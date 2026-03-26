import { randomUUID } from "node:crypto";

import {
  addPartyMember,
  createAdventureRun,
  createAuditLog,
  createEncounter,
  createEncounterEvent,
  createEncounterParticipant,
  createInventoryItem,
  createParty,
  createRunReward,
  equipInventoryItemForCharacter,
  createRunChoice,
  createRunFloor,
  createRunRoom,
  ensureRulesVersion,
  getActivePartyForUser,
  getAdventureRunById,
  getCharacterById,
  getEligibleCharacterByUserId,
  getEncounterById,
  getInventoryItemById,
  getLatestAdventureRunForUser,
  getPartyById,
  getPartyMemberByPartyAndUser,
  getRunRoomDetailById,
  getUserById,
  incrementCharacterCrawlerXp,
  listEquipmentLoadoutsForCharacter,
  listEncountersForRun,
  listInventoryItemsForCharacter,
  listLootTemplates,
  listMonsterTemplates,
  listPartyMemberDetails,
  listRunRewardsForEncounter,
  listRunRewardsForRoom,
  listRunRoomDetails,
  setPartyMemberLeft,
  setPartyMemberReadyState,
  setPartyMemberStatus,
  unequipInventoryItemForCharacter,
  updateEncounter,
  updateAdventureRun,
  updateInventoryItemStatus,
  updateParty,
  updateRunRoom,
  upsertOwnedInventoryStack,
  upsertLootTemplate,
  upsertMonsterTemplate,
  upsertTelegramUser,
  type AdventureRunRecord,
  type CharacterRecord,
  type EquipmentLoadoutDetailRecord,
  type EncounterParticipantRecord,
  type InventoryItemRecord,
  type LootTemplateRecord,
  type PartyMemberDetailRecord,
  type PartyRecord,
  type RunRoomDetailRecord,
  type RunRewardRecord,
} from "@dm-bot/db";
import {
  crawlerContentVersion,
  generateEncounterRewards,
  generateRoomRewards,
  generateRun,
  getLootTemplateByKey,
  getMonsterTemplateByKey,
  type GeneratedRun,
  type GeneratedRoom,
  type LootTemplateSeed,
  type MonsterTemplateSeed,
  type CrawlerRoomType,
  starterLootTemplates,
  starterMonsterTemplates,
} from "@dm-bot/crawler-generation";
import {
  initializeEncounterState,
  resolveEncounterRound,
  resolveRetreatAttempt,
  type EncounterEvent,
  type EncounterParticipant,
  type EncounterState,
  type EncounterResolutionResult,
} from "@dm-bot/crawler-engine";

export type CrawlerOutboundMessage = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

export type CrawlerCommandResult = {
  alertText?: string;
  message?: CrawlerOutboundMessage;
};

export type TelegramActor = {
  telegramUserId: string;
  telegramUsername?: string | undefined;
  telegramFirstName?: string | undefined;
  telegramLastName?: string | undefined;
};

export type CrawlerRunSurface = "group" | "dm";

export type CrawlerPartyEligibility = {
  userStatus: "active" | "suspended";
  characterStatus: "active" | "frozen" | "retired";
  alreadyInActiveRun: boolean;
};

export type CrawlerPartyStartCheck = {
  memberCount: number;
  readyMemberCount: number;
  minimumMembers?: number;
  maximumMembers?: number;
};

const ACTIVE_PARTY_MEMBER_STATUSES = new Set<PartyMemberDetailRecord["status"]>(["joined", "ready"]);
let crawlerContentSeeded = false;

export function isEligibleForCrawlerParty(input: CrawlerPartyEligibility): boolean {
  return (
    input.userStatus === "active" &&
    input.characterStatus === "active" &&
    input.alreadyInActiveRun === false
  );
}

export function canStartCrawlerParty(input: CrawlerPartyStartCheck): boolean {
  const minimumMembers = input.minimumMembers ?? 1;
  const maximumMembers = input.maximumMembers ?? 4;

  return (
    input.memberCount >= minimumMembers &&
    input.memberCount <= maximumMembers &&
    input.readyMemberCount === input.memberCount
  );
}

function displayName(actor: TelegramActor) {
  const name = [actor.telegramFirstName, actor.telegramLastName].filter(Boolean).join(" ").trim();

  return name || actor.telegramUsername || `telegram-${actor.telegramUserId}`;
}

async function ensureUser(actor: TelegramActor) {
  return upsertTelegramUser({
    telegramUserId: actor.telegramUserId,
    telegramUsername: actor.telegramUsername,
    telegramFirstName: actor.telegramFirstName,
    telegramLastName: actor.telegramLastName,
    displayName: displayName(actor),
  });
}

function restrictedUserMessage() {
  return "Your crawler access is currently restricted. Please contact an administrator if you believe this is a mistake.";
}

function createPartyButtons() {
  return {
    inline_keyboard: [[{ text: "Create Party", callback_data: "crawler:party:create" }]],
  };
}

function activeMembers(members: PartyMemberDetailRecord[]) {
  return members.filter((member) => ACTIVE_PARTY_MEMBER_STATUSES.has(member.status));
}

function partyStatusForMembers(members: PartyMemberDetailRecord[]): PartyRecord["status"] {
  const currentMembers = activeMembers(members);

  if (currentMembers.length === 0) {
    return "cancelled";
  }

  const readyCount = currentMembers.filter((member) => member.status === "ready").length;
  return canStartCrawlerParty({
    memberCount: currentMembers.length,
    readyMemberCount: readyCount,
  })
    ? "ready"
    : "forming";
}

async function syncPartyStatus(partyId: string) {
  const members = await listPartyMemberDetails(partyId);
  const nextStatus = partyStatusForMembers(members);
  await updateParty({
    partyId,
    status: nextStatus,
  });
}

function lootEquipmentSlot(template: LootTemplateSeed) {
  return template.equipmentSlot ?? null;
}

function lootEffectData(template: LootTemplateSeed) {
  switch (template.key) {
    case "balanced_longsword":
      return {
        summary: template.effectSummary,
        attackBonus: 1,
        applicableClasses: ["fighter", "rogue"],
      };
    case "ashen_wand":
      return {
        summary: template.effectSummary,
        attackBonus: 1,
        applicableClasses: ["wizard", "cleric"],
      };
    case "reinforced_chain":
      return {
        summary: template.effectSummary,
        armorClassBonus: 1,
        applicableClasses: ["fighter", "cleric"],
      };
    case "iron_charm":
      return {
        summary: template.effectSummary,
        maxHpBonus: 2,
      };
    case "flash_powder":
      return {
        summary: template.effectSummary,
        initiativeBonus: 3,
      };
    case "stoneskin_tonic":
      return {
        summary: template.effectSummary,
        armorClassBonus: 2,
      };
    case "arcane_draught":
      return {
        summary: template.effectSummary,
        attackBonus: 2,
        applicableClasses: ["wizard", "cleric"],
      };
    default:
      return {
        summary: template.effectSummary,
      };
  }
}

async function ensureCrawlerContent() {
  if (crawlerContentSeeded) {
    return;
  }

  for (const template of starterMonsterTemplates) {
    await upsertMonsterTemplate({
      templateKey: template.key,
      displayName: template.name,
      themeKey: template.themeKey,
      roleKey: template.role,
      pointValue: template.pointValue,
      statBlock: {
        armorClass: template.armorClass,
        hitPoints: template.hitPoints,
        initiativeModifier: template.initiativeModifier,
        attackModifier: template.attackModifier,
        damageDiceCount: template.damageDiceCount,
        damageDieSides: template.damageDieSides,
        damageModifier: template.damageModifier,
      },
      aiProfile: {},
      rewards: {},
      contentVersion: crawlerContentVersion,
    });
  }

  for (const template of starterLootTemplates) {
    await upsertLootTemplate({
      templateKey: template.key,
      displayName: template.name,
      categoryKey: template.category,
      rarityKey: template.rarity,
      equipmentSlot: lootEquipmentSlot(template),
      isPermanent: template.isPermanent,
      effectData: lootEffectData(template),
      dropRules: {},
      contentVersion: crawlerContentVersion,
    });
  }

  crawlerContentSeeded = true;
}

function formatPartyLobby(
  party: PartyRecord,
  members: PartyMemberDetailRecord[],
  leaderDisplayName: string,
) {
  const currentMembers = activeMembers(members);
  const readyCount = currentMembers.filter((member) => member.status === "ready").length;
  const allReady = canStartCrawlerParty({
    memberCount: currentMembers.length,
    readyMemberCount: readyCount,
  });

  const lines = [
    "Crawler Party Lobby",
    "",
    `Leader: ${leaderDisplayName}`,
    `Status: ${party.status.replaceAll("_", " ")}`,
    `Members: ${currentMembers.length}/4`,
    "",
    ...currentMembers.map((member, index) => {
      const handle = member.telegram_username ? `@${member.telegram_username}` : member.user_display_name;
      const marker = member.status === "ready" ? "ready" : "waiting";
      return `${index + 1}. ${member.character_name} (${member.class_key}) - ${handle} - ${marker}`;
    }),
  ];

  if (party.status === "in_run" && party.active_run_id) {
    lines.push("");
    lines.push(`Active run: ${party.active_run_id}`);
    lines.push("This party has already entered the dungeon.");
  } else {
    lines.push("");
    lines.push(allReady ? "Everyone is ready. The leader can start the run." : "Ready up when your character is prepared.");
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (party.status !== "in_run") {
    buttons.push([{ text: "Join Party", callback_data: `crawler:party:join:${party.id}` }]);
    buttons.push([{ text: "Ready Up / Not Ready", callback_data: `crawler:party:ready:${party.id}` }]);
    buttons.push([{ text: "Leave Party", callback_data: `crawler:party:leave:${party.id}` }]);

    if (allReady) {
      buttons.push([{ text: "Start Run", callback_data: `crawler:party:start:${party.id}` }]);
    }
  }

  return {
    text: lines.join("\n"),
    ...(buttons.length > 0 ? { replyMarkup: { inline_keyboard: buttons } } : {}),
  } satisfies CrawlerOutboundMessage;
}

function roomActionLabel(roomType: RunRoomDetailRecord["room_type"]) {
  switch (roomType) {
    case "combat":
      return "Engage Foes";
    case "elite_combat":
      return "Engage Elite";
    case "treasure":
      return "Open Cache";
    case "event":
      return "Investigate";
    case "rest":
      return "Take Rest";
    case "boss":
      return "Confront Boss";
  }
}

function isEncounterRoom(roomType: RunRoomDetailRecord["room_type"]) {
  return roomType === "combat" || roomType === "elite_combat" || roomType === "boss";
}

type EquipmentEffect = {
  attackBonus: number;
  armorClassBonus: number;
  maxHpBonus: number;
  initiativeBonus: number;
};

type RunEffectRecord = {
  key: string;
  label: string;
  summary: string;
  applicableClasses?: string[];
  attackBonus?: number;
  armorClassBonus?: number;
  maxHpBonus?: number;
  initiativeBonus?: number;
};

type RunCombatHitPointRecord = Record<string, number>;

type PersistedEncounterState = {
  roomType?: string;
  state?: EncounterState;
  fallbackRoomId?: string | null;
  retreatVotes?: string[];
  nextSequenceNumber?: number;
};

function appliesToClass(effectData: Record<string, unknown> | null, classKey: string) {
  const applicableClasses = effectData?.applicableClasses;

  if (!Array.isArray(applicableClasses) || applicableClasses.length === 0) {
    return true;
  }

  return applicableClasses.includes(classKey);
}

function extractEquipmentEffect(
  loadouts: EquipmentLoadoutDetailRecord[],
  classKey: string,
) {
  return loadouts.reduce<EquipmentEffect>((totals, loadout) => {
    const effectData = loadout.effect_data;

    if (!effectData || !appliesToClass(effectData, classKey)) {
      return totals;
    }

    return {
      attackBonus: totals.attackBonus + (typeof effectData.attackBonus === "number" ? effectData.attackBonus : 0),
      armorClassBonus: totals.armorClassBonus + (typeof effectData.armorClassBonus === "number" ? effectData.armorClassBonus : 0),
      maxHpBonus: totals.maxHpBonus + (typeof effectData.maxHpBonus === "number" ? effectData.maxHpBonus : 0),
      initiativeBonus: totals.initiativeBonus + (typeof effectData.initiativeBonus === "number" ? effectData.initiativeBonus : 0),
    };
  }, {
    attackBonus: 0,
    armorClassBonus: 0,
    maxHpBonus: 0,
    initiativeBonus: 0,
  });
}

function getActiveRunEffects(run: AdventureRunRecord): RunEffectRecord[] {
  const activeEffects = run.summary?.activeEffects;

  if (!Array.isArray(activeEffects)) {
    return [];
  }

  return activeEffects.filter((effect): effect is RunEffectRecord => {
    return typeof effect === "object" && effect !== null && typeof effect.key === "string" && typeof effect.label === "string";
  });
}

function summarizeRunEffects(effects: RunEffectRecord[]) {
  return effects.map((effect) => `${effect.label}: ${effect.summary}`);
}

function buildRunSummary(
  run: AdventureRunRecord,
  overrides: Record<string, unknown> = {},
  activeEffects?: RunEffectRecord[],
) {
  const summary = { ...(run.summary ?? {}) };

  if (activeEffects !== undefined) {
    summary.activeEffects = activeEffects;
  }

  return {
    ...summary,
    ...overrides,
  };
}

function getRunHitPoints(run: AdventureRunRecord): RunCombatHitPointRecord {
  const stored = run.summary?.partyHitPoints;

  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stored).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

function updateRunHitPoints(
  run: AdventureRunRecord,
  finalParticipants: Array<{ id: string; currentHitPoints: number }>,
  members: PartyMemberDetailRecord[],
) {
  const next = { ...getRunHitPoints(run) };

  for (const member of members) {
    const participant = finalParticipants.find((candidate) => candidate.id.endsWith(member.character_id));

    if (participant) {
      next[member.character_id] = participant.currentHitPoints;
    }
  }

  return next;
}

function getEncounterStateSnapshot(snapshot: Record<string, unknown>): PersistedEncounterState | null {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as PersistedEncounterState;
}

function chooseRoomEffect(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
): RunEffectRecord | null {
  const seed = `${run.seed}:${room.id}`;
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  if (room.room_type === "rest") {
    return {
      key: "fortified_rest",
      label: "Fortified Rest",
      summary: "+2 max HP in the next encounter.",
      maxHpBonus: 2,
    };
  }

  if (room.room_type === "event") {
    return hash % 2 === 0
      ? {
        key: "quickened_steps",
        label: "Quickened Steps",
        summary: "+2 initiative in the next encounter.",
        initiativeBonus: 2,
      }
      : {
        key: "omens_of_war",
        label: "Omens of War",
        summary: "+1 attack in the next encounter.",
        attackBonus: 1,
      };
  }

  return null;
}

function consumableEffectForTemplateKey(templateKey: string): RunEffectRecord | null {
  switch (templateKey) {
    case "minor_healing_potion":
      return {
        key: "minor_healing_potion",
        label: "Mending Draught",
        summary: "+3 max HP in the next encounter.",
        maxHpBonus: 3,
      };
    case "flash_powder":
      return {
        key: "flash_powder",
        label: "Flash Powder",
        summary: "+3 initiative in the next encounter.",
        initiativeBonus: 3,
      };
    case "stoneskin_tonic":
      return {
        key: "stoneskin_tonic",
        label: "Stoneskin Tonic",
        summary: "+2 AC in the next encounter.",
        armorClassBonus: 2,
      };
    case "arcane_draught":
      return {
        key: "arcane_draught",
        label: "Arcane Draught",
        summary: "+2 attack for wizard or cleric actions in the next encounter.",
        applicableClasses: ["wizard", "cleric"],
        attackBonus: 2,
      };
    default:
      return null;
  }
}

async function grantInventoryReward(params: {
  userId: string;
  characterId: string;
  lootTemplate: LootTemplateRecord;
  quantity: number;
  metadata: Record<string, unknown>;
}) {
  if (params.lootTemplate.category_key === "currency") {
    return upsertOwnedInventoryStack({
      userId: params.userId,
      characterId: params.characterId,
      lootTemplateId: params.lootTemplate.id,
      quantity: params.quantity,
      metadata: params.metadata,
    });
  }

  return createInventoryItem({
    userId: params.userId,
    characterId: params.characterId,
    lootTemplateId: params.lootTemplate.id,
    quantity: params.quantity,
    metadata: params.metadata,
  });
}

function toPlayerEncounterParticipant(
  member: PartyMemberDetailRecord,
  character: CharacterRecord,
  loadouts: EquipmentLoadoutDetailRecord[],
  runEffects: RunEffectRecord[],
  runHitPoints: RunCombatHitPointRecord,
  slot: number,
): EncounterParticipant {
  const derived = character.derived_stats as { maxHp?: number; armorClass?: number; initiativeMod?: number };
  const defaultProfile: Pick<
    EncounterParticipant,
    "attackModifier" | "damageDiceCount" | "damageDieSides" | "damageModifier"
  > = {
    attackModifier: 5,
    damageDiceCount: 1,
    damageDieSides: 8,
    damageModifier: 3,
  };

  const profileByClass: Record<
    string,
    Pick<EncounterParticipant, "attackModifier" | "damageDiceCount" | "damageDieSides" | "damageModifier">
  > = {
    fighter: defaultProfile,
    rogue: { attackModifier: 5, damageDiceCount: 1, damageDieSides: 8, damageModifier: 3 },
    wizard: { attackModifier: 5, damageDiceCount: 1, damageDieSides: 10, damageModifier: 0 },
    cleric: { attackModifier: 5, damageDiceCount: 1, damageDieSides: 8, damageModifier: 3 },
  };
  const profile: Pick<
    EncounterParticipant,
    "attackModifier" | "damageDiceCount" | "damageDieSides" | "damageModifier"
  > = profileByClass[character.class_key] ?? defaultProfile;
  const equipmentEffect = extractEquipmentEffect(loadouts, character.class_key);
  const runEffectTotals = runEffects.reduce<EquipmentEffect>((totals, effect) => {
    if (effect.applicableClasses && !effect.applicableClasses.includes(character.class_key)) {
      return totals;
    }

    return {
      attackBonus: totals.attackBonus + (effect.attackBonus ?? 0),
      armorClassBonus: totals.armorClassBonus + (effect.armorClassBonus ?? 0),
      maxHpBonus: totals.maxHpBonus + (effect.maxHpBonus ?? 0),
      initiativeBonus: totals.initiativeBonus + (effect.initiativeBonus ?? 0),
    };
  }, {
    attackBonus: 0,
    armorClassBonus: 0,
    maxHpBonus: 0,
    initiativeBonus: 0,
  });
  const maxHitPoints = (derived.maxHp ?? 1) + equipmentEffect.maxHpBonus;
  const effectiveMaxHp = maxHitPoints + runEffectTotals.maxHpBonus;
  const currentHitPoints = Math.max(0, Math.min(runHitPoints[character.id] ?? effectiveMaxHp, effectiveMaxHp));

  return {
    id: `player-${slot}-${character.id}`,
    name: character.name,
    side: "player",
    initiativeModifier: (derived.initiativeMod ?? 0) + runEffectTotals.initiativeBonus,
    armorClass: (derived.armorClass ?? 10) + equipmentEffect.armorClassBonus + runEffectTotals.armorClassBonus,
    hitPoints: currentHitPoints,
    maxHitPoints: effectiveMaxHp,
    attackModifier: profile.attackModifier + equipmentEffect.attackBonus + runEffectTotals.attackBonus,
    damageDiceCount: profile.damageDiceCount,
    damageDieSides: profile.damageDieSides,
    damageModifier: profile.damageModifier,
  };
}

function toMonsterEncounterParticipant(
  template: MonsterTemplateSeed,
  slot: number,
): EncounterParticipant {
  return {
    id: `monster-${slot}-${template.key}`,
    name: template.name,
    side: "monster",
    initiativeModifier: template.initiativeModifier,
    armorClass: template.armorClass,
    hitPoints: template.hitPoints,
    maxHitPoints: template.hitPoints,
    attackModifier: template.attackModifier,
    damageDiceCount: template.damageDiceCount,
    damageDieSides: template.damageDieSides,
    damageModifier: template.damageModifier,
  };
}

function formatEncounterLog(events: EncounterEvent[]) {
  return events.map((event) => `- ${event.summary}`);
}

function summarizeEncounterSide(
  participants: Array<{ name: string; side: "player" | "monster"; currentHitPoints: number; maxHitPoints: number }>,
  side: "player" | "monster",
) {
  return participants
    .filter((participant) => participant.side === side)
    .map((participant) => `- ${participant.name} ${participant.currentHitPoints}/${participant.maxHitPoints}`);
}

function roomResolutionLead(roomType: RunRoomDetailRecord["room_type"]) {
  switch (roomType) {
    case "treasure":
      return "The party cracks open a hidden cache and banks the spoils.";
    case "event":
      return "The party weathers the chamber's strange event and comes away with something to show for it.";
    case "rest":
      return "The party gathers themselves in a rare calm and secures a few useful supplies.";
    default:
      return "The room has been resolved.";
  }
}

type GrantedRewardSummary = {
  rewardRows: RunRewardRecord[];
  summaryLines: string[];
};

export type EncounterXpAward = {
  characterId: string;
  characterName: string;
  xpGranted: number;
  totalXp: number;
  crawlerLevel: number;
};

export function encounterXpForRoomType(roomType: RunRoomDetailRecord["room_type"]) {
  switch (roomType) {
    case "combat":
      return 25;
    case "elite_combat":
      return 50;
    case "boss":
      return 100;
    default:
      return 0;
  }
}

export function buildEncounterXpRecipients(params: {
  members: PartyMemberDetailRecord[];
  finalParticipants: EncounterResolutionResult["finalParticipants"];
  xpPerSurvivor: number;
}) {
  if (params.xpPerSurvivor <= 0) {
    return [];
  }

  return activeMembers(params.members).flatMap((member) => {
    const finalParticipant = params.finalParticipants.find((participant) => participant.id.endsWith(member.character_id));

    if (!finalParticipant || finalParticipant.currentHitPoints <= 0) {
      return [];
    }

    return [{
      characterId: member.character_id,
      userId: member.user_id,
      characterName: member.character_name,
      xpGranted: params.xpPerSurvivor,
    }];
  });
}

function summarizeRewardRows(rewardRows: RunRewardRecord[]) {
  const byRecipient = new Map<string, string[]>();

  for (const row of rewardRows) {
    const recipientName = typeof row.reward_payload.recipientName === "string"
      ? row.reward_payload.recipientName
      : "Unknown adventurer";
    const itemName = typeof row.reward_payload.itemName === "string"
      ? row.reward_payload.itemName
      : "Unknown reward";
    const quantity = typeof row.reward_payload.quantity === "number" ? row.reward_payload.quantity : row.quantity;
    const label = quantity > 1 ? `${itemName} x${quantity}` : itemName;

    const existing = byRecipient.get(recipientName) ?? [];
    existing.push(label);
    byRecipient.set(recipientName, existing);
  }

  return [...byRecipient.entries()].map(([recipientName, rewards]) => `- ${recipientName}: ${rewards.join(", ")}`);
}

function summarizeEncounterXpAwards(xpAwards: EncounterXpAward[]) {
  return xpAwards.map((award) => `- ${award.characterName}: +${award.xpGranted} XP (${award.totalXp} total)`);
}

function formatEncounterVictoryMessage(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  result: EncounterResolutionResult,
  rewards: GrantedRewardSummary,
  xpAwards: EncounterXpAward[],
  next: RunRoomDetailRecord | null,
  memberCount: number,
) {
  const finalSummary = result.finalParticipants
    .map((participant) => `${participant.name} ${participant.currentHitPoints}/${participant.maxHitPoints}`)
    .join(" | ");

  const lines = [
    `Encounter Resolved: ${room.room_type.replaceAll("_", " ")}`,
    "",
    `Run ID: ${run.id}`,
    `Theme: ${run.theme_key ?? "unknown"}`,
    `Rounds: ${result.roundsCompleted}`,
    `Final status: ${finalSummary}`,
    "",
    "Rewards",
    ...(rewards.summaryLines.length > 0 ? rewards.summaryLines : ["- No rewards granted."]),
  ];

  if (xpAwards.length > 0) {
    lines.push("");
    lines.push("Experience");
    lines.push(...summarizeEncounterXpAwards(xpAwards));
  }

  lines.push("");
  lines.push("Combat Log");
  lines.push(...formatEncounterLog(result.events));

  if (next) {
    const prompt = next.prompt_payload as { title?: string; description?: string; roomType?: string };
    lines.push("");
    lines.push("Next Room");
    lines.push(prompt.title ?? `Floor ${next.floor_number}, Room ${next.room_number}`);
    lines.push(prompt.description ?? "A new chamber lies ahead.");
    lines.push(`Room type: ${(prompt.roomType ?? next.room_type).replaceAll("_", " ")}`);

    return {
      text: lines.join("\n"),
      replyMarkup: {
        inline_keyboard: [[{
          text: roomActionLabel(next.room_type),
          callback_data: `crawler:run:proceed:${next.id}`,
        }]],
      },
    } satisfies CrawlerOutboundMessage;
  }

  lines.push("");
  lines.push(`The party of ${memberCount} clears the final chamber.`);

  return {
    text: lines.join("\n"),
  } satisfies CrawlerOutboundMessage;
}

function formatRoomRewardMessage(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  rewards: GrantedRewardSummary,
  gainedEffect: RunEffectRecord | null,
  next: RunRoomDetailRecord | null,
  memberCount: number,
) {
  const prompt = next
    ? next.prompt_payload as { title?: string; description?: string; roomType?: string }
    : null;
  const lines = [
    `Room Resolved: ${room.room_type.replaceAll("_", " ")}`,
    "",
    `Run ID: ${run.id}`,
    `Theme: ${run.theme_key ?? "unknown"}`,
    `Party size: ${memberCount}`,
    roomResolutionLead(room.room_type),
    "",
    "Rewards",
    ...(rewards.summaryLines.length > 0 ? rewards.summaryLines : ["- No rewards granted."]),
  ];

  if (gainedEffect) {
    lines.push("");
    lines.push("Boon");
    lines.push(`- ${gainedEffect.label}: ${gainedEffect.summary}`);
  }

  if (next && prompt) {
    lines.push("");
    lines.push("Next Room");
    lines.push(prompt.title ?? `Floor ${next.floor_number}, Room ${next.room_number}`);
    lines.push(prompt.description ?? "A new chamber lies ahead.");
    lines.push(`Room type: ${(prompt.roomType ?? next.room_type).replaceAll("_", " ")}`);

    return {
      text: lines.join("\n"),
      replyMarkup: {
        inline_keyboard: [[{
          text: roomActionLabel(next.room_type),
          callback_data: `crawler:run:proceed:${next.id}`,
        }]],
      },
    } satisfies CrawlerOutboundMessage;
  }

  lines.push("");
  lines.push(`The party of ${memberCount} clears the final chamber.`);

  return {
    text: lines.join("\n"),
  } satisfies CrawlerOutboundMessage;
}

function formatEncounterDefeatMessage(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  result: EncounterResolutionResult,
) {
  const finalSummary = result.finalParticipants
    .map((participant) => `${participant.name} ${participant.currentHitPoints}/${participant.maxHitPoints}`)
    .join(" | ");

  return {
    text: [
      "Encounter Lost",
      "",
      `Run ID: ${run.id}`,
      `Theme: ${run.theme_key ?? "unknown"}`,
      `Defeat in: Floor ${room.floor_number}, Room ${room.room_number}`,
      `Rounds: ${result.roundsCompleted}`,
      `Final status: ${finalSummary}`,
      "",
      "Combat Log",
      ...formatEncounterLog(result.events),
      "",
      "The run has failed. Your character survives outside the run, but this expedition is over.",
    ].join("\n"),
  } satisfies CrawlerOutboundMessage;
}

function formatEncounterActionPrompt(params: {
  run: AdventureRunRecord;
  room: RunRoomDetailRecord;
  encounterId: string;
  state: EncounterState;
  retreatVotes: string[];
  members: PartyMemberDetailRecord[];
}) {
  const playerLines = summarizeEncounterSide(params.state.participants, "player");
  const monsterLines = summarizeEncounterSide(params.state.participants, "monster");

  return {
    text: [
      `Encounter Engaged: ${params.room.room_type.replaceAll("_", " ")}`,
      "",
      `Run ID: ${params.run.id}`,
      `Theme: ${params.run.theme_key ?? "unknown"}`,
      `Round: ${params.state.nextRound}`,
      `Retreat votes: ${params.retreatVotes.length}/${activeMembers(params.members).length}`,
      "",
      "Party",
      ...(playerLines.length > 0 ? playerLines : ["- No surviving party members."]),
      "",
      "Enemies",
      ...(monsterLines.length > 0 ? monsterLines : ["- No surviving enemies."]),
      "",
      "Choose whether to press the attack or attempt a full-party retreat.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "Attack", callback_data: `crawler:encounter:attack:${params.encounterId}:${params.state.nextRound}` }],
        [{ text: "Vote Retreat", callback_data: `crawler:encounter:retreat:${params.encounterId}:${params.state.nextRound}` }],
      ],
    },
  } satisfies CrawlerOutboundMessage;
}

function formatEncounterRoundMessage(params: {
  run: AdventureRunRecord;
  room: RunRoomDetailRecord;
  encounterId: string;
  state: EncounterState;
  retreatVotes: string[];
  members: PartyMemberDetailRecord[];
  events: EncounterEvent[];
}) {
  const lines = [
    `Encounter Round ${Math.max(1, params.state.nextRound - 1)}`,
    "",
    ...formatEncounterLog(params.events),
    "",
    ...formatEncounterActionPrompt(params).text.split("\n"),
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: formatEncounterActionPrompt(params).replyMarkup,
  } satisfies CrawlerOutboundMessage;
}

function formatRetreatVoteMessage(params: {
  run: AdventureRunRecord;
  room: RunRoomDetailRecord;
  encounterId: string;
  state: EncounterState;
  retreatVotes: string[];
  members: PartyMemberDetailRecord[];
}) {
  const voters = activeMembers(params.members)
    .filter((member) => params.retreatVotes.includes(member.user_id))
    .map((member) => member.character_name);

  const prompt = formatEncounterActionPrompt(params);
  return {
    text: [
      "Retreat Vote Updated",
      "",
      voters.length > 0 ? `Votes: ${voters.join(", ")}` : "No retreat votes recorded yet.",
      "",
      prompt.text,
    ].join("\n"),
    replyMarkup: prompt.replyMarkup,
  } satisfies CrawlerOutboundMessage;
}

function formatRetreatSuccessMessage(params: {
  run: AdventureRunRecord;
  room: RunRoomDetailRecord;
  fallbackRoom: RunRoomDetailRecord | null;
  events: EncounterEvent[];
  state: EncounterState;
  encounterId: string;
}) {
  const playerLines = summarizeEncounterSide(params.state.participants, "player");
  const buttons = params.fallbackRoom
    ? {
      inline_keyboard: [[{
        text: "Re-enter Encounter",
        callback_data: `crawler:encounter:resume:${params.encounterId}:${params.room.id}`,
      }]],
    }
    : undefined;

  return {
    text: [
      "Retreat Successful",
      "",
      ...formatEncounterLog(params.events),
      "",
      ...(params.fallbackRoom
        ? [
          `The party falls back to Floor ${params.fallbackRoom.floor_number}, Room ${params.fallbackRoom.room_number}.`,
          "Current HP",
          ...playerLines,
        ]
        : [
          "The party escapes the dungeon entrance, but the run is over.",
          "Current HP",
          ...playerLines,
        ]),
    ].join("\n"),
    ...(buttons ? { replyMarkup: buttons } : {}),
  } satisfies CrawlerOutboundMessage;
}

function formatActiveRoomPrompt(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  memberCount: number,
  members: PartyMemberDetailRecord[],
  surface: CrawlerRunSurface,
) {
  const prompt = room.prompt_payload as {
    title?: string;
    description?: string;
    roomType?: string;
    templateKey?: string;
  };

  const presentation = describeRunPresentationState({
    runStatus: run.status,
    roomStatus: room.status,
    roomResolvedAt: room.resolved_at,
    surface,
    hasCurrentRoom: true,
  });

  const lines = [
    presentation.heading,
    "",
    `Run ID: ${run.id}`,
    `Theme: ${run.theme_key ?? "unknown"}`,
    `Run status: ${run.status.replaceAll("_", " ")}`,
    `Current room: Floor ${room.floor_number}, Room ${room.room_number}`,
    `Party size: ${memberCount}`,
    "",
    "Party",
    ...formatPartyRoster(members),
    "",
    presentation.actionLine,
    "",
    prompt.title ?? `Floor ${room.floor_number}, Room ${room.room_number}`,
    prompt.description ?? "A new chamber lies ahead.",
    `Room type: ${(prompt.roomType ?? room.room_type).replaceAll("_", " ")}`,
  ];
  const activeEffects = getActiveRunEffects(run);

  if (activeEffects.length > 0) {
    lines.push("");
    lines.push("Active boons");
    lines.push(...summarizeRunEffects(activeEffects).map((summary) => `- ${summary}`));
  }

  return {
    text: lines.join("\n"),
    ...(presentation.buttonAllowed
      ? {
        replyMarkup: {
          inline_keyboard: [[{
            text: roomActionLabel(room.room_type),
            callback_data: `crawler:run:proceed:${room.id}`,
          }]],
        },
      }
      : {}),
  } satisfies CrawlerOutboundMessage;
}

function formatRunCompleteMessage(run: AdventureRunRecord, room: RunRoomDetailRecord, memberCount: number) {
  return {
    text: [
      "Crawler Run Complete",
      "",
      `Run ID: ${run.id}`,
      `Theme: ${run.theme_key ?? "unknown"}`,
      `Party size: ${memberCount}`,
      "",
      `The party cleared Floor ${room.floor_number}, Room ${room.room_number} and emerged from the dungeon.`,
      "The run is complete and any banked rewards remain in your inventory.",
    ].join("\n"),
  } satisfies CrawlerOutboundMessage;
}

function formatRunFailedMessage(run: AdventureRunRecord, room: RunRoomDetailRecord, memberCount: number) {
  return {
    text: [
      "Crawler Run Failed",
      "",
      `Run ID: ${run.id}`,
      `Theme: ${run.theme_key ?? "unknown"}`,
      `Party size: ${memberCount}`,
      "",
      `The party fell in Floor ${room.floor_number}, Room ${room.room_number}.`,
      run.failure_reason ?? "The expedition has ended in defeat.",
    ].join("\n"),
  } satisfies CrawlerOutboundMessage;
}

type RunPresentationState = {
  heading: string;
  actionLine: string;
  actionable: boolean;
  buttonAllowed: boolean;
  showRoomPrompt: boolean;
};

export function describeRunPresentationState(params: {
  runStatus: AdventureRunRecord["status"];
  roomStatus: RunRoomDetailRecord["status"] | null;
  roomResolvedAt: Date | null;
  surface: CrawlerRunSurface;
  hasCurrentRoom: boolean;
}): RunPresentationState {
  if (params.runStatus === "completed") {
    return {
      heading: "Crawler Run Complete",
      actionLine: "This run is finished and cannot be resumed.",
      actionable: false,
      buttonAllowed: false,
      showRoomPrompt: false,
    };
  }

  if (params.runStatus === "failed") {
    return {
      heading: "Crawler Run Failed",
      actionLine: "This run has already ended in defeat and cannot be resumed.",
      actionable: false,
      buttonAllowed: false,
      showRoomPrompt: false,
    };
  }

  if (
    params.runStatus === "awaiting_choice" &&
    params.hasCurrentRoom &&
    params.roomStatus === "active" &&
    params.roomResolvedAt === null
  ) {
    return {
      heading: "Crawler Run",
      actionLine: params.surface === "group"
        ? "Action: awaiting room input from the party."
        : "Action: awaiting room input. Open the group chat with the bot to continue this room.",
      actionable: true,
      buttonAllowed: params.surface === "group",
      showRoomPrompt: true,
    };
  }

  return {
    heading: "Crawler Run",
    actionLine: "This run is not awaiting room input right now. No room action is available from /run.",
    actionable: false,
    buttonAllowed: false,
    showRoomPrompt: false,
  };
}

export function buildPartyLobbyButtonLabels(params: {
  partyStatus: PartyRecord["status"];
  allReady: boolean;
}) {
  if (params.partyStatus === "in_run") {
    return [];
  }

  const labels = ["Join Party", "Ready Up / Not Ready", "Leave Party"];

  if (params.allReady) {
    labels.push("Start Run");
  }

  return labels;
}

function formatPartyRoster(members: PartyMemberDetailRecord[]) {
  const currentMembers = activeMembers(members);

  if (currentMembers.length === 0) {
    return ["No active party members found."];
  }

  return currentMembers.map((member, index) => {
    const handle = member.telegram_username ? `@${member.telegram_username}` : member.user_display_name;
    return `${index + 1}. ${member.character_name} (${member.class_key}) - ${handle} - ${member.status}`;
  });
}

function formatInventoryMessage(
  character: CharacterRecord,
  inventoryItems: Awaited<ReturnType<typeof listInventoryItemsForCharacter>>,
  lootTemplates: LootTemplateRecord[],
): CrawlerOutboundMessage {
  const lootById = new Map(lootTemplates.map((template) => [template.id, template]));

  const lines = [
    "Crawler Inventory",
    "",
    `Character: ${character.name} (${character.class_key})`,
    "",
  ];

  if (inventoryItems.length === 0) {
    lines.push("No crawler loot owned yet.");
    lines.push("Win encounters in the dungeon to start banking rewards.");
    return { text: lines.join("\n") };
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const item of inventoryItems.slice(0, 20)) {
    const template = item.loot_template_id ? lootById.get(item.loot_template_id) : null;
    const name = template?.display_name ?? "Unknown item";
    const quantity = item.quantity > 1 ? ` x${item.quantity}` : "";
    const rarity = template?.rarity_key ? ` (${template.rarity_key})` : "";
    lines.push(`- ${name}${quantity}${rarity} [${item.status}]`);

    if (template?.category_key === "consumable" && item.status === "owned") {
      buttons.push([{
        text: `Use ${template.display_name}`,
        callback_data: `crawler:inventory:use:${item.id}`,
      }]);
    }
  }

  if (inventoryItems.length > 20) {
    lines.push("");
    lines.push(`Showing 20 of ${inventoryItems.length} items.`);
  }

  return {
    text: lines.join("\n"),
    ...(buttons.length > 0 ? { replyMarkup: { inline_keyboard: buttons.slice(0, 8) } } : {}),
  };
}

function formatEquipmentMessage(
  character: CharacterRecord,
  inventoryItems: InventoryItemRecord[],
  lootTemplates: LootTemplateRecord[],
  loadouts: EquipmentLoadoutDetailRecord[],
): CrawlerOutboundMessage {
  const lootById = new Map(lootTemplates.map((template) => [template.id, template]));
  const equippedBySlot = new Map(loadouts.map((loadout) => [loadout.slot, loadout]));
  const equipableItems = inventoryItems.filter((item) => {
    const template = item.loot_template_id ? lootById.get(item.loot_template_id) : null;
    return Boolean(template?.equipment_slot) && (item.status === "owned" || item.status === "equipped");
  });

  const lines = [
    "Crawler Equipment",
    "",
    `Character: ${character.name} (${character.class_key})`,
    "",
    "Equipped",
    `Weapon: ${equippedBySlot.get("weapon")?.loot_display_name ?? "None"}`,
    `Armor: ${equippedBySlot.get("armor")?.loot_display_name ?? "None"}`,
    `Accessory: ${equippedBySlot.get("accessory")?.loot_display_name ?? "None"}`,
    "",
    "Available Gear",
  ];

  if (equipableItems.length === 0) {
    lines.push("No equipable loot owned yet.");
    return { text: lines.join("\n") };
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const item of equipableItems.slice(0, 12)) {
    const template = item.loot_template_id ? lootById.get(item.loot_template_id) : null;

    if (!template?.equipment_slot) {
      continue;
    }

    const isEquipped = item.status === "equipped";
    lines.push(`- ${template.display_name} [${template.equipment_slot}] ${isEquipped ? "(equipped)" : ""}`.trim());

    buttons.push([{
      text: isEquipped ? `Unequip ${template.display_name}` : `Equip ${template.display_name}`,
      callback_data: isEquipped
        ? `crawler:equipment:unequip:${template.equipment_slot}`
        : `crawler:equipment:equip:${item.id}`,
    }]);
  }

  if (equipableItems.length > 12) {
    lines.push("");
    lines.push(`Showing 12 of ${equipableItems.length} equipable items.`);
  }

  return {
    text: lines.join("\n"),
    ...(buttons.length > 0 ? { replyMarkup: { inline_keyboard: buttons } } : {}),
  };
}

async function buildPartyLobbyMessage(party: PartyRecord): Promise<CrawlerOutboundMessage> {
  const [members, leader] = await Promise.all([
    listPartyMemberDetails(party.id),
    getUserById(party.leader_user_id),
  ]);

  return formatPartyLobby(party, members, leader?.display_name ?? "Unknown leader");
}

async function buildRunMessage(runId: string, surface: CrawlerRunSurface = "group"): Promise<CrawlerOutboundMessage> {
  const run = await getAdventureRunById(runId);

  if (!run) {
    return {
      text: "The active crawler run could not be found.",
    };
  }

  const [rooms, members, encounters] = await Promise.all([
    listRunRoomDetails(run.id),
    getPartyById(run.party_id).then((party) => party ? listPartyMemberDetails(party.id) : []),
    listEncountersForRun(run.id),
  ]);
  const currentRoom = rooms.find((room) => room.id === run.current_room_id) ?? rooms[0];
  const memberCount = activeMembers(members).length;

  if (!currentRoom) {
    return {
      text: [
        "Crawler Run",
        "",
        `Run ID: ${run.id}`,
        `Run status: ${run.status.replaceAll("_", " ")}`,
        "No active room is currently available.",
      ].join("\n"),
    };
  }

  if (run.status === "completed") {
    return {
      text: [
        formatRunCompleteMessage(run, currentRoom, memberCount).text,
        "",
        "Party",
        ...formatPartyRoster(members),
        "",
        describeRunPresentationState({
          runStatus: run.status,
          roomStatus: currentRoom.status,
          roomResolvedAt: currentRoom.resolved_at,
          surface,
          hasCurrentRoom: true,
        }).actionLine,
      ].join("\n"),
    };
  }

  if (run.status === "failed") {
    return {
      text: [
        formatRunFailedMessage(run, currentRoom, memberCount).text,
        "",
        "Party",
        ...formatPartyRoster(members),
        "",
        describeRunPresentationState({
          runStatus: run.status,
          roomStatus: currentRoom.status,
          roomResolvedAt: currentRoom.resolved_at,
          surface,
          hasCurrentRoom: true,
        }).actionLine,
      ].join("\n"),
    };
  }

  if (run.status === "in_combat" && run.active_encounter_id) {
    const encounter = encounters.find((candidate) => candidate.id === run.active_encounter_id) ?? await getEncounterById(run.active_encounter_id);
    const snapshot = encounter ? getEncounterStateSnapshot(encounter.encounter_snapshot) : null;

    if (encounter && currentRoom && snapshot?.state) {
      return formatEncounterActionPrompt({
        run,
        room: currentRoom,
        encounterId: encounter.id,
        state: snapshot.state,
        retreatVotes: snapshot.retreatVotes ?? [],
        members,
      });
    }
  }

  if (run.summary?.pendingEncounterId && run.summary?.encounterFallbackRoomId === currentRoom?.id) {
    const encounterId = typeof run.summary.pendingEncounterId === "string" ? run.summary.pendingEncounterId : null;
    const pendingEncounter = encounterId
      ? encounters.find((candidate) => candidate.id === encounterId) ?? await getEncounterById(encounterId)
      : null;

    if (pendingEncounter && currentRoom) {
      return {
        text: [
          "Crawler Run",
          "",
          `Run ID: ${run.id}`,
          `Theme: ${run.theme_key ?? "unknown"}`,
          `Run status: ${run.status.replaceAll("_", " ")}`,
          `Current room: Floor ${currentRoom.floor_number}, Room ${currentRoom.room_number}`,
          "",
          "The party has fallen back from an active encounter.",
          "You can regroup here, use consumables, and re-enter when ready.",
        ].join("\n"),
        replyMarkup: {
          inline_keyboard: [[{
            text: "Re-enter Encounter",
            callback_data: `crawler:encounter:resume:${pendingEncounter.id}:${pendingEncounter.room_id}`,
          }]],
        },
      };
    }
  }

  const presentation = describeRunPresentationState({
    runStatus: run.status,
    roomStatus: currentRoom.status,
    roomResolvedAt: currentRoom.resolved_at,
    surface,
    hasCurrentRoom: true,
  });

  if (presentation.showRoomPrompt) {
    return formatActiveRoomPrompt(run, currentRoom, memberCount, members, surface);
  }

  return {
    text: [
      presentation.heading,
      "",
      `Run ID: ${run.id}`,
      `Theme: ${run.theme_key ?? "unknown"}`,
      `Run status: ${run.status.replaceAll("_", " ")}`,
      `Current room: Floor ${currentRoom.floor_number}, Room ${currentRoom.room_number}`,
      `Party size: ${memberCount}`,
      "",
      "Party",
      ...formatPartyRoster(members),
      "",
      presentation.actionLine,
    ].join("\n"),
  };
}

async function persistGeneratedRun(runId: string, generated: GeneratedRun) {
  const createdRooms: RunRoomDetailRecord[] = [];

  for (const floor of generated.floors) {
    const persistedFloor = await createRunFloor({
      runId,
      floorNumber: floor.floorNumber,
      seedFragment: floor.seedFragment,
      metadata: floor.metadata,
    });

    for (const room of floor.rooms) {
      const persistedRoom = await createRunRoom({
        runId,
        floorId: persistedFloor.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        status: "unvisited",
        templateKey: room.templateKey,
        promptPayload: room.promptPayload,
        generationPayload: room.generationPayload,
      });

      createdRooms.push({
        ...persistedRoom,
        floor_number: floor.floorNumber,
      });
    }
  }

  return createdRooms.sort((left, right) => {
    if (left.floor_number !== right.floor_number) {
      return left.floor_number - right.floor_number;
    }

    return left.room_number - right.room_number;
  });
}

async function buildPlayerParticipants(
  members: PartyMemberDetailRecord[],
  runEffects: RunEffectRecord[],
  runHitPoints: RunCombatHitPointRecord,
) {
  const currentMembers = activeMembers(members);
  const characters = await Promise.all(currentMembers.map((member) => getCharacterById(member.character_id)));
  const loadouts = await Promise.all(currentMembers.map((member) => listEquipmentLoadoutsForCharacter(member.character_id)));

  return currentMembers.flatMap((member, index) => {
    const character = characters[index];
    const characterLoadouts = loadouts[index] ?? [];

    if (!character) {
      return [];
    }

    return [toPlayerEncounterParticipant(member, character, characterLoadouts, runEffects, runHitPoints, index + 1)];
  });
}

function buildMonsterParticipants(room: RunRoomDetailRecord) {
  const payload = room.generation_payload as { encounterMonsterKeys?: unknown };
  const monsterKeys = Array.isArray(payload.encounterMonsterKeys)
    ? payload.encounterMonsterKeys.filter((value): value is string => typeof value === "string")
    : [];

  return monsterKeys.flatMap((key, index) => {
    const template = getMonsterTemplateByKey(key);
    return template ? [toMonsterEncounterParticipant(template, index + 1)] : [];
  });
}

async function grantEncounterRewards(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  encounterId: string,
  members: PartyMemberDetailRecord[],
): Promise<GrantedRewardSummary> {
  const currentMembers = activeMembers(members);
  const existingRewards = await listRunRewardsForRoom(room.id);

  if (existingRewards.length > 0) {
    return {
      rewardRows: existingRewards,
      summaryLines: summarizeRewardRows(existingRewards),
    };
  }

  await ensureCrawlerContent();

  const lootTemplates = await listLootTemplates();
  const lootByKey = new Map(lootTemplates.map((template) => [template.template_key, template]));
  const rewardRoomType = room.room_type as "combat" | "elite_combat" | "boss";
  const rewardSeeds = generateEncounterRewards(
    `${run.seed}:${room.id}`,
    rewardRoomType,
    currentMembers.length,
  );
  const rewardRows: RunRewardRecord[] = [];

  for (const rewardSeed of rewardSeeds) {
    const member = currentMembers[rewardSeed.recipientSlot - 1];
    const lootTemplate = lootByKey.get(rewardSeed.templateKey);

    if (!member || !lootTemplate) {
      continue;
    }

    const inventoryItem = await grantInventoryReward({
      userId: member.user_id,
      characterId: member.character_id,
      lootTemplate,
      quantity: rewardSeed.quantity,
      metadata: {
        runId: run.id,
        roomId: room.id,
        encounterId,
        source: "crawler_encounter_reward",
      },
    });

    const rewardRow = await createRunReward({
      runId: run.id,
      roomId: room.id,
      encounterId,
      recipientUserId: member.user_id,
      recipientCharacterId: member.character_id,
      lootTemplateId: lootTemplate.id,
      rewardKind: lootTemplate.category_key,
      status: "granted",
      quantity: rewardSeed.quantity,
      rewardPayload: {
        itemName: lootTemplate.display_name,
        quantity: rewardSeed.quantity,
        recipientName: member.character_name,
        inventoryItemId: inventoryItem.id,
      },
    });

    rewardRows.push(rewardRow);
  }

  if (rewardRows.length > 0) {
    await createAuditLog({
      actorType: "system",
      action: "crawler_rewards_granted",
      targetType: "run_room",
      targetId: room.id,
      metadata: {
        runId: run.id,
        encounterId,
        rewardCount: rewardRows.length,
        rewards: rewardRows.map((row) => row.reward_payload),
      },
    });
  }

  return {
    rewardRows,
    summaryLines: summarizeRewardRows(rewardRows),
  };
}

async function grantEncounterXp(params: {
  run: AdventureRunRecord;
  room: RunRoomDetailRecord;
  encounterId: string;
  members: PartyMemberDetailRecord[];
  result: EncounterResolutionResult;
}) {
  const existingXpRewards = (await listRunRewardsForEncounter(params.encounterId)).filter(
    (reward) => reward.reward_kind === "crawler_xp",
  );

  if (existingXpRewards.length > 0) {
    return existingXpRewards.map((reward) => ({
      characterId: reward.recipient_character_id ?? "unknown",
      characterName: typeof reward.reward_payload.recipientName === "string"
        ? reward.reward_payload.recipientName
        : "Unknown adventurer",
      xpGranted: typeof reward.reward_payload.xpGranted === "number" ? reward.reward_payload.xpGranted : reward.quantity,
      totalXp: typeof reward.reward_payload.totalXp === "number" ? reward.reward_payload.totalXp : 0,
      crawlerLevel: typeof reward.reward_payload.crawlerLevel === "number" ? reward.reward_payload.crawlerLevel : 1,
    }));
  }

  const xpPerSurvivor = encounterXpForRoomType(params.room.room_type);
  const recipients = buildEncounterXpRecipients({
    members: params.members,
    finalParticipants: params.result.finalParticipants,
    xpPerSurvivor,
  });

  const awards: EncounterXpAward[] = [];

  for (const recipient of recipients) {
    const progress = await incrementCharacterCrawlerXp({
      characterId: recipient.characterId,
      xpDelta: recipient.xpGranted,
      crawlerStatsPatch: {
        lastCrawlerXpAwardedAt: new Date().toISOString(),
        lastCrawlerXpSource: "encounter",
      },
    });

    if (!progress) {
      continue;
    }

    await createRunReward({
      runId: params.run.id,
      roomId: params.room.id,
      encounterId: params.encounterId,
      recipientUserId: recipient.userId,
      recipientCharacterId: recipient.characterId,
      rewardKind: "crawler_xp",
      status: "granted",
      quantity: recipient.xpGranted,
      rewardPayload: {
        recipientName: recipient.characterName,
        xpGranted: recipient.xpGranted,
        totalXp: progress.crawler_xp,
        crawlerLevel: progress.crawler_level,
      },
    });

    awards.push({
      characterId: recipient.characterId,
      characterName: recipient.characterName,
      xpGranted: recipient.xpGranted,
      totalXp: progress.crawler_xp,
      crawlerLevel: progress.crawler_level,
    });
  }

  if (awards.length > 0) {
    await createAuditLog({
      actorType: "system",
      action: "crawler_xp_granted",
      targetType: "encounter",
      targetId: params.encounterId,
      metadata: {
        runId: params.run.id,
        roomId: params.room.id,
        roomType: params.room.room_type,
        xpPerSurvivor,
        awards,
      },
    });
  }

  return awards;
}

async function grantRoomRewards(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  members: PartyMemberDetailRecord[],
): Promise<GrantedRewardSummary> {
  const currentMembers = activeMembers(members);
  const existingRewards = await listRunRewardsForRoom(room.id);

  if (existingRewards.length > 0) {
    return {
      rewardRows: existingRewards,
      summaryLines: summarizeRewardRows(existingRewards),
    };
  }

  await ensureCrawlerContent();

  const lootTemplates = await listLootTemplates();
  const lootByKey = new Map(lootTemplates.map((template) => [template.template_key, template]));
  const rewardRoomType = room.room_type as Extract<CrawlerRoomType, "treasure" | "event" | "rest">;
  const rewardSeeds = generateRoomRewards(
    `${run.seed}:${room.id}`,
    rewardRoomType,
    currentMembers.length,
  );
  const rewardRows: RunRewardRecord[] = [];

  for (const rewardSeed of rewardSeeds) {
    const member = currentMembers[rewardSeed.recipientSlot - 1];
    const lootTemplate = lootByKey.get(rewardSeed.templateKey);

    if (!member || !lootTemplate) {
      continue;
    }

    const inventoryItem = await grantInventoryReward({
      userId: member.user_id,
      characterId: member.character_id,
      lootTemplate,
      quantity: rewardSeed.quantity,
      metadata: {
        runId: run.id,
        roomId: room.id,
        source: "crawler_room_reward",
        roomType: room.room_type,
      },
    });

    const rewardRow = await createRunReward({
      runId: run.id,
      roomId: room.id,
      recipientUserId: member.user_id,
      recipientCharacterId: member.character_id,
      lootTemplateId: lootTemplate.id,
      rewardKind: lootTemplate.category_key,
      status: "granted",
      quantity: rewardSeed.quantity,
      rewardPayload: {
        itemName: lootTemplate.display_name,
        quantity: rewardSeed.quantity,
        recipientName: member.character_name,
        inventoryItemId: inventoryItem.id,
        roomType: room.room_type,
      },
    });

    rewardRows.push(rewardRow);
  }

  if (rewardRows.length > 0) {
    await createAuditLog({
      actorType: "system",
      action: "crawler_room_rewards_granted",
      targetType: "run_room",
      targetId: room.id,
      metadata: {
        runId: run.id,
        roomType: room.room_type,
        rewardCount: rewardRows.length,
        rewards: rewardRows.map((row) => row.reward_payload),
      },
    });
  }

  return {
    rewardRows,
    summaryLines: summarizeRewardRows(rewardRows),
  };
}

async function appendEncounterEvents(
  encounterId: string,
  snapshot: PersistedEncounterState,
  events: EncounterEvent[],
) {
  const nextSequenceNumber = snapshot.nextSequenceNumber ?? 1;

  for (const [index, event] of events.entries()) {
    await createEncounterEvent({
      encounterId,
      sequenceNumber: nextSequenceNumber + index,
      roundNumber: "round" in event ? event.round : 0,
      eventType: event.type,
      actorParticipantId: null,
      targetParticipantId: null,
      publicText: event.summary,
      payload: event as unknown as Record<string, unknown>,
    });
  }

  return nextSequenceNumber + events.length;
}

async function resolveEncounterRoom(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  members: PartyMemberDetailRecord[],
) {
  await ensureCrawlerContent();
  const playerParticipants = await buildPlayerParticipants(members, getActiveRunEffects(run), getRunHitPoints(run));
  const monsterParticipants = buildMonsterParticipants(room);
  const participants = [...playerParticipants, ...monsterParticipants];
  const initialized = initializeEncounterState({
    participants,
  });

  const monsterTemplatesByKey = new Map(
    (await listMonsterTemplates()).map((template) => [template.template_key, template]),
  );
  const encounter = await createEncounter({
    runId: run.id,
    roomId: room.id,
    status: "active",
    encounterKey: `${room.room_type}:${room.template_key ?? "unknown"}`,
    encounterSnapshot: {
      roomType: room.room_type,
      state: initialized.state,
      retreatVotes: [],
      nextSequenceNumber: 1,
    },
  });

  const participantIdByEngineId = new Map<string, string>();

  for (const [index, participant] of participants.entries()) {
    const engineId = participant.id;
    const isMonster = participant.side === "monster";
    const monsterKey = isMonster ? engineId.replace(/^monster-\d+-/, "") : null;
    const member = !isMonster ? members.find((candidate) => candidate.character_name === participant.name) : null;
    const monsterTemplateId = monsterKey ? monsterTemplatesByKey.get(monsterKey)?.id ?? null : null;
    const record = await createEncounterParticipant({
      encounterId: encounter.id,
      side: participant.side,
      userId: member?.user_id ?? null,
      characterId: member?.character_id ?? null,
      monsterTemplateId,
      slot: index + 1,
      displayName: participant.name,
      snapshot: {
        ...participant,
        monsterKey,
      },
      isDefeated: false,
    });
    participantIdByEngineId.set(engineId, record.id);
  }

  for (const [index, event] of initialized.events.entries()) {
    await createEncounterEvent({
      encounterId: encounter.id,
      sequenceNumber: index + 1,
      roundNumber: "round" in event ? event.round : 0,
      eventType: event.type,
      actorParticipantId: "participantId" in event ? participantIdByEngineId.get(event.participantId) ?? null : null,
      targetParticipantId: "targetId" in event ? participantIdByEngineId.get(event.targetId) ?? null : null,
      publicText: event.summary,
      payload: event as unknown as Record<string, unknown>,
    });
  }

  return {
    encounterId: encounter.id,
    state: initialized.state,
    events: initialized.events,
  };
}

async function activateRoom(run: AdventureRunRecord, room: RunRoomDetailRecord) {
  await updateRunRoom({
    roomId: room.id,
    status: "active",
    entered: true,
  });

  return updateAdventureRun({
    runId: run.id,
    status: "awaiting_choice",
    currentFloorNumber: room.floor_number,
    currentRoomId: room.id,
  });
}

function nextRoom(rooms: RunRoomDetailRecord[], currentRoomId: string) {
  const currentIndex = rooms.findIndex((room) => room.id === currentRoomId);

  if (currentIndex === -1) {
    return null;
  }

  return rooms[currentIndex + 1] ?? null;
}

function previousRoom(rooms: RunRoomDetailRecord[], currentRoomId: string) {
  const currentIndex = rooms.findIndex((room) => room.id === currentRoomId);

  if (currentIndex <= 0) {
    return null;
  }

  return rooms[currentIndex - 1] ?? null;
}

export async function handlePartyCommand(actor: TelegramActor): Promise<CrawlerOutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  const existingParty = await getActivePartyForUser(user.id);

  if (existingParty) {
    if (existingParty.status === "in_run" && existingParty.active_run_id) {
      return buildRunMessage(existingParty.active_run_id, "group");
    }

    return buildPartyLobbyMessage(existingParty);
  }

  const character = await getEligibleCharacterByUserId(user.id);

  if (!character) {
    return {
      text: [
        "You need an active character before you can join a crawler party.",
        "",
        "Create one in DM with /create_character first.",
      ].join("\n"),
    };
  }

  return {
    text: [
      "No active crawler party found for you.",
      "",
      `Current character: ${character.name} (${character.class_key})`,
      "",
      "Create a party to begin assembling an adventure group.",
    ].join("\n"),
    replyMarkup: createPartyButtons(),
  };
}

export async function handleRunCommand(
  actor: TelegramActor,
  surface: CrawlerRunSurface = "dm",
): Promise<CrawlerOutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  const activeParty = await getActivePartyForUser(user.id);

  if (activeParty?.status === "in_run" && activeParty.active_run_id) {
    return buildRunMessage(activeParty.active_run_id, surface);
  }

  if (activeParty) {
    return {
      text: [
        "No active crawler run is currently underway for you.",
        "",
        "Your party is still in the lobby.",
        "Use /party in the group chat to review members, readiness, and start the next run.",
      ].join("\n"),
    };
  }

  const latestRun = await getLatestAdventureRunForUser(user.id);

  if (latestRun) {
    const message = await buildRunMessage(latestRun.id, surface);
    return {
      text: [
        "Most Recent Crawler Run",
        "",
        message.text,
      ].join("\n"),
      ...(message.replyMarkup ? { replyMarkup: message.replyMarkup } : {}),
    };
  }

  return {
    text: [
      "No crawler run found for you yet.",
      "",
      "Use /party in a group chat to assemble a party and start an expedition.",
    ].join("\n"),
  };
}

export async function handleInventoryCommand(actor: TelegramActor): Promise<CrawlerOutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  await ensureCrawlerContent();

  const character = await getEligibleCharacterByUserId(user.id);

  if (!character) {
    return {
      text: [
        "You need an active character before you can inspect crawler inventory.",
        "",
        "Create one in DM with /create_character first.",
      ].join("\n"),
    };
  }

  const [inventoryItems, lootTemplates] = await Promise.all([
    listInventoryItemsForCharacter(character.id),
    listLootTemplates(),
  ]);

  return formatInventoryMessage(character, inventoryItems, lootTemplates);
}

export async function handleEquipmentCommand(actor: TelegramActor): Promise<CrawlerOutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  await ensureCrawlerContent();

  const character = await getEligibleCharacterByUserId(user.id);

  if (!character) {
    return {
      text: [
        "You need an active character before you can manage crawler equipment.",
        "",
        "Create one in DM with /create_character first.",
      ].join("\n"),
    };
  }

  const [inventoryItems, lootTemplates, loadouts] = await Promise.all([
    listInventoryItemsForCharacter(character.id),
    listLootTemplates(),
    listEquipmentLoadoutsForCharacter(character.id),
  ]);

  return formatEquipmentMessage(character, inventoryItems, lootTemplates, loadouts);
}

export async function handleCrawlerCallback(
  actor: TelegramActor,
  callbackData: string,
): Promise<CrawlerCommandResult> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      alertText: "Your crawler access is restricted",
      message: { text: restrictedUserMessage() },
    };
  }

  if (callbackData.startsWith("crawler:inventory:use:")) {
    const inventoryItemId = callbackData.slice("crawler:inventory:use:".length);

    if (!inventoryItemId) {
      return {
        alertText: "That consumable could not be used",
      };
    }

    await ensureCrawlerContent();

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "No active character found",
      };
    }

    const inventoryItem = await getInventoryItemById(inventoryItemId);

    if (!inventoryItem || inventoryItem.user_id !== user.id || inventoryItem.character_id !== character.id) {
      return {
        alertText: "That item is not available to this character",
      };
    }

    if (inventoryItem.status !== "owned") {
      return {
        alertText: "That item can no longer be used",
      };
    }

    const lootTemplates = await listLootTemplates();
    const template = inventoryItem.loot_template_id
      ? lootTemplates.find((candidate) => candidate.id === inventoryItem.loot_template_id)
      : null;

    if (!template || template.category_key !== "consumable") {
      return {
        alertText: "That item is not a usable consumable",
      };
    }

    const activeParty = await getActivePartyForUser(user.id);

    if (!activeParty || activeParty.status !== "in_run" || !activeParty.active_run_id) {
      return {
        alertText: "Consumables can only be used during an active crawler run",
      };
    }

    const run = await getAdventureRunById(activeParty.active_run_id);

    if (!run || !["awaiting_choice", "active", "in_run", "in_combat", "paused"].includes(run.status)) {
      return {
        alertText: "There is no active run ready for consumables right now",
      };
    }

    const effect = consumableEffectForTemplateKey(template.template_key);

    if (!effect) {
      return {
        alertText: "That consumable is not supported yet",
      };
    }

    const nextEffects = [...getActiveRunEffects(run), effect];

    await updateInventoryItemStatus({
      inventoryItemId: inventoryItem.id,
      status: "consumed",
    });
    await updateAdventureRun({
      runId: run.id,
      summary: buildRunSummary(run, {}, nextEffects),
    });
    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_consumable_used",
      targetType: "inventory_item",
      targetId: inventoryItem.id,
      metadata: {
        runId: run.id,
        characterId: character.id,
        templateKey: template.template_key,
        effect,
      },
    });

    return {
      alertText: `${template.display_name} used`,
      message: await handleInventoryCommand(actor),
    };
  }

  if (callbackData.startsWith("crawler:equipment:equip:")) {
    const inventoryItemId = callbackData.slice("crawler:equipment:equip:".length);

    if (!inventoryItemId) {
      return {
        alertText: "That item could not be equipped",
      };
    }

    await ensureCrawlerContent();

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "No active character found",
        message: {
          text: "You need an active character before you can equip crawler loot.",
        },
      };
    }

    const inventoryItem = await getInventoryItemById(inventoryItemId);

    if (!inventoryItem || inventoryItem.user_id !== user.id || inventoryItem.character_id !== character.id) {
      return {
        alertText: "That item is not available to this character",
      };
    }

    const lootTemplates = await listLootTemplates();
    const template = inventoryItem.loot_template_id
      ? lootTemplates.find((candidate) => candidate.id === inventoryItem.loot_template_id)
      : null;

    if (!template?.equipment_slot) {
      return {
        alertText: "That item cannot be equipped",
      };
    }

    const effectData = template.effect_data;

    if (!appliesToClass(effectData, character.class_key)) {
      return {
        alertText: `${template.display_name} cannot be used by ${character.class_key}`,
      };
    }

    await equipInventoryItemForCharacter({
      characterId: character.id,
      inventoryItemId: inventoryItem.id,
      slot: template.equipment_slot,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_item_equipped",
      targetType: "inventory_item",
      targetId: inventoryItem.id,
      metadata: {
        characterId: character.id,
        slot: template.equipment_slot,
        lootTemplateId: template.id,
      },
    });

    return {
      alertText: `${template.display_name} equipped`,
      message: await handleEquipmentCommand(actor),
    };
  }

  if (callbackData.startsWith("crawler:equipment:unequip:")) {
    const slot = callbackData.slice("crawler:equipment:unequip:".length) as "weapon" | "armor" | "accessory";

    if (!["weapon", "armor", "accessory"].includes(slot)) {
      return {
        alertText: "That slot could not be unequipped",
      };
    }

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "No active character found",
      };
    }

    const changed = await unequipInventoryItemForCharacter({
      characterId: character.id,
      slot,
    });

    if (!changed) {
      return {
        alertText: "Nothing was equipped in that slot",
      };
    }

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_item_unequipped",
      targetType: "character",
      targetId: character.id,
      metadata: {
        slot,
      },
    });

    return {
      alertText: `${slot} unequipped`,
      message: await handleEquipmentCommand(actor),
    };
  }

  if (callbackData === "crawler:party:create") {
    const existingParty = await getActivePartyForUser(user.id);

    if (existingParty) {
      return {
        alertText: "You are already in an active party",
        message: existingParty.status === "in_run" && existingParty.active_run_id
          ? await buildRunMessage(existingParty.active_run_id, "group")
          : await buildPartyLobbyMessage(existingParty),
      };
    }

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "Create a character first",
        message: {
          text: "You need an active character before creating a crawler party. Use /create_character in DM first.",
        },
      };
    }

    const party = await createParty({
      leaderUserId: user.id,
      partyName: `${user.display_name}'s party`,
    });

    await addPartyMember({
      partyId: party.id,
      userId: user.id,
      characterId: character.id,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_party_created",
      targetType: "party",
      targetId: party.id,
      metadata: {
        characterId: character.id,
      },
    });

    return {
      alertText: "Party created",
      message: await buildPartyLobbyMessage(party),
    };
  }

  if (callbackData.startsWith("crawler:party:join:")) {
    const partyId = callbackData.slice("crawler:party:join:".length);
    const party = await getPartyById(partyId);

    if (!party || !["forming", "ready"].includes(party.status)) {
      return {
        alertText: "This party is no longer accepting members",
      };
    }

    const existingParty = await getActivePartyForUser(user.id);

    if (existingParty?.id && existingParty.id !== party.id) {
      return {
        alertText: "Leave your current party first",
        message: existingParty.status === "in_run" && existingParty.active_run_id
          ? await buildRunMessage(existingParty.active_run_id, "group")
          : await buildPartyLobbyMessage(existingParty),
      };
    }

    const existingMember = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (existingMember && ACTIVE_PARTY_MEMBER_STATUSES.has(existingMember.status)) {
      return {
        alertText: "You are already in this party",
        message: await buildPartyLobbyMessage(party),
      };
    }

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "Create a character first",
        message: {
          text: "You need an active character before joining a crawler party. Use /create_character in DM first.",
        },
      };
    }

    if (existingMember) {
      await setPartyMemberStatus({
        partyMemberId: existingMember.id,
        status: "joined",
      });
    } else {
      await addPartyMember({
        partyId: party.id,
        userId: user.id,
        characterId: character.id,
      });
    }

    await syncPartyStatus(party.id);

    return {
      alertText: "Joined party",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party),
    };
  }

  if (callbackData.startsWith("crawler:party:ready:")) {
    const partyId = callbackData.slice("crawler:party:ready:".length);
    const party = await getPartyById(partyId);

    if (!party || party.status === "in_run") {
      return {
        alertText: "This party is no longer in the lobby",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    const willBeReady = membership.status !== "ready";
    await setPartyMemberReadyState(membership.id, willBeReady);
    await syncPartyStatus(party.id);

    return {
      alertText: willBeReady ? "You are ready" : "You are no longer ready",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party),
    };
  }

  if (callbackData.startsWith("crawler:party:leave:")) {
    const partyId = callbackData.slice("crawler:party:leave:".length);
    const party = await getPartyById(partyId);

    if (!party || party.status === "in_run") {
      return {
        alertText: "This party can no longer be changed",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not in this party",
      };
    }

    await setPartyMemberLeft(membership.id);
    const remainingMembers = activeMembers(await listPartyMemberDetails(party.id));

    if (party.leader_user_id === user.id || remainingMembers.length === 0) {
      await updateParty({
        partyId: party.id,
        status: "cancelled",
        activeRunId: null,
      });

      return {
        alertText: party.leader_user_id === user.id ? "Party dissolved" : "Party closed",
        message: {
          text: "The crawler party has been dissolved.",
        },
      };
    }

    await syncPartyStatus(party.id);

    return {
      alertText: "You left the party",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party),
    };
  }

  if (callbackData.startsWith("crawler:party:start:")) {
    const partyId = callbackData.slice("crawler:party:start:".length);
    const party = await getPartyById(partyId);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    if (party.leader_user_id !== user.id) {
      return {
        alertText: "Only the party leader can start the run",
      };
    }

    if (party.status === "in_run" && party.active_run_id) {
      return {
        alertText: "Run already started",
        message: await buildRunMessage(party.active_run_id, "group"),
      };
    }

    const members = activeMembers(await listPartyMemberDetails(party.id));
    const readyCount = members.filter((member) => member.status === "ready").length;

    if (!canStartCrawlerParty({ memberCount: members.length, readyMemberCount: readyCount })) {
      return {
        alertText: "Everyone must be ready first",
        message: await buildPartyLobbyMessage(party),
      };
    }

    const rulesVersion = await ensureRulesVersion({
      versionKey: "arena-v1-alpha",
      summary: "Default crawler-compatible rules anchor.",
      config: {
        mode: "crawler",
        generationVersion: "crawler-v1-prototype",
      },
    });

    const seed = randomUUID();
    const generated = generateRun(seed, members.length);
    const run = await createAdventureRun({
      partyId: party.id,
      seed,
      generationVersion: generated.generationVersion,
      floorCount: generated.floorCount,
      difficultyTier: 1,
      themeKey: generated.theme.key,
      rulesVersionId: rulesVersion.id,
      status: "active",
    });

    const rooms = await persistGeneratedRun(run.id, generated);
    const firstRoom = rooms[0]!;

    await activateRoom(run, firstRoom);
    await updateParty({
      partyId: party.id,
      status: "in_run",
      activeRunId: run.id,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_run_started",
      targetType: "adventure_run",
      targetId: run.id,
      metadata: {
        partyId: party.id,
        memberCount: members.length,
        themeKey: generated.theme.key,
        floorCount: generated.floorCount,
      },
    });

    return {
      alertText: "Run started",
      message: await buildRunMessage(run.id, "group"),
    };
  }

  if (callbackData.startsWith("crawler:run:proceed:")) {
    const roomId = callbackData.slice("crawler:run:proceed:".length);

    if (!roomId) {
      return {
        alertText: "That room action is invalid",
      };
    }

    const currentRoom = await getRunRoomDetailById(roomId);

    if (!currentRoom) {
      return {
        alertText: "Room not found",
      };
    }

    const run = await getAdventureRunById(currentRoom.run_id);

    if (!run) {
      return {
        alertText: "Run not found",
      };
    }

    const party = await getPartyById(run.party_id);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    if (run.current_room_id !== roomId) {
      return {
        alertText: "That room is no longer active",
      };
    }

    if (run.status !== "awaiting_choice") {
      return {
        alertText: "That run is no longer awaiting input",
      };
    }

    if (currentRoom.status !== "active" || currentRoom.resolved_at) {
      return {
        alertText: "That room has already been resolved",
      };
    }

    await createRunChoice({
      runId: run.id,
      roomId: currentRoom.id,
      actorUserId: user.id,
      choiceKey: "proceed",
      choicePayload: {
        roomType: currentRoom.room_type,
      },
    });

    const rooms = await listRunRoomDetails(run.id);
    const next = nextRoom(rooms, currentRoom.id);
    const members = await listPartyMemberDetails(party.id);
    const memberCount = activeMembers(members).length;

    if (isEncounterRoom(currentRoom.room_type)) {
      const { encounterId, state, events } = await resolveEncounterRoom(run, currentRoom, members);
      const fallbackRoom = previousRoom(rooms, currentRoom.id);
      const nextRun = await updateAdventureRun({
        runId: run.id,
        status: "in_combat",
        activeEncounterId: encounterId,
        summary: buildRunSummary(run, {
          pendingEncounterId: encounterId,
          encounterFallbackRoomId: fallbackRoom?.id ?? null,
          partyHitPoints: getRunHitPoints(run),
        }, []),
      });
      await updateEncounter({
        encounterId,
        encounterSnapshot: {
          roomType: currentRoom.room_type,
          state,
          fallbackRoomId: fallbackRoom?.id ?? null,
          retreatVotes: [],
          nextSequenceNumber: events.length + 1,
        },
      });

      return {
        alertText: "Encounter engaged",
        message: formatEncounterActionPrompt({
          run: nextRun ?? run,
          room: currentRoom,
          encounterId,
          state,
          retreatVotes: [],
          members,
        }),
      };
    }

    await updateRunRoom({
      roomId: currentRoom.id,
      status: "completed",
      resolved: true,
    });

    const rewards = await grantRoomRewards(run, currentRoom, members);
    const gainedEffect = chooseRoomEffect(run, currentRoom);
    const nextRunEffects = gainedEffect
      ? [...getActiveRunEffects(run), gainedEffect]
      : getActiveRunEffects(run);

    if (!next) {
      await updateAdventureRun({
        runId: run.id,
        status: "completed",
        currentRoomId: currentRoom.id,
        currentFloorNumber: currentRoom.floor_number,
        summary: buildRunSummary(run, {}, nextRunEffects),
      });
      await updateParty({
        partyId: party.id,
        status: "completed",
        activeRunId: null,
      });

      return {
        alertText: "Run complete",
        message: formatRoomRewardMessage(
          (await getAdventureRunById(run.id)) ?? run,
          currentRoom,
          rewards,
          gainedEffect,
          null,
          memberCount,
        ),
      };
    }

    await activateRoom(run, next);
    await updateAdventureRun({
      runId: run.id,
      summary: buildRunSummary(run, {}, nextRunEffects),
    });

    return {
      alertText: `${currentRoom.room_type.replaceAll("_", " ")} resolved`,
      message: formatRoomRewardMessage(
        (await getAdventureRunById(run.id)) ?? run,
        currentRoom,
        rewards,
        gainedEffect,
        next,
        memberCount,
      ),
    };
  }

  if (callbackData.startsWith("crawler:encounter:attack:")) {
    const [, , , encounterId, roundToken] = callbackData.split(":");
    const expectedRound = Number(roundToken);

    if (!encounterId || !Number.isInteger(expectedRound)) {
      return {
        alertText: "That combat action is invalid",
      };
    }

    const encounter = await getEncounterById(encounterId);

    if (!encounter || encounter.status !== "active") {
      return {
        alertText: "That encounter is no longer active",
      };
    }

    const run = await getAdventureRunById(encounter.run_id);
    const room = await getRunRoomDetailById(encounter.room_id);

    if (!run || !room || run.status !== "in_combat" || run.active_encounter_id !== encounter.id || run.current_room_id !== room.id) {
      return {
        alertText: "That encounter is no longer awaiting combat actions",
      };
    }

    const party = await getPartyById(run.party_id);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    const snapshot = getEncounterStateSnapshot(encounter.encounter_snapshot);
    const state = snapshot?.state;

    if (!state || state.nextRound !== expectedRound) {
      return {
        alertText: "That combat prompt is stale",
      };
    }

    const members = await listPartyMemberDetails(party.id);
    const rooms = await listRunRoomDetails(run.id);
    const next = nextRoom(rooms, room.id);
    const memberCount = activeMembers(members).length;
    const roundResult = resolveEncounterRound(state);
    const nextSequenceNumber = await appendEncounterEvents(encounter.id, snapshot ?? {}, roundResult.events);
    const partyHitPoints = updateRunHitPoints(run, roundResult.finalParticipants, members);

    if (roundResult.winningSide === "monster") {
      await updateEncounter({
        encounterId: encounter.id,
        status: "failed",
        encounterSnapshot: {
          ...(snapshot ?? {}),
          state: roundResult.state,
          retreatVotes: [],
          nextSequenceNumber,
        },
      });
      await updateRunRoom({
        roomId: room.id,
        status: "failed",
        resolved: true,
      });
      await updateAdventureRun({
        runId: run.id,
        status: "failed",
        currentRoomId: room.id,
        currentFloorNumber: room.floor_number,
        activeEncounterId: null,
        summary: buildRunSummary(run, {
          failedRoomId: room.id,
          failedRoomType: room.room_type,
          partyHitPoints,
          pendingEncounterId: null,
          encounterFallbackRoomId: null,
        }, []),
      });
      await updateParty({
        partyId: party.id,
        status: "completed",
        activeRunId: null,
      });

      return {
        alertText: "Encounter lost",
        message: formatEncounterDefeatMessage(
          (await getAdventureRunById(run.id)) ?? run,
          room,
          {
            winningSide: "monster",
            roundsCompleted: roundResult.roundsCompleted,
            events: roundResult.events,
            finalParticipants: roundResult.finalParticipants,
          },
        ),
      };
    }

    if (roundResult.winningSide === "player") {
      await updateEncounter({
        encounterId: encounter.id,
        status: "completed",
        encounterSnapshot: {
          ...(snapshot ?? {}),
          state: roundResult.state,
          retreatVotes: [],
          nextSequenceNumber,
        },
      });
      const rewards = await grantEncounterRewards(run, room, encounter.id, members);
      const xpAwards = await grantEncounterXp({
        run,
        room,
        encounterId: encounter.id,
        members,
        result: {
          winningSide: "player",
          roundsCompleted: roundResult.roundsCompleted,
          events: roundResult.events,
          finalParticipants: roundResult.finalParticipants,
        },
      });
      await updateRunRoom({
        roomId: room.id,
        status: "completed",
        resolved: true,
      });

      if (!next) {
        await updateAdventureRun({
          runId: run.id,
          status: "completed",
          currentRoomId: room.id,
          currentFloorNumber: room.floor_number,
          activeEncounterId: null,
          summary: buildRunSummary(run, {
            partyHitPoints,
            pendingEncounterId: null,
            encounterFallbackRoomId: null,
          }, []),
        });
        await updateParty({
          partyId: party.id,
          status: "completed",
          activeRunId: null,
        });

        return {
          alertText: "Run complete",
          message: formatEncounterVictoryMessage(
            (await getAdventureRunById(run.id)) ?? run,
            room,
            {
              winningSide: "player",
              roundsCompleted: roundResult.roundsCompleted,
              events: roundResult.events,
              finalParticipants: roundResult.finalParticipants,
            },
            rewards,
            xpAwards,
            null,
            memberCount,
          ),
        };
      }

      await activateRoom(run, next);
      await updateAdventureRun({
        runId: run.id,
        activeEncounterId: null,
        summary: buildRunSummary(run, {
          partyHitPoints,
          pendingEncounterId: null,
          encounterFallbackRoomId: null,
        }, []),
      });

      return {
        alertText: "Encounter won",
        message: formatEncounterVictoryMessage(
          (await getAdventureRunById(run.id)) ?? run,
          room,
          {
            winningSide: "player",
            roundsCompleted: roundResult.roundsCompleted,
            events: roundResult.events,
            finalParticipants: roundResult.finalParticipants,
          },
          rewards,
          xpAwards,
          next,
          memberCount,
        ),
      };
    }

    const nextRun = await updateAdventureRun({
      runId: run.id,
      summary: buildRunSummary(run, {
        partyHitPoints,
        pendingEncounterId: encounter.id,
      }, []),
    });
    await updateEncounter({
      encounterId: encounter.id,
      encounterSnapshot: {
        ...(snapshot ?? {}),
        state: roundResult.state,
        retreatVotes: [],
        nextSequenceNumber,
      },
    });

    return {
      alertText: `Round ${roundResult.roundsCompleted} resolved`,
      message: formatEncounterRoundMessage({
        run: nextRun ?? run,
        room,
        encounterId: encounter.id,
        state: roundResult.state,
        retreatVotes: [],
        members,
        events: roundResult.events,
      }),
    };
  }

  if (callbackData.startsWith("crawler:encounter:retreat:")) {
    const [, , , encounterId, roundToken] = callbackData.split(":");
    const expectedRound = Number(roundToken);

    if (!encounterId || !Number.isInteger(expectedRound)) {
      return {
        alertText: "That retreat action is invalid",
      };
    }

    const encounter = await getEncounterById(encounterId);

    if (!encounter || encounter.status !== "active") {
      return {
        alertText: "That encounter is no longer active",
      };
    }

    const run = await getAdventureRunById(encounter.run_id);
    const room = await getRunRoomDetailById(encounter.room_id);

    if (!run || !room || run.status !== "in_combat" || run.active_encounter_id !== encounter.id || run.current_room_id !== room.id) {
      return {
        alertText: "That encounter is no longer awaiting combat actions",
      };
    }

    const party = await getPartyById(run.party_id);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    const snapshot = getEncounterStateSnapshot(encounter.encounter_snapshot);
    const state = snapshot?.state;

    if (!state || state.nextRound !== expectedRound) {
      return {
        alertText: "That combat prompt is stale",
      };
    }

    const members = await listPartyMemberDetails(party.id);
    const currentVotes = new Set(snapshot?.retreatVotes ?? []);

    if (currentVotes.has(user.id)) {
      return {
        alertText: "You already voted to retreat this round",
      };
    }

    currentVotes.add(user.id);
    const requiredVotes = activeMembers(members).map((member) => member.user_id);
    const unanimous = requiredVotes.every((memberUserId) => currentVotes.has(memberUserId));

    if (!unanimous) {
      await updateEncounter({
        encounterId: encounter.id,
        encounterSnapshot: {
          ...(snapshot ?? {}),
          state,
          retreatVotes: [...currentVotes],
          nextSequenceNumber: snapshot?.nextSequenceNumber ?? 1,
        },
      });

      return {
        alertText: "Retreat vote recorded",
        message: formatRetreatVoteMessage({
          run,
          room,
          encounterId: encounter.id,
          state,
          retreatVotes: [...currentVotes],
          members,
        }),
      };
    }

    const retreatResult = resolveRetreatAttempt(state);
    const nextSequenceNumber = await appendEncounterEvents(encounter.id, snapshot ?? {}, retreatResult.events);
    const partyHitPoints = updateRunHitPoints(run, retreatResult.finalParticipants, members);
    const rooms = await listRunRoomDetails(run.id);
    const fallbackRoom = snapshot?.fallbackRoomId
      ? await getRunRoomDetailById(snapshot.fallbackRoomId)
      : previousRoom(rooms, room.id);

    if (!retreatResult.succeeded) {
      await updateEncounter({
        encounterId: encounter.id,
        status: "failed",
        encounterSnapshot: {
          ...(snapshot ?? {}),
          state: retreatResult.state,
          retreatVotes: [],
          nextSequenceNumber,
        },
      });
      await updateRunRoom({
        roomId: room.id,
        status: "failed",
        resolved: true,
      });
      await updateAdventureRun({
        runId: run.id,
        status: "failed",
        currentRoomId: room.id,
        currentFloorNumber: room.floor_number,
        activeEncounterId: null,
        summary: buildRunSummary(run, {
          failedRoomId: room.id,
          failedRoomType: room.room_type,
          partyHitPoints,
          pendingEncounterId: null,
          encounterFallbackRoomId: null,
        }, []),
      });
      await updateParty({
        partyId: party.id,
        status: "completed",
        activeRunId: null,
      });

      return {
        alertText: "Retreat failed",
        message: formatEncounterDefeatMessage(
          (await getAdventureRunById(run.id)) ?? run,
          room,
          {
            winningSide: "monster",
            roundsCompleted: state.nextRound,
            events: retreatResult.events,
            finalParticipants: retreatResult.finalParticipants,
          },
        ),
      };
    }

    if (!fallbackRoom) {
      await updateEncounter({
        encounterId: encounter.id,
        status: "cancelled",
        encounterSnapshot: {
          ...(snapshot ?? {}),
          state: retreatResult.state,
          retreatVotes: [],
          nextSequenceNumber,
        },
      });
      await updateAdventureRun({
        runId: run.id,
        status: "abandoned",
        activeEncounterId: null,
        summary: buildRunSummary(run, {
          partyHitPoints,
          pendingEncounterId: null,
          encounterFallbackRoomId: null,
        }, []),
      });
      await updateParty({
        partyId: party.id,
        status: "abandoned",
        activeRunId: null,
      });

      return {
        alertText: "Retreat successful",
        message: formatRetreatSuccessMessage({
          run: (await getAdventureRunById(run.id)) ?? run,
          room,
          fallbackRoom: null,
          events: retreatResult.events,
          state: retreatResult.state,
          encounterId: encounter.id,
        }),
      };
    }

    await updateEncounter({
      encounterId: encounter.id,
      status: "queued",
      encounterSnapshot: {
        ...(snapshot ?? {}),
        state: retreatResult.state,
        fallbackRoomId: fallbackRoom.id,
        retreatVotes: [],
        nextSequenceNumber,
      },
    });
    await updateAdventureRun({
      runId: run.id,
      status: "awaiting_choice",
      currentFloorNumber: fallbackRoom.floor_number,
      currentRoomId: fallbackRoom.id,
      activeEncounterId: null,
      summary: buildRunSummary(run, {
        partyHitPoints,
        pendingEncounterId: encounter.id,
        encounterFallbackRoomId: fallbackRoom.id,
      }, []),
    });

    return {
      alertText: "Retreat successful",
      message: formatRetreatSuccessMessage({
        run: (await getAdventureRunById(run.id)) ?? run,
        room,
        fallbackRoom,
        events: retreatResult.events,
        state: retreatResult.state,
        encounterId: encounter.id,
      }),
    };
  }

  if (callbackData.startsWith("crawler:encounter:resume:")) {
    const [, , , encounterId, roomId] = callbackData.split(":");

    if (!encounterId || !roomId) {
      return {
        alertText: "That encounter cannot be resumed",
      };
    }

    const encounter = await getEncounterById(encounterId);
    const room = await getRunRoomDetailById(roomId);

    if (!encounter || !room || encounter.room_id !== room.id) {
      return {
        alertText: "That encounter could not be found",
      };
    }

    const run = await getAdventureRunById(encounter.run_id);

    if (!run) {
      return {
        alertText: "Run not found",
      };
    }

    const party = await getPartyById(run.party_id);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    const snapshot = getEncounterStateSnapshot(encounter.encounter_snapshot);
    const state = snapshot?.state;

    if (!state || encounter.status !== "queued" || run.summary?.pendingEncounterId !== encounter.id) {
      return {
        alertText: "That encounter is not waiting to be resumed",
      };
    }

    const members = await listPartyMemberDetails(party.id);
    const nextRun = await updateAdventureRun({
      runId: run.id,
      status: "in_combat",
      currentFloorNumber: room.floor_number,
      currentRoomId: room.id,
      activeEncounterId: encounter.id,
      summary: buildRunSummary(run, {
        pendingEncounterId: encounter.id,
        encounterFallbackRoomId: snapshot?.fallbackRoomId ?? null,
      }, []),
    });
    await updateEncounter({
      encounterId: encounter.id,
      status: "active",
      encounterSnapshot: {
        ...(snapshot ?? {}),
        retreatVotes: [],
      },
    });

    return {
      alertText: "Encounter resumed",
      message: formatEncounterActionPrompt({
        run: nextRun ?? run,
        room,
        encounterId: encounter.id,
        state,
        retreatVotes: [],
        members,
      }),
    };
  }

  return {
    alertText: "Unknown crawler action",
  };
}

export async function handlePartyCallback(
  actor: TelegramActor,
  callbackData: string,
) {
  return handleCrawlerCallback(actor, callbackData);
}

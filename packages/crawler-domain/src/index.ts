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
  createRunChoice,
  createRunFloor,
  createRunRoom,
  ensureRulesVersion,
  getActivePartyForUser,
  getAdventureRunById,
  getCharacterById,
  getEligibleCharacterByUserId,
  getPartyById,
  getPartyMemberByPartyAndUser,
  getRunRoomDetailById,
  getUserById,
  listInventoryItemsForCharacter,
  listLootTemplates,
  listMonsterTemplates,
  listPartyMemberDetails,
  listRunRewardsForRoom,
  listRunRoomDetails,
  setPartyMemberLeft,
  setPartyMemberReadyState,
  setPartyMemberStatus,
  updateEncounter,
  updateAdventureRun,
  updateParty,
  updateRunRoom,
  upsertLootTemplate,
  upsertMonsterTemplate,
  upsertTelegramUser,
  type AdventureRunRecord,
  type CharacterRecord,
  type EncounterParticipantRecord,
  type LootTemplateRecord,
  type PartyMemberDetailRecord,
  type PartyRecord,
  type RunRoomDetailRecord,
  type RunRewardRecord,
} from "@dm-bot/db";
import {
  crawlerContentVersion,
  generateEncounterRewards,
  generateRun,
  getLootTemplateByKey,
  getMonsterTemplateByKey,
  type GeneratedRun,
  type GeneratedRoom,
  type LootTemplateSeed,
  type MonsterTemplateSeed,
  starterLootTemplates,
  starterMonsterTemplates,
} from "@dm-bot/crawler-generation";
import {
  resolveEncounter,
  type EncounterEvent,
  type EncounterParticipant,
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

async function ensureCrawlerContent() {
  if (crawlerContentSeeded) {
    return;
  }

  const [existingMonsters, existingLoot] = await Promise.all([
    listMonsterTemplates(),
    listLootTemplates(),
  ]);

  if (existingMonsters.length === 0) {
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
  }

  if (existingLoot.length === 0) {
    for (const template of starterLootTemplates) {
      await upsertLootTemplate({
        templateKey: template.key,
        displayName: template.name,
        categoryKey: template.category,
        rarityKey: template.rarity,
        equipmentSlot: lootEquipmentSlot(template),
        isPermanent: template.isPermanent,
        effectData: {
          summary: template.effectSummary,
        },
        dropRules: {},
        contentVersion: crawlerContentVersion,
      });
    }
  }

  crawlerContentSeeded = true;
}

function formatPartyLobby(
  party: PartyRecord,
  members: PartyMemberDetailRecord[],
  viewerUserId: string,
  leaderDisplayName: string,
) {
  const currentMembers = activeMembers(members);
  const viewerMembership = currentMembers.find((member) => member.user_id === viewerUserId);
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
    if (!viewerMembership) {
      buttons.push([{ text: "Join Party", callback_data: `crawler:party:join:${party.id}` }]);
    } else {
      buttons.push([
        {
          text: viewerMembership.status === "ready" ? "Not Ready" : "Ready Up",
          callback_data: `crawler:party:ready:${party.id}`,
        },
      ]);
      buttons.push([{ text: "Leave Party", callback_data: `crawler:party:leave:${party.id}` }]);
    }

    if (party.leader_user_id === viewerUserId && allReady) {
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

function toPlayerEncounterParticipant(
  member: PartyMemberDetailRecord,
  character: CharacterRecord,
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

  return {
    id: `player-${slot}-${character.id}`,
    name: character.name,
    side: "player",
    initiativeModifier: derived.initiativeMod ?? 0,
    armorClass: derived.armorClass ?? 10,
    hitPoints: derived.maxHp ?? 1,
    maxHitPoints: derived.maxHp ?? 1,
    attackModifier: profile.attackModifier,
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

type GrantedRewardSummary = {
  rewardRows: RunRewardRecord[];
  summaryLines: string[];
};

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

function formatEncounterVictoryMessage(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  result: EncounterResolutionResult,
  rewards: GrantedRewardSummary,
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
    "",
    "Combat Log",
    ...formatEncounterLog(result.events),
  ];

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

function formatActiveRoomPrompt(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  memberCount: number,
) {
  const prompt = room.prompt_payload as {
    title?: string;
    description?: string;
    roomType?: string;
    templateKey?: string;
  };

  const lines = [
    "Crawler Run",
    "",
    `Run ID: ${run.id}`,
    `Theme: ${run.theme_key ?? "unknown"}`,
    `Party size: ${memberCount}`,
    "",
    prompt.title ?? `Floor ${room.floor_number}, Room ${room.room_number}`,
    prompt.description ?? "A new chamber lies ahead.",
    `Room type: ${(prompt.roomType ?? room.room_type).replaceAll("_", " ")}`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [[{
        text: roomActionLabel(room.room_type),
        callback_data: `crawler:run:proceed:${room.id}`,
      }]],
    },
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

  for (const item of inventoryItems.slice(0, 20)) {
    const template = item.loot_template_id ? lootById.get(item.loot_template_id) : null;
    const name = template?.display_name ?? "Unknown item";
    const quantity = item.quantity > 1 ? ` x${item.quantity}` : "";
    const rarity = template?.rarity_key ? ` (${template.rarity_key})` : "";
    lines.push(`- ${name}${quantity}${rarity} [${item.status}]`);
  }

  if (inventoryItems.length > 20) {
    lines.push("");
    lines.push(`Showing 20 of ${inventoryItems.length} items.`);
  }

  return {
    text: lines.join("\n"),
  };
}

async function buildPartyLobbyMessage(party: PartyRecord, viewerUserId: string): Promise<CrawlerOutboundMessage> {
  const [members, leader] = await Promise.all([
    listPartyMemberDetails(party.id),
    getUserById(party.leader_user_id),
  ]);

  return formatPartyLobby(party, members, viewerUserId, leader?.display_name ?? "Unknown leader");
}

async function buildRunMessage(runId: string): Promise<CrawlerOutboundMessage> {
  const run = await getAdventureRunById(runId);

  if (!run) {
    return {
      text: "The active crawler run could not be found.",
    };
  }

  const [rooms, members] = await Promise.all([
    listRunRoomDetails(run.id),
    getPartyById(run.party_id).then((party) => party ? listPartyMemberDetails(party.id) : []),
  ]);
  const currentRoom = rooms.find((room) => room.id === run.current_room_id) ?? rooms[0];
  const memberCount = activeMembers(members).length;

  if (!currentRoom) {
    return {
      text: [
        "Crawler Run",
        "",
        `Run ID: ${run.id}`,
        "No active room is currently available.",
      ].join("\n"),
    };
  }

  if (run.status === "completed") {
    return formatRunCompleteMessage(run, currentRoom, memberCount);
  }

  if (run.status === "failed") {
    return formatRunFailedMessage(run, currentRoom, memberCount);
  }

  return formatActiveRoomPrompt(run, currentRoom, memberCount);
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

async function buildPlayerParticipants(members: PartyMemberDetailRecord[]) {
  const currentMembers = activeMembers(members);
  const characters = await Promise.all(currentMembers.map((member) => getCharacterById(member.character_id)));

  return currentMembers.flatMap((member, index) => {
    const character = characters[index];

    if (!character) {
      return [];
    }

    return [toPlayerEncounterParticipant(member, character, index + 1)];
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

    const inventoryItem = await createInventoryItem({
      userId: member.user_id,
      characterId: member.character_id,
      lootTemplateId: lootTemplate.id,
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

async function resolveEncounterRoom(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  members: PartyMemberDetailRecord[],
) {
  await ensureCrawlerContent();
  const playerParticipants = await buildPlayerParticipants(members);
  const monsterParticipants = buildMonsterParticipants(room);
  const participants = [...playerParticipants, ...monsterParticipants];
  const result = resolveEncounter({
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
      participants,
    },
  });

  const participantIdByEngineId = new Map<string, string>();

  for (const [index, participant] of participants.entries()) {
    const finalState = result.finalParticipants.find((candidate) => candidate.id === participant.id);
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
      isDefeated: finalState?.isDefeated ?? false,
    });
    participantIdByEngineId.set(engineId, record.id);
  }

  for (const [index, event] of result.events.entries()) {
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

  await updateEncounter({
    encounterId: encounter.id,
    status: result.winningSide === "player" ? "completed" : "failed",
  });

  return {
    encounterId: encounter.id,
    result,
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
      return buildRunMessage(existingParty.active_run_id);
    }

    return buildPartyLobbyMessage(existingParty, user.id);
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

  if (callbackData === "crawler:party:create") {
    const existingParty = await getActivePartyForUser(user.id);

    if (existingParty) {
      return {
        alertText: "You are already in an active party",
        message: existingParty.status === "in_run" && existingParty.active_run_id
          ? await buildRunMessage(existingParty.active_run_id)
          : await buildPartyLobbyMessage(existingParty, user.id),
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
      message: await buildPartyLobbyMessage(party, user.id),
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
          ? await buildRunMessage(existingParty.active_run_id)
          : await buildPartyLobbyMessage(existingParty, user.id),
      };
    }

    const existingMember = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (existingMember && ACTIVE_PARTY_MEMBER_STATUSES.has(existingMember.status)) {
      return {
        alertText: "You are already in this party",
        message: await buildPartyLobbyMessage(party, user.id),
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
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
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
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
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
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
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
        message: await buildRunMessage(party.active_run_id),
      };
    }

    const members = activeMembers(await listPartyMemberDetails(party.id));
    const readyCount = members.filter((member) => member.status === "ready").length;

    if (!canStartCrawlerParty({ memberCount: members.length, readyMemberCount: readyCount })) {
      return {
        alertText: "Everyone must be ready first",
        message: await buildPartyLobbyMessage(party, user.id),
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
    const generated = generateRun(seed);
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
      message: await buildRunMessage(run.id),
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
      const { encounterId, result } = await resolveEncounterRoom(run, currentRoom, members);

      if (result.winningSide !== "player") {
        await updateRunRoom({
          roomId: currentRoom.id,
          status: "failed",
          resolved: true,
        });
        await updateAdventureRun({
          runId: run.id,
          status: "failed",
          currentRoomId: currentRoom.id,
          currentFloorNumber: currentRoom.floor_number,
          summary: {
            failedRoomId: currentRoom.id,
            failedRoomType: currentRoom.room_type,
          },
        });
        await updateParty({
          partyId: party.id,
          status: "completed",
          activeRunId: null,
        });

        return {
          alertText: "Encounter lost",
          message: formatEncounterDefeatMessage((await getAdventureRunById(run.id)) ?? run, currentRoom, result),
        };
      }

      const rewards = await grantEncounterRewards(run, currentRoom, encounterId, members);

      await updateRunRoom({
        roomId: currentRoom.id,
        status: "completed",
        resolved: true,
      });

      if (!next) {
        await updateAdventureRun({
          runId: run.id,
          status: "completed",
          currentRoomId: currentRoom.id,
          currentFloorNumber: currentRoom.floor_number,
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
            currentRoom,
            result,
            rewards,
            null,
            memberCount,
          ),
        };
      }

      await activateRoom(run, next);

      return {
        alertText: "Encounter won",
        message: formatEncounterVictoryMessage(
          (await getAdventureRunById(run.id)) ?? run,
          currentRoom,
          result,
          rewards,
          next,
          memberCount,
        ),
      };
    }

    await updateRunRoom({
      roomId: currentRoom.id,
      status: "completed",
      resolved: true,
    });

    if (!next) {
      await updateAdventureRun({
        runId: run.id,
        status: "completed",
        currentRoomId: currentRoom.id,
        currentFloorNumber: currentRoom.floor_number,
      });
      await updateParty({
        partyId: party.id,
        status: "completed",
        activeRunId: null,
      });

      return {
        alertText: "Run complete",
        message: formatRunCompleteMessage((await getAdventureRunById(run.id)) ?? run, currentRoom, memberCount),
      };
    }

    await activateRoom(run, next);

    return {
      alertText: `${currentRoom.room_type.replaceAll("_", " ")} resolved`,
      message: formatActiveRoomPrompt((await getAdventureRunById(run.id)) ?? run, next, memberCount),
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

import {
  cancelActiveSession,
  createAuditLog,
  createCharacterAndCompleteSession,
  createPendingDispute,
  declinePendingDispute,
  ensureRulesVersion,
  getActiveCharacterByUserId,
  getEligibleCharacterByUserId,
  getActiveSessionByUserId,
  getPendingIncomingDisputes,
  getPendingOutgoingDisputes,
  listPublicCharacterStatuses,
  listRecentDisputesForUser,
  listRecentMatchesForUser,
  getUserById,
  getUserByTelegramUserId,
  getUserByUsername,
  resolvePendingDispute,
  setCharacterStatus,
  upsertActiveSession,
  upsertTelegramUser,
  type CharacterRecord,
  type DisputeRecord,
  type UserDisputeSummaryRecord,
  type UserMatchSummaryRecord,
  type PublicCharacterStatusRecord,
} from "@dm-bot/db";
import {
  resolveMatch,
  type CombatEvent,
  type CombatParticipant,
  type MatchResolutionResult,
} from "@dm-bot/engine";

export type OutboundMessage = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

export type NotificationMessage = {
  telegramUserId: string;
  message: OutboundMessage;
};

export type CommandResult = {
  message: OutboundMessage;
  notifications?: NotificationMessage[];
};

export type DisputeTarget =
  | {
      type: "username";
      username: string;
    }
  | {
      type: "telegram_user_id";
      telegramUserId: string;
    };

export type TelegramActor = {
  telegramUserId: string;
  telegramUsername?: string | undefined;
  telegramFirstName?: string | undefined;
  telegramLastName?: string | undefined;
};

type CharacterClass = "fighter" | "rogue" | "wizard" | "cleric";
type AbilityKey = keyof CharacterTemplate["abilityScores"];

type CharacterTemplate = {
  classKey: CharacterClass;
  label: string;
  summary: string;
  level: number;
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  derivedStats: {
    maxHp: number;
    armorClass: number;
    initiativeMod: number;
    proficiencyBonus: number;
    speed: number;
    saveMods: Record<string, number>;
  };
  loadout: {
    actions: string[];
    weapons?: string[];
    spells?: string[];
  };
  resourceState: {
    secondWindAvailable?: boolean;
    spellSlots?: Record<string, number>;
  };
};

type RolledAbilityDetail = {
  score: number;
  rolls: [number, number, number, number];
  dropped: number;
};

type RolledCharacterPlan = {
  abilityScores: CharacterTemplate["abilityScores"];
  derivedStats: CharacterTemplate["derivedStats"];
  details: Record<AbilityKey, RolledAbilityDetail>;
};

const classTemplates: Record<CharacterClass, CharacterTemplate> = {
  fighter: {
    classKey: "fighter",
    label: "Fighter",
    summary: "Durable front-liner with a steady melee attack and one self-heal per match.",
    level: 1,
    abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    derivedStats: {
      maxHp: 12,
      armorClass: 16,
      initiativeMod: 1,
      proficiencyBonus: 2,
      speed: 30,
      saveMods: { str: 5, dex: 1, con: 2, int: -1, wis: 0, cha: 0 },
    },
    loadout: {
      actions: ["Longsword Attack", "Second Wind"],
      weapons: ["Longsword"],
    },
    resourceState: {
      secondWindAvailable: true,
    },
  },
  rogue: {
    classKey: "rogue",
    label: "Rogue",
    summary: "Agile duelist with sharp initiative, precise rapier attacks, and lighter defenses.",
    level: 1,
    abilityScores: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 14 },
    derivedStats: {
      maxHp: 9,
      armorClass: 14,
      initiativeMod: 3,
      proficiencyBonus: 2,
      speed: 30,
      saveMods: { str: 0, dex: 5, con: 1, int: 3, wis: 0, cha: 2 },
    },
    loadout: {
      actions: ["Rapier Attack"],
      weapons: ["Rapier"],
    },
    resourceState: {},
  },
  wizard: {
    classKey: "wizard",
    label: "Wizard",
    summary: "Fragile caster with repeatable ranged offense and a limited burst spell.",
    level: 1,
    abilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    derivedStats: {
      maxHp: 8,
      armorClass: 12,
      initiativeMod: 2,
      proficiencyBonus: 2,
      speed: 30,
      saveMods: { str: -1, dex: 2, con: 1, int: 5, wis: 0, cha: 0 },
    },
    loadout: {
      actions: ["Fire Bolt", "Magic Missile"],
      spells: ["Fire Bolt", "Magic Missile"],
    },
    resourceState: {
      spellSlots: { level1: 2 },
    },
  },
  cleric: {
    classKey: "cleric",
    label: "Cleric",
    summary: "Balanced divine caster with solid defenses and radiant offense.",
    level: 1,
    abilityScores: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    derivedStats: {
      maxHp: 10,
      armorClass: 15,
      initiativeMod: 0,
      proficiencyBonus: 2,
      speed: 30,
      saveMods: { str: 1, dex: 0, con: 2, int: 0, wis: 5, cha: 1 },
    },
    loadout: {
      actions: ["Sacred Flame", "Guiding Bolt"],
      spells: ["Sacred Flame", "Guiding Bolt"],
    },
    resourceState: {
      spellSlots: { level1: 2 },
    },
  },
};

function displayName(actor: TelegramActor) {
  const name = [actor.telegramFirstName, actor.telegramLastName].filter(Boolean).join(" ").trim();

  return name || actor.telegramUsername || `telegram-${actor.telegramUserId}`;
}

function classButtons() {
  return [
    [{ text: "Fighter", callback_data: "cc:class:fighter" }],
    [{ text: "Rogue", callback_data: "cc:class:rogue" }],
    [{ text: "Wizard", callback_data: "cc:class:wizard" }],
    [{ text: "Cleric", callback_data: "cc:class:cleric" }],
  ];
}

function rollButtons(allowReroll: boolean) {
  return [
    [{ text: "Use These Rolls", callback_data: "cc:roll:accept" }],
    ...(allowReroll ? [[{ text: "Reroll Once", callback_data: "cc:roll:reroll" }]] : []),
  ];
}

function confirmCharacterButtons() {
  return [
    [{ text: "Enter the Arena", callback_data: "cc:confirm:create" }],
    [{ text: "Rename Character", callback_data: "cc:confirm:rename" }],
  ];
}

function startButtons(hasCharacter: boolean) {
  if (hasCharacter) {
    return [
      [{ text: "View Character", callback_data: "nav:character" }],
      [{ text: "Create Character", callback_data: "nav:create_character" }],
      [{ text: "Delete Character", callback_data: "nav:delete_character" }],
      [{ text: "Help", callback_data: "nav:help" }],
    ];
  }

  return [
    [{ text: "Create Character", callback_data: "nav:create_character" }],
    [{ text: "Help", callback_data: "nav:help" }],
  ];
}

function rulesConfigSnapshot() {
  return {
    version: "arena-v1-alpha",
    characterGeneration: {
      method: "4d6_drop_lowest_assigned_by_class_priority",
      rerollsAllowed: 1,
    },
    classes: Object.values(classTemplates).map((template) => ({
      classKey: template.classKey,
      level: template.level,
      summary: template.summary,
      loadout: template.loadout,
    })),
  };
}

function formatCharacterSummary(character: CharacterRecord) {
  const derived = character.derived_stats as { maxHp?: number; armorClass?: number };
  return [
    `Name: ${character.name}`,
    `Class: ${capitalize(character.class_key)}`,
    `Level: ${character.level}`,
    `Status: ${capitalize(character.status)}`,
    `HP: ${derived.maxHp ?? "?"}`,
    `AC: ${derived.armorClass ?? "?"}`,
    `Record: ${character.wins}-${character.losses}`,
  ].join("\n");
}

function formatAbilityScores(scores: CharacterTemplate["abilityScores"]) {
  return [
    `STR ${scores.str}`,
    `DEX ${scores.dex}`,
    `CON ${scores.con}`,
    `INT ${scores.int}`,
    `WIS ${scores.wis}`,
    `CHA ${scores.cha}`,
  ].join(" | ");
}

function formatRollPlan(template: CharacterTemplate, plan: RolledCharacterPlan, rerollsRemaining: number) {
  const lines: string[] = [
    `${template.label} selected.`,
    template.summary,
    "",
    "You rolled your ability scores with 4d6, dropping the lowest die each time.",
  ];

  const orderedAbilities: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

  for (const ability of orderedAbilities) {
    const detail = plan.details[ability];
    lines.push(
      `${ability.toUpperCase()} ${detail.score}: [${detail.rolls.join(", ")}] drop ${detail.dropped}`,
    );
  }

  lines.push("");
  lines.push(`Derived combat stats: HP ${plan.derivedStats.maxHp}, AC ${plan.derivedStats.armorClass}, Init ${plan.derivedStats.initiativeMod >= 0 ? "+" : ""}${plan.derivedStats.initiativeMod}`);
  lines.push(`Rerolls remaining: ${rerollsRemaining}`);
  lines.push("");
  lines.push("Use these rolls or reroll once, then you will name your character.");

  return lines.join("\n");
}

function formatCharacterPreview(
  template: CharacterTemplate,
  name: string,
  abilityScores: CharacterTemplate["abilityScores"],
  derivedStats: CharacterTemplate["derivedStats"],
) {
  return [
    "Character preview:",
    "",
    `Name: ${name}`,
    `Class: ${template.label}`,
    `Level: ${template.level}`,
    "",
    formatAbilityScores(abilityScores),
    "",
    `HP ${derivedStats.maxHp} | AC ${derivedStats.armorClass} | Init ${derivedStats.initiativeMod >= 0 ? "+" : ""}${derivedStats.initiativeMod}`,
    `Actions: ${template.loadout.actions.join(", ")}`,
    "",
    "If this looks right, enter the arena.",
  ].join("\n");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isSupportedClass(value: string): value is CharacterClass {
  return value in classTemplates;
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollAbilityDetail(): RolledAbilityDetail {
  const rolls = [rollD6(), rollD6(), rollD6(), rollD6()] as [number, number, number, number];
  const sorted = [...rolls].sort((left, right) => left - right);
  const dropped = sorted[0]!;
  const score = sorted.slice(1).reduce((total, value) => total + value, 0);

  return {
    score,
    rolls,
    dropped,
  };
}

function classAbilityPriority(classKey: CharacterClass): AbilityKey[] {
  switch (classKey) {
    case "fighter":
      return ["str", "con", "dex", "wis", "cha", "int"];
    case "rogue":
      return ["dex", "con", "cha", "int", "wis", "str"];
    case "wizard":
      return ["int", "dex", "con", "wis", "cha", "str"];
    case "cleric":
      return ["wis", "con", "str", "cha", "dex", "int"];
  }
}

function computeDerivedStats(classKey: CharacterClass, abilityScores: CharacterTemplate["abilityScores"]): CharacterTemplate["derivedStats"] {
  const dexMod = abilityModifier(abilityScores.dex);
  const conMod = abilityModifier(abilityScores.con);
  const wisMod = abilityModifier(abilityScores.wis);
  const intMod = abilityModifier(abilityScores.int);
  const strMod = abilityModifier(abilityScores.str);
  const chaMod = abilityModifier(abilityScores.cha);
  const proficiencyBonus = 2;

  switch (classKey) {
    case "fighter":
      return {
        maxHp: Math.max(1, 10 + conMod),
        armorClass: 16,
        initiativeMod: dexMod,
        proficiencyBonus,
        speed: 30,
        saveMods: {
          str: strMod + proficiencyBonus,
          dex: dexMod,
          con: conMod + proficiencyBonus,
          int: intMod,
          wis: wisMod,
          cha: chaMod,
        },
      };
    case "rogue":
      return {
        maxHp: Math.max(1, 8 + conMod),
        armorClass: 11 + dexMod,
        initiativeMod: dexMod,
        proficiencyBonus,
        speed: 30,
        saveMods: {
          str: strMod,
          dex: dexMod + proficiencyBonus,
          con: conMod,
          int: intMod + proficiencyBonus,
          wis: wisMod,
          cha: chaMod,
        },
      };
    case "wizard":
      return {
        maxHp: Math.max(1, 6 + conMod),
        armorClass: 10 + dexMod,
        initiativeMod: dexMod,
        proficiencyBonus,
        speed: 30,
        saveMods: {
          str: strMod,
          dex: dexMod,
          con: conMod,
          int: intMod + proficiencyBonus,
          wis: wisMod + proficiencyBonus,
          cha: chaMod,
        },
      };
    case "cleric":
      return {
        maxHp: Math.max(1, 8 + conMod),
        armorClass: 15 + clamp(dexMod, -5, 2),
        initiativeMod: dexMod,
        proficiencyBonus,
        speed: 30,
        saveMods: {
          str: strMod,
          dex: dexMod,
          con: conMod,
          int: intMod,
          wis: wisMod + proficiencyBonus,
          cha: chaMod + proficiencyBonus,
        },
      };
  }
}

function buildRolledCharacterPlan(template: CharacterTemplate): RolledCharacterPlan {
  const details = {} as Record<AbilityKey, RolledAbilityDetail>;
  const rolledPool = Array.from({ length: 6 }, () => rollAbilityDetail()).sort((left, right) => right.score - left.score);
  const priority = classAbilityPriority(template.classKey);

  for (const [index, ability] of priority.entries()) {
    details[ability] = rolledPool[index]!;
  }

  const abilityScores = {
    str: details.str.score,
    dex: details.dex.score,
    con: details.con.score,
    int: details.int.score,
    wis: details.wis.score,
    cha: details.cha.score,
  };

  return {
    abilityScores,
    derivedStats: computeDerivedStats(template.classKey, abilityScores),
    details,
  };
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
  return "Your arena access is currently restricted. Please contact an administrator if you believe this is a mistake.";
}

function frozenCharacterMessage(character: CharacterRecord) {
  return `${character.name} is currently frozen and cannot enter new disputes or be used for new arena actions.`;
}

function helpText() {
  return [
    "This bot resolves disputes through automated 1v1 fantasy combat using a simplified 5e-style ruleset.",
    "",
    "Commands:",
    "/start",
    "/help",
    "/create_character",
    "/character",
    "/inventory",
    "/delete_character",
    "/record",
    "/history",
    "/status",
    "/party",
    "/dispute @username reason",
    "/accept",
    "/decline",
    "/cancel",
    "",
    "Group chats:",
    "- /start, /help, /status, /party, and /dispute work in groups",
    "- character creation, inventory, and sheet management should be done in DM",
  ].join("\n");
}

function formatPublicCharacterStatus(character: PublicCharacterStatusRecord) {
  const owner = character.telegram_username ? `@${character.telegram_username}` : character.user_display_name;

  return [
    `${character.name} (${capitalize(character.class_key)} ${character.level})`,
    `owner: ${owner}`,
    `status: ${capitalize(character.status)}`,
    `record: ${character.wins}-${character.losses} (${character.matches_played} matches)`,
  ].join(" | ");
}

function formatMatchOutcome(match: UserMatchSummaryRecord) {
  const outcome = match.match_status === "completed"
    ? match.is_winner
      ? "Win"
      : "Loss"
    : capitalize(match.match_status);
  const rounds = match.rounds_completed ? `, ${match.rounds_completed} rounds` : "";
  const endReason = match.end_reason ? `, ${match.end_reason}` : "";

  return `${outcome} vs ${match.opponent_character_name}${rounds}${endReason}`;
}

function formatDisputePerspective(dispute: UserDisputeSummaryRecord, userId: string) {
  if (dispute.challenger_user_id === userId) {
    return `You challenged ${dispute.target_display_name} (${dispute.target_character_name})`;
  }

  return `${dispute.challenger_display_name} (${dispute.challenger_character_name}) challenged you`;
}

function formatTimestamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDisputeCommand(text: string) {
  const match = text.match(/^\/dispute(?:@[A-Za-z0-9_]+)?\s+(@[A-Za-z0-9_]{3,})\s+([\s\S]+)$/);

  if (!match) {
    return null;
  }

  return {
    username: match[1]!,
    reason: match[2]!.trim(),
  };
}

function parseReplyDisputeCommand(text: string) {
  const match = text.match(/^\/dispute(?:@[A-Za-z0-9_]+)?\s+([\s\S]+)$/);

  if (!match) {
    return null;
  }

  const reason = match[1]!.trim();

  if (!reason) {
    return null;
  }

  return { reason };
}

function toCombatParticipant(character: CharacterRecord, slot: 1 | 2): CombatParticipant {
  return {
    slot,
    name: character.name,
    classKey: character.class_key as CombatParticipant["classKey"],
    level: character.level,
    abilityScores: character.ability_scores as CombatParticipant["abilityScores"],
    derivedStats: character.derived_stats as CombatParticipant["derivedStats"],
    loadout: character.loadout as CombatParticipant["loadout"],
    resourceState: character.resource_state as CombatParticipant["resourceState"],
  };
}

function buildMatchSummary(
  challengerCharacter: CharacterRecord,
  targetCharacter: CharacterRecord,
  result: MatchResolutionResult,
  reason: string,
) {
  const winner = result.finalStates.find((state) => state.slot === result.winnerParticipantSlot)!;
  const loser = result.finalStates.find((state) => state.slot !== result.winnerParticipantSlot)!;
  const eventLines = formatCombatLog(result.events);

  return [
    "Arena Verdict",
    "",
    `${challengerCharacter.name} vs ${targetCharacter.name}`,
    `Reason: ${reason}`,
    "",
    `Winner: ${winner.name}`,
    `Method: ${formatMatchEndReason(result.endReason)}`,
    `Final HP: ${winner.name} ${winner.currentHp}/${winner.maxHp}, ${loser.name} ${loser.currentHp}/${loser.maxHp}`,
    `Rounds: ${result.roundsCompleted}`,
    "",
    "Combat Log",
    ...eventLines,
    "",
    `${winner.name} stands victorious.`,
  ].join("\n");
}

function formatCombatLog(events: CombatEvent[]) {
  const lines: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "initiative":
        lines.push(`- ${event.summary}`);
        break;
      case "turn_start":
        lines.push("");
        lines.push(`Round ${event.round}`);
        lines.push(`${"-".repeat(`Round ${event.round}`.length)}`);
        lines.push(`- ${event.summary.replace(/^Round \d+:\s*/, "")}`);
        break;
      case "action":
        lines.push(`- ${event.summary}`);
        break;
      case "attack":
        lines.push(`${event.isCritical ? "*Critical hit* " : "- "}${event.summary}`);
        break;
      case "save":
        lines.push(`- ${event.summary}`);
        break;
      case "damage":
        lines.push(`${event.targetHpAfter === 0 ? "*Finishing blow* " : "- "}${event.summary}`);
        break;
      case "heal":
        lines.push(`- ${event.summary}`);
        break;
      case "effect":
        lines.push(`*Effect* ${event.summary}`);
        break;
      case "match_end":
        lines.push("");
        lines.push(`Verdict: ${event.summary}`);
        break;
    }
  }

  return lines;
}

function formatMatchEndReason(reason: MatchResolutionResult["endReason"]) {
  switch (reason) {
    case "knockout":
      return "Knockout";
    case "round_limit_hp_pct":
      return "Round limit, higher HP percentage";
    case "round_limit_damage":
      return "Round limit, more damage dealt";
    case "round_limit_hits":
      return "Round limit, more successful hits";
    case "sudden_death":
      return "Sudden death tie-break";
  }
}

function toPersistedEvent(
  event: CombatEvent,
  challengerCharacterId: string,
  targetCharacterId: string,
  sequenceNumber: number,
) {
  const actorCharacterId =
    "participantSlot" in event
      ? event.participantSlot === 1
        ? challengerCharacterId
        : targetCharacterId
      : undefined;
  const targetCharacterIdValue =
    "targetSlot" in event
      ? event.targetSlot === 1
        ? challengerCharacterId
        : targetCharacterId
      : undefined;

  return {
    eventType: event.type,
    roundNumber: "round" in event ? event.round : 0,
    sequenceNumber,
    publicText: event.summary,
    payload: event as unknown as Record<string, unknown>,
    ...(actorCharacterId ? { actorCharacterId } : {}),
    ...(targetCharacterIdValue ? { targetCharacterId: targetCharacterIdValue } : {}),
  };
}

export function buildReadinessSnapshot() {
  return {
    database: "pending" as const,
    rulesConfig: "pending" as const,
  };
}

export function previewMatchResolution() {
  return {
    winnerParticipantSlot: null,
    endReason: "error" as const,
    events: [
      {
        type: "not_implemented",
        summary: "Combat engine has not been implemented yet.",
      },
    ],
  };
}

export async function handleStart(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: [
        `Welcome back, ${displayName(actor)}.`,
        restrictedUserMessage(),
      ].join("\n\n"),
    };
  }

  if (character) {
    return {
      text: [
        `Welcome back to the arena, ${displayName(actor)}.`,
        "",
        formatCharacterSummary(character),
      ].join("\n"),
      replyMarkup: {
        inline_keyboard: startButtons(true),
      },
    };
  }

  return {
    text: [
      "Welcome to the arena.",
      "You settle disputes by sending a fantasy character into an automated 5e-style duel.",
      "",
      "You do not have a character yet.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: startButtons(false),
    },
  };
}

export async function handleHelp(): Promise<OutboundMessage> {
  return {
    text: helpText(),
  };
}

export async function handleCharacter(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (!character) {
    return {
      text: "You do not have a character yet. Use /create_character to enter the arena.",
      replyMarkup: {
        inline_keyboard: startButtons(false),
      },
    };
  }

  return {
    text: formatCharacterSummary(character),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "Create Character", callback_data: "nav:create_character" }],
        [{ text: "Delete Character", callback_data: "nav:delete_character" }],
      ],
    },
  };
}

export async function handleDeleteCharacterPrompt(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (!character) {
    return {
      text: "You do not have a character to delete right now.",
      replyMarkup: {
        inline_keyboard: startButtons(false),
      },
    };
  }

  return {
    text: [
      `Delete ${character.name}?`,
      "",
      "This will retire your current character from future use.",
      "Historical disputes and match records will remain intact.",
      "This cannot be undone from Telegram.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "Confirm Delete", callback_data: "character:delete:confirm" }],
        [{ text: "Keep Character", callback_data: "character:delete:cancel" }],
      ],
    },
  };
}

export async function handleDeleteCharacterConfirm(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (!character) {
    return {
      text: "You do not have a character to delete right now.",
      replyMarkup: {
        inline_keyboard: startButtons(false),
      },
    };
  }

  const retiredCharacter = await setCharacterStatus({
    characterId: character.id,
    status: "retired",
  });

  if (!retiredCharacter) {
    return {
      text: "Your character could not be deleted right now. Please try again.",
    };
  }

  await cancelActiveSession(user.id);

  await createAuditLog({
    actorType: "user",
    actorUserId: user.id,
    action: "character_deleted",
    targetType: "character",
    targetId: character.id,
    metadata: {
      characterName: character.name,
      previousStatus: character.status,
      nextStatus: "retired",
    },
  });

  return {
    text: [
      `${character.name} has been retired.`,
      "",
      "You can create a new character whenever you're ready.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [[{ text: "Create Character", callback_data: "nav:create_character" }]],
    },
  };
}

export async function handleRecord(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (!character) {
    return {
      text: "You do not have a character yet. Use /create_character to enter the arena.",
      replyMarkup: {
        inline_keyboard: startButtons(false),
      },
    };
  }

  const recentMatches = await listRecentMatchesForUser(user.id, 5);
  const recentMatchLines = recentMatches.length === 0
    ? ["No completed arena history yet."]
    : recentMatches.map((match) => `- ${formatTimestamp(match.created_at)}: ${formatMatchOutcome(match)}`);

  return {
    text: [
      `${character.name} the ${capitalize(character.class_key)}`,
      `Record: ${character.wins}-${character.losses} (${character.matches_played} matches)`,
      "",
      "Recent matches:",
      ...recentMatchLines,
    ].join("\n"),
  };
}

export async function handleHistory(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  const disputes = await listRecentDisputesForUser(user.id, 8);

  if (disputes.length === 0) {
    return {
      text: "You do not have any dispute history yet.",
    };
  }

  return {
    text: [
      "Recent disputes:",
      ...disputes.map(
        (dispute) =>
          `- ${formatTimestamp(dispute.created_at)}: ${formatDisputePerspective(dispute, user.id)}. Status: ${dispute.status}. Reason: ${dispute.reason}`,
      ),
    ].join("\n"),
  };
}

export async function handleStatus(): Promise<OutboundMessage> {
  const characters = await listPublicCharacterStatuses(24);

  if (characters.length === 0) {
    return {
      text: "No arena characters are registered yet. Use /create_character in DM to join the roster.",
    };
  }

  return {
    text: [
      "Arena roster:",
      ...characters.map((character, index) => `${index + 1}. ${formatPublicCharacterStatus(character)}`),
    ].join("\n"),
  };
}

export async function handleCancel(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  const cancelled = await cancelActiveSession(user.id);

  return {
    text: cancelled
      ? "Your current bot flow has been cancelled."
      : "You do not have an active bot flow right now.",
  };
}

export async function handleCreateCharacter(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const existingCharacter = await getActiveCharacterByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (existingCharacter) {
    return {
      text: [
        existingCharacter.status === "frozen"
          ? "You already have a frozen character in v1."
          : "You already have an active character in v1.",
        "",
        ...(existingCharacter.status === "frozen" ? [frozenCharacterMessage(existingCharacter), ""] : []),
        formatCharacterSummary(existingCharacter),
      ].join("\n"),
    };
  }

  await upsertActiveSession({
    userId: user.id,
    flowType: "character_creation",
    stepKey: "choose_class",
    data: {},
  });

  return {
    text: [
      "Choose your arena class.",
      "You will roll your character's ability scores with 4d6, drop the lowest die, then name the character.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: classButtons(),
    },
  };
}

export async function handleCallback(actor: TelegramActor, callbackData: string): Promise<{
  alertText?: string;
  message?: OutboundMessage;
  notifications?: NotificationMessage[];
}> {
  if (callbackData === "nav:create_character") {
    return {
      message: await handleCreateCharacter(actor),
    };
  }

  if (callbackData === "nav:delete_character") {
    return {
      message: await handleDeleteCharacterPrompt(actor),
    };
  }

  if (callbackData === "nav:character") {
    return {
      message: await handleCharacter(actor),
    };
  }

  if (callbackData === "nav:help") {
    return {
      message: await handleHelp(),
    };
  }

  if (callbackData === "character:delete:confirm") {
    return {
      alertText: "Character deleted",
      message: await handleDeleteCharacterConfirm(actor),
    };
  }

  if (callbackData === "character:delete:cancel") {
    return {
      alertText: "Deletion cancelled",
      message: await handleCharacter(actor),
    };
  }

  if (callbackData.startsWith("dispute:accept:")) {
    const disputeId = callbackData.slice("dispute:accept:".length);
    const result = await handleAccept(actor, disputeId);
    return {
      alertText: "Dispute accepted",
      message: result.message,
      ...(result.notifications ? { notifications: result.notifications } : {}),
    };
  }

  if (callbackData.startsWith("dispute:decline:")) {
    const disputeId = callbackData.slice("dispute:decline:".length);
    const result = await handleDecline(actor, disputeId);
    return {
      alertText: "Dispute declined",
      message: result.message,
      ...(result.notifications ? { notifications: result.notifications } : {}),
    };
  }

  if (callbackData === "cc:roll:accept") {
    const user = await ensureUser(actor);
    const session = await getActiveSessionByUserId(user.id);

    if (!session || session.flow_type !== "character_creation" || session.step_key !== "awaiting_roll_choice") {
      return {
        alertText: "This character creation session has expired. Start again with /create_character.",
      };
    }

    await upsertActiveSession({
      userId: user.id,
      flowType: "character_creation",
      stepKey: "awaiting_name",
      data: session.data,
    });

    return {
      alertText: "Rolls locked in",
      message: {
        text: [
          "Your rolls are locked in.",
          "",
          `Ability scores: ${formatAbilityScores(session.data.abilityScores as CharacterTemplate["abilityScores"])}`,
          "",
          "Send the name you want your arena character to use.",
        ].join("\n"),
      },
    };
  }

  if (callbackData === "cc:roll:reroll") {
    const user = await ensureUser(actor);
    const session = await getActiveSessionByUserId(user.id);

    if (!session || session.flow_type !== "character_creation" || session.step_key !== "awaiting_roll_choice") {
      return {
        alertText: "This character creation session has expired. Start again with /create_character.",
      };
    }

    const classKey = String(session.data.classKey ?? "");
    const rerollsRemaining = Number(session.data.rerollsRemaining ?? 0);

    if (!isSupportedClass(classKey)) {
      return {
        alertText: "This character creation session is invalid. Start again with /create_character.",
      };
    }

    if (rerollsRemaining <= 0) {
      return {
        alertText: "No rerolls remaining.",
      };
    }

    const template = classTemplates[classKey];
    const plan = buildRolledCharacterPlan(template);

    await upsertActiveSession({
      userId: user.id,
      flowType: "character_creation",
      stepKey: "awaiting_roll_choice",
      data: {
        classKey: template.classKey,
        abilityScores: plan.abilityScores,
        derivedStats: plan.derivedStats,
        rollDetails: plan.details,
        rerollsRemaining: rerollsRemaining - 1,
      },
    });

    return {
      alertText: "Reroll complete",
      message: {
        text: formatRollPlan(template, plan, rerollsRemaining - 1),
        replyMarkup: {
          inline_keyboard: rollButtons(rerollsRemaining - 1 > 0),
        },
      },
    };
  }

  if (callbackData === "cc:confirm:rename") {
    const user = await ensureUser(actor);
    const session = await getActiveSessionByUserId(user.id);

    if (!session || session.flow_type !== "character_creation" || session.step_key !== "awaiting_confirmation") {
      return {
        alertText: "This character creation session has expired. Start again with /create_character.",
      };
    }

    await upsertActiveSession({
      userId: user.id,
      flowType: "character_creation",
      stepKey: "awaiting_name",
      data: {
        ...session.data,
        pendingName: undefined,
      },
    });

    return {
      alertText: "Rename your character",
      message: {
        text: "Send a different character name.",
      },
    };
  }

  if (callbackData === "cc:confirm:create") {
    const user = await ensureUser(actor);
    const session = await getActiveSessionByUserId(user.id);

    if (!session || session.flow_type !== "character_creation" || session.step_key !== "awaiting_confirmation") {
      return {
        alertText: "This character creation session has expired. Start again with /create_character.",
      };
    }

    const classKey = String(session.data.classKey ?? "");
    const pendingName = String(session.data.pendingName ?? "").trim();
    const abilityScores = session.data.abilityScores as CharacterTemplate["abilityScores"] | undefined;
    const derivedStats = session.data.derivedStats as CharacterTemplate["derivedStats"] | undefined;

    if (!isSupportedClass(classKey) || !pendingName || !abilityScores || !derivedStats) {
      return {
        alertText: "This character creation session is invalid. Start again with /create_character.",
      };
    }

    const existingCharacter = await getActiveCharacterByUserId(user.id);

    if (existingCharacter) {
      return {
        alertText: "You already have a character.",
        message: {
          text:
            existingCharacter.status === "frozen"
              ? `${frozenCharacterMessage(existingCharacter)} Use /character to view it.`
              : "You already have an active character. Use /character to view it.",
        },
      };
    }

    const template = classTemplates[classKey];
    const rulesVersion = await ensureRulesVersion({
      versionKey: "arena-v1-alpha",
      summary: "Initial starter rules for automated 1v1 arbitration combat.",
      config: rulesConfigSnapshot(),
    });

    const character = await createCharacterAndCompleteSession({
      userId: user.id,
      name: pendingName,
      classKey: template.classKey,
      level: template.level,
      rulesVersionId: rulesVersion.id,
      abilityScores,
      derivedStats,
      loadout: template.loadout,
      resourceState: template.resourceState,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "character_created",
      targetType: "character",
      targetId: character.id,
      metadata: {
        characterName: character.name,
        classKey: character.class_key,
        level: character.level,
      },
    });

    return {
      alertText: "Character created",
      message: {
        text: [
          "Your character is ready.",
          "",
          formatCharacterSummary(character),
          formatAbilityScores(abilityScores),
        ].join("\n"),
        replyMarkup: {
          inline_keyboard: [[{ text: "View Character", callback_data: "nav:character" }]],
        },
      },
    };
  }

  if (!callbackData.startsWith("cc:class:")) {
    return {
      alertText: "That action is not supported yet.",
    };
  }

  const classKey = callbackData.slice("cc:class:".length);

  if (!isSupportedClass(classKey)) {
    return {
      alertText: "That class is not supported.",
    };
  }

  const user = await ensureUser(actor);
  const session = await getActiveSessionByUserId(user.id);

  if (user.status !== "active") {
    return {
      alertText: "Arena access restricted",
      message: {
        text: restrictedUserMessage(),
      },
    };
  }

  if (!session || session.flow_type !== "character_creation") {
    return {
      alertText: "This character creation session has expired. Start again with /create_character.",
    };
  }

  const template = classTemplates[classKey];
  const plan = buildRolledCharacterPlan(template);

  await upsertActiveSession({
    userId: user.id,
    flowType: "character_creation",
    stepKey: "awaiting_roll_choice",
    data: {
      classKey: template.classKey,
      abilityScores: plan.abilityScores,
      derivedStats: plan.derivedStats,
      rollDetails: plan.details,
      rerollsRemaining: 1,
    },
  });

  return {
    alertText: `${template.label} selected`,
    message: {
      text: formatRollPlan(template, plan, 1),
      replyMarkup: {
        inline_keyboard: rollButtons(true),
      },
    },
  };
}

export async function handleTextMessage(
  actor: TelegramActor,
  text: string,
): Promise<OutboundMessage | null> {
  const user = await ensureUser(actor);
  const session = await getActiveSessionByUserId(user.id);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  if (!session || session.flow_type !== "character_creation" || session.step_key !== "awaiting_name") {
    return null;
  }

  const proposedName = text.trim();

  if (proposedName.length < 2 || proposedName.length > 40) {
    return {
      text: "Character names must be between 2 and 40 characters. Send a different name.",
    };
  }

  const classKey = String(session.data.classKey ?? "");

  if (!isSupportedClass(classKey)) {
    return {
      text: "Your character creation session is invalid. Please restart with /create_character.",
    };
  }

  const existingCharacter = await getActiveCharacterByUserId(user.id);

  if (existingCharacter) {
    return {
      text:
        existingCharacter.status === "frozen"
          ? `${frozenCharacterMessage(existingCharacter)} Use /character to view it.`
          : "You already have an active character. Use /character to view it.",
    };
  }

  const template = classTemplates[classKey];
  const abilityScores = session.data.abilityScores as CharacterTemplate["abilityScores"] | undefined;
  const derivedStats = session.data.derivedStats as CharacterTemplate["derivedStats"] | undefined;

  if (!abilityScores || !derivedStats) {
    return {
      text: "Your rolled stats are missing. Please restart with /create_character.",
    };
  }

  await upsertActiveSession({
    userId: user.id,
    flowType: "character_creation",
    stepKey: "awaiting_confirmation",
    data: {
      ...session.data,
      pendingName: proposedName,
    },
  });

  return {
    text: formatCharacterPreview(template, proposedName, abilityScores, derivedStats),
    replyMarkup: {
      inline_keyboard: confirmCharacterButtons(),
    },
  };
}

export async function handleDisputeCommand(params: {
  actor: TelegramActor;
  reason: string;
  target: DisputeTarget;
}): Promise<CommandResult> {
  const { actor, reason, target } = params;
  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    return {
      message: {
        text: "Please include a short reason for the dispute.",
      },
    };
  }

  const challenger = await ensureUser(actor);

  if (challenger.status !== "active") {
    return {
      message: {
        text: restrictedUserMessage(),
      },
    };
  }

  const challengerCharacter = await getEligibleCharacterByUserId(challenger.id);

  if (!challengerCharacter) {
    const currentCharacter = await getActiveCharacterByUserId(challenger.id);

    return {
      message: {
        text: currentCharacter
          ? frozenCharacterMessage(currentCharacter)
          : "You need a character before you can start a dispute.",
      },
    };
  }

  const targetUser =
    target.type === "username"
      ? await getUserByUsername(target.username)
      : await getUserByTelegramUserId(target.telegramUserId);

  if (!targetUser) {
    return {
      message: {
        text: "I couldn't identify that target yet. They need to have started the bot first and created a character.",
      },
    };
  }

  if (targetUser.id === challenger.id) {
    return {
      message: {
        text: "You cannot challenge yourself in v1.",
      },
    };
  }

  if (targetUser.status !== "active") {
    return {
      message: {
        text: `${targetUser.display_name} is not currently eligible for arena disputes.`,
      },
    };
  }

  const targetCharacter = await getEligibleCharacterByUserId(targetUser.id);

  if (!targetCharacter) {
    const currentTargetCharacter = await getActiveCharacterByUserId(targetUser.id);

    return {
      message: {
        text: currentTargetCharacter
          ? `${targetUser.display_name}'s character is currently frozen and cannot accept disputes.`
          : `${targetUser.display_name} does not have an active character yet.`,
      },
    };
  }

  const existingOutgoing = await getPendingOutgoingDisputes(challenger.id);

  if (existingOutgoing.some((dispute) => dispute.target_user_id === targetUser.id)) {
    return {
      message: {
        text: `You already have a pending dispute with ${targetUser.display_name}.`,
      },
    };
  }

  const dispute = await createPendingDispute({
    challengerUserId: challenger.id,
    targetUserId: targetUser.id,
    challengerCharacterId: challengerCharacter.id,
    targetCharacterId: targetCharacter.id,
    reason: normalizedReason,
  });

  await createAuditLog({
    actorType: "user",
    actorUserId: challenger.id,
    action: "dispute_created",
    targetType: "dispute",
    targetId: dispute.id,
    reason: dispute.reason,
    metadata: {
      challengerCharacterId: challengerCharacter.id,
      challengerCharacterName: challengerCharacter.name,
      targetUserId: targetUser.id,
      targetCharacterId: targetCharacter.id,
      targetCharacterName: targetCharacter.name,
    },
  });

  return {
    message: {
      text: `Challenge sent to ${targetUser.display_name}.\nReason: ${dispute.reason}`,
    },
    notifications: [
      {
        telegramUserId: targetUser.telegram_user_id,
        message: {
          text: [
            `${challenger.display_name} has challenged you to arbitration.`,
            `Their character: ${challengerCharacter.name}`,
            `Your character: ${targetCharacter.name}`,
            `Reason: ${dispute.reason}`,
          ].join("\n"),
          replyMarkup: {
            inline_keyboard: [
              [{ text: "Accept", callback_data: `dispute:accept:${dispute.id}` }],
              [{ text: "Decline", callback_data: `dispute:decline:${dispute.id}` }],
            ],
          },
        },
      },
    ],
  };
}

export async function handleParsedDisputeCommand(
  actor: TelegramActor,
  text: string,
): Promise<CommandResult> {
  const parsed = parseDisputeCommand(text);

  if (!parsed) {
    return {
      message: {
        text: "Use /dispute @username reason, or reply to someone's message with /dispute reason",
      },
    };
  }

  return handleDisputeCommand({
    actor,
    reason: parsed.reason,
    target: {
      type: "username",
      username: parsed.username,
    },
  });
}

export async function handleReplyDisputeCommand(params: {
  actor: TelegramActor;
  text: string;
  repliedUserTelegramId: string;
}): Promise<CommandResult> {
  const parsed = parseReplyDisputeCommand(params.text);

  if (!parsed) {
    return {
      message: {
        text: "Reply to someone's message with /dispute reason",
      },
    };
  }

  return handleDisputeCommand({
    actor: params.actor,
    reason: parsed.reason,
    target: {
      type: "telegram_user_id",
      telegramUserId: params.repliedUserTelegramId,
    },
  });
}

async function resolveAcceptedDispute(actor: TelegramActor, dispute: DisputeRecord): Promise<CommandResult> {
  const targetUser = await ensureUser(actor);
  const challengerUser = await getUserById(dispute.challenger_user_id);

  if (targetUser.status !== "active") {
    return {
      message: {
        text: restrictedUserMessage(),
      },
    };
  }

  if (!challengerUser) {
    return {
      message: {
        text: "The challenger could not be found anymore.",
      },
    };
  }

  if (challengerUser.status !== "active") {
    return {
      message: {
        text: "The challenger is no longer eligible for this dispute.",
      },
    };
  }

  const challengerCharacter = await getEligibleCharacterByUserId(dispute.challenger_user_id);
  const targetCharacter = await getEligibleCharacterByUserId(targetUser.id);

  if (!challengerCharacter || !targetCharacter) {
    return {
      message: {
        text: "One of the characters is no longer eligible for this dispute.",
      },
    };
  }

  const result = resolveMatch({
    participants: [
      toCombatParticipant(challengerCharacter, 1),
      toCombatParticipant(targetCharacter, 2),
    ],
  });

  const rulesVersion = await ensureRulesVersion({
    versionKey: "arena-v1-alpha",
    summary: "Initial starter rules for automated 1v1 arbitration combat.",
    config: rulesConfigSnapshot(),
  });

  let resolvedMatchId: string | null = null;

  try {
    const persisted = await resolvePendingDispute({
      disputeId: dispute.id,
      targetUserId: targetUser.id,
      rulesVersionId: rulesVersion.id,
      rulesSnapshot: rulesConfigSnapshot(),
      challengerCharacter,
      targetCharacter,
      winnerCharacterId:
        result.winnerParticipantSlot === 1 ? challengerCharacter.id : targetCharacter.id,
      endReason: result.endReason,
      roundsCompleted: result.roundsCompleted,
      events: result.events.map((event, index) =>
        toPersistedEvent(event, challengerCharacter.id, targetCharacter.id, index + 1),
      ),
    });

    resolvedMatchId = persisted.match.id;
  } catch {
    return {
      message: {
        text: "The duel could not be finalized safely. The dispute is still pending and can be retried shortly.",
      },
      notifications: [
        {
          telegramUserId: challengerUser.telegram_user_id,
          message: {
            text: `${targetUser.display_name} tried to accept your dispute, but the duel could not be finalized safely yet. It remains pending for now.`,
          },
        },
      ],
    };
  }

  await createAuditLog({
    actorType: "user",
    actorUserId: targetUser.id,
    action: "dispute_accepted",
    targetType: "dispute",
    targetId: dispute.id,
    reason: dispute.reason,
    metadata: {
      challengerUserId: challengerUser.id,
      challengerCharacterId: challengerCharacter.id,
      targetCharacterId: targetCharacter.id,
    },
  });

  await createAuditLog({
    actorType: "system",
    action: "match_completed",
    targetType: "match",
    targetId: resolvedMatchId,
    reason: dispute.reason,
    metadata: {
      disputeId: dispute.id,
      winnerCharacterId:
        result.winnerParticipantSlot === 1 ? challengerCharacter.id : targetCharacter.id,
      winnerCharacterName:
        result.winnerParticipantSlot === 1 ? challengerCharacter.name : targetCharacter.name,
      endReason: result.endReason,
      roundsCompleted: result.roundsCompleted,
    },
  });

  const summary = buildMatchSummary(
    challengerCharacter,
    targetCharacter,
    result,
    dispute.reason,
  );

  return {
    message: {
      text: summary,
    },
    notifications: [
      {
        telegramUserId: challengerUser.telegram_user_id,
        message: {
          text: summary,
        },
      },
    ],
  };
}

export async function handleAccept(
  actor: TelegramActor,
  explicitDisputeId?: string,
): Promise<CommandResult> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      message: {
        text: restrictedUserMessage(),
      },
    };
  }

  const disputes = await getPendingIncomingDisputes(user.id);

  if (disputes.length === 0) {
    return {
      message: {
        text: "You have no pending disputes to accept.",
      },
    };
  }

  const dispute = explicitDisputeId
    ? disputes.find((candidate) => candidate.id === explicitDisputeId)
    : disputes.length === 1
      ? disputes[0]
      : undefined;

  if (!dispute) {
    return {
      message: {
        text: "You have multiple pending disputes. Use the inline buttons to choose one.",
      },
    };
  }

  return resolveAcceptedDispute(actor, dispute);
}

export async function handleDecline(
  actor: TelegramActor,
  explicitDisputeId?: string,
): Promise<CommandResult> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      message: {
        text: restrictedUserMessage(),
      },
    };
  }

  const disputes = await getPendingIncomingDisputes(user.id);

  if (disputes.length === 0) {
    return {
      message: {
        text: "You have no pending disputes to decline.",
      },
    };
  }

  const dispute = explicitDisputeId
    ? disputes.find((candidate) => candidate.id === explicitDisputeId)
    : disputes.length === 1
      ? disputes[0]
      : undefined;

  if (!dispute) {
    return {
      message: {
        text: "You have multiple pending disputes. Use the inline buttons to choose one.",
      },
    };
  }

  const declined = await declinePendingDispute(dispute.id, user.id);
  const challenger = await getUserById(dispute.challenger_user_id);

  if (declined) {
    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "dispute_declined",
      targetType: "dispute",
      targetId: dispute.id,
      reason: dispute.reason,
      metadata: {
        challengerUserId: dispute.challenger_user_id,
      },
    });
  }

  return {
    message: {
      text: declined ? "You declined the dispute." : "That dispute is no longer pending.",
    },
    notifications: challenger && declined
      ? [
          {
            telegramUserId: challenger.telegram_user_id,
            message: {
              text: `${user.display_name} declined your dispute: ${dispute.reason}`,
            },
          },
        ]
      : [],
  };
}

import {
  cancelActiveSession,
  createCharacterAndCompleteSession,
  createPendingDispute,
  declinePendingDispute,
  ensureRulesVersion,
  getActiveCharacterByUserId,
  getActiveSessionByUserId,
  getPendingIncomingDisputes,
  getPendingOutgoingDisputes,
  listRecentDisputesForUser,
  listRecentMatchesForUser,
  getUserById,
  getUserByTelegramUserId,
  getUserByUsername,
  resolvePendingDispute,
  upsertActiveSession,
  upsertTelegramUser,
  type CharacterRecord,
  type DisputeRecord,
  type UserDisputeSummaryRecord,
  type UserMatchSummaryRecord,
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
    summary: "Agile duelist with strong first-hit damage and lighter defenses.",
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
      actions: ["Rapier Attack", "Sneak Attack"],
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

function startButtons(hasCharacter: boolean) {
  if (hasCharacter) {
    return [
      [{ text: "View Character", callback_data: "nav:character" }],
      [{ text: "Create Character", callback_data: "nav:create_character" }],
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
    classes: Object.values(classTemplates).map((template) => ({
      classKey: template.classKey,
      level: template.level,
      summary: template.summary,
      abilityScores: template.abilityScores,
      derivedStats: template.derivedStats,
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
    `HP: ${derived.maxHp ?? "?"}`,
    `AC: ${derived.armorClass ?? "?"}`,
    `Record: ${character.wins}-${character.losses}`,
  ].join("\n");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isSupportedClass(value: string): value is CharacterClass {
  return value in classTemplates;
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

function helpText() {
  return [
    "This bot resolves disputes through automated 1v1 fantasy combat using a simplified 5e-style ruleset.",
    "",
    "Commands:",
    "/start",
    "/help",
    "/create_character",
    "/character",
    "/record",
    "/history",
    "/dispute @username reason",
    "/accept",
    "/decline",
    "/cancel",
    "",
    "Group chats:",
    "- /start, /help, and /dispute work in groups",
    "- character creation and sheet management should be done in DM",
  ].join("\n");
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
  const eventLines = result.events.map((event) => event.summary);

  return [
    `${challengerCharacter.name} vs ${targetCharacter.name}`,
    `Reason: ${reason}`,
    "",
    ...eventLines,
  ].join("\n");
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
      inline_keyboard: [[{ text: "Create Character", callback_data: "nav:create_character" }]],
    },
  };
}

export async function handleRecord(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
  const character = await getActiveCharacterByUserId(user.id);

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

export async function handleCancel(actor: TelegramActor): Promise<OutboundMessage> {
  const user = await ensureUser(actor);
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

  if (existingCharacter) {
    return {
      text: [
        "You already have an active character in v1.",
        "",
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
      "Each option uses a fixed starter build so the first version stays fast and balanced.",
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

  if (!session || session.flow_type !== "character_creation") {
    return {
      alertText: "This character creation session has expired. Start again with /create_character.",
    };
  }

  const template = classTemplates[classKey];

  await upsertActiveSession({
    userId: user.id,
    flowType: "character_creation",
    stepKey: "awaiting_name",
    data: {
      classKey: template.classKey,
    },
  });

  return {
    alertText: `${template.label} selected`,
    message: {
      text: [
        `${template.label} selected.`,
        template.summary,
        "",
        "Send the name you want your arena character to use.",
      ].join("\n"),
    },
  };
}

export async function handleTextMessage(
  actor: TelegramActor,
  text: string,
): Promise<OutboundMessage | null> {
  const user = await ensureUser(actor);
  const session = await getActiveSessionByUserId(user.id);

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
      text: "You already have an active character. Use /character to view it.",
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
    name: proposedName,
    classKey: template.classKey,
    level: template.level,
    rulesVersionId: rulesVersion.id,
    abilityScores: template.abilityScores,
    derivedStats: template.derivedStats,
    loadout: template.loadout,
    resourceState: template.resourceState,
  });

  return {
    text: [
      "Your character is ready.",
      "",
      formatCharacterSummary(character),
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [[{ text: "View Character", callback_data: "nav:character" }]],
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
        text: "Your access to arena actions is currently restricted.",
      },
    };
  }

  const challengerCharacter = await getActiveCharacterByUserId(challenger.id);

  if (!challengerCharacter) {
    return {
      message: {
        text: "You need a character before you can start a dispute.",
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

  const targetCharacter = await getActiveCharacterByUserId(targetUser.id);

  if (!targetCharacter) {
    return {
      message: {
        text: `${targetUser.display_name} does not have an active character yet.`,
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

  if (!challengerUser) {
    return {
      message: {
        text: "The challenger could not be found anymore.",
      },
    };
  }

  const challengerCharacter = await getActiveCharacterByUserId(dispute.challenger_user_id);
  const targetCharacter = await getActiveCharacterByUserId(targetUser.id);

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

  try {
    await resolvePendingDispute({
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

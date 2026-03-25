import {
  cancelActiveSession,
  createCharacterAndCompleteSession,
  ensureRulesVersion,
  getActiveCharacterByUserId,
  getActiveSessionByUserId,
  upsertActiveSession,
  upsertTelegramUser,
  type CharacterRecord,
} from "@dm-bot/db";

export type OutboundMessage = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
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
    ];
  }

  return [[{ text: "Create Character", callback_data: "nav:create_character" }]];
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

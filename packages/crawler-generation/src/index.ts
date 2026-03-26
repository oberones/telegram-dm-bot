export type CrawlerThemeKey = "goblin_warrens" | "forsaken_crypt" | "arcane_ruins";
export type CrawlerRoomType = "combat" | "elite_combat" | "treasure" | "event" | "rest" | "boss";

export type ThemeDefinition = {
  key: CrawlerThemeKey;
  name: string;
  roomWeightAdjustments: Partial<Record<CrawlerRoomType, number>>;
  preferredMonsterKeys: string[];
};

export type MonsterTemplateSeed = {
  key: string;
  name: string;
  themeKey: CrawlerThemeKey | "shared";
  role: "minion" | "brute" | "skirmisher" | "caster" | "support" | "elite" | "boss";
  pointValue: number;
  armorClass: number;
  hitPoints: number;
  initiativeModifier: number;
  attackModifier: number;
  damageDiceCount: number;
  damageDieSides: number;
  damageModifier: number;
};

export type LootTemplateSeed = {
  key: string;
  name: string;
  category: "weapon" | "armor" | "accessory" | "consumable" | "currency";
  rarity: "common" | "uncommon" | "rare";
  effectSummary: string;
  equipmentSlot?: "weapon" | "armor" | "accessory";
  isPermanent: boolean;
};

export type EncounterRewardSeed = {
  recipientSlot: number;
  templateKey: string;
  quantity: number;
};

export type RoomRewardSeed = {
  recipientSlot: number;
  templateKey: string;
  quantity: number;
};

export type RoomWeightTable = Record<CrawlerRoomType, number>;

export type GeneratedRoom = {
  floorNumber: number;
  roomNumber: number;
  roomType: CrawlerRoomType;
  templateKey: string;
  promptPayload: Record<string, unknown>;
  generationPayload: Record<string, unknown>;
};

export type GeneratedFloor = {
  floorNumber: number;
  seedFragment: string;
  metadata: Record<string, unknown>;
  rooms: GeneratedRoom[];
};

export type GeneratedRun = {
  seed: string;
  generationVersion: string;
  theme: ThemeDefinition;
  floorCount: number;
  floors: GeneratedFloor[];
};

export const defaultRoomWeights: RoomWeightTable = {
  combat: 45,
  elite_combat: 10,
  treasure: 15,
  event: 15,
  rest: 15,
  boss: 0,
};

export const crawlerThemes: ThemeDefinition[] = [
  {
    key: "goblin_warrens",
    name: "Goblin Warrens",
    roomWeightAdjustments: { event: 5, rest: -5 },
    preferredMonsterKeys: ["goblin_sneak", "warg", "goblin_boss"],
  },
  {
    key: "forsaken_crypt",
    name: "Forsaken Crypt",
    roomWeightAdjustments: { rest: 5, treasure: -5 },
    preferredMonsterKeys: ["skeleton_guard", "restless_dead", "bone_warden"],
  },
  {
    key: "arcane_ruins",
    name: "Arcane Ruins",
    roomWeightAdjustments: { elite_combat: 5, combat: -5 },
    preferredMonsterKeys: ["animated_armor", "arc_spark", "collapsed_magus"],
  },
];

export const starterMonsterTemplates: MonsterTemplateSeed[] = [
  { key: "goblin_sneak", name: "Goblin Sneak", themeKey: "goblin_warrens", role: "skirmisher", pointValue: 0.5, armorClass: 13, hitPoints: 7, initiativeModifier: 2, attackModifier: 4, damageDiceCount: 1, damageDieSides: 6, damageModifier: 2 },
  { key: "warg", name: "Warg", themeKey: "goblin_warrens", role: "brute", pointValue: 1.0, armorClass: 13, hitPoints: 11, initiativeModifier: 2, attackModifier: 5, damageDiceCount: 2, damageDieSides: 4, damageModifier: 2 },
  { key: "goblin_boss", name: "Goblin Boss", themeKey: "goblin_warrens", role: "elite", pointValue: 1.5, armorClass: 15, hitPoints: 18, initiativeModifier: 1, attackModifier: 5, damageDiceCount: 1, damageDieSides: 8, damageModifier: 3 },
  { key: "skeleton_guard", name: "Skeleton Guard", themeKey: "forsaken_crypt", role: "brute", pointValue: 1.0, armorClass: 14, hitPoints: 13, initiativeModifier: 0, attackModifier: 4, damageDiceCount: 1, damageDieSides: 6, damageModifier: 2 },
  { key: "restless_dead", name: "Restless Dead", themeKey: "forsaken_crypt", role: "support", pointValue: 0.75, armorClass: 12, hitPoints: 10, initiativeModifier: 0, attackModifier: 3, damageDiceCount: 1, damageDieSides: 6, damageModifier: 1 },
  { key: "bone_warden", name: "Bone Warden", themeKey: "forsaken_crypt", role: "boss", pointValue: 3.0, armorClass: 15, hitPoints: 24, initiativeModifier: 1, attackModifier: 6, damageDiceCount: 1, damageDieSides: 10, damageModifier: 3 },
  { key: "animated_armor", name: "Animated Armor", themeKey: "arcane_ruins", role: "brute", pointValue: 1.0, armorClass: 16, hitPoints: 16, initiativeModifier: 0, attackModifier: 5, damageDiceCount: 1, damageDieSides: 6, damageModifier: 2 },
  { key: "arc_spark", name: "Arc Spark", themeKey: "arcane_ruins", role: "caster", pointValue: 0.75, armorClass: 12, hitPoints: 8, initiativeModifier: 2, attackModifier: 5, damageDiceCount: 1, damageDieSides: 8, damageModifier: 1 },
  { key: "collapsed_magus", name: "Collapsed Magus", themeKey: "arcane_ruins", role: "boss", pointValue: 3.0, armorClass: 14, hitPoints: 22, initiativeModifier: 2, attackModifier: 6, damageDiceCount: 2, damageDieSides: 6, damageModifier: 2 },
  { key: "giant_rat", name: "Giant Rat", themeKey: "shared", role: "minion", pointValue: 0.5, armorClass: 11, hitPoints: 4, initiativeModifier: 1, attackModifier: 3, damageDiceCount: 1, damageDieSides: 4, damageModifier: 1 },
];

export const starterLootTemplates: LootTemplateSeed[] = [
  {
    key: "balanced_longsword",
    name: "Balanced Longsword",
    category: "weapon",
    rarity: "common",
    effectSummary: "+1 melee attack rolls for martial characters",
    equipmentSlot: "weapon",
    isPermanent: true,
  },
  {
    key: "ashen_wand",
    name: "Ashen Wand",
    category: "weapon",
    rarity: "common",
    effectSummary: "+1 spell attack rolls",
    equipmentSlot: "weapon",
    isPermanent: true,
  },
  {
    key: "reinforced_chain",
    name: "Reinforced Chain",
    category: "armor",
    rarity: "common",
    effectSummary: "+1 AC for eligible wearers",
    equipmentSlot: "armor",
    isPermanent: true,
  },
  {
    key: "iron_charm",
    name: "Iron Charm",
    category: "accessory",
    rarity: "common",
    effectSummary: "+2 max HP",
    equipmentSlot: "accessory",
    isPermanent: true,
  },
  {
    key: "minor_healing_potion",
    name: "Minor Healing Potion",
    category: "consumable",
    rarity: "common",
    effectSummary: "Restore a small amount of HP during a run",
    isPermanent: false,
  },
  {
    key: "gold",
    name: "Gold",
    category: "currency",
    rarity: "common",
    effectSummary: "Future meta and vendor currency",
    isPermanent: false,
  },
];

export const crawlerContentVersion = "crawler-v1-prototype";

const roomTemplateByType: Record<CrawlerRoomType, string[]> = {
  combat: ["ambush", "hallway_clash", "guard_post"],
  elite_combat: ["elite_guard", "champion_den"],
  treasure: ["hidden_cache", "supply_stash"],
  event: ["unstable_shrine", "strange_idol"],
  rest: ["safe_camp", "quiet_chamber"],
  boss: ["theme_boss"],
};

export function selectThemeFromSeed(seed: string): ThemeDefinition {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return crawlerThemes[Math.abs(hash) % crawlerThemes.length]!;
}

export function buildRoomWeightsForTheme(themeKey: CrawlerThemeKey): RoomWeightTable {
  const theme = crawlerThemes.find((candidate) => candidate.key === themeKey);

  if (!theme) {
    return { ...defaultRoomWeights };
  }

  const merged: RoomWeightTable = { ...defaultRoomWeights };

  for (const [roomType, adjustment] of Object.entries(theme.roomWeightAdjustments)) {
    const typedRoomType = roomType as CrawlerRoomType;
    merged[typedRoomType] = Math.max(0, merged[typedRoomType] + adjustment);
  }

  return merged;
}

export function generateRun(seed: string): GeneratedRun {
  const theme = selectThemeFromSeed(seed);
  const rng = createRng(seed);
  const floorCount = 3;
  const floors: GeneratedFloor[] = [];

  for (let floorNumber = 1; floorNumber <= floorCount; floorNumber += 1) {
    const roomCount = floorNumber === floorCount ? 3 : 3;
    const rooms: GeneratedRoom[] = [];

    for (let roomNumber = 1; roomNumber <= roomCount; roomNumber += 1) {
      const isFirstRoom = floorNumber === 1 && roomNumber === 1;
      const isBossRoom = floorNumber === floorCount && roomNumber === roomCount;
      const roomType = isBossRoom
        ? "boss"
        : isFirstRoom
          ? "combat"
          : pickRoomType(rng, floorNumber, theme.key);
      const templateKey = pickRoomTemplate(rng, roomType);

      rooms.push({
        floorNumber,
        roomNumber,
        roomType,
        templateKey,
        promptPayload: buildPromptPayload(theme, floorNumber, roomNumber, roomType, templateKey),
        generationPayload: {
          templateKey,
          themeKey: theme.key,
          floorNumber,
          roomNumber,
          roomType,
          encounterMonsterKeys: buildEncounterMonsterKeys(theme.key, roomType, rng),
        },
      });
    }

    floors.push({
      floorNumber,
      seedFragment: `${seed}:floor:${floorNumber}`,
      metadata: {
        themeKey: theme.key,
        roomCount,
      },
      rooms,
    });
  }

  return {
    seed,
    generationVersion: crawlerContentVersion,
    theme,
    floorCount,
    floors,
  };
}

function buildPromptPayload(
  theme: ThemeDefinition,
  floorNumber: number,
  roomNumber: number,
  roomType: CrawlerRoomType,
  templateKey: string,
) {
  const descriptionByType: Record<CrawlerRoomType, string> = {
    combat: "A hostile presence stirs ahead.",
    elite_combat: "A stronger foe guards the path forward.",
    treasure: "A cache of supplies or treasure glints in the dark.",
    event: "Something strange waits to be investigated.",
    rest: "A rare calm settles over this chamber.",
    boss: "A final threat bars the way.",
  };

  return {
    title: `${theme.name} - Floor ${floorNumber}, Room ${roomNumber}`,
    description: descriptionByType[roomType],
    roomType,
    templateKey,
  };
}

function pickRoomType(
  rng: () => number,
  floorNumber: number,
  themeKey: CrawlerThemeKey,
): CrawlerRoomType {
  const weights = buildRoomWeightsForTheme(themeKey);
  const adjusted = { ...weights };

  if (floorNumber === 1) {
    adjusted.elite_combat = Math.max(0, adjusted.elite_combat - 5);
    adjusted.treasure += 5;
    adjusted.event += 5;
  }

  if (floorNumber === 3) {
    adjusted.combat += 10;
    adjusted.treasure = Math.max(0, adjusted.treasure - 5);
  }

  const candidates = Object.entries(adjusted)
    .filter(([roomType, weight]) => roomType !== "boss" && weight > 0) as Array<[CrawlerRoomType, number]>;
  const totalWeight = candidates.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * totalWeight;

  for (const [roomType, weight] of candidates) {
    cursor -= weight;
    if (cursor <= 0) {
      return roomType;
    }
  }

  return "combat";
}

function pickRoomTemplate(rng: () => number, roomType: CrawlerRoomType) {
  const templates = roomTemplateByType[roomType];
  return templates[Math.floor(rng() * templates.length)] ?? templates[0]!;
}

export function getMonsterTemplateByKey(key: string) {
  return starterMonsterTemplates.find((template) => template.key === key) ?? null;
}

export function getLootTemplateByKey(key: string) {
  return starterLootTemplates.find((template) => template.key === key) ?? null;
}

export function generateEncounterRewards(
  seed: string,
  roomType: Extract<CrawlerRoomType, "combat" | "elite_combat" | "boss">,
  recipientCount: number,
): EncounterRewardSeed[] {
  const rng = createRng(seed);
  const rewards: EncounterRewardSeed[] = [];
  const permanentPool = starterLootTemplates.filter((template) => template.isPermanent);

  for (let recipientSlot = 1; recipientSlot <= recipientCount; recipientSlot += 1) {
    if (roomType === "combat") {
      rewards.push({
        recipientSlot,
        templateKey: "gold",
        quantity: 10,
      });
      continue;
    }

    const permanentIndex = Math.floor(rng() * permanentPool.length);
    const permanent = permanentPool[permanentIndex] ?? permanentPool[0];

    rewards.push({
      recipientSlot,
      templateKey: "gold",
      quantity: roomType === "boss" ? 30 : 15,
    });

    if (permanent) {
      rewards.push({
        recipientSlot,
        templateKey: permanent.key,
        quantity: 1,
      });
    }
  }

  return rewards;
}

export function generateRoomRewards(
  seed: string,
  roomType: Extract<CrawlerRoomType, "treasure" | "event" | "rest">,
  recipientCount: number,
): RoomRewardSeed[] {
  const rng = createRng(seed);
  const rewards: RoomRewardSeed[] = [];
  const permanentPool = starterLootTemplates.filter((template) => template.isPermanent);

  for (let recipientSlot = 1; recipientSlot <= recipientCount; recipientSlot += 1) {
    if (roomType === "rest") {
      rewards.push({
        recipientSlot,
        templateKey: "minor_healing_potion",
        quantity: 1,
      });
      continue;
    }

    if (roomType === "event") {
      rewards.push({
        recipientSlot,
        templateKey: rng() > 0.5 ? "gold" : "minor_healing_potion",
        quantity: rng() > 0.5 ? 10 : 1,
      });
      continue;
    }

    rewards.push({
      recipientSlot,
      templateKey: "gold",
      quantity: 20,
    });

    const permanentIndex = Math.floor(rng() * permanentPool.length);
    const permanent = permanentPool[permanentIndex] ?? permanentPool[0];

    if (permanent) {
      rewards.push({
        recipientSlot,
        templateKey: permanent.key,
        quantity: 1,
      });
    }
  }

  return rewards;
}

function buildEncounterMonsterKeys(
  themeKey: CrawlerThemeKey,
  roomType: CrawlerRoomType,
  rng: () => number,
) {
  if (!["combat", "elite_combat", "boss"].includes(roomType)) {
    return [] as string[];
  }

  const themeMonsters = starterMonsterTemplates.filter((template) => template.themeKey === themeKey);
  const normalMonsters = themeMonsters.filter((template) => ["minion", "brute", "skirmisher", "caster", "support"].includes(template.role));
  const eliteMonsters = themeMonsters.filter((template) => template.role === "elite");
  const bossMonsters = themeMonsters.filter((template) => template.role === "boss");

  if (roomType === "boss") {
    return [bossMonsters[0]?.key ?? normalMonsters[0]?.key ?? "giant_rat"];
  }

  if (roomType === "elite_combat") {
    if (eliteMonsters[0]) {
      return [eliteMonsters[0].key];
    }

    return pickDistinctMonsterKeys(normalMonsters, rng, 2);
  }

  const count = rng() > 0.6 ? 2 : 1;
  return pickDistinctMonsterKeys(normalMonsters, rng, count);
}

function pickDistinctMonsterKeys(
  monsters: MonsterTemplateSeed[],
  rng: () => number,
  count: number,
) {
  if (monsters.length === 0) {
    return ["giant_rat"];
  }

  const pool = [...monsters];
  const selected: string[] = [];

  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [picked] = pool.splice(index, 1);
    if (picked) {
      selected.push(picked.key);
    }
  }

  if (selected.length === 0) {
    selected.push(monsters[0]!.key);
  }

  return selected;
}

function createRng(seed: string) {
  let state = 0;

  for (const character of seed) {
    state = (state * 31 + character.charCodeAt(0)) >>> 0;
  }

  if (state === 0) {
    state = 123456789;
  }

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

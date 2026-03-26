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
};

export type LootTemplateSeed = {
  key: string;
  name: string;
  category: "weapon" | "armor" | "accessory" | "consumable" | "currency";
  rarity: "common" | "uncommon" | "rare";
  effectSummary: string;
  isPermanent: boolean;
};

export type RoomWeightTable = Record<CrawlerRoomType, number>;

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
  { key: "goblin_sneak", name: "Goblin Sneak", themeKey: "goblin_warrens", role: "skirmisher", pointValue: 0.5 },
  { key: "warg", name: "Warg", themeKey: "goblin_warrens", role: "brute", pointValue: 1.0 },
  { key: "goblin_boss", name: "Goblin Boss", themeKey: "goblin_warrens", role: "elite", pointValue: 1.5 },
  { key: "skeleton_guard", name: "Skeleton Guard", themeKey: "forsaken_crypt", role: "brute", pointValue: 1.0 },
  { key: "restless_dead", name: "Restless Dead", themeKey: "forsaken_crypt", role: "support", pointValue: 0.75 },
  { key: "bone_warden", name: "Bone Warden", themeKey: "forsaken_crypt", role: "boss", pointValue: 3.0 },
  { key: "animated_armor", name: "Animated Armor", themeKey: "arcane_ruins", role: "brute", pointValue: 1.0 },
  { key: "arc_spark", name: "Arc Spark", themeKey: "arcane_ruins", role: "caster", pointValue: 0.75 },
  { key: "collapsed_magus", name: "Collapsed Magus", themeKey: "arcane_ruins", role: "boss", pointValue: 3.0 },
  { key: "giant_rat", name: "Giant Rat", themeKey: "shared", role: "minion", pointValue: 0.5 },
];

export const starterLootTemplates: LootTemplateSeed[] = [
  {
    key: "balanced_longsword",
    name: "Balanced Longsword",
    category: "weapon",
    rarity: "common",
    effectSummary: "+1 melee attack rolls for martial characters",
    isPermanent: true,
  },
  {
    key: "ashen_wand",
    name: "Ashen Wand",
    category: "weapon",
    rarity: "common",
    effectSummary: "+1 spell attack rolls",
    isPermanent: true,
  },
  {
    key: "reinforced_chain",
    name: "Reinforced Chain",
    category: "armor",
    rarity: "common",
    effectSummary: "+1 AC for eligible wearers",
    isPermanent: true,
  },
  {
    key: "iron_charm",
    name: "Iron Charm",
    category: "accessory",
    rarity: "common",
    effectSummary: "+2 max HP",
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

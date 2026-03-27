export const crawlerXpThresholds = [0, 100, 250, 450, 700] as const;

export type CrawlerProgression = {
  tier: number;
  totalXp: number;
  currentTierFloorXp: number;
  nextTierXp: number | null;
  xpIntoTier: number;
  xpToNextTier: number | null;
};

export type CrawlerCombatBonuses = {
  maxHpBonus: number;
  attackBonus: number;
  armorClassBonus: number;
  initiativeBonus: number;
};

export type CrawlerPerkDefinition = {
  key: string;
  label: string;
  summary: string;
  unlockTier: number;
  unlockXp: number;
  bonuses: CrawlerCombatBonuses;
};

export const crawlerPerkDefinitions: readonly CrawlerPerkDefinition[] = [
  {
    key: "veterans_grit",
    label: "Veteran's Grit",
    summary: "+2 max HP in crawler runs.",
    unlockTier: 2,
    unlockXp: 100,
    bonuses: {
      maxHpBonus: 2,
      attackBonus: 0,
      armorClassBonus: 0,
      initiativeBonus: 0,
    },
  },
  {
    key: "deadeye",
    label: "Deadeye",
    summary: "+1 attack in crawler runs.",
    unlockTier: 3,
    unlockXp: 250,
    bonuses: {
      maxHpBonus: 0,
      attackBonus: 1,
      armorClassBonus: 0,
      initiativeBonus: 0,
    },
  },
  {
    key: "guarded_stance",
    label: "Guarded Stance",
    summary: "+1 AC in crawler runs.",
    unlockTier: 4,
    unlockXp: 450,
    bonuses: {
      maxHpBonus: 0,
      attackBonus: 0,
      armorClassBonus: 1,
      initiativeBonus: 0,
    },
  },
  {
    key: "battle_rhythm",
    label: "Battle Rhythm",
    summary: "+1 initiative in crawler runs.",
    unlockTier: 5,
    unlockXp: 700,
    bonuses: {
      maxHpBonus: 0,
      attackBonus: 0,
      armorClassBonus: 0,
      initiativeBonus: 1,
    },
  },
] as const;

export function describeCrawlerProgression(totalXp: number): CrawlerProgression {
  const normalizedXp = Math.max(0, Math.floor(totalXp));
  let tierIndex = 0;

  for (let index = 0; index < crawlerXpThresholds.length; index += 1) {
    if (normalizedXp >= crawlerXpThresholds[index]!) {
      tierIndex = index;
    }
  }

  const currentTierFloorXp = crawlerXpThresholds[tierIndex] ?? 0;
  const nextTierXp = crawlerXpThresholds[tierIndex + 1] ?? null;

  return {
    tier: tierIndex + 1,
    totalXp: normalizedXp,
    currentTierFloorXp,
    nextTierXp,
    xpIntoTier: normalizedXp - currentTierFloorXp,
    xpToNextTier: nextTierXp === null ? null : Math.max(0, nextTierXp - normalizedXp),
  };
}

export function listUnlockedCrawlerPerks(totalXp: number): CrawlerPerkDefinition[] {
  const normalizedXp = Math.max(0, Math.floor(totalXp));

  return crawlerPerkDefinitions.filter((perk) => normalizedXp >= perk.unlockXp);
}

export function nextCrawlerPerk(totalXp: number): CrawlerPerkDefinition | null {
  const normalizedXp = Math.max(0, Math.floor(totalXp));

  return crawlerPerkDefinitions.find((perk) => normalizedXp < perk.unlockXp) ?? null;
}

export function sumCrawlerCombatBonuses(totalXp: number): CrawlerCombatBonuses {
  return listUnlockedCrawlerPerks(totalXp).reduce<CrawlerCombatBonuses>((totals, perk) => {
    return {
      maxHpBonus: totals.maxHpBonus + perk.bonuses.maxHpBonus,
      attackBonus: totals.attackBonus + perk.bonuses.attackBonus,
      armorClassBonus: totals.armorClassBonus + perk.bonuses.armorClassBonus,
      initiativeBonus: totals.initiativeBonus + perk.bonuses.initiativeBonus,
    };
  }, {
    maxHpBonus: 0,
    attackBonus: 0,
    armorClassBonus: 0,
    initiativeBonus: 0,
  });
}

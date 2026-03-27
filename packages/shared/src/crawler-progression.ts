export const crawlerXpThresholds = [0, 100, 250, 450, 700] as const;

export type CrawlerProgression = {
  tier: number;
  totalXp: number;
  currentTierFloorXp: number;
  nextTierXp: number | null;
  xpIntoTier: number;
  xpToNextTier: number | null;
};

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

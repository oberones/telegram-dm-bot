import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCrawlerProgression,
  listUnlockedCrawlerPerks,
  nextCrawlerPerk,
  sumCrawlerCombatBonuses,
} from "./crawler-progression.js";

test("crawler progression starts at tier one and points to the next threshold", () => {
  assert.deepEqual(
    describeCrawlerProgression(0),
    {
      tier: 1,
      totalXp: 0,
      currentTierFloorXp: 0,
      nextTierXp: 100,
      xpIntoTier: 0,
      xpToNextTier: 100,
    },
  );
});

test("crawler progression advances tiers at configured thresholds", () => {
  assert.deepEqual(
    describeCrawlerProgression(250),
    {
      tier: 3,
      totalXp: 250,
      currentTierFloorXp: 250,
      nextTierXp: 450,
      xpIntoTier: 0,
      xpToNextTier: 200,
    },
  );
});

test("crawler progression caps next-threshold reporting at the highest configured tier", () => {
  assert.deepEqual(
    describeCrawlerProgression(999),
    {
      tier: 5,
      totalXp: 999,
      currentTierFloorXp: 700,
      nextTierXp: null,
      xpIntoTier: 299,
      xpToNextTier: null,
    },
  );
});

test("crawler perks unlock at milestone thresholds", () => {
  assert.deepEqual(
    listUnlockedCrawlerPerks(449).map((perk) => perk.label),
    ["Veteran's Grit", "Deadeye"],
  );
  assert.equal(nextCrawlerPerk(449)?.label, "Guarded Stance");
  assert.equal(nextCrawlerPerk(999), null);
});

test("crawler combat bonuses sum unlocked perk effects", () => {
  assert.deepEqual(
    sumCrawlerCombatBonuses(700),
    {
      maxHpBonus: 2,
      attackBonus: 1,
      armorClassBonus: 1,
      initiativeBonus: 1,
    },
  );
});

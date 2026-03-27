import assert from "node:assert/strict";
import test from "node:test";

import { describeCrawlerProgression } from "./crawler-progression.js";

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

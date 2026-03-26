import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRoomWeightsForTheme,
  crawlerThemes,
  selectThemeFromSeed,
  starterLootTemplates,
  starterMonsterTemplates,
} from "./index.js";

test("theme selection is deterministic for a given seed", () => {
  const first = selectThemeFromSeed("seed-alpha");
  const second = selectThemeFromSeed("seed-alpha");

  assert.equal(first.key, second.key);
});

test("starter content fixtures are populated", () => {
  assert.ok(crawlerThemes.length >= 3);
  assert.ok(starterMonsterTemplates.length >= 6);
  assert.ok(starterLootTemplates.length >= 4);
});

test("theme room weights stay non-negative", () => {
  const weights = buildRoomWeightsForTheme("goblin_warrens");

  for (const value of Object.values(weights)) {
    assert.ok(value >= 0);
  }
});

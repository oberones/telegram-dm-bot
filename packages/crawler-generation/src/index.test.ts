import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRoomWeightsForTheme,
  crawlerThemes,
  generateEncounterRewards,
  generateRun,
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

test("generateRun is deterministic for a given seed", () => {
  const first = generateRun("seed-alpha");
  const second = generateRun("seed-alpha");

  assert.deepEqual(first, second);
});

test("generateRun starts with a combat room and ends with a boss room", () => {
  const generated = generateRun("seed-beta");
  const allRooms = generated.floors.flatMap((floor) => floor.rooms);

  assert.equal(allRooms[0]?.roomType, "combat");
  assert.equal(allRooms.at(-1)?.roomType, "boss");
});

test("generateEncounterRewards is deterministic for a given seed", () => {
  const first = generateEncounterRewards("reward-seed", "elite_combat", 2);
  const second = generateEncounterRewards("reward-seed", "elite_combat", 2);

  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
});

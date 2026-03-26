import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRoomWeightsForTheme,
  crawlerThemes,
  generateEncounterRewards,
  generateRoomRewards,
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

test("generateRun scales encounter groups to party size", () => {
  const solo = generateRun("seed-gamma", 1);
  const party = generateRun("seed-gamma", 3);
  const soloRooms = solo.floors.flatMap((floor) => floor.rooms);
  const partyRooms = party.floors.flatMap((floor) => floor.rooms);
  const soloFirstCombat = soloRooms.find((room) => room.roomType === "combat");
  const partyFirstCombat = partyRooms.find((room) => room.roomType === "combat");
  const soloBoss = soloRooms.at(-1);
  const partyBoss = partyRooms.at(-1);

  assert.ok(soloFirstCombat);
  assert.ok(partyFirstCombat);
  assert.ok(soloBoss);
  assert.ok(partyBoss);
  const soloEncounterKeys = getEncounterMonsterKeys(soloFirstCombat.generationPayload);
  const partyEncounterKeys = getEncounterMonsterKeys(partyFirstCombat.generationPayload);
  const soloBossKeys = getEncounterMonsterKeys(soloBoss.generationPayload);
  const partyBossKeys = getEncounterMonsterKeys(partyBoss.generationPayload);

  assert.equal(soloEncounterKeys.length, 1);
  assert.ok(partyEncounterKeys.length >= 1);
  assert.ok(
    partyEncounterKeys.length >= soloEncounterKeys.length,
  );
  assert.ok(partyBossKeys.length >= soloBossKeys.length);
});

function getEncounterMonsterKeys(payload: unknown): string[] {
  assert.ok(payload && typeof payload === "object");
  assert.ok("encounterMonsterKeys" in payload);

  const { encounterMonsterKeys } = payload as { encounterMonsterKeys: unknown };

  assert.ok(Array.isArray(encounterMonsterKeys));
  assert.ok(encounterMonsterKeys.every((value) => typeof value === "string"));

  return encounterMonsterKeys;
}

test("generateEncounterRewards is deterministic for a given seed", () => {
  const first = generateEncounterRewards("reward-seed", "elite_combat", 2);
  const second = generateEncounterRewards("reward-seed", "elite_combat", 2);

  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
});

test("generateRoomRewards is deterministic for a given seed", () => {
  const first = generateRoomRewards("room-reward-seed", "treasure", 2);
  const second = generateRoomRewards("room-reward-seed", "treasure", 2);

  assert.deepEqual(first, second);
  assert.ok(first.length >= 2);
});

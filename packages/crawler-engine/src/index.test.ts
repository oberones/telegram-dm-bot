import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeterministicRandomSource,
  isEncounterResolved,
  resolveEncounter,
  sortParticipantsByInitiative,
  type EncounterSnapshot,
} from "./index.js";

test("initiative sorting uses roll plus modifier", () => {
  const snapshot: EncounterSnapshot = {
    participants: [
      {
        id: "a",
        name: "Fighter",
        side: "player",
        initiativeModifier: 1,
        armorClass: 16,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "b",
        name: "Goblin Sneak",
        side: "monster",
        initiativeModifier: 2,
        armorClass: 13,
        hitPoints: 7,
        maxHitPoints: 7,
        attackModifier: 4,
        damageDiceCount: 1,
        damageDieSides: 6,
        damageModifier: 2,
      },
    ],
  };

  const order = sortParticipantsByInitiative(snapshot, { a: 12, b: 9 });

  assert.deepEqual(
    order.map((participant) => participant.id),
    ["a", "b"],
  );
});

test("encounter resolution detects when only one side remains alive", () => {
  const resolved: EncounterSnapshot = {
    participants: [
      {
        id: "a",
        name: "Wizard",
        side: "player",
        initiativeModifier: 2,
        armorClass: 12,
        hitPoints: 7,
        maxHitPoints: 7,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 0,
      },
      {
        id: "b",
        name: "Giant Rat",
        side: "monster",
        initiativeModifier: 1,
        armorClass: 11,
        hitPoints: 0,
        maxHitPoints: 4,
        attackModifier: 3,
        damageDiceCount: 1,
        damageDieSides: 4,
        damageModifier: 1,
      },
    ],
  };

  assert.equal(isEncounterResolved(resolved), true);
});

test("resolveEncounter lets the party defeat a monster with deterministic rolls", () => {
  const result = resolveEncounter({
    participants: [
      {
        id: "player-1",
        name: "Rheen",
        side: "player",
        initiativeModifier: 1,
        armorClass: 16,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "monster-1",
        name: "Goblin Sneak",
        side: "monster",
        initiativeModifier: 2,
        armorClass: 13,
        hitPoints: 7,
        maxHitPoints: 7,
        attackModifier: 4,
        damageDiceCount: 1,
        damageDieSides: 6,
        damageModifier: 2,
      },
    ],
    rng: createDeterministicRandomSource([15, 3, 16, 4]),
  });

  assert.equal(result.winningSide, "player");
  assert.ok(result.events.some((event) => event.type === "encounter_end"));
});

test("resolveEncounter supports multiple players against one monster", () => {
  const result = resolveEncounter({
    participants: [
      {
        id: "player-1",
        name: "Rheen",
        side: "player",
        initiativeModifier: 1,
        armorClass: 16,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "player-2",
        name: "Ignus",
        side: "player",
        initiativeModifier: 2,
        armorClass: 12,
        hitPoints: 8,
        maxHitPoints: 8,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 0,
      },
      {
        id: "monster-1",
        name: "Warg",
        side: "monster",
        initiativeModifier: 2,
        armorClass: 13,
        hitPoints: 11,
        maxHitPoints: 11,
        attackModifier: 5,
        damageDiceCount: 2,
        damageDieSides: 4,
        damageModifier: 2,
      },
    ],
    rng: createDeterministicRandomSource([10, 14, 4, 15, 5, 17, 4]),
  });

  assert.equal(result.winningSide, "player");
  assert.equal(result.finalParticipants.filter((participant) => participant.side === "monster")[0]?.isDefeated, true);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeterministicRandomSource,
  initializeEncounterState,
  isEncounterResolved,
  resolveEncounter,
  resolveEncounterRound,
  resolveRetreatAttempt,
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

test("encounters can resolve one round at a time from persisted state", () => {
  const rng = createDeterministicRandomSource([15, 3, 16, 4]);
  const initialized = initializeEncounterState({
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
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);

  assert.equal(firstRound.roundsCompleted, 1);
  assert.equal(firstRound.winningSide, "player");
  assert.ok(firstRound.events.some((event) => event.type === "encounter_end"));
});

test("player-selected wizard spell actions resolve and spend spell slots", () => {
  const rng = createDeterministicRandomSource([15, 3, 14, 4, 5, 3]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Ignus",
        side: "player",
        classKey: "wizard",
        spellSlotsLevel1: 1,
        dexteritySaveModifier: 2,
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
        name: "Goblin Sneak",
        side: "monster",
        monsterRole: "skirmisher",
        dexteritySaveModifier: 2,
        spellSlotsLevel1: 0,
        initiativeModifier: 1,
        armorClass: 13,
        hitPoints: 7,
        maxHitPoints: 7,
        attackModifier: 4,
        damageDiceCount: 1,
        damageDieSides: 6,
        damageModifier: 2,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(
    initialized.state,
    { "player-1": "magic_missile" },
    rng,
  );

  assert.ok(firstRound.events.some((event) => event.type === "attack" && event.summary.includes("Magic Missile")));
  assert.equal(
    firstRound.state.participants.find((participant) => participant.id === "player-1")?.spellSlotsLevel1,
    0,
  );
});

test("cleric sacred flame uses a save-based action when selected", () => {
  const rng = createDeterministicRandomSource([12, 5, 4, 6, 15, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Borin",
        side: "player",
        classKey: "cleric",
        spellSlotsLevel1: 1,
        dexteritySaveModifier: 0,
        initiativeModifier: 0,
        armorClass: 15,
        hitPoints: 10,
        maxHitPoints: 10,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "monster-1",
        name: "Giant Rat",
        side: "monster",
        monsterRole: "minion",
        dexteritySaveModifier: 1,
        spellSlotsLevel1: 0,
        initiativeModifier: 1,
        armorClass: 11,
        hitPoints: 4,
        maxHitPoints: 4,
        attackModifier: 3,
        damageDiceCount: 1,
        damageDieSides: 4,
        damageModifier: 1,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(
    initialized.state,
    { "player-1": "sacred_flame" },
    rng,
  );

  assert.ok(firstRound.events.some((event) => event.type === "attack" && event.summary.includes("Sacred Flame")));
  assert.ok(firstRound.events.some((event) => event.type === "damage"));
});

test("monster target selection randomizes among equal-hp candidates", () => {
  const rng = createDeterministicRandomSource([5, 4, 20, 2, 15, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Rheen",
        side: "player",
        initiativeModifier: 1,
        armorClass: 14,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 2,
      },
      {
        id: "player-2",
        name: "Mira",
        side: "player",
        initiativeModifier: 1,
        armorClass: 14,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 2,
      },
      {
        id: "monster-1",
        name: "Warg",
        side: "monster",
        initiativeModifier: 3,
        armorClass: 13,
        hitPoints: 11,
        maxHitPoints: 11,
        attackModifier: 5,
        damageDiceCount: 2,
        damageDieSides: 4,
        damageModifier: 2,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);
  const firstAttack = firstRound.events.find((event) => event.type === "attack");

  assert.equal(firstAttack?.targetId, "player-2");
});

test("monster target selection prioritizes more dangerous players when no easy finish exists", () => {
  const rng = createDeterministicRandomSource([5, 4, 20, 15, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Shieldbearer",
        side: "player",
        initiativeModifier: 0,
        armorClass: 16,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 3,
        damageDiceCount: 1,
        damageDieSides: 4,
        damageModifier: 0,
      },
      {
        id: "player-2",
        name: "Bladesinger",
        side: "player",
        initiativeModifier: 3,
        armorClass: 13,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 7,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 4,
      },
      {
        id: "monster-1",
        name: "Warg",
        side: "monster",
        monsterRole: "minion",
        initiativeModifier: 3,
        armorClass: 13,
        hitPoints: 11,
        maxHitPoints: 11,
        attackModifier: 5,
        damageDiceCount: 2,
        damageDieSides: 4,
        damageModifier: 2,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);
  const firstAttack = firstRound.events.find((event) => event.type === "attack");

  assert.equal(firstAttack?.targetId, "player-2");
});

test("skirmishers prefer fragile backliners over sturdier frontliners", () => {
  const rng = createDeterministicRandomSource([5, 4, 20, 15, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Shieldbearer",
        side: "player",
        initiativeModifier: 0,
        armorClass: 17,
        hitPoints: 14,
        maxHitPoints: 14,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "player-2",
        name: "Glass Mage",
        side: "player",
        initiativeModifier: 2,
        armorClass: 12,
        hitPoints: 8,
        maxHitPoints: 8,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 1,
      },
      {
        id: "monster-1",
        name: "Goblin Sneak",
        side: "monster",
        monsterRole: "skirmisher",
        initiativeModifier: 3,
        armorClass: 13,
        hitPoints: 7,
        maxHitPoints: 7,
        attackModifier: 4,
        damageDiceCount: 1,
        damageDieSides: 6,
        damageModifier: 2,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);
  const firstAttack = firstRound.events.find((event) => event.type === "attack");

  assert.equal(firstAttack?.targetId, "player-2");
});

test("brutes prioritize finish opportunities over healthier targets", () => {
  const rng = createDeterministicRandomSource([5, 4, 20, 15, 4, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Rogue",
        side: "player",
        initiativeModifier: 2,
        armorClass: 14,
        hitPoints: 4,
        maxHitPoints: 12,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
      },
      {
        id: "player-2",
        name: "Wizard",
        side: "player",
        initiativeModifier: 2,
        armorClass: 12,
        hitPoints: 12,
        maxHitPoints: 12,
        attackModifier: 6,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 2,
      },
      {
        id: "monster-1",
        name: "Warg",
        side: "monster",
        monsterRole: "brute",
        initiativeModifier: 3,
        armorClass: 13,
        hitPoints: 11,
        maxHitPoints: 11,
        attackModifier: 5,
        damageDiceCount: 2,
        damageDieSides: 4,
        damageModifier: 2,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);
  const firstAttack = firstRound.events.find((event) => event.type === "attack");

  assert.equal(firstAttack?.targetId, "player-1");
});

test("casters prefer exposed high-threat targets", () => {
  const rng = createDeterministicRandomSource([5, 4, 20, 15, 4]);
  const initialized = initializeEncounterState({
    participants: [
      {
        id: "player-1",
        name: "Guardian",
        side: "player",
        initiativeModifier: 0,
        armorClass: 17,
        hitPoints: 14,
        maxHitPoints: 14,
        attackModifier: 4,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 2,
      },
      {
        id: "player-2",
        name: "Stormcaller",
        side: "player",
        initiativeModifier: 3,
        armorClass: 12,
        hitPoints: 9,
        maxHitPoints: 9,
        attackModifier: 7,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 3,
      },
      {
        id: "monster-1",
        name: "Arc Spark",
        side: "monster",
        monsterRole: "caster",
        initiativeModifier: 4,
        armorClass: 12,
        hitPoints: 8,
        maxHitPoints: 8,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 1,
      },
    ],
    rng,
  });

  const firstRound = resolveEncounterRound(initialized.state, rng);
  const firstAttack = firstRound.events.find((event) => event.type === "attack");

  assert.equal(firstAttack?.targetId, "player-2");
});

test("retreat attempts trigger opportunity attacks before the party escapes", () => {
  const initialized = initializeEncounterState({
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
    rng: createDeterministicRandomSource([10, 8]),
  });

  const retreat = resolveRetreatAttempt(initialized.state, createDeterministicRandomSource([17, 4]));

  assert.equal(retreat.succeeded, true);
  assert.ok(retreat.events.some((event) => event.type === "attack"));
  assert.ok(retreat.events.some((event) => event.type === "retreat" && event.succeeded));
  assert.equal(
    retreat.finalParticipants.find((participant) => participant.id === "player-1")?.currentHitPoints,
    6,
  );
});

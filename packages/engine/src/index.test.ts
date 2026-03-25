import test from "node:test";
import assert from "node:assert/strict";

import {
  createDeterministicRandomSource,
  resolveMatch,
  type CombatParticipant,
} from "./index.js";

function participant(overrides: Partial<CombatParticipant> & Pick<CombatParticipant, "slot" | "name" | "classKey">): CombatParticipant {
  const defaults: Record<CombatParticipant["classKey"], CombatParticipant> = {
    fighter: {
      slot: 1,
      name: "Fighter",
      classKey: "fighter",
      level: 1,
      abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      derivedStats: {
        maxHp: 12,
        armorClass: 16,
        initiativeMod: 1,
        proficiencyBonus: 2,
        speed: 30,
        saveMods: { str: 5, dex: 1, con: 2, int: -1, wis: 0, cha: 0 },
      },
      loadout: { actions: ["Longsword Attack", "Second Wind"] },
      resourceState: { secondWindAvailable: true },
    },
    rogue: {
      slot: 1,
      name: "Rogue",
      classKey: "rogue",
      level: 1,
      abilityScores: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 14 },
      derivedStats: {
        maxHp: 9,
        armorClass: 14,
        initiativeMod: 3,
        proficiencyBonus: 2,
        speed: 30,
        saveMods: { str: 0, dex: 5, con: 1, int: 3, wis: 0, cha: 2 },
      },
      loadout: { actions: ["Rapier Attack", "Sneak Attack"] },
      resourceState: {},
    },
    wizard: {
      slot: 1,
      name: "Wizard",
      classKey: "wizard",
      level: 1,
      abilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      derivedStats: {
        maxHp: 8,
        armorClass: 12,
        initiativeMod: 2,
        proficiencyBonus: 2,
        speed: 30,
        saveMods: { str: -1, dex: 2, con: 1, int: 5, wis: 0, cha: 0 },
      },
      loadout: { actions: ["Fire Bolt", "Magic Missile"] },
      resourceState: { spellSlots: { level1: 2 } },
    },
    cleric: {
      slot: 1,
      name: "Cleric",
      classKey: "cleric",
      level: 1,
      abilityScores: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
      derivedStats: {
        maxHp: 10,
        armorClass: 15,
        initiativeMod: 0,
        proficiencyBonus: 2,
        speed: 30,
        saveMods: { str: 1, dex: 0, con: 2, int: 0, wis: 5, cha: 1 },
      },
      loadout: { actions: ["Sacred Flame", "Guiding Bolt"] },
      resourceState: { spellSlots: { level1: 2 } },
    },
  };

  return {
    ...defaults[overrides.classKey],
    ...overrides,
  };
}

test("fighter defeats wizard with deterministic rolls", () => {
  const result = resolveMatch({
    participants: [
      participant({ slot: 1, name: "Argot", classKey: "fighter" }),
      participant({ slot: 2, name: "Elira", classKey: "wizard" }),
    ],
    rng: createDeterministicRandomSource([
      15,
      5,
      18,
      7,
      6,
      16,
      6,
      3, 2, 1,
      14,
      8,
    ]),
  });

  assert.equal(result.winnerParticipantSlot, 1);
  assert.equal(result.endReason, "knockout");
  assert.equal(result.finalStates[1]?.currentHp, 0);
  assert.ok(result.events.some((event) => event.type === "initiative"));
  assert.ok(result.events.some((event) => event.type === "damage"));
});

test("fighter uses second wind when below half health", () => {
  const result = resolveMatch({
    participants: [
      participant({ slot: 1, name: "Argot", classKey: "fighter" }),
      participant({ slot: 2, name: "Bastion", classKey: "fighter" }),
    ],
    roundLimit: 1,
    rng: createDeterministicRandomSource([
      1,
      10,
      19,
      8,
      6,
    ]),
  });

  const healEvent = result.events.find((event) => event.type === "heal");

  assert.ok(healEvent);
  assert.equal(healEvent?.type, "heal");
  assert.equal(healEvent?.actionKey, "Second Wind");
  assert.equal(result.endReason, "round_limit_hp_pct");
});

test("round limit uses hp percentage tie-break", () => {
  const result = resolveMatch({
    participants: [
      participant({ slot: 1, name: "Shade", classKey: "rogue" }),
      participant({ slot: 2, name: "Bastion", classKey: "fighter" }),
    ],
    roundLimit: 1,
    rng: createDeterministicRandomSource([
      19,
      3,
      18,
      2,
      2,
    ]),
  });

  assert.equal(result.endReason, "round_limit_hp_pct");
  assert.equal(result.winnerParticipantSlot, 1);
});

test("rogue rapier damage matches 5e weapon damage plus dexterity", () => {
  const result = resolveMatch({
    participants: [
      participant({ slot: 1, name: "Shade", classKey: "rogue" }),
      participant({ slot: 2, name: "Bastion", classKey: "fighter" }),
    ],
    roundLimit: 1,
    rng: createDeterministicRandomSource([
      19,
      3,
      18,
      2,
      2,
    ]),
  });

  const rapierDamage = result.events.find(
    (event) => event.type === "damage" && event.actionKey === "Rapier Attack",
  );

  assert.ok(rapierDamage);
  assert.equal(rapierDamage?.type, "damage");
  assert.equal(rapierDamage?.modifier, 3);
  assert.equal(rapierDamage?.total, 5);
});

test("guiding bolt grants advantage on the next attack roll", () => {
  const result = resolveMatch({
    participants: [
      participant({ slot: 1, name: "Aster", classKey: "cleric" }),
      participant({ slot: 2, name: "Bastion", classKey: "fighter" }),
    ],
    roundLimit: 2,
    rng: createDeterministicRandomSource([
      12,
      5,
      15,
      1,
      1,
      1,
      4,
      2,
      4,
      17,
      2,
      2,
      2,
      2,
    ]),
  });

  const effectEvent = result.events.find(
    (event) => event.type === "effect" && event.actionKey === "Guiding Bolt",
  );
  const advantagedAttack = result.events.find(
    (event) =>
      event.type === "attack" &&
      event.actionKey === "Guiding Bolt" &&
      event.round === 2,
  );

  assert.ok(effectEvent);
  assert.ok(advantagedAttack);
  assert.equal(advantagedAttack?.type, "attack");
  assert.match(advantagedAttack?.summary ?? "", /with advantage/);
  assert.equal(advantagedAttack?.attackRoll, 17);
});

import assert from "node:assert/strict";
import test from "node:test";

import { isEncounterResolved, sortParticipantsByInitiative, type EncounterSnapshot } from "./index.js";

test("initiative sorting uses roll plus modifier", () => {
  const snapshot: EncounterSnapshot = {
    participants: [
      { id: "a", name: "Fighter", side: "player", initiativeModifier: 1, armorClass: 16, hitPoints: 12, maxHitPoints: 12 },
      { id: "b", name: "Goblin Sneak", side: "monster", initiativeModifier: 2, armorClass: 13, hitPoints: 7, maxHitPoints: 7 },
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
      { id: "a", name: "Wizard", side: "player", initiativeModifier: 2, armorClass: 12, hitPoints: 7, maxHitPoints: 7 },
      { id: "b", name: "Giant Rat", side: "monster", initiativeModifier: 1, armorClass: 11, hitPoints: 0, maxHitPoints: 4 },
    ],
  };

  assert.equal(isEncounterResolved(resolved), true);
});

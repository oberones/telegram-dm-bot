import assert from "node:assert/strict";
import test from "node:test";

import type { EncounterState } from "@dm-bot/crawler-engine";

import {
  applyHealing,
  applyEncounterDefeatToPartyMembers,
  buildEncounterXpRecipients,
  buildPartyLobbyButtonLabels,
  canStartCrawlerParty,
  describeRunPresentationState,
  encounterActionLockAlertText,
  encounterAvailableActionLabelsForMember,
  encounterActionKeysForClass,
  encounterXpForRoomType,
  formatEncounterSideSummaryLine,
  formatRunPartyRosterEntry,
  isEncounterRoundReadyToResolve,
  isEligibleForCrawlerParty,
  lockedEncounterActionSummary,
  retreatVoteProgressSummary,
  waitingEncounterActionSummary,
} from "./index.js";

test("active users with active characters can join crawler parties", () => {
  assert.equal(
    isEligibleForCrawlerParty({
      userStatus: "active",
      characterStatus: "active",
      alreadyInActiveRun: false,
    }),
    true,
  );
});

test("suspended users or frozen characters are ineligible for crawler parties", () => {
  assert.equal(
    isEligibleForCrawlerParty({
      userStatus: "suspended",
      characterStatus: "active",
      alreadyInActiveRun: false,
    }),
    false,
  );

  assert.equal(
    isEligibleForCrawlerParty({
      userStatus: "active",
      characterStatus: "frozen",
      alreadyInActiveRun: false,
    }),
    false,
  );
});

test("crawler parties can only start when all members are ready and within size limits", () => {
  assert.equal(
    canStartCrawlerParty({
      memberCount: 3,
      readyMemberCount: 3,
    }),
    true,
  );

  assert.equal(
    canStartCrawlerParty({
      memberCount: 3,
      readyMemberCount: 2,
    }),
    false,
  );

  assert.equal(
    canStartCrawlerParty({
      memberCount: 5,
      readyMemberCount: 5,
    }),
    false,
  );
});

test("party lobby buttons are group-safe and do not depend on the triggering viewer", () => {
  assert.deepEqual(
    buildPartyLobbyButtonLabels({
      partyStatus: "forming",
      allReady: false,
    }),
    ["Join Party", "Ready Up / Not Ready", "Leave Party"],
  );

  assert.deepEqual(
    buildPartyLobbyButtonLabels({
      partyStatus: "ready",
      allReady: true,
    }),
    ["Join Party", "Ready Up / Not Ready", "Leave Party", "Start Run"],
  );
});

test("run resume state is actionable in groups when the room is active and awaiting input", () => {
  assert.deepEqual(
    describeRunPresentationState({
      runStatus: "awaiting_choice",
      roomStatus: "active",
      roomResolvedAt: null,
      surface: "group",
      hasCurrentRoom: true,
    }),
    {
      heading: "Crawler Run",
      actionLine: "Action: awaiting room input from the party.",
      actionable: true,
      buttonAllowed: true,
      showRoomPrompt: true,
    },
  );
});

test("run resume state in DM avoids action buttons and points players back to the group", () => {
  assert.deepEqual(
    describeRunPresentationState({
      runStatus: "awaiting_choice",
      roomStatus: "active",
      roomResolvedAt: null,
      surface: "dm",
      hasCurrentRoom: true,
    }),
    {
      heading: "Crawler Run",
      actionLine: "Action: awaiting room input. Open the group chat with the bot to continue this room.",
      actionable: true,
      buttonAllowed: false,
      showRoomPrompt: true,
    },
  );
});

test("completed or stale runs are inspect-only and cannot be resumed", () => {
  assert.deepEqual(
    describeRunPresentationState({
      runStatus: "completed",
      roomStatus: "completed",
      roomResolvedAt: new Date("2026-03-26T12:00:00Z"),
      surface: "group",
      hasCurrentRoom: true,
    }),
    {
      heading: "Crawler Run Complete",
      actionLine: "This run is finished and cannot be resumed.",
      actionable: false,
      buttonAllowed: false,
      showRoomPrompt: false,
    },
  );

  assert.deepEqual(
    describeRunPresentationState({
      runStatus: "cancelled",
      roomStatus: "skipped",
      roomResolvedAt: new Date("2026-03-26T12:00:00Z"),
      surface: "group",
      hasCurrentRoom: true,
    }),
    {
      heading: "Crawler Run Cancelled",
      actionLine: "This run was cancelled and cannot be resumed.",
      actionable: false,
      buttonAllowed: false,
      showRoomPrompt: false,
    },
  );

  assert.deepEqual(
    describeRunPresentationState({
      runStatus: "paused",
      roomStatus: "completed",
      roomResolvedAt: new Date("2026-03-26T12:00:00Z"),
      surface: "group",
      hasCurrentRoom: true,
    }),
    {
      heading: "Crawler Run",
      actionLine: "This run is not awaiting room input right now. No room action is available from /run.",
      actionable: false,
      buttonAllowed: false,
      showRoomPrompt: false,
    },
  );
});

test("encounter xp scales by room type", () => {
  assert.equal(encounterXpForRoomType("combat"), 25);
  assert.equal(encounterXpForRoomType("elite_combat"), 50);
  assert.equal(encounterXpForRoomType("boss"), 100);
});

test("encounter xp only goes to surviving active party members", () => {
  assert.deepEqual(
    buildEncounterXpRecipients({
      members: [
        {
          id: "pm-1",
          party_id: "party-1",
          user_id: "user-1",
          character_id: "char-1",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Alice",
          telegram_username: "alice",
          character_name: "Alyndra",
          class_key: "fighter",
        },
        {
          id: "pm-2",
          party_id: "party-1",
          user_id: "user-2",
          character_id: "char-2",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Borin",
          telegram_username: "borin",
          character_name: "Borin",
          class_key: "cleric",
        },
      ],
      finalParticipants: [
        {
          id: "player-1-char-1",
          name: "Alyndra",
          side: "player",
          currentHitPoints: 4,
          maxHitPoints: 12,
          damageDealt: 7,
          isDefeated: false,
        },
        {
          id: "player-2-char-2",
          name: "Borin",
          side: "player",
          currentHitPoints: 0,
          maxHitPoints: 11,
          damageDealt: 3,
          isDefeated: true,
        },
        {
          id: "monster-1-goblin_skirmisher",
          name: "Goblin Skirmisher",
          side: "monster",
          currentHitPoints: 0,
          maxHitPoints: 7,
          damageDealt: 5,
          isDefeated: true,
        },
      ],
      xpPerSurvivor: 25,
    }),
    [{
      characterId: "char-1",
      userId: "user-1",
      characterName: "Alyndra",
      xpGranted: 25,
    }],
  );
});

test("encounter action menus vary by class", () => {
  assert.deepEqual(encounterActionKeysForClass("fighter"), ["attack", "retreat"]);
  assert.deepEqual(encounterActionKeysForClass("rogue"), ["attack", "retreat"]);
  assert.deepEqual(encounterActionKeysForClass("wizard"), ["melee_attack", "fire_bolt", "magic_missile", "retreat"]);
  assert.deepEqual(encounterActionKeysForClass("cleric"), ["attack", "sacred_flame", "guiding_bolt", "retreat"]);
  assert.deepEqual(
    encounterAvailableActionLabelsForMember(
      { class_key: "wizard", character_name: "Ignus" },
      { spellSlotsLevel1: 1 },
    ),
    ["Melee Attack", "Cast Fire Bolt", "Cast Magic Missile", "Retreat"],
  );
  assert.deepEqual(
    encounterAvailableActionLabelsForMember(
      { class_key: "cleric", character_name: "Borin" },
      { spellSlotsLevel1: 0 },
    ),
    ["Attack", "Cast Sacred Flame", "Retreat"],
  );
});

test("encounter action lock feedback distinguishes first lock, duplicate lock, and action changes", () => {
  assert.equal(encounterActionLockAlertText(undefined, "attack"), "Attack locked");
  assert.equal(encounterActionLockAlertText("attack", "attack"), "Attack already locked");
  assert.equal(
    encounterActionLockAlertText("attack", "retreat"),
    "Action changed: Attack -> Retreat",
  );
});

test("encounter rounds only resolve once every living player has acted without a mixed retreat conflict", () => {
  assert.equal(
    isEncounterRoundReadyToResolve(
      {
        participants: [
          {
            id: "player-1-char-1",
            name: "Alyndra",
            side: "player",
            classKey: "fighter",
            currentHitPoints: 12,
            maxHitPoints: 12,
            hitPoints: 12,
            armorClass: 16,
            initiativeModifier: 1,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "player-2-char-2",
            name: "Borin",
            side: "player",
            classKey: "cleric",
            currentHitPoints: 10,
            maxHitPoints: 10,
            hitPoints: 10,
            armorClass: 15,
            initiativeModifier: 0,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "monster-1-warg",
            name: "Warg",
            side: "monster",
            monsterRole: "brute",
            currentHitPoints: 11,
            maxHitPoints: 11,
            hitPoints: 11,
            armorClass: 13,
            initiativeModifier: 2,
            attackModifier: 5,
            damageDiceCount: 2,
            damageDieSides: 4,
            damageModifier: 2,
            damageDealt: 0,
          },
        ],
        order: ["player-1-char-1", "player-2-char-2", "monster-1-warg"],
        initiativeRolls: {
          "player-1-char-1": 12,
          "player-2-char-2": 9,
          "monster-1-warg": 8,
        },
        nextRound: 1,
        roundLimit: 12,
      },
      {
        "player-1-char-1": "attack",
      },
    ),
    false,
  );

  assert.equal(
    isEncounterRoundReadyToResolve(
      {
        participants: [
          {
            id: "player-1-char-1",
            name: "Alyndra",
            side: "player",
            classKey: "fighter",
            currentHitPoints: 12,
            maxHitPoints: 12,
            hitPoints: 12,
            armorClass: 16,
            initiativeModifier: 1,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "player-2-char-2",
            name: "Borin",
            side: "player",
            classKey: "cleric",
            currentHitPoints: 10,
            maxHitPoints: 10,
            hitPoints: 10,
            armorClass: 15,
            initiativeModifier: 0,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
        ],
        order: ["player-1-char-1", "player-2-char-2"],
        initiativeRolls: {
          "player-1-char-1": 12,
          "player-2-char-2": 9,
        },
        nextRound: 1,
        roundLimit: 12,
      },
      {
        "player-1-char-1": "retreat",
        "player-2-char-2": "attack",
      },
    ),
    false,
  );

  assert.equal(
    isEncounterRoundReadyToResolve(
      {
        participants: [
          {
            id: "player-1-char-1",
            name: "Alyndra",
            side: "player",
            classKey: "fighter",
            currentHitPoints: 12,
            maxHitPoints: 12,
            hitPoints: 12,
            armorClass: 16,
            initiativeModifier: 1,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "player-2-char-2",
            name: "Borin",
            side: "player",
            classKey: "cleric",
            currentHitPoints: 10,
            maxHitPoints: 10,
            hitPoints: 10,
            armorClass: 15,
            initiativeModifier: 0,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
        ],
        order: ["player-1-char-1", "player-2-char-2"],
        initiativeRolls: {
          "player-1-char-1": 12,
          "player-2-char-2": 9,
        },
        nextRound: 1,
        roundLimit: 12,
      },
      {
        "player-1-char-1": "attack",
        "player-2-char-2": "guiding_bolt",
      },
    ),
    true,
  );
});

test("waiting encounter summary lists only living players without locked actions", () => {
  assert.deepEqual(
    waitingEncounterActionSummary(
      {
        state: {
          participants: [
            {
              id: "player-1-char-1",
              name: "Alyndra",
              side: "player",
              classKey: "fighter",
              currentHitPoints: 12,
              maxHitPoints: 12,
              hitPoints: 12,
              armorClass: 16,
              initiativeModifier: 1,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 8,
              damageModifier: 3,
              damageDealt: 0,
            },
            {
              id: "player-2-char-2",
              name: "Borin",
              side: "player",
              classKey: "cleric",
              currentHitPoints: 0,
              maxHitPoints: 10,
              hitPoints: 0,
              armorClass: 15,
              initiativeModifier: 0,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 8,
              damageModifier: 3,
              damageDealt: 0,
            },
            {
              id: "player-3-char-3",
              name: "Ignus",
              side: "player",
              classKey: "wizard",
              currentHitPoints: 8,
              maxHitPoints: 8,
              hitPoints: 8,
              armorClass: 12,
              initiativeModifier: 2,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 10,
              damageModifier: 0,
              damageDealt: 0,
            },
          ],
          order: ["player-1-char-1", "player-2-char-2", "player-3-char-3"],
          initiativeRolls: {},
          nextRound: 1,
          roundLimit: 12,
        },
        members: [
          {
            id: "pm-1",
            party_id: "party-1",
            user_id: "user-1",
            character_id: "char-1",
            status: "ready",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Alice",
            telegram_username: "alice",
            character_name: "Alyndra",
            class_key: "fighter",
          },
          {
            id: "pm-2",
            party_id: "party-1",
            user_id: "user-2",
            character_id: "char-2",
            status: "defeated",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Borin",
            telegram_username: "borin",
            character_name: "Borin",
            class_key: "cleric",
          },
          {
            id: "pm-3",
            party_id: "party-1",
            user_id: "user-3",
            character_id: "char-3",
            status: "ready",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Ignus",
            telegram_username: "ignus",
            character_name: "Ignus",
            class_key: "wizard",
          },
        ],
        playerActions: {
          "player-1-char-1": "attack",
        },
      },
    ),
    ["Ignus"],
  );
});

test("locked encounter summary lists only living players with committed actions", () => {
  assert.deepEqual(
    lockedEncounterActionSummary(
      {
        state: {
          participants: [
            {
              id: "player-1-char-1",
              name: "Alyndra",
              side: "player",
              classKey: "fighter",
              currentHitPoints: 12,
              maxHitPoints: 12,
              hitPoints: 12,
              armorClass: 16,
              initiativeModifier: 1,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 8,
              damageModifier: 3,
              damageDealt: 0,
            },
            {
              id: "player-2-char-2",
              name: "Borin",
              side: "player",
              classKey: "cleric",
              currentHitPoints: 0,
              maxHitPoints: 10,
              hitPoints: 0,
              armorClass: 15,
              initiativeModifier: 0,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 8,
              damageModifier: 3,
              damageDealt: 0,
            },
            {
              id: "player-3-char-3",
              name: "Ignus",
              side: "player",
              classKey: "wizard",
              currentHitPoints: 8,
              maxHitPoints: 8,
              hitPoints: 8,
              armorClass: 12,
              initiativeModifier: 2,
              attackModifier: 5,
              damageDiceCount: 1,
              damageDieSides: 10,
              damageModifier: 0,
              damageDealt: 0,
            },
          ],
          order: ["player-1-char-1", "player-2-char-2", "player-3-char-3"],
          initiativeRolls: {},
          nextRound: 1,
          roundLimit: 12,
        },
        members: [
          {
            id: "pm-1",
            party_id: "party-1",
            user_id: "user-1",
            character_id: "char-1",
            status: "ready",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Alice",
            telegram_username: "alice",
            character_name: "Alyndra",
            class_key: "fighter",
          },
          {
            id: "pm-2",
            party_id: "party-1",
            user_id: "user-2",
            character_id: "char-2",
            status: "ready",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Borin",
            telegram_username: "borin",
            character_name: "Borin",
            class_key: "cleric",
          },
          {
            id: "pm-3",
            party_id: "party-1",
            user_id: "user-3",
            character_id: "char-3",
            status: "ready",
            joined_at: new Date("2026-03-26T12:00:00Z"),
            ready_at: new Date("2026-03-26T12:01:00Z"),
            left_at: null,
            created_at: new Date("2026-03-26T12:00:00Z"),
            updated_at: new Date("2026-03-26T12:01:00Z"),
            user_display_name: "Ignus",
            telegram_username: "ignus",
            character_name: "Ignus",
            class_key: "wizard",
          },
        ],
        playerActions: {
          "player-1-char-1": "attack",
        },
      },
    ),
    ["- Alyndra: Attack"],
  );
});

test("encounter action summaries follow initiative order for living players", () => {
  assert.deepEqual(
    lockedEncounterActionSummary({
      state: {
        participants: [
          {
            id: "player-1-char-1",
            name: "Alyndra",
            side: "player",
            classKey: "fighter",
            currentHitPoints: 12,
            maxHitPoints: 12,
            hitPoints: 12,
            armorClass: 16,
            initiativeModifier: 1,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "player-2-char-2",
            name: "Borin",
            side: "player",
            classKey: "cleric",
            currentHitPoints: 10,
            maxHitPoints: 10,
            hitPoints: 10,
            armorClass: 15,
            initiativeModifier: 0,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 8,
            damageModifier: 3,
            damageDealt: 0,
          },
          {
            id: "player-3-char-3",
            name: "Ignus",
            side: "player",
            classKey: "wizard",
            currentHitPoints: 8,
            maxHitPoints: 8,
            hitPoints: 8,
            armorClass: 12,
            initiativeModifier: 2,
            attackModifier: 5,
            damageDiceCount: 1,
            damageDieSides: 10,
            damageModifier: 0,
            damageDealt: 0,
          },
        ],
        order: ["player-3-char-3", "player-1-char-1", "player-2-char-2"],
        initiativeRolls: {},
        nextRound: 1,
        roundLimit: 12,
      },
      members: [
        {
          id: "pm-1",
          party_id: "party-1",
          user_id: "user-1",
          character_id: "char-1",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Alice",
          telegram_username: "alice",
          character_name: "Alyndra",
          class_key: "fighter",
        },
        {
          id: "pm-2",
          party_id: "party-1",
          user_id: "user-2",
          character_id: "char-2",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Borin",
          telegram_username: "borin",
          character_name: "Borin",
          class_key: "cleric",
        },
        {
          id: "pm-3",
          party_id: "party-1",
          user_id: "user-3",
          character_id: "char-3",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Ignus",
          telegram_username: "ignus",
          character_name: "Ignus",
          class_key: "wizard",
        },
      ],
      playerActions: {
        "player-1-char-1": "attack",
        "player-3-char-3": "fire_bolt",
      },
    }),
    ["- Ignus: Cast Fire Bolt", "- Alyndra: Attack"],
  );
});

test("retreat vote progress only appears once at least one living player selects retreat", () => {
  const state: EncounterState = {
    participants: [
      {
        id: "player-1-char-1",
        name: "Alyndra",
        side: "player",
        classKey: "fighter",
        currentHitPoints: 12,
        maxHitPoints: 12,
        hitPoints: 12,
        armorClass: 16,
        initiativeModifier: 1,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
        damageDealt: 0,
      },
      {
        id: "player-2-char-2",
        name: "Borin",
        side: "player",
        classKey: "cleric",
        currentHitPoints: 0,
        maxHitPoints: 10,
        hitPoints: 0,
        armorClass: 15,
        initiativeModifier: 0,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 8,
        damageModifier: 3,
        damageDealt: 0,
      },
      {
        id: "player-3-char-3",
        name: "Ignus",
        side: "player",
        classKey: "wizard",
        currentHitPoints: 8,
        maxHitPoints: 8,
        hitPoints: 8,
        armorClass: 12,
        initiativeModifier: 2,
        attackModifier: 5,
        damageDiceCount: 1,
        damageDieSides: 10,
        damageModifier: 0,
        damageDealt: 0,
      },
    ],
    order: ["player-3-char-3", "player-1-char-1", "player-2-char-2"],
    initiativeRolls: {},
    nextRound: 1,
    roundLimit: 12,
  };

  assert.equal(retreatVoteProgressSummary({ state, playerActions: {} }), null);
  assert.equal(
    retreatVoteProgressSummary({
      state,
      playerActions: {
        "player-3-char-3": "retreat",
      },
    }),
    "Retreat votes: 1/2",
  );
});

test("monster encounter roster lines surface player-facing role labels", () => {
  assert.equal(
    formatEncounterSideSummaryLine({
      name: "Goblin Sneak",
      side: "monster",
      monsterRole: "skirmisher",
      currentHitPoints: 7,
      maxHitPoints: 7,
    }),
    "- Goblin Sneak (skirmisher) 7/7",
  );

  assert.equal(
    formatEncounterSideSummaryLine({
      name: "Alyndra",
      side: "player",
      currentHitPoints: 9,
      maxHitPoints: 12,
    }),
    "- Alyndra 9/12",
  );
});

test("run party roster entry includes crawler progression when character data is available", () => {
  assert.equal(
    formatRunPartyRosterEntry(
      {
        id: "pm-1",
        party_id: "party-1",
        user_id: "user-1",
        character_id: "char-1",
        status: "ready",
        joined_at: new Date("2026-03-26T12:00:00Z"),
        ready_at: new Date("2026-03-26T12:01:00Z"),
        left_at: null,
        created_at: new Date("2026-03-26T12:00:00Z"),
        updated_at: new Date("2026-03-26T12:01:00Z"),
        user_display_name: "Alice",
        telegram_username: "alice",
        character_name: "Alyndra",
        class_key: "fighter",
      },
      0,
      {
        character: {
          id: "char-1",
          user_id: "user-1",
          name: "Alyndra",
          class_key: "fighter",
          level: 1,
          crawler_level: 2,
          crawler_xp: 125,
          status: "active",
          rules_version_id: "rules-1",
          wins: 0,
          losses: 0,
          matches_played: 0,
          derived_stats: {},
          ability_scores: {},
          loadout: {},
          resource_state: {},
          crawler_stats: {},
        },
        currentHitPoints: 7,
        maxHitPoints: 12,
      },
    ),
    "1. Alyndra (fighter) - @alice - ready - 7/12 HP - crawler T2 125/250 XP - perks: Veteran's Grit",
  );
});

test("defeated encounter participants are removed from active run participation", () => {
  assert.deepEqual(
    applyEncounterDefeatToPartyMembers(
      [
        {
          id: "pm-1",
          party_id: "party-1",
          user_id: "user-1",
          character_id: "char-1",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Alice",
          telegram_username: "alice",
          character_name: "Alyndra",
          class_key: "fighter",
        },
        {
          id: "pm-2",
          party_id: "party-1",
          user_id: "user-2",
          character_id: "char-2",
          status: "ready",
          joined_at: new Date("2026-03-26T12:00:00Z"),
          ready_at: new Date("2026-03-26T12:01:00Z"),
          left_at: null,
          created_at: new Date("2026-03-26T12:00:00Z"),
          updated_at: new Date("2026-03-26T12:01:00Z"),
          user_display_name: "Borin",
          telegram_username: "borin",
          character_name: "Borin",
          class_key: "cleric",
        },
      ],
      [
        {
          id: "player-1-char-1",
          name: "Alyndra",
          side: "player",
          currentHitPoints: 0,
          maxHitPoints: 12,
          damageDealt: 7,
          isDefeated: true,
        },
        {
          id: "player-2-char-2",
          name: "Borin",
          side: "player",
          currentHitPoints: 4,
          maxHitPoints: 11,
          damageDealt: 3,
          isDefeated: false,
        },
      ],
    ).map((member) => member.status),
    ["defeated", "ready"],
  );
});

test("healing is capped at max hp", () => {
  assert.equal(applyHealing(4, 10, 4), 8);
  assert.equal(applyHealing(9, 10, 4), 10);
  assert.equal(applyHealing(0, 10, 6), 6);
});

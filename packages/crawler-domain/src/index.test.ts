import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHealing,
  applyEncounterDefeatToPartyMembers,
  buildEncounterXpRecipients,
  buildPartyLobbyButtonLabels,
  canStartCrawlerParty,
  describeRunPresentationState,
  encounterXpForRoomType,
  formatEncounterSideSummaryLine,
  formatRunPartyRosterEntry,
  isEligibleForCrawlerParty,
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

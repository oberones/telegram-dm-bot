import assert from "node:assert/strict";
import test from "node:test";

import { canStartCrawlerParty, describeRunPresentationState, isEligibleForCrawlerParty } from "./index.js";

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

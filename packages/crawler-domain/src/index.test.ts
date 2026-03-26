import assert from "node:assert/strict";
import test from "node:test";

import { canStartCrawlerParty, isEligibleForCrawlerParty } from "./index.js";

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

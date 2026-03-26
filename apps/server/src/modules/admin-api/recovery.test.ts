import assert from "node:assert/strict";
import test from "node:test";

import {
  explainFlaggedCrawlerEncounter,
  explainFlaggedCrawlerRun,
  explainFlaggedDispute,
  explainFlaggedMatch,
  summarizeCrawlerRewards,
} from "./recovery.js";

test("pending disputes get a recovery hint", () => {
  assert.match(explainFlaggedDispute("pending"), /Awaiting target response/);
});

test("errored matches surface the stored error summary when present", () => {
  assert.equal(
    explainFlaggedMatch({
      status: "error",
      endReason: "error",
      errorSummary: "Webhook replay failed during persistence.",
    }),
    "Webhook replay failed during persistence.",
  );
});

test("running matches get an administrative intervention hint", () => {
  assert.match(
    explainFlaggedMatch({
      status: "running",
      endReason: null,
      errorSummary: null,
    }),
    /administrative finalization or cancellation/,
  );
});

test("awaiting-choice crawler runs get a conservative recovery hint", () => {
  assert.match(
    explainFlaggedCrawlerRun({
      status: "awaiting_choice",
      currentRoomId: "room-1",
      activeEncounterId: null,
      failureReason: null,
    }),
    /waiting on room input/,
  );
});

test("combat or errored crawler runs get administrative failure hints", () => {
  assert.match(
    explainFlaggedCrawlerRun({
      status: "in_combat",
      currentRoomId: "room-1",
      activeEncounterId: "encounter-1",
      failureReason: null,
    }),
    /encounter is stuck/,
  );

  assert.equal(
    explainFlaggedCrawlerRun({
      status: "error",
      currentRoomId: "room-1",
      activeEncounterId: null,
      failureReason: "Encounter snapshot is inconsistent.",
    }),
    "Encounter snapshot is inconsistent.",
  );
});

test("active crawler encounters get a conservative error-marking hint", () => {
  assert.match(
    explainFlaggedCrawlerEncounter({
      status: "active",
      errorSummary: null,
    }),
    /mark it errored/i,
  );
});

test("crawler reward summaries surface pending and revoked anomalies", () => {
  assert.deepEqual(
    summarizeCrawlerRewards([
      {
        id: "reward-1",
        run_id: "run-1",
        room_id: "room-1",
        encounter_id: "enc-1",
        recipient_user_id: "user-1",
        recipient_character_id: "char-1",
        loot_template_id: "loot-1",
        reward_kind: "weapon",
        status: "granted",
        quantity: 1,
        reward_payload: {},
        granted_at: new Date(),
        revoked_at: null,
        created_at: new Date(),
      },
      {
        id: "reward-2",
        run_id: "run-1",
        room_id: "room-1",
        encounter_id: "enc-1",
        recipient_user_id: "user-1",
        recipient_character_id: "char-1",
        loot_template_id: "loot-2",
        reward_kind: "armor",
        status: "pending",
        quantity: 1,
        reward_payload: {},
        granted_at: null,
        revoked_at: null,
        created_at: new Date(),
      },
      {
        id: "reward-3",
        run_id: "run-1",
        room_id: "room-2",
        encounter_id: null,
        recipient_user_id: "user-2",
        recipient_character_id: "char-2",
        loot_template_id: "loot-3",
        reward_kind: "consumable",
        status: "revoked",
        quantity: 1,
        reward_payload: {},
        granted_at: new Date(),
        revoked_at: new Date(),
        created_at: new Date(),
      },
    ]),
    {
      granted: 1,
      pending: 1,
      revoked: 1,
      anomalies: [
        "1 reward ledger row(s) are still pending.",
        "1 reward ledger row(s) were revoked and should be reviewed.",
      ],
    },
  );
});

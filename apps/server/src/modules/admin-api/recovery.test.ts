import assert from "node:assert/strict";
import test from "node:test";

import { explainFlaggedCrawlerRun, explainFlaggedDispute, explainFlaggedMatch } from "./recovery.js";

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

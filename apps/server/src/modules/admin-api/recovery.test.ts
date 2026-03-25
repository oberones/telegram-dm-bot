import assert from "node:assert/strict";
import test from "node:test";

import { explainFlaggedDispute, explainFlaggedMatch } from "./recovery.js";

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

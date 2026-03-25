import assert from "node:assert/strict";
import test from "node:test";

import { createPasswordHash, hashSessionToken, verifyPassword } from "./admin-auth.js";

test("createPasswordHash and verifyPassword round-trip correctly", () => {
  const password = "correct horse battery staple";
  const passwordHash = createPasswordHash(password);

  assert.equal(verifyPassword(password, passwordHash), true);
  assert.equal(verifyPassword("wrong password", passwordHash), false);
});

test("hashSessionToken is deterministic for the same secret and token", () => {
  const first = hashSessionToken("session-secret", "raw-token");
  const second = hashSessionToken("session-secret", "raw-token");
  const different = hashSessionToken("session-secret", "different-token");

  assert.equal(first, second);
  assert.notEqual(first, different);
});

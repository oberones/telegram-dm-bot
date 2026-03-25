import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("repositories do not use template interpolation inside SQL definitions", async () => {
  const source = await readFile(new URL("./repositories.ts", import.meta.url), "utf8");

  assert.equal(
    source.includes("${"),
    false,
    "packages/db/src/repositories.ts contains template interpolation; use parameterized queries instead",
  );
});

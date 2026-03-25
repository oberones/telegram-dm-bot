import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { migrationDirectory, query } from "./index.js";

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedVersions() {
  const result = await query<{ version: string }>(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );

  return new Set(result.rows.map((row: { version: string }) => row.version));
}

async function run() {
  await ensureMigrationsTable();

  const dir = fileURLToPath(migrationDirectory);
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const applied = await appliedVersions();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");

    await query(sql);
    await query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    console.log(`Applied migration ${file}`);
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

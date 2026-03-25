import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { loadConfig } from "@dm-bot/shared";

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    const config = loadConfig();

    pool = new Pool({
      connectionString: config.databaseUrl,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  await query("SELECT 1");
  return true;
}

import type { PoolClient } from "pg";

import { withTransaction } from "./client.js";

export type UserRecord = {
  id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  display_name: string;
  status: "active" | "suspended";
};

export type CharacterRecord = {
  id: string;
  user_id: string;
  name: string;
  class_key: string;
  level: number;
  status: "active" | "frozen" | "retired";
  wins: number;
  losses: number;
  matches_played: number;
  derived_stats: Record<string, unknown>;
  ability_scores: Record<string, unknown>;
  loadout: Record<string, unknown>;
  resource_state: Record<string, unknown>;
};

export type BotSessionRecord = {
  id: string;
  user_id: string;
  flow_type: "character_creation" | "dispute_creation";
  status: "active" | "completed" | "cancelled" | "expired";
  step_key: string;
  data: Record<string, unknown>;
  expires_at: Date;
};

export type RulesVersionRecord = {
  id: string;
  version_key: string;
  status: "draft" | "active" | "retired";
  summary: string;
  config: Record<string, unknown>;
};

type TelegramUserInput = {
  telegramUserId: string;
  telegramUsername?: string | undefined;
  telegramFirstName?: string | undefined;
  telegramLastName?: string | undefined;
  displayName: string;
};

type CharacterInput = {
  userId: string;
  name: string;
  classKey: string;
  level: number;
  rulesVersionId: string;
  abilityScores: Record<string, unknown>;
  derivedStats: Record<string, unknown>;
  loadout: Record<string, unknown>;
  resourceState: Record<string, unknown>;
};

function sessionExpiryDate() {
  return new Date(Date.now() + 1000 * 60 * 30);
}

export async function upsertTelegramUser(input: TelegramUserInput): Promise<UserRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRecord>(
      `
        INSERT INTO users (
          telegram_user_id,
          telegram_username,
          telegram_first_name,
          telegram_last_name,
          display_name,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (telegram_user_id)
        DO UPDATE SET
          telegram_username = EXCLUDED.telegram_username,
          telegram_first_name = EXCLUDED.telegram_first_name,
          telegram_last_name = EXCLUDED.telegram_last_name,
          display_name = EXCLUDED.display_name,
          last_seen_at = NOW(),
          updated_at = NOW()
        RETURNING id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, display_name, status
      `,
      [
        input.telegramUserId,
        input.telegramUsername ?? null,
        input.telegramFirstName ?? null,
        input.telegramLastName ?? null,
        input.displayName,
      ],
    );

    return result.rows[0]!;
  });
}

export async function getActiveCharacterByUserId(userId: string): Promise<CharacterRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<CharacterRecord>(
      `
        SELECT
          id,
          user_id,
          name,
          class_key,
          level,
          status,
          wins,
          losses,
          matches_played,
          derived_stats,
          ability_scores,
          loadout,
          resource_state
        FROM characters
        WHERE user_id = $1
          AND status IN ('active', 'frozen')
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  });
}

export async function getActiveSessionByUserId(userId: string): Promise<BotSessionRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<BotSessionRecord>(
      `
        SELECT id, user_id, flow_type, status, step_key, data, expires_at
        FROM bot_sessions
        WHERE user_id = $1
          AND status = 'active'
          AND expires_at > NOW()
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  });
}

export async function upsertActiveSession(params: {
  userId: string;
  flowType: "character_creation" | "dispute_creation";
  stepKey: string;
  data: Record<string, unknown>;
}): Promise<BotSessionRecord> {
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE bot_sessions
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $1
          AND status = 'active'
      `,
      [params.userId],
    );

    const result = await client.query<BotSessionRecord>(
      `
        INSERT INTO bot_sessions (
          user_id,
          flow_type,
          status,
          step_key,
          data,
          expires_at,
          last_interaction_at,
          updated_at
        )
        VALUES ($1, $2, 'active', $3, $4::jsonb, $5, NOW(), NOW())
        RETURNING id, user_id, flow_type, status, step_key, data, expires_at
      `,
      [
        params.userId,
        params.flowType,
        params.stepKey,
        JSON.stringify(params.data),
        sessionExpiryDate(),
      ],
    );

    return result.rows[0]!;
  });
}

export async function clearActiveSession(userId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE bot_sessions
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $1
          AND status = 'active'
      `,
      [userId],
    );
  });
}

export async function cancelActiveSession(userId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE bot_sessions
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $1
          AND status = 'active'
      `,
      [userId],
    );

    return (result.rowCount ?? 0) > 0;
  });
}

export async function ensureRulesVersion(params: {
  versionKey: string;
  summary: string;
  config: Record<string, unknown>;
}): Promise<RulesVersionRecord> {
  return withTransaction(async (client) => {
    const existing = await client.query<RulesVersionRecord>(
      `
        SELECT id, version_key, status, summary, config
        FROM rules_versions
        WHERE version_key = $1
        LIMIT 1
      `,
      [params.versionKey],
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const inserted = await client.query<RulesVersionRecord>(
      `
        INSERT INTO rules_versions (version_key, status, summary, config, activated_at, updated_at)
        VALUES ($1, 'active', $2, $3::jsonb, NOW(), NOW())
        RETURNING id, version_key, status, summary, config
      `,
      [params.versionKey, params.summary, JSON.stringify(params.config)],
    );

    return inserted.rows[0]!;
  });
}

export async function createCharacterAndCompleteSession(
  input: CharacterInput,
): Promise<CharacterRecord> {
  return withTransaction(async (client) => {
    const character = await insertCharacter(client, input);

    await client.query(
      `
        UPDATE bot_sessions
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $1
          AND status = 'active'
      `,
      [input.userId],
    );

    return character;
  });
}

async function insertCharacter(
  client: PoolClient,
  input: CharacterInput,
): Promise<CharacterRecord> {
  const result = await client.query<CharacterRecord>(
    `
      INSERT INTO characters (
        user_id,
        name,
        class_key,
        level,
        status,
        rules_version_id,
        ability_scores,
        derived_stats,
        loadout,
        resource_state,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'active', $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
      RETURNING
        id,
        user_id,
        name,
        class_key,
        level,
        status,
        wins,
        losses,
        matches_played,
        derived_stats,
        ability_scores,
        loadout,
        resource_state
    `,
    [
      input.userId,
      input.name,
      input.classKey,
      input.level,
      input.rulesVersionId,
      JSON.stringify(input.abilityScores),
      JSON.stringify(input.derivedStats),
      JSON.stringify(input.loadout),
      JSON.stringify(input.resourceState),
    ],
  );

  return result.rows[0]!;
}

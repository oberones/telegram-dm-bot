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
  rules_version_id: string;
  wins: number;
  losses: number;
  matches_played: number;
  derived_stats: Record<string, unknown>;
  ability_scores: Record<string, unknown>;
  loadout: Record<string, unknown>;
  resource_state: Record<string, unknown>;
};

export type DisputeRecord = {
  id: string;
  challenger_user_id: string;
  target_user_id: string;
  challenger_character_id: string;
  target_character_id: string;
  reason: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled" | "match_created";
  created_at: Date;
};

export type MatchRecord = {
  id: string;
  dispute_id: string;
  status: "queued" | "running" | "completed" | "cancelled" | "error" | "finalized_by_admin";
  winner_character_id: string | null;
  end_reason:
    | "knockout"
    | "round_limit_hp_pct"
    | "round_limit_damage"
    | "round_limit_hits"
    | "sudden_death"
    | "admin_finalized"
    | "cancelled"
    | "error"
    | null;
  rounds_completed?: number;
  created_at?: Date;
  completed_at?: Date | null;
  error_summary?: string | null;
  admin_finalization_reason?: string | null;
};

export type AdminUserRecord = {
  id: string;
  display_name: string;
  telegram_user_id: string;
  telegram_username: string | null;
  status: UserRecord["status"];
  last_seen_at: Date | null;
  character_name: string | null;
  class_key: string | null;
  matches_played: number | null;
  wins: number | null;
  losses: number | null;
};

export type AdminCharacterRecord = {
  id: string;
  user_id: string;
  user_display_name: string;
  telegram_username: string | null;
  name: string;
  class_key: string;
  level: number;
  status: CharacterRecord["status"];
  wins: number;
  losses: number;
  matches_played: number;
  created_at: Date;
  last_match_at: Date | null;
  frozen_reason: string | null;
};

export type PublicCharacterStatusRecord = {
  id: string;
  user_id: string;
  user_display_name: string;
  telegram_username: string | null;
  name: string;
  class_key: string;
  level: number;
  status: CharacterRecord["status"];
  wins: number;
  losses: number;
  matches_played: number;
};

export type AdminMatchListRecord = {
  id: string;
  dispute_id: string;
  status: MatchRecord["status"];
  winner_character_id: string | null;
  end_reason: MatchRecord["end_reason"];
  rounds_completed: number;
  created_at: Date;
  completed_at: Date | null;
  error_summary: string | null;
  admin_finalization_reason: string | null;
  challenger_character_name: string;
  target_character_name: string;
  winner_character_name: string | null;
};

export type MatchParticipantRecord = {
  id: string;
  match_id: string;
  character_id: string;
  user_id: string;
  slot: number;
  is_winner: boolean;
  character_name: string;
  user_display_name: string;
  snapshot: Record<string, unknown>;
  created_at: Date;
};

export type AuditLogRecord = {
  id: string;
  actor_type: string;
  actor_user_id: string | null;
  actor_admin_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  admin_display_name: string | null;
  user_display_name: string | null;
};

export type MatchEventRecord = {
  id: string;
  match_id: string;
  round_number: number;
  sequence_number: number;
  event_type: string;
  public_text: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
};

export type UserMatchSummaryRecord = {
  match_id: string;
  dispute_id: string;
  match_status: MatchRecord["status"];
  end_reason: MatchRecord["end_reason"];
  rounds_completed: number | null;
  created_at: Date;
  completed_at: Date | null;
  character_id: string;
  character_name: string;
  opponent_character_id: string;
  opponent_character_name: string;
  is_winner: boolean;
};

export type UserDisputeSummaryRecord = {
  id: string;
  status: DisputeRecord["status"];
  reason: string;
  created_at: Date;
  challenger_user_id: string;
  target_user_id: string;
  challenger_display_name: string;
  target_display_name: string;
  challenger_character_name: string;
  target_character_name: string;
  accepted_at?: Date | null;
  declined_at?: Date | null;
  cancelled_at?: Date | null;
  expired_at?: Date | null;
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

export type TelegramUpdateRecord = {
  id: string;
  telegram_update_id: number;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
  update_type: string;
  received_at: Date;
  processed_at: Date | null;
  status: "received" | "processed" | "failed";
  error_summary: string | null;
  raw_payload: Record<string, unknown> | null;
};

export type AdminUserAccountRecord = {
  id: string;
  email: string;
  display_name: string;
  role: "super_admin" | "operator" | "moderator";
  status: "active" | "disabled";
  password_hash: string | null;
  last_login_at: Date | null;
};

export type AdminSessionRecord = {
  id: string;
  admin_user_id: string;
  session_token_hash: string;
  expires_at: Date;
  last_seen_at: Date;
  created_at: Date;
};

export type PartyRecord = {
  id: string;
  leader_user_id: string;
  status: "forming" | "ready" | "in_run" | "completed" | "abandoned" | "cancelled";
  active_run_id: string | null;
  party_name: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PartyMemberRecord = {
  id: string;
  party_id: string;
  user_id: string;
  character_id: string;
  status: "joined" | "ready" | "left" | "disconnected" | "defeated";
  joined_at: Date;
  ready_at: Date | null;
  left_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PartySummaryRecord = PartyRecord & {
  leader_display_name: string;
};

export type PartyMemberDetailRecord = PartyMemberRecord & {
  user_display_name: string;
  telegram_username: string | null;
  character_name: string;
  class_key: string;
};

export type AdventureRunRecord = {
  id: string;
  party_id: string;
  status:
    | "forming"
    | "active"
    | "awaiting_choice"
    | "in_combat"
    | "paused"
    | "completed"
    | "failed"
    | "abandoned"
    | "cancelled"
    | "error";
  seed: string;
  generation_version: string;
  theme_key: string | null;
  rules_version_id: string | null;
  floor_count: number;
  current_floor_number: number | null;
  current_room_id: string | null;
  active_encounter_id: string | null;
  difficulty_tier: number;
  summary: Record<string, unknown>;
  started_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type RunFloorRecord = {
  id: string;
  run_id: string;
  floor_number: number;
  seed_fragment: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type RunRoomRecord = {
  id: string;
  run_id: string;
  floor_id: string;
  room_number: number;
  room_type: "combat" | "elite_combat" | "treasure" | "event" | "rest" | "boss";
  status: "unvisited" | "active" | "completed" | "skipped" | "failed";
  template_key: string | null;
  prompt_payload: Record<string, unknown>;
  generation_payload: Record<string, unknown>;
  entered_at: Date | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type RunRoomDetailRecord = RunRoomRecord & {
  floor_number: number;
};

export type RunChoiceRecord = {
  id: string;
  run_id: string;
  room_id: string;
  actor_user_id: string | null;
  choice_key: string;
  choice_payload: Record<string, unknown>;
  created_at: Date;
};

export type MonsterTemplateRecord = {
  id: string;
  template_key: string;
  display_name: string;
  theme_key: string;
  role_key: string;
  point_value: string;
  stat_block: Record<string, unknown>;
  ai_profile: Record<string, unknown>;
  rewards: Record<string, unknown>;
  is_active: boolean;
  content_version: string;
};

export type LootTemplateRecord = {
  id: string;
  template_key: string;
  display_name: string;
  category_key: string;
  rarity_key: string;
  equipment_slot: "weapon" | "armor" | "accessory" | null;
  is_permanent: boolean;
  effect_data: Record<string, unknown>;
  drop_rules: Record<string, unknown>;
  is_active: boolean;
  content_version: string;
};

export type InventoryItemRecord = {
  id: string;
  user_id: string;
  character_id: string | null;
  loot_template_id: string | null;
  status: "owned" | "equipped" | "consumed" | "lost" | "destroyed";
  quantity: number;
  metadata: Record<string, unknown>;
  acquired_at: Date;
  consumed_at: Date | null;
  lost_at: Date | null;
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

type PartyInput = {
  leaderUserId: string;
  partyName?: string | null;
};

type PartyMemberInput = {
  partyId: string;
  userId: string;
  characterId: string;
};

type AdventureRunInput = {
  partyId: string;
  seed: string;
  generationVersion: string;
  floorCount: number;
  difficultyTier: number;
  themeKey?: string | null;
  rulesVersionId?: string | null;
  status?: AdventureRunRecord["status"];
};

type RunFloorInput = {
  runId: string;
  floorNumber: number;
  seedFragment: string;
  metadata?: Record<string, unknown>;
};

type RunRoomInput = {
  runId: string;
  floorId: string;
  roomNumber: number;
  roomType: RunRoomRecord["room_type"];
  status?: RunRoomRecord["status"];
  templateKey?: string | null;
  promptPayload?: Record<string, unknown>;
  generationPayload?: Record<string, unknown>;
};

type MonsterTemplateInput = {
  templateKey: string;
  displayName: string;
  themeKey: string;
  roleKey: string;
  pointValue: number;
  statBlock: Record<string, unknown>;
  aiProfile?: Record<string, unknown>;
  rewards?: Record<string, unknown>;
  contentVersion: string;
};

type LootTemplateInput = {
  templateKey: string;
  displayName: string;
  categoryKey: string;
  rarityKey: string;
  equipmentSlot?: LootTemplateRecord["equipment_slot"];
  isPermanent: boolean;
  effectData: Record<string, unknown>;
  dropRules?: Record<string, unknown>;
  contentVersion: string;
};

type InventoryItemInput = {
  userId: string;
  characterId?: string | null;
  lootTemplateId?: string | null;
  quantity?: number;
  metadata?: Record<string, unknown>;
};

type CreateDisputeInput = {
  challengerUserId: string;
  targetUserId: string;
  challengerCharacterId: string;
  targetCharacterId: string;
  reason: string;
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
          rules_version_id,
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

export async function getEligibleCharacterByUserId(userId: string): Promise<CharacterRecord | null> {
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
          rules_version_id,
          wins,
          losses,
          matches_played,
          derived_stats,
          ability_scores,
          loadout,
          resource_state
        FROM characters
        WHERE user_id = $1
          AND status = 'active'
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
        rules_version_id,
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

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRecord>(
      `
        SELECT id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, display_name, status
        FROM users
        WHERE lower(telegram_username) = lower($1)
        LIMIT 1
      `,
      [username.replace(/^@/, "")],
    );

    return result.rows[0] ?? null;
  });
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRecord>(
      `
        SELECT id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, display_name, status
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  });
}

export async function getUserByTelegramUserId(telegramUserId: string): Promise<UserRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRecord>(
      `
        SELECT id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, display_name, status
        FROM users
        WHERE telegram_user_id = $1
        LIMIT 1
      `,
      [telegramUserId],
    );

    return result.rows[0] ?? null;
  });
}

export async function upsertBootstrapAdmin(params: {
  email: string;
  displayName: string;
  role: AdminUserAccountRecord["role"];
  passwordHash: string;
}): Promise<AdminUserAccountRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminUserAccountRecord>(
      `
        INSERT INTO admin_users (
          email,
          display_name,
          role,
          status,
          password_hash,
          updated_at
        )
        VALUES ($1, $2, $3, 'active', $4, NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW()
        RETURNING id, email, display_name, role, status, password_hash, last_login_at
      `,
      [params.email.toLowerCase(), params.displayName, params.role, params.passwordHash],
    );

    return result.rows[0]!;
  });
}

export async function getAdminUserByEmail(email: string): Promise<AdminUserAccountRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminUserAccountRecord>(
      `
        SELECT id, email, display_name, role, status, password_hash, last_login_at
        FROM admin_users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  });
}

export async function getAdminSessionWithUserByHash(sessionTokenHash: string): Promise<{
  session: AdminSessionRecord;
  adminUser: AdminUserAccountRecord;
} | null> {
  return withTransaction(async (client) => {
    const result = await client.query<
      AdminSessionRecord & {
        email: string;
        display_name: string;
        role: AdminUserAccountRecord["role"];
        status: AdminUserAccountRecord["status"];
        password_hash: string | null;
        admin_last_login_at: Date | null;
      }
    >(
      `
        SELECT
          s.id,
          s.admin_user_id,
          s.session_token_hash,
          s.expires_at,
          s.last_seen_at,
          s.created_at,
          u.email,
          u.display_name,
          u.role,
          u.status,
          u.password_hash,
          u.last_login_at AS admin_last_login_at
        FROM admin_sessions s
        INNER JOIN admin_users u
          ON u.id = s.admin_user_id
        WHERE s.session_token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [sessionTokenHash],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      session: {
        id: row.id,
        admin_user_id: row.admin_user_id,
        session_token_hash: row.session_token_hash,
        expires_at: row.expires_at,
        last_seen_at: row.last_seen_at,
        created_at: row.created_at,
      },
      adminUser: {
        id: row.admin_user_id,
        email: row.email,
        display_name: row.display_name,
        role: row.role,
        status: row.status,
        password_hash: row.password_hash,
        last_login_at: row.admin_last_login_at,
      },
    };
  });
}

export async function createAdminSession(params: {
  adminUserId: string;
  sessionTokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}): Promise<AdminSessionRecord> {
  return withTransaction(async (client) => {
    await client.query(
      `
        UPDATE admin_users
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [params.adminUserId],
    );

    const result = await client.query<AdminSessionRecord>(
      `
        INSERT INTO admin_sessions (
          admin_user_id,
          session_token_hash,
          ip_address,
          user_agent,
          expires_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, admin_user_id, session_token_hash, expires_at, last_seen_at, created_at
      `,
      [
        params.adminUserId,
        params.sessionTokenHash,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.expiresAt,
      ],
    );

    return result.rows[0]!;
  });
}

export async function touchAdminSession(sessionId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE admin_sessions
        SET last_seen_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );
  });
}

export async function deleteAdminSessionByHash(sessionTokenHash: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        DELETE FROM admin_sessions
        WHERE session_token_hash = $1
      `,
      [sessionTokenHash],
    );
  });
}

export async function createPendingDispute(input: CreateDisputeInput): Promise<DisputeRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<DisputeRecord>(
      `
        INSERT INTO disputes (
          challenger_user_id,
          target_user_id,
          challenger_character_id,
          target_character_id,
          reason,
          status,
          expires_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + interval '24 hours', NOW())
        RETURNING id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
      `,
      [
        input.challengerUserId,
        input.targetUserId,
        input.challengerCharacterId,
        input.targetCharacterId,
        input.reason,
      ],
    );

    return result.rows[0]!;
  });
}

export async function beginTelegramUpdateProcessing(params: {
  telegramUpdateId: number;
  telegramChatId?: string | null;
  telegramUserId?: string | null;
  updateType: string;
  rawPayload: Record<string, unknown>;
}): Promise<"process" | "skip"> {
  return withTransaction(async (client) => {
    const existing = await client.query<TelegramUpdateRecord>(
      `
        SELECT
          id,
          telegram_update_id,
          telegram_chat_id,
          telegram_user_id,
          update_type,
          received_at,
          processed_at,
          status,
          error_summary,
          raw_payload
        FROM telegram_updates
        WHERE telegram_update_id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [params.telegramUpdateId],
    );

    const row = existing.rows[0];

    if (!row) {
      await client.query(
        `
          INSERT INTO telegram_updates (
            telegram_update_id,
            telegram_chat_id,
            telegram_user_id,
            update_type,
            status,
            raw_payload
          )
          VALUES ($1, $2, $3, $4, 'received', $5::jsonb)
        `,
        [
          params.telegramUpdateId,
          params.telegramChatId ?? null,
          params.telegramUserId ?? null,
          params.updateType,
          JSON.stringify(params.rawPayload),
        ],
      );

      return "process";
    }

    if (row.status === "processed" || row.status === "received") {
      return "skip";
    }

    await client.query(
      `
        UPDATE telegram_updates
        SET telegram_chat_id = $2,
            telegram_user_id = $3,
            update_type = $4,
            status = 'received',
            processed_at = NULL,
            error_summary = NULL,
            raw_payload = $5::jsonb
        WHERE telegram_update_id = $1
      `,
      [
        params.telegramUpdateId,
        params.telegramChatId ?? null,
        params.telegramUserId ?? null,
        params.updateType,
        JSON.stringify(params.rawPayload),
      ],
    );

    return "process";
  });
}

export async function markTelegramUpdateProcessed(telegramUpdateId: number): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE telegram_updates
        SET status = 'processed',
            processed_at = NOW(),
            error_summary = NULL
        WHERE telegram_update_id = $1
      `,
      [telegramUpdateId],
    );
  });
}

export async function markTelegramUpdateFailed(params: {
  telegramUpdateId: number;
  errorSummary: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE telegram_updates
        SET status = 'failed',
            error_summary = $2
        WHERE telegram_update_id = $1
      `,
      [params.telegramUpdateId, params.errorSummary],
    );
  });
}

export async function getPendingIncomingDisputes(userId: string): Promise<DisputeRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<DisputeRecord>(
      `
        SELECT id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
        FROM disputes
        WHERE target_user_id = $1
          AND status = 'pending'
        ORDER BY created_at ASC
      `,
      [userId],
    );

    return result.rows;
  });
}

export async function getPendingOutgoingDisputes(userId: string): Promise<DisputeRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<DisputeRecord>(
      `
        SELECT id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
        FROM disputes
        WHERE challenger_user_id = $1
          AND status = 'pending'
        ORDER BY created_at ASC
      `,
      [userId],
    );

    return result.rows;
  });
}

export async function declinePendingDispute(disputeId: string, targetUserId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE disputes
        SET status = 'declined',
            declined_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND target_user_id = $2
          AND status = 'pending'
      `,
      [disputeId, targetUserId],
    );

    return (result.rowCount ?? 0) > 0;
  });
}

export async function getDisputeById(disputeId: string): Promise<DisputeRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DisputeRecord>(
      `
        SELECT id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
        FROM disputes
        WHERE id = $1
        LIMIT 1
      `,
      [disputeId],
    );

    return result.rows[0] ?? null;
  });
}

export async function cancelPendingDisputeByAdmin(disputeId: string): Promise<DisputeRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DisputeRecord>(
      `
        UPDATE disputes
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND status = 'pending'
        RETURNING id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
      `,
      [disputeId],
    );

    return result.rows[0] ?? null;
  });
}

export async function resolvePendingDispute(params: {
  disputeId: string;
  targetUserId: string;
  rulesVersionId: string;
  rulesSnapshot: Record<string, unknown>;
  challengerCharacter: CharacterRecord;
  targetCharacter: CharacterRecord;
  winnerCharacterId: string;
  endReason: MatchRecord["end_reason"];
  roundsCompleted: number;
  events: Array<{
    eventType: string;
    roundNumber: number;
    sequenceNumber: number;
    publicText: string;
    payload: Record<string, unknown>;
    actorCharacterId?: string;
    targetCharacterId?: string;
  }>;
}): Promise<{ dispute: DisputeRecord; match: MatchRecord }> {
  return withTransaction(async (client) => {
    const disputeResult = await client.query<DisputeRecord>(
      `
        UPDATE disputes
        SET status = 'match_created',
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND target_user_id = $2
          AND status = 'pending'
        RETURNING id, challenger_user_id, target_user_id, challenger_character_id, target_character_id, reason, status, created_at
      `,
      [params.disputeId, params.targetUserId],
    );

    const dispute = disputeResult.rows[0];

    if (!dispute) {
      throw new Error("Pending dispute not found or already handled");
    }

    const matchResult = await client.query<MatchRecord>(
      `
        INSERT INTO matches (
          dispute_id,
          rules_version_id,
          rules_snapshot,
          status,
          winner_character_id,
          end_reason,
          rounds_completed,
          started_at,
          completed_at,
          updated_at
        )
        VALUES ($1, $2, $3::jsonb, 'completed', $4, $5, $6, NOW(), NOW(), NOW())
        RETURNING id, dispute_id, status, winner_character_id, end_reason
      `,
      [
        dispute.id,
        params.rulesVersionId,
        JSON.stringify(params.rulesSnapshot),
        params.winnerCharacterId,
        params.endReason,
        params.roundsCompleted,
      ],
    );

    const match = matchResult.rows[0]!;

    const participants = [
      params.challengerCharacter,
      params.targetCharacter,
    ] as const;

    const participantIdByCharacterId = new Map<string, string>();

    for (const character of participants) {
      const isWinner = character.id === params.winnerCharacterId;
      const participantInsert = await client.query<{ id: string }>(
        `
          INSERT INTO match_participants (
            match_id,
            character_id,
            user_id,
            slot,
            is_winner,
            snapshot
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
        `,
        [
          match.id,
          character.id,
          character.user_id,
          character.id === params.challengerCharacter.id ? 1 : 2,
          isWinner,
          JSON.stringify(character),
        ],
      );

      participantIdByCharacterId.set(character.id, participantInsert.rows[0]!.id);
    }

    for (const event of params.events) {
      await client.query(
        `
          INSERT INTO match_events (
            match_id,
            round_number,
            sequence_number,
            event_type,
            actor_participant_id,
            target_participant_id,
            public_text,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          match.id,
          event.roundNumber,
          event.sequenceNumber,
          event.eventType,
          event.actorCharacterId ? participantIdByCharacterId.get(event.actorCharacterId) ?? null : null,
          event.targetCharacterId ? participantIdByCharacterId.get(event.targetCharacterId) ?? null : null,
          event.publicText,
          JSON.stringify(event.payload),
        ],
      );
    }

    for (const character of participants) {
      const isWinner = character.id === params.winnerCharacterId;
      await client.query(
        `
          UPDATE characters
          SET wins = wins + $2,
              losses = losses + $3,
              matches_played = matches_played + 1,
              last_match_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        [character.id, isWinner ? 1 : 0, isWinner ? 0 : 1],
      );
    }

    return {
      dispute,
      match,
    };
  });
}

export async function listUsers(limit = 50): Promise<AdminUserRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminUserRecord>(
      `
        SELECT
          u.id,
          u.display_name,
          u.telegram_user_id,
          u.telegram_username,
          u.status,
          u.last_seen_at,
          c.name AS character_name,
          c.class_key,
          c.matches_played,
          c.wins,
          c.losses
        FROM users u
        LEFT JOIN characters c
          ON c.user_id = u.id
         AND c.status IN ('active', 'frozen')
        ORDER BY u.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function listCharacters(limit = 100): Promise<AdminCharacterRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminCharacterRecord>(
      `
        SELECT
          c.id,
          c.user_id,
          u.display_name AS user_display_name,
          u.telegram_username,
          c.name,
          c.class_key,
          c.level,
          c.status,
          c.wins,
          c.losses,
          c.matches_played,
          c.created_at,
          c.last_match_at,
          c.frozen_reason
        FROM characters c
        INNER JOIN users u
          ON u.id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function listPublicCharacterStatuses(limit = 24): Promise<PublicCharacterStatusRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PublicCharacterStatusRecord>(
      `
        SELECT
          c.id,
          c.user_id,
          u.display_name AS user_display_name,
          u.telegram_username,
          c.name,
          c.class_key,
          c.level,
          c.status,
          c.wins,
          c.losses,
          c.matches_played
        FROM characters c
        INNER JOIN users u
          ON u.id = c.user_id
        WHERE c.status IN ('active', 'frozen')
          AND u.status = 'active'
        ORDER BY c.matches_played DESC, c.wins DESC, c.created_at ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function setUserStatus(params: {
  userId: string;
  status: UserRecord["status"];
  suspendedReason?: string | null;
}): Promise<UserRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<UserRecord>(
      `
        UPDATE users
        SET status = $2,
            suspended_reason = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, telegram_user_id, telegram_username, telegram_first_name, telegram_last_name, display_name, status
      `,
      [params.userId, params.status, params.status === "suspended" ? params.suspendedReason ?? null : null],
    );

    return result.rows[0] ?? null;
  });
}

export async function setCharacterStatus(params: {
  characterId: string;
  status: CharacterRecord["status"];
  frozenReason?: string | null;
}): Promise<CharacterRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<CharacterRecord>(
      `
        UPDATE characters
        SET status = $2,
            frozen_reason = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          user_id,
          name,
          class_key,
          level,
          status,
          rules_version_id,
          wins,
          losses,
          matches_played,
          derived_stats,
          ability_scores,
          loadout,
          resource_state
      `,
      [
        params.characterId,
        params.status,
        params.status === "frozen" ? params.frozenReason ?? null : null,
      ],
    );

    return result.rows[0] ?? null;
  });
}

export async function createAuditLog(params: {
  actorType: string;
  actorUserId?: string | null;
  actorAdminUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO audit_logs (
          actor_type,
          actor_user_id,
          actor_admin_user_id,
          action,
          target_type,
          target_id,
          reason,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        params.actorType,
        params.actorUserId ?? null,
        params.actorAdminUserId ?? null,
        params.action,
        params.targetType,
        params.targetId ?? null,
        params.reason ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
  });
}

export async function listAuditLogs(limit = 50): Promise<AuditLogRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AuditLogRecord>(
      `
        SELECT
          a.id,
          a.actor_type,
          a.actor_user_id,
          a.actor_admin_user_id,
          a.action,
          a.target_type,
          a.target_id,
          a.reason,
          a.metadata,
          a.created_at,
          au.display_name AS admin_display_name,
          u.display_name AS user_display_name
        FROM audit_logs a
        LEFT JOIN admin_users au
          ON au.id = a.actor_admin_user_id
        LEFT JOIN users u
          ON u.id = a.actor_user_id
        ORDER BY a.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function listMatches(limit = 50): Promise<AdminMatchListRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AdminMatchListRecord>(
      `
        SELECT
          m.id,
          m.dispute_id,
          m.status,
          m.winner_character_id,
          m.end_reason,
          m.rounds_completed,
          m.created_at,
          m.completed_at,
          m.error_summary,
          m.admin_finalization_reason,
          challenger_character.name AS challenger_character_name,
          target_character.name AS target_character_name,
          winner_character.name AS winner_character_name
        FROM matches m
        INNER JOIN disputes d
          ON d.id = m.dispute_id
        INNER JOIN characters challenger_character
          ON challenger_character.id = d.challenger_character_id
        INNER JOIN characters target_character
          ON target_character.id = d.target_character_id
        LEFT JOIN characters winner_character
          ON winner_character.id = m.winner_character_id
        ORDER BY m.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function getMatchById(matchId: string): Promise<MatchRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<MatchRecord>(
      `
        SELECT
          id,
          dispute_id,
          status,
          winner_character_id,
          end_reason,
          rounds_completed,
          created_at,
          completed_at,
          error_summary,
          admin_finalization_reason
        FROM matches
        WHERE id = $1
        LIMIT 1
      `,
      [matchId],
    );

    return result.rows[0] ?? null;
  });
}

export async function listMatchEvents(matchId: string): Promise<MatchEventRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<MatchEventRecord>(
      `
        SELECT id, match_id, round_number, sequence_number, event_type, public_text, payload, created_at
        FROM match_events
        WHERE match_id = $1
        ORDER BY sequence_number ASC
      `,
      [matchId],
    );

    return result.rows;
  });
}

export async function listMatchParticipants(matchId: string): Promise<MatchParticipantRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<MatchParticipantRecord>(
      `
        SELECT
          mp.id,
          mp.match_id,
          mp.character_id,
          mp.user_id,
          mp.slot,
          mp.is_winner,
          c.name AS character_name,
          u.display_name AS user_display_name,
          mp.snapshot,
          mp.created_at
        FROM match_participants mp
        INNER JOIN characters c
          ON c.id = mp.character_id
        INNER JOIN users u
          ON u.id = mp.user_id
        WHERE mp.match_id = $1
        ORDER BY mp.slot ASC
      `,
      [matchId],
    );

    return result.rows;
  });
}

export async function finalizeMatchByAdmin(params: {
  matchId: string;
  winnerCharacterId: string;
  reason: string;
}): Promise<MatchRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<MatchRecord>(
      `
        UPDATE matches
        SET status = 'finalized_by_admin',
            winner_character_id = $2,
            end_reason = 'admin_finalized',
            completed_at = NOW(),
            admin_finalization_reason = $3,
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('queued', 'running', 'error')
        RETURNING id, dispute_id, status, winner_character_id, end_reason, rounds_completed, created_at, completed_at
      `,
      [params.matchId, params.winnerCharacterId, params.reason],
    );

    const match = result.rows[0] ?? null;

    if (!match) {
      return null;
    }

    await client.query(
      `
        UPDATE match_participants
        SET is_winner = (character_id = $2)
        WHERE match_id = $1
      `,
      [params.matchId, params.winnerCharacterId],
    );

    return match;
  });
}

export async function cancelMatchByAdmin(params: {
  matchId: string;
  reason: string;
}): Promise<MatchRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<MatchRecord>(
      `
        UPDATE matches
        SET status = 'cancelled',
            winner_character_id = NULL,
            end_reason = 'cancelled',
            completed_at = NOW(),
            admin_finalization_reason = $2,
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('queued', 'running', 'error')
        RETURNING id, dispute_id, status, winner_character_id, end_reason, rounds_completed, created_at, completed_at
      `,
      [params.matchId, params.reason],
    );

    const match = result.rows[0] ?? null;

    if (!match) {
      return null;
    }

    await client.query(
      `
        UPDATE match_participants
        SET is_winner = FALSE
        WHERE match_id = $1
      `,
      [params.matchId],
    );

    return match;
  });
}

export async function listRecentMatchesForUser(
  userId: string,
  limit = 5,
): Promise<UserMatchSummaryRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<UserMatchSummaryRecord>(
      `
        SELECT
          m.id AS match_id,
          m.dispute_id,
          m.status AS match_status,
          m.end_reason,
          m.rounds_completed,
          m.created_at,
          m.completed_at,
          self.character_id,
          self_character.name AS character_name,
          opponent.character_id AS opponent_character_id,
          opponent_character.name AS opponent_character_name,
          self.is_winner
        FROM match_participants self
        INNER JOIN matches m
          ON m.id = self.match_id
        INNER JOIN match_participants opponent
          ON opponent.match_id = self.match_id
         AND opponent.id <> self.id
        INNER JOIN characters self_character
          ON self_character.id = self.character_id
        INNER JOIN characters opponent_character
          ON opponent_character.id = opponent.character_id
        WHERE self.user_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `,
      [userId, limit],
    );

    return result.rows;
  });
}

export async function listRecentDisputesForUser(
  userId: string,
  limit = 10,
): Promise<UserDisputeSummaryRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<UserDisputeSummaryRecord>(
      `
        SELECT
          d.id,
          d.status,
          d.reason,
          d.created_at,
          d.accepted_at,
          d.declined_at,
          d.cancelled_at,
          d.expired_at,
          d.challenger_user_id,
          d.target_user_id,
          challenger.display_name AS challenger_display_name,
          target.display_name AS target_display_name,
          challenger_character.name AS challenger_character_name,
          target_character.name AS target_character_name
        FROM disputes d
        INNER JOIN users challenger
          ON challenger.id = d.challenger_user_id
        INNER JOIN users target
          ON target.id = d.target_user_id
        INNER JOIN characters challenger_character
          ON challenger_character.id = d.challenger_character_id
        INNER JOIN characters target_character
          ON target_character.id = d.target_character_id
        WHERE d.challenger_user_id = $1
           OR d.target_user_id = $1
        ORDER BY d.created_at DESC
        LIMIT $2
      `,
      [userId, limit],
    );

    return result.rows;
  });
}

export async function listDisputes(limit = 50): Promise<UserDisputeSummaryRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<UserDisputeSummaryRecord>(
      `
        SELECT
          d.id,
          d.status,
          d.reason,
          d.created_at,
          d.accepted_at,
          d.declined_at,
          d.cancelled_at,
          d.expired_at,
          d.challenger_user_id,
          d.target_user_id,
          challenger.display_name AS challenger_display_name,
          target.display_name AS target_display_name,
          challenger_character.name AS challenger_character_name,
          target_character.name AS target_character_name
        FROM disputes d
        INNER JOIN users challenger
          ON challenger.id = d.challenger_user_id
        INNER JOIN users target
          ON target.id = d.target_user_id
        INNER JOIN characters challenger_character
          ON challenger_character.id = d.challenger_character_id
        INNER JOIN characters target_character
          ON target_character.id = d.target_character_id
        ORDER BY d.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  });
}

export async function getDashboardCounts(): Promise<{
  pendingDisputes: number;
  runningMatches: number;
  failedMatches: number;
}> {
  return withTransaction(async (client) => {
    const [pendingDisputes, runningMatches, failedMatches] = await Promise.all([
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM disputes WHERE status = 'pending'"),
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM matches WHERE status = 'running'"),
      client.query<{ count: string }>("SELECT count(*)::text AS count FROM matches WHERE status = 'error'"),
    ]);

    return {
      pendingDisputes: Number(pendingDisputes.rows[0]?.count ?? 0),
      runningMatches: Number(runningMatches.rows[0]?.count ?? 0),
      failedMatches: Number(failedMatches.rows[0]?.count ?? 0),
    };
  });
}

export async function createParty(input: PartyInput): Promise<PartyRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyRecord>(
      `
        INSERT INTO parties (
          leader_user_id,
          party_name
        )
        VALUES ($1, $2)
        RETURNING *
      `,
      [input.leaderUserId, input.partyName ?? null],
    );

    return result.rows[0]!;
  });
}

export async function getPartyById(partyId: string): Promise<PartyRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyRecord>(
      `
        SELECT *
        FROM parties
        WHERE id = $1
        LIMIT 1
      `,
      [partyId],
    );

    return result.rows[0] ?? null;
  });
}

export async function listActiveParties(): Promise<PartyRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyRecord>(
      `
        SELECT *
        FROM parties
        WHERE status IN ('forming', 'ready', 'in_run')
        ORDER BY created_at DESC
      `,
    );

    return result.rows;
  });
}

export async function listPartySummaries(): Promise<PartySummaryRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PartySummaryRecord>(
      `
        SELECT
          p.*,
          leader.display_name AS leader_display_name
        FROM parties p
        INNER JOIN users leader
          ON leader.id = p.leader_user_id
        WHERE p.status IN ('forming', 'ready', 'in_run')
        ORDER BY p.created_at DESC
      `,
    );

    return result.rows;
  });
}

export async function getActivePartyForUser(userId: string): Promise<PartyRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyRecord>(
      `
        SELECT DISTINCT p.*
        FROM parties p
        LEFT JOIN party_members pm
          ON pm.party_id = p.id
        WHERE p.status IN ('forming', 'ready', 'in_run')
          AND (
            p.leader_user_id = $1
            OR (
              pm.user_id = $1
              AND pm.status IN ('joined', 'ready')
            )
          )
        ORDER BY p.created_at DESC
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  });
}

export async function addPartyMember(input: PartyMemberInput): Promise<PartyMemberRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        INSERT INTO party_members (
          party_id,
          user_id,
          character_id
        )
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [input.partyId, input.userId, input.characterId],
    );

    return result.rows[0]!;
  });
}

export async function listPartyMembers(partyId: string): Promise<PartyMemberRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        SELECT *
        FROM party_members
        WHERE party_id = $1
        ORDER BY joined_at ASC
      `,
      [partyId],
    );

    return result.rows;
  });
}

export async function listPartyMemberDetails(partyId: string): Promise<PartyMemberDetailRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberDetailRecord>(
      `
        SELECT
          pm.*,
          u.display_name AS user_display_name,
          u.telegram_username,
          c.name AS character_name,
          c.class_key
        FROM party_members pm
        INNER JOIN users u
          ON u.id = pm.user_id
        INNER JOIN characters c
          ON c.id = pm.character_id
        WHERE pm.party_id = $1
        ORDER BY pm.joined_at ASC
      `,
      [partyId],
    );

    return result.rows;
  });
}

export async function getPartyMemberByPartyAndUser(
  partyId: string,
  userId: string,
): Promise<PartyMemberRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        SELECT *
        FROM party_members
        WHERE party_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [partyId, userId],
    );

    return result.rows[0] ?? null;
  });
}

export async function setPartyMemberReadyState(
  partyMemberId: string,
  ready: boolean,
): Promise<PartyMemberRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        UPDATE party_members
        SET
          status = $2,
          ready_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [partyMemberId, ready ? "ready" : "joined", ready],
    );

    return result.rows[0] ?? null;
  });
}

export async function setPartyMemberLeft(partyMemberId: string): Promise<PartyMemberRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        UPDATE party_members
        SET
          status = 'left',
          left_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [partyMemberId],
    );

    return result.rows[0] ?? null;
  });
}

export async function setPartyMemberStatus(params: {
  partyMemberId: string;
  status: PartyMemberRecord["status"];
}): Promise<PartyMemberRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyMemberRecord>(
      `
        UPDATE party_members
        SET
          status = $2,
          ready_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE NULL END,
          left_at = CASE WHEN $2 = 'left' THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [params.partyMemberId, params.status],
    );

    return result.rows[0] ?? null;
  });
}

export async function updateParty(params: {
  partyId: string;
  status?: PartyRecord["status"];
  activeRunId?: string | null;
  leaderUserId?: string;
  partyName?: string | null;
}): Promise<PartyRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PartyRecord>(
      `
        UPDATE parties
        SET
          status = COALESCE($2, status),
          active_run_id = CASE
            WHEN $3 THEN $4
            ELSE active_run_id
          END,
          leader_user_id = COALESCE($5, leader_user_id),
          party_name = COALESCE($6, party_name),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        params.partyId,
        params.status ?? null,
        params.activeRunId !== undefined,
        params.activeRunId ?? null,
        params.leaderUserId ?? null,
        params.partyName ?? null,
      ],
    );

    return result.rows[0] ?? null;
  });
}

export async function createAdventureRun(input: AdventureRunInput): Promise<AdventureRunRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<AdventureRunRecord>(
      `
        INSERT INTO adventure_runs (
          party_id,
          status,
          seed,
          generation_version,
          theme_key,
          rules_version_id,
          floor_count,
          difficulty_tier
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        input.partyId,
        input.status ?? "forming",
        input.seed,
        input.generationVersion,
        input.themeKey ?? null,
        input.rulesVersionId ?? null,
        input.floorCount,
        input.difficultyTier,
      ],
    );

    return result.rows[0]!;
  });
}

export async function updateAdventureRun(params: {
  runId: string;
  status?: AdventureRunRecord["status"];
  currentFloorNumber?: number | null;
  currentRoomId?: string | null;
  activeEncounterId?: string | null;
  summary?: Record<string, unknown>;
}): Promise<AdventureRunRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<AdventureRunRecord>(
      `
        UPDATE adventure_runs
        SET
          status = COALESCE($2, status),
          current_floor_number = CASE WHEN $3 THEN $4 ELSE current_floor_number END,
          current_room_id = CASE WHEN $5 THEN $6 ELSE current_room_id END,
          active_encounter_id = CASE WHEN $7 THEN $8 ELSE active_encounter_id END,
          summary = COALESCE($9, summary),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        params.runId,
        params.status ?? null,
        params.currentFloorNumber !== undefined,
        params.currentFloorNumber ?? null,
        params.currentRoomId !== undefined,
        params.currentRoomId ?? null,
        params.activeEncounterId !== undefined,
        params.activeEncounterId ?? null,
        params.summary ?? null,
      ],
    );

    return result.rows[0] ?? null;
  });
}

export async function getAdventureRunById(runId: string): Promise<AdventureRunRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<AdventureRunRecord>(
      `
        SELECT *
        FROM adventure_runs
        WHERE id = $1
        LIMIT 1
      `,
      [runId],
    );

    return result.rows[0] ?? null;
  });
}

export async function listActiveAdventureRuns(): Promise<AdventureRunRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AdventureRunRecord>(
      `
        SELECT *
        FROM adventure_runs
        WHERE status IN ('forming', 'active', 'awaiting_choice', 'in_combat', 'paused')
        ORDER BY created_at DESC
      `,
    );

    return result.rows;
  });
}

export async function createRunFloor(input: RunFloorInput): Promise<RunFloorRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<RunFloorRecord>(
      `
        INSERT INTO run_floors (
          run_id,
          floor_number,
          seed_fragment,
          metadata
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [input.runId, input.floorNumber, input.seedFragment, input.metadata ?? {}],
    );

    return result.rows[0]!;
  });
}

export async function createRunRoom(input: RunRoomInput): Promise<RunRoomRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<RunRoomRecord>(
      `
        INSERT INTO run_rooms (
          run_id,
          floor_id,
          room_number,
          room_type,
          status,
          template_key,
          prompt_payload,
          generation_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        input.runId,
        input.floorId,
        input.roomNumber,
        input.roomType,
        input.status ?? "unvisited",
        input.templateKey ?? null,
        input.promptPayload ?? {},
        input.generationPayload ?? {},
      ],
    );

    return result.rows[0]!;
  });
}

export async function listRunRoomDetails(runId: string): Promise<RunRoomDetailRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<RunRoomDetailRecord>(
      `
        SELECT
          rr.*,
          rf.floor_number
        FROM run_rooms rr
        INNER JOIN run_floors rf
          ON rf.id = rr.floor_id
        WHERE rr.run_id = $1
        ORDER BY rf.floor_number ASC, rr.room_number ASC
      `,
      [runId],
    );

    return result.rows;
  });
}

export async function getRunRoomDetailById(roomId: string): Promise<RunRoomDetailRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<RunRoomDetailRecord>(
      `
        SELECT
          rr.*,
          rf.floor_number
        FROM run_rooms rr
        INNER JOIN run_floors rf
          ON rf.id = rr.floor_id
        WHERE rr.id = $1
        LIMIT 1
      `,
      [roomId],
    );

    return result.rows[0] ?? null;
  });
}

export async function updateRunRoom(params: {
  roomId: string;
  status?: RunRoomRecord["status"];
  entered?: boolean;
  resolved?: boolean;
  promptPayload?: Record<string, unknown>;
}): Promise<RunRoomRecord | null> {
  return withTransaction(async (client) => {
    const result = await client.query<RunRoomRecord>(
      `
        UPDATE run_rooms
        SET
          status = COALESCE($2, status),
          entered_at = CASE WHEN $3 THEN NOW() ELSE entered_at END,
          resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END,
          prompt_payload = COALESCE($5, prompt_payload),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        params.roomId,
        params.status ?? null,
        params.entered ?? false,
        params.resolved ?? false,
        params.promptPayload ?? null,
      ],
    );

    return result.rows[0] ?? null;
  });
}

export async function createRunChoice(params: {
  runId: string;
  roomId: string;
  actorUserId?: string | null;
  choiceKey: string;
  choicePayload?: Record<string, unknown>;
}): Promise<RunChoiceRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<RunChoiceRecord>(
      `
        INSERT INTO run_choices (
          run_id,
          room_id,
          actor_user_id,
          choice_key,
          choice_payload
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        params.runId,
        params.roomId,
        params.actorUserId ?? null,
        params.choiceKey,
        params.choicePayload ?? {},
      ],
    );

    return result.rows[0]!;
  });
}

export async function upsertMonsterTemplate(input: MonsterTemplateInput): Promise<MonsterTemplateRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<MonsterTemplateRecord>(
      `
        INSERT INTO monster_templates (
          template_key,
          display_name,
          theme_key,
          role_key,
          point_value,
          stat_block,
          ai_profile,
          rewards,
          content_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (template_key) DO UPDATE
        SET
          display_name = EXCLUDED.display_name,
          theme_key = EXCLUDED.theme_key,
          role_key = EXCLUDED.role_key,
          point_value = EXCLUDED.point_value,
          stat_block = EXCLUDED.stat_block,
          ai_profile = EXCLUDED.ai_profile,
          rewards = EXCLUDED.rewards,
          content_version = EXCLUDED.content_version,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.templateKey,
        input.displayName,
        input.themeKey,
        input.roleKey,
        input.pointValue,
        input.statBlock,
        input.aiProfile ?? {},
        input.rewards ?? {},
        input.contentVersion,
      ],
    );

    return result.rows[0]!;
  });
}

export async function listMonsterTemplates(): Promise<MonsterTemplateRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<MonsterTemplateRecord>(
      `
        SELECT *
        FROM monster_templates
        WHERE is_active = TRUE
        ORDER BY theme_key ASC, template_key ASC
      `,
    );

    return result.rows;
  });
}

export async function upsertLootTemplate(input: LootTemplateInput): Promise<LootTemplateRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<LootTemplateRecord>(
      `
        INSERT INTO loot_templates (
          template_key,
          display_name,
          category_key,
          rarity_key,
          equipment_slot,
          is_permanent,
          effect_data,
          drop_rules,
          content_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (template_key) DO UPDATE
        SET
          display_name = EXCLUDED.display_name,
          category_key = EXCLUDED.category_key,
          rarity_key = EXCLUDED.rarity_key,
          equipment_slot = EXCLUDED.equipment_slot,
          is_permanent = EXCLUDED.is_permanent,
          effect_data = EXCLUDED.effect_data,
          drop_rules = EXCLUDED.drop_rules,
          content_version = EXCLUDED.content_version,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.templateKey,
        input.displayName,
        input.categoryKey,
        input.rarityKey,
        input.equipmentSlot ?? null,
        input.isPermanent,
        input.effectData,
        input.dropRules ?? {},
        input.contentVersion,
      ],
    );

    return result.rows[0]!;
  });
}

export async function listLootTemplates(): Promise<LootTemplateRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<LootTemplateRecord>(
      `
        SELECT *
        FROM loot_templates
        WHERE is_active = TRUE
        ORDER BY category_key ASC, rarity_key ASC, template_key ASC
      `,
    );

    return result.rows;
  });
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItemRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<InventoryItemRecord>(
      `
        INSERT INTO inventory_items (
          user_id,
          character_id,
          loot_template_id,
          quantity,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        input.userId,
        input.characterId ?? null,
        input.lootTemplateId ?? null,
        input.quantity ?? 1,
        input.metadata ?? {},
      ],
    );

    return result.rows[0]!;
  });
}

export async function listInventoryItemsForCharacter(characterId: string): Promise<InventoryItemRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<InventoryItemRecord>(
      `
        SELECT *
        FROM inventory_items
        WHERE character_id = $1
        ORDER BY acquired_at DESC
      `,
      [characterId],
    );

    return result.rows;
  });
}

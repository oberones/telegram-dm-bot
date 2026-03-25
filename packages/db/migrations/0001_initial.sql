CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'operator', 'moderator');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_status') THEN
    CREATE TYPE admin_status AS ENUM ('active', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'character_status') THEN
    CREATE TYPE character_status AS ENUM ('active', 'frozen', 'retired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
    CREATE TYPE dispute_status AS ENUM (
      'pending',
      'accepted',
      'declined',
      'expired',
      'cancelled',
      'match_created'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM (
      'queued',
      'running',
      'completed',
      'cancelled',
      'error',
      'finalized_by_admin'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_end_reason') THEN
    CREATE TYPE match_end_reason AS ENUM (
      'knockout',
      'round_limit_hp_pct',
      'round_limit_damage',
      'round_limit_hits',
      'sudden_death',
      'admin_finalized',
      'cancelled',
      'error'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_flow_type') THEN
    CREATE TYPE session_flow_type AS ENUM ('character_creation', 'dispute_creation');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled', 'expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rules_version_status') THEN
    CREATE TYPE rules_version_status AS ENUM ('draft', 'active', 'retired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  display_name TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  suspended_reason TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role admin_role NOT NULL,
  status admin_status NOT NULL DEFAULT 'active',
  password_hash TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rules_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key TEXT NOT NULL UNIQUE,
  status rules_version_status NOT NULL,
  summary TEXT NOT NULL,
  config JSONB NOT NULL,
  created_by_admin_user_id UUID REFERENCES admin_users(id),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  class_key TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level > 0),
  status character_status NOT NULL DEFAULT 'active',
  rules_version_id UUID NOT NULL REFERENCES rules_versions(id),
  ability_scores JSONB NOT NULL,
  derived_stats JSONB NOT NULL,
  loadout JSONB NOT NULL,
  resource_state JSONB NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  frozen_reason TEXT,
  last_match_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_user_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  challenger_character_id UUID NOT NULL REFERENCES characters(id),
  target_character_id UUID NOT NULL REFERENCES characters(id),
  origin_chat_id TEXT,
  origin_message_id TEXT,
  reason TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (challenger_user_id <> target_user_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL UNIQUE REFERENCES disputes(id),
  rules_version_id UUID NOT NULL REFERENCES rules_versions(id),
  rules_snapshot JSONB NOT NULL,
  status match_status NOT NULL,
  winner_character_id UUID REFERENCES characters(id),
  end_reason match_end_reason,
  rounds_completed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  errored_at TIMESTAMPTZ,
  error_code TEXT,
  error_summary TEXT,
  admin_finalization_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id),
  user_id UUID NOT NULL REFERENCES users(id),
  slot SMALLINT NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, slot),
  UNIQUE (match_id, character_id)
);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_participant_id UUID REFERENCES match_participants(id),
  target_participant_id UUID REFERENCES match_participants(id),
  public_text TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  flow_type session_flow_type NOT NULL,
  status session_status NOT NULL DEFAULT 'active',
  step_key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_update_id BIGINT NOT NULL UNIQUE,
  telegram_chat_id TEXT,
  telegram_user_id TEXT,
  update_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  error_summary TEXT,
  raw_payload JSONB
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  actor_admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS characters_one_live_per_user_idx
  ON characters (user_id)
  WHERE status IN ('active', 'frozen');

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS users_last_seen_at_idx ON users (last_seen_at);

CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users (role);
CREATE INDEX IF NOT EXISTS admin_users_status_idx ON admin_users (status);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_user_id_idx ON admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);

CREATE INDEX IF NOT EXISTS rules_versions_status_idx ON rules_versions (status);
CREATE INDEX IF NOT EXISTS rules_versions_activated_at_idx ON rules_versions (activated_at);

CREATE INDEX IF NOT EXISTS characters_status_idx ON characters (status);
CREATE INDEX IF NOT EXISTS characters_class_key_idx ON characters (class_key);
CREATE INDEX IF NOT EXISTS characters_level_idx ON characters (level);
CREATE INDEX IF NOT EXISTS characters_last_match_at_idx ON characters (last_match_at);

CREATE INDEX IF NOT EXISTS disputes_challenger_user_id_idx ON disputes (challenger_user_id);
CREATE INDEX IF NOT EXISTS disputes_target_user_id_idx ON disputes (target_user_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes (status);
CREATE INDEX IF NOT EXISTS disputes_expires_at_idx ON disputes (expires_at);
CREATE INDEX IF NOT EXISTS disputes_status_created_at_idx ON disputes (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS disputes_pending_pair_idx
  ON disputes (challenger_user_id, target_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS matches_status_idx ON matches (status);
CREATE INDEX IF NOT EXISTS matches_winner_character_id_idx ON matches (winner_character_id);
CREATE INDEX IF NOT EXISTS matches_rules_version_id_idx ON matches (rules_version_id);
CREATE INDEX IF NOT EXISTS matches_status_created_at_idx ON matches (status, created_at DESC);

CREATE INDEX IF NOT EXISTS match_participants_match_id_idx ON match_participants (match_id);
CREATE INDEX IF NOT EXISTS match_participants_character_id_idx ON match_participants (character_id);
CREATE INDEX IF NOT EXISTS match_participants_user_id_idx ON match_participants (user_id);

CREATE INDEX IF NOT EXISTS match_events_match_id_idx ON match_events (match_id);
CREATE INDEX IF NOT EXISTS match_events_round_sequence_idx
  ON match_events (match_id, round_number, sequence_number);
CREATE INDEX IF NOT EXISTS match_events_event_type_idx ON match_events (event_type);

CREATE UNIQUE INDEX IF NOT EXISTS bot_sessions_one_active_per_user_idx
  ON bot_sessions (user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bot_sessions_expires_at_idx ON bot_sessions (expires_at);
CREATE INDEX IF NOT EXISTS bot_sessions_flow_type_idx ON bot_sessions (flow_type);

CREATE INDEX IF NOT EXISTS telegram_updates_received_at_idx ON telegram_updates (received_at);
CREATE INDEX IF NOT EXISTS telegram_updates_status_idx ON telegram_updates (status);
CREATE INDEX IF NOT EXISTS telegram_updates_user_id_idx ON telegram_updates (telegram_user_id);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_target_type_idx ON audit_logs (target_type);
CREATE INDEX IF NOT EXISTS audit_logs_target_id_idx ON audit_logs (target_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_admin_idx ON audit_logs (actor_admin_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_idx ON audit_logs (actor_user_id);

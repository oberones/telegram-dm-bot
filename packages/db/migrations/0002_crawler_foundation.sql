DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_status') THEN
    CREATE TYPE party_status AS ENUM (
      'forming',
      'ready',
      'in_run',
      'completed',
      'abandoned',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_member_status') THEN
    CREATE TYPE party_member_status AS ENUM (
      'joined',
      'ready',
      'left',
      'disconnected',
      'defeated'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE run_status AS ENUM (
      'forming',
      'active',
      'awaiting_choice',
      'in_combat',
      'paused',
      'completed',
      'failed',
      'abandoned',
      'cancelled',
      'error'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crawler_room_type') THEN
    CREATE TYPE crawler_room_type AS ENUM (
      'combat',
      'elite_combat',
      'treasure',
      'event',
      'rest',
      'boss'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
    CREATE TYPE room_status AS ENUM (
      'unvisited',
      'active',
      'completed',
      'skipped',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encounter_status') THEN
    CREATE TYPE encounter_status AS ENUM (
      'queued',
      'active',
      'completed',
      'failed',
      'cancelled',
      'error'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encounter_side') THEN
    CREATE TYPE encounter_side AS ENUM ('player', 'monster');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_item_status') THEN
    CREATE TYPE inventory_item_status AS ENUM (
      'owned',
      'equipped',
      'consumed',
      'lost',
      'destroyed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_slot') THEN
    CREATE TYPE equipment_slot AS ENUM ('weapon', 'armor', 'accessory');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loot_grant_status') THEN
    CREATE TYPE loot_grant_status AS ENUM ('pending', 'granted', 'revoked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_user_id UUID NOT NULL REFERENCES users(id),
  status party_status NOT NULL DEFAULT 'forming',
  active_run_id UUID,
  party_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  character_id UUID NOT NULL REFERENCES characters(id),
  status party_member_status NOT NULL DEFAULT 'joined',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (party_id, user_id),
  UNIQUE (party_id, character_id)
);

CREATE TABLE IF NOT EXISTS monster_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  theme_key TEXT NOT NULL,
  role_key TEXT NOT NULL,
  point_value NUMERIC(6,2) NOT NULL,
  stat_block JSONB NOT NULL,
  ai_profile JSONB NOT NULL DEFAULT '{}'::JSONB,
  rewards JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  content_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category_key TEXT NOT NULL,
  rarity_key TEXT NOT NULL,
  equipment_slot equipment_slot,
  is_permanent BOOLEAN NOT NULL DEFAULT TRUE,
  effect_data JSONB NOT NULL,
  drop_rules JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  content_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adventure_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id),
  status run_status NOT NULL DEFAULT 'forming',
  seed TEXT NOT NULL,
  generation_version TEXT NOT NULL,
  theme_key TEXT,
  rules_version_id UUID REFERENCES rules_versions(id),
  floor_count INTEGER NOT NULL CHECK (floor_count > 0),
  current_floor_number INTEGER,
  current_room_id UUID,
  active_encounter_id UUID,
  difficulty_tier INTEGER NOT NULL CHECK (difficulty_tier > 0),
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parties
  ADD CONSTRAINT parties_active_run_id_fkey
  FOREIGN KEY (active_run_id) REFERENCES adventure_runs(id);

CREATE TABLE IF NOT EXISTS run_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL CHECK (floor_number > 0),
  seed_fragment TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, floor_number)
);

CREATE TABLE IF NOT EXISTS run_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES run_floors(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL CHECK (room_number > 0),
  room_type crawler_room_type NOT NULL,
  status room_status NOT NULL DEFAULT 'unvisited',
  template_key TEXT,
  prompt_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  generation_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  entered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, floor_id, room_number)
);

ALTER TABLE adventure_runs
  ADD CONSTRAINT adventure_runs_current_room_id_fkey
  FOREIGN KEY (current_room_id) REFERENCES run_rooms(id);

CREATE TABLE IF NOT EXISTS run_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES run_rooms(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  choice_key TEXT NOT NULL,
  choice_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES run_rooms(id) ON DELETE CASCADE,
  status encounter_status NOT NULL DEFAULT 'queued',
  encounter_key TEXT NOT NULL,
  encounter_snapshot JSONB NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  errored_at TIMESTAMPTZ,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE adventure_runs
  ADD CONSTRAINT adventure_runs_active_encounter_id_fkey
  FOREIGN KEY (active_encounter_id) REFERENCES encounters(id);

CREATE TABLE IF NOT EXISTS encounter_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  side encounter_side NOT NULL,
  user_id UUID REFERENCES users(id),
  character_id UUID REFERENCES characters(id),
  monster_template_id UUID REFERENCES monster_templates(id),
  slot SMALLINT NOT NULL,
  display_name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  is_defeated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encounter_id, side, slot)
);

CREATE TABLE IF NOT EXISTS encounter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  actor_participant_id UUID REFERENCES encounter_participants(id),
  target_participant_id UUID REFERENCES encounter_participants(id),
  public_text TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encounter_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  character_id UUID REFERENCES characters(id),
  loot_template_id UUID REFERENCES loot_templates(id),
  status inventory_item_status NOT NULL DEFAULT 'owned',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_loadouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot equipment_slot NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  equipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, slot),
  UNIQUE (inventory_item_id)
);

CREATE TABLE IF NOT EXISTS run_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  room_id UUID REFERENCES run_rooms(id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES users(id),
  recipient_character_id UUID REFERENCES characters(id),
  loot_template_id UUID REFERENCES loot_templates(id),
  reward_kind TEXT NOT NULL,
  status loot_grant_status NOT NULL DEFAULT 'pending',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reward_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedural_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES adventure_runs(id) ON DELETE CASCADE,
  generation_version TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  seed_fragment TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  output_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parties_leader_user_id_idx ON parties (leader_user_id);
CREATE INDEX IF NOT EXISTS parties_status_idx ON parties (status);
CREATE UNIQUE INDEX IF NOT EXISTS parties_one_active_leader_idx
  ON parties (leader_user_id)
  WHERE status IN ('forming', 'ready', 'in_run');

CREATE INDEX IF NOT EXISTS party_members_user_id_idx ON party_members (user_id);
CREATE INDEX IF NOT EXISTS party_members_character_id_idx ON party_members (character_id);
CREATE INDEX IF NOT EXISTS party_members_status_idx ON party_members (status);

CREATE INDEX IF NOT EXISTS adventure_runs_party_id_idx ON adventure_runs (party_id);
CREATE INDEX IF NOT EXISTS adventure_runs_status_idx ON adventure_runs (status);
CREATE UNIQUE INDEX IF NOT EXISTS adventure_runs_one_active_party_idx
  ON adventure_runs (party_id)
  WHERE status IN ('forming', 'active', 'awaiting_choice', 'in_combat', 'paused');

CREATE INDEX IF NOT EXISTS run_floors_run_id_idx ON run_floors (run_id);
CREATE INDEX IF NOT EXISTS run_rooms_run_id_idx ON run_rooms (run_id);
CREATE INDEX IF NOT EXISTS run_rooms_status_idx ON run_rooms (status);
CREATE INDEX IF NOT EXISTS run_choices_run_id_idx ON run_choices (run_id);

CREATE INDEX IF NOT EXISTS encounters_run_id_idx ON encounters (run_id);
CREATE INDEX IF NOT EXISTS encounters_room_id_idx ON encounters (room_id);
CREATE INDEX IF NOT EXISTS encounters_status_idx ON encounters (status);
CREATE INDEX IF NOT EXISTS encounter_participants_encounter_id_idx ON encounter_participants (encounter_id);
CREATE INDEX IF NOT EXISTS encounter_events_encounter_id_idx ON encounter_events (encounter_id);

CREATE INDEX IF NOT EXISTS monster_templates_theme_key_idx ON monster_templates (theme_key);
CREATE INDEX IF NOT EXISTS monster_templates_active_idx ON monster_templates (is_active);
CREATE INDEX IF NOT EXISTS loot_templates_category_key_idx ON loot_templates (category_key);
CREATE INDEX IF NOT EXISTS loot_templates_active_idx ON loot_templates (is_active);

CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx ON inventory_items (user_id);
CREATE INDEX IF NOT EXISTS inventory_items_character_id_idx ON inventory_items (character_id);
CREATE INDEX IF NOT EXISTS inventory_items_status_idx ON inventory_items (status);

CREATE INDEX IF NOT EXISTS run_rewards_run_id_idx ON run_rewards (run_id);
CREATE INDEX IF NOT EXISTS run_rewards_status_idx ON run_rewards (status);
CREATE INDEX IF NOT EXISTS procedural_generation_logs_run_id_idx ON procedural_generation_logs (run_id);

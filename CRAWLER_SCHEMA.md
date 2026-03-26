# Crawler Schema Specification

## 1. Purpose

This document defines the recommended database schema expansion for the cooperative dungeon crawler mode.

It builds on:

- [DUNGEON_CRAWLER_EXPANSION.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DUNGEON_CRAWLER_EXPANSION.md)
- [CRAWLER_RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_RULES_SPEC.md)
- [SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/SCHEMA.md)

The crawler schema must support:

- party formation
- persistent run state
- seeded procedural generation
- PvE encounters
- persistent loot and inventory
- resumable Telegram play
- admin recovery and auditability

---

## 2. Schema Goals

The crawler schema must:

1. support one or more active parties without ambiguity
2. store active runs durably enough to resume after interruption
3. persist generated dungeon structure and encounter composition
4. separate live run state from historical logs
5. support permanent loot ownership and equipment
6. allow replay, audit, and recovery of problematic runs

---

## 3. Design Principles

### Principle 1: Generated Content Must Be Stored, Not Recomputed Blindly

Because the crawler is procedural, generation inputs and outputs must both be stored.

Store:

- run seed
- generation version
- generated room graph
- chosen encounters
- chosen rewards

Do not rely only on “rerun the generator” later.

### Principle 2: Live Run State and Historical Run Logs Must Both Exist

The system needs:

- mutable live state for active runs
- immutable history for completed/failed runs

### Principle 3: Persistent Loot Must Be Ledger-Friendly

Permanent loot is economically sensitive.

Use explicit ownership and grant records rather than silently mutating character JSON blobs.

### Principle 4: Recovery Must Be First-Class

Crawler mode will create more stuck states than duel mode.

Store explicit run and encounter statuses so admin tooling can recover safely.

### Principle 5: Snapshot Anything That Affects Outcome

Encounters should not depend on mutable current item or monster rows after the fact.

---

## 4. New Enums

Recommended crawler-specific enums or constrained strings:

### Party Status

- `forming`
- `ready`
- `in_run`
- `completed`
- `abandoned`
- `cancelled`

### Party Member Status

- `joined`
- `ready`
- `left`
- `disconnected`
- `defeated`

### Run Status

- `forming`
- `active`
- `awaiting_choice`
- `in_combat`
- `paused`
- `completed`
- `failed`
- `abandoned`
- `cancelled`
- `error`

### Room Type

- `combat`
- `elite_combat`
- `treasure`
- `event`
- `rest`
- `boss`

### Room Status

- `unvisited`
- `active`
- `completed`
- `skipped`
- `failed`

### Encounter Status

- `queued`
- `active`
- `completed`
- `failed`
- `cancelled`
- `error`

### Encounter Side

- `player`
- `monster`

### Inventory Item Status

- `owned`
- `equipped`
- `consumed`
- `lost`
- `destroyed`

### Equipment Slot

- `weapon`
- `armor`
- `accessory`

### Loot Grant Status

- `pending`
- `granted`
- `revoked`

---

## 5. New Core Tables

Recommended new crawler tables:

- `parties`
- `party_members`
- `adventure_runs`
- `run_floors`
- `run_rooms`
- `run_choices`
- `encounters`
- `encounter_participants`
- `encounter_events`
- `monster_templates`
- `loot_templates`
- `inventory_items`
- `equipment_loadouts`
- `run_rewards`
- `procedural_generation_logs`

Optional later:

- `event_templates`
- `merchant_offers`
- `consumable_uses`
- `crafting_materials`

---

## 6. `parties`

### Purpose

Stores the player group before and during a run.

### Columns

- `id` UUID PK
- `leader_user_id` UUID FK -> `users.id`
- `status` party status not null
- `active_run_id` UUID nullable FK -> `adventure_runs.id`
- `party_name` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- one party may have at most one active run
- a user may only lead one active/forming party at a time

### Indexes

- `parties_leader_user_id_idx`
- `parties_status_idx`
- partial unique on `leader_user_id` where status in (`forming`, `ready`, `in_run`)

---

## 7. `party_members`

### Purpose

Stores party membership and readiness.

### Columns

- `id` UUID PK
- `party_id` UUID FK -> `parties.id`
- `user_id` UUID FK -> `users.id`
- `character_id` UUID FK -> `characters.id`
- `status` party member status not null
- `joined_at` timestamptz not null
- `ready_at` timestamptz nullable
- `left_at` timestamptz nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- unique (`party_id`, `user_id`)
- unique (`party_id`, `character_id`)

### Notes

- character is selected when joining the party, not later
- membership status is historical and operationally useful

---

## 8. `adventure_runs`

### Purpose

Top-level persistent run state.

### Columns

- `id` UUID PK
- `party_id` UUID FK -> `parties.id`
- `status` run status not null
- `seed` text not null
- `generation_version` text not null
- `rules_version_id` UUID FK -> `rules_versions.id`
- `floor_count` integer not null
- `current_floor_number` integer nullable
- `current_room_id` UUID nullable FK -> `run_rooms.id`
- `active_encounter_id` UUID nullable FK -> `encounters.id`
- `difficulty_tier` integer not null
- `started_at` timestamptz nullable
- `completed_at` timestamptz nullable
- `failed_at` timestamptz nullable
- `failure_reason` text nullable
- `summary` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `summary` can hold compact aggregate state like rooms completed, rewards banked, kills, etc.
- explicit current pointers make run resume much easier

### Indexes

- `adventure_runs_party_id_idx`
- `adventure_runs_status_idx`
- `adventure_runs_started_at_idx`

---

## 9. `run_floors`

### Purpose

Stores generated floor metadata.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `floor_number` integer not null
- `theme_key` text nullable
- `graph` jsonb not null
- `created_at` timestamptz not null

### Constraints

- unique (`run_id`, `floor_number`)

### Notes

- `graph` stores room connectivity and generation output for the floor

---

## 10. `run_rooms`

### Purpose

Stores generated rooms and room resolution state.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `run_floor_id` UUID FK -> `run_floors.id`
- `room_number` integer not null
- `floor_number` integer not null
- `room_type` room type not null
- `status` room status not null
- `generation_payload` jsonb not null
- `resolution_payload` jsonb not null default `'{}'::jsonb`
- `entered_at` timestamptz nullable
- `resolved_at` timestamptz nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `generation_payload` stores the room’s generated content
- `resolution_payload` stores choices made, rewards taken, etc.

### Indexes

- `run_rooms_run_id_idx`
- `run_rooms_room_type_idx`
- `run_rooms_status_idx`
- unique (`run_id`, `floor_number`, `room_number`)

---

## 11. `run_choices`

### Purpose

Stores player-facing choices made during exploration.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `run_room_id` UUID FK -> `run_rooms.id`
- `actor_user_id` UUID FK -> `users.id`
- `choice_key` text not null
- `choice_payload` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null

### Notes

- useful for auditing event rooms and pathing decisions
- supports replaying what players actually chose

---

## 12. `encounters`

### Purpose

Stores PvE combat instances within runs.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `run_room_id` UUID FK -> `run_rooms.id`
- `status` encounter status not null
- `initiative_state` jsonb not null default `'{}'::jsonb`
- `turn_index` integer nullable
- `round_number` integer not null default `1`
- `summary` jsonb not null default `'{}'::jsonb`
- `started_at` timestamptz nullable
- `completed_at` timestamptz nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- this is the crawler equivalent of a duel match, but embedded in a run
- `summary` can include reward pointers, encounter type, threat tier, etc.

### Indexes

- `encounters_run_id_idx`
- `encounters_status_idx`

---

## 13. `encounter_participants`

### Purpose

Stores players and monsters in an encounter plus immutable snapshots.

### Columns

- `id` UUID PK
- `encounter_id` UUID FK -> `encounters.id`
- `side` encounter side not null
- `slot` integer not null
- `user_id` UUID nullable FK -> `users.id`
- `character_id` UUID nullable FK -> `characters.id`
- `monster_template_id` UUID nullable FK -> `monster_templates.id`
- `display_name` text not null
- `snapshot` jsonb not null
- `current_state` jsonb not null
- `is_defeated` boolean not null default false
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- exactly one of `character_id` or `monster_template_id` should be present

### Notes

- `snapshot` is immutable encounter-start state
- `current_state` is mutable live state during the encounter

---

## 14. `encounter_events`

### Purpose

Stores the combat event log for PvE encounters.

### Columns

- `id` UUID PK
- `encounter_id` UUID FK -> `encounters.id`
- `round_number` integer not null
- `sequence_number` integer not null
- `event_type` text not null
- `actor_participant_id` UUID nullable FK -> `encounter_participants.id`
- `target_participant_id` UUID nullable FK -> `encounter_participants.id`
- `public_text` text nullable
- `payload` jsonb not null
- `created_at` timestamptz not null

### Constraints

- unique (`encounter_id`, `sequence_number`)

### Notes

- mirrors the current `match_events` design philosophy
- should be sufficient to replay and explain outcomes

---

## 15. `monster_templates`

### Purpose

Stores curated monster definitions.

### Columns

- `id` UUID PK
- `key` text unique not null
- `name` text not null
- `role` text not null
- `tier` integer not null
- `status` text not null default `active`
- `stat_block` jsonb not null
- `ai_profile` jsonb not null
- `reward_profile` jsonb not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `stat_block` should contain AC, HP, attacks, saves, and action kit
- `ai_profile` should define deterministic behavior rules

### Indexes

- `monster_templates_key_idx`
- `monster_templates_role_idx`
- `monster_templates_tier_idx`

---

## 16. `loot_templates`

### Purpose

Stores all possible item and reward definitions.

### Columns

- `id` UUID PK
- `key` text unique not null
- `name` text not null
- `category` text not null
- `rarity` text not null
- `equipment_slot` equipment slot nullable
- `is_consumable` boolean not null default false
- `is_unique` boolean not null default false
- `effects` jsonb not null
- `value_currency` integer nullable
- `status` text not null default `active`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- one table can represent equipment, consumables, and pure reward items if categories are clear

---

## 17. `inventory_items`

### Purpose

Stores owned loot instances for characters or users.

### Columns

- `id` UUID PK
- `user_id` UUID FK -> `users.id`
- `character_id` UUID nullable FK -> `characters.id`
- `loot_template_id` UUID FK -> `loot_templates.id`
- `status` inventory item status not null
- `source_run_id` UUID nullable FK -> `adventure_runs.id`
- `source_room_id` UUID nullable FK -> `run_rooms.id`
- `granted_at` timestamptz not null
- `consumed_at` timestamptz nullable
- `metadata` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- use item instances instead of only counters so rewards remain auditable
- `character_id` can be nullable if ownership is account-level rather than character-bound

### Indexes

- `inventory_items_user_id_idx`
- `inventory_items_character_id_idx`
- `inventory_items_status_idx`

---

## 18. `equipment_loadouts`

### Purpose

Stores what a character currently has equipped.

### Columns

- `id` UUID PK
- `character_id` UUID FK -> `characters.id`
- `equipment_slot` equipment slot not null
- `inventory_item_id` UUID FK -> `inventory_items.id`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- unique (`character_id`, `equipment_slot`)
- unique (`inventory_item_id`)

### Notes

- keeps current equipment queryable without mutating item history

---

## 19. `run_rewards`

### Purpose

Explicit reward ledger for run and room grants.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `run_room_id` UUID nullable FK -> `run_rooms.id`
- `user_id` UUID FK -> `users.id`
- `character_id` UUID nullable FK -> `characters.id`
- `reward_type` text not null
- `loot_template_id` UUID nullable FK -> `loot_templates.id`
- `currency_amount` integer nullable
- `status` loot grant status not null
- `reason` text nullable
- `payload` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null
- `granted_at` timestamptz nullable

### Notes

- this is the authoritative reward ledger
- item instance creation should map cleanly to reward rows

---

## 20. `procedural_generation_logs`

### Purpose

Stores generation inputs and outputs for audit/debug purposes.

### Columns

- `id` UUID PK
- `run_id` UUID FK -> `adventure_runs.id`
- `generator_key` text not null
- `generator_version` text not null
- `seed` text not null
- `input_payload` jsonb not null
- `output_payload` jsonb not null
- `created_at` timestamptz not null

### Notes

- useful when procedural generation is tweaked over time
- preserves “why this dungeon existed in this shape”

---

## 21. Existing Table Extensions

### `characters`

Recommended new columns:

- `crawler_level` integer nullable or default `1`
- `crawler_xp` integer not null default `0`
- `gold_balance` integer not null default `0`
- `crawler_stats` jsonb not null default `'{}'::jsonb`

### `users`

Possible additions:

- `active_party_id` UUID nullable FK -> `parties.id`
- `active_run_id` UUID nullable FK -> `adventure_runs.id`

These can also be derived instead of stored if you want fewer direct pointers.

### `bot_sessions`

Recommended additions:

- allow crawler-specific session flow types such as:
  - `party_forming`
  - `run_choice`
  - `encounter_turn`
  - `inventory_management`

---

## 22. Run Resume Strategy

The schema should make resume easy by storing:

- active run pointer
- current room pointer
- current encounter pointer
- current turn index
- current expected choice

Recommended location for “what input is expected next”:

- `adventure_runs.summary`
- or a dedicated `run_prompts` table later if complexity grows

For v1, `summary` plus explicit pointers is probably enough.

---

## 23. Recovery and Admin Safety

Admin tooling will need to inspect and possibly mutate:

- party status
- run status
- room resolution state
- encounter status
- reward grant status

Therefore:

- all crawler mutations should produce audit log rows
- reward reversals must be explicit
- no direct inventory deletion without a ledger trail

---

## 24. Suggested Migration Strategy

Do not attempt the full crawler schema in one giant migration unless the feature is about to enter implementation.

Recommended sequence:

1. parties + party_members
2. adventure_runs + run_floors + run_rooms + run_choices
3. monster_templates + encounters + encounter_participants + encounter_events
4. loot_templates + inventory_items + equipment_loadouts + run_rewards
5. procedural_generation_logs + crawler extensions on characters/users

This keeps rollout and testing manageable.

---

## 25. Recommended Next Documents

The strongest next docs are:

- `CRAWLER_BOT_FLOWS.md`
- `CRAWLER_ARCHITECTURE.md`

Those should define the actual Telegram UX and runtime/service boundaries before implementation starts.

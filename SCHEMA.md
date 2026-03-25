# Database Schema Specification

## 1. Purpose

This document defines the canonical database schema for the Telegram arbitration bot.

It is the bridge between the product docs and real migrations. It specifies:

- core tables
- enums and statuses
- relationships
- key constraints
- indexing strategy
- snapshot and audit requirements

This schema is designed for PostgreSQL and assumes the architecture described in:

- [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md)
- [RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/RULES_SPEC.md)
- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)
- [BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BOT_FLOWS.md)
- [ADMIN_PANEL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ADMIN_PANEL.md)

---

## 2. Schema Goals

The schema must:

1. store Telegram-linked player identities safely
2. support one active character per player in v1
3. preserve historical correctness through immutable match snapshots
4. support dispute and match lifecycle management
5. support browser-based admin operations
6. support complete audit logging of sensitive actions
7. remain evolvable as rules versions change over time

---

## 3. Design Principles

### Principle 1: Live State and Historical State Must Be Separate

Current character records are mutable. Historical matches must use snapshot records and must never depend on current character values.

### Principle 2: Explicit Status Fields

Disputes, matches, users, and characters should use explicit status enums rather than ambiguous nullable fields alone.

### Principle 3: JSON Where Shape Evolves, Columns Where Querying Matters

Use normal columns for frequently queried fields such as:

- status
- class
- level
- timestamps
- foreign keys

Use `jsonb` for structured but evolving payloads such as:

- character loadouts
- rules config snapshots
- match event payloads
- session partial form data

### Principle 4: Auditability by Default

Sensitive state changes should leave behind searchable records.

### Principle 5: Database-Enforced Integrity

Use foreign keys, unique constraints, and transactional updates wherever possible. Do not rely only on application logic for core integrity.

---

## 4. Naming Conventions

Recommended conventions:

- table names: plural snake_case
- columns: snake_case
- primary keys: `id`
- timestamps: `created_at`, `updated_at`
- soft-delete or archival fields only where truly needed

### ID Strategy

Recommended:

- UUIDs for application-level primary keys

Reasons:

- easier cross-system references
- safer for public/admin-facing IDs
- avoids sequential enumeration concerns

Telegram user IDs should also be stored in their original numeric/string form as a separate unique field.

---

## 5. Core Enums

These can be implemented as PostgreSQL enums or constrained strings, depending on ORM preference.

### User Status

- `active`
- `suspended`

### Admin Role

- `super_admin`
- `operator`
- `moderator`

### Admin Status

- `active`
- `disabled`

### Character Status

- `active`
- `frozen`
- `retired`

### Dispute Status

- `pending`
- `accepted`
- `declined`
- `expired`
- `cancelled`
- `match_created`

### Match Status

- `queued`
- `running`
- `completed`
- `cancelled`
- `error`
- `finalized_by_admin`

### Match End Reason

- `knockout`
- `round_limit_hp_pct`
- `round_limit_damage`
- `round_limit_hits`
- `sudden_death`
- `admin_finalized`
- `cancelled`
- `error`

### Session Flow Type

- `character_creation`
- `dispute_creation`

### Session Status

- `active`
- `completed`
- `cancelled`
- `expired`

### Rules Version Status

- `draft`
- `active`
- `retired`

---

## 6. Entity Overview

Recommended primary tables:

- `users`
- `admin_users`
- `admin_sessions`
- `characters`
- `rules_versions`
- `disputes`
- `matches`
- `match_participants`
- `match_events`
- `bot_sessions`
- `telegram_updates`
- `audit_logs`

Optional early additions:

- `admin_invites`
- `system_settings`

---

## 7. `users`

### Purpose

Stores player identity linked to Telegram.

### Columns

- `id` UUID PK
- `telegram_user_id` text not null unique
- `telegram_username` text null
- `telegram_first_name` text null
- `telegram_last_name` text null
- `display_name` text not null
- `status` user status not null default `active`
- `suspended_reason` text null
- `last_seen_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- unique on `telegram_user_id`

### Notes

- `display_name` is the app-preferred name shown in admin surfaces
- `telegram_username` must not be used as the primary identity key

### Recommended Indexes

- unique index on `telegram_user_id`
- index on `status`
- index on `last_seen_at`
- trigram or lower-text index on `display_name` if search volume justifies it later

---

## 8. `admin_users`

### Purpose

Stores browser-admin identities.

### Columns

- `id` UUID PK
- `email` text not null unique
- `display_name` text not null
- `role` admin role not null
- `status` admin status not null default `active`
- `password_hash` text null
- `last_login_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `password_hash` may be null if using passwordless magic links only
- if passwordless is used, related token tables may be introduced later

### Recommended Indexes

- unique index on `email`
- index on `role`
- index on `status`

---

## 9. `admin_sessions`

### Purpose

Stores server-side admin browser sessions.

### Columns

- `id` UUID PK
- `admin_user_id` UUID not null FK -> `admin_users.id`
- `session_token_hash` text not null unique
- `ip_address` inet null
- `user_agent` text null
- `expires_at` timestamptz not null
- `last_seen_at` timestamptz not null
- `created_at` timestamptz not null

### Constraints

- FK to `admin_users`
- unique on `session_token_hash`

### Recommended Indexes

- unique index on `session_token_hash`
- index on `admin_user_id`
- index on `expires_at`

---

## 10. `characters`

### Purpose

Stores the current live character state for each player.

### Columns

- `id` UUID PK
- `user_id` UUID not null FK -> `users.id`
- `name` text not null
- `class_key` text not null
- `level` integer not null
- `status` character status not null default `active`
- `rules_version_id` UUID not null FK -> `rules_versions.id`
- `ability_scores` jsonb not null
- `derived_stats` jsonb not null
- `loadout` jsonb not null
- `resource_state` jsonb not null
- `wins` integer not null default 0
- `losses` integer not null default 0
- `matches_played` integer not null default 0
- `frozen_reason` text null
- `last_match_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### One Active Character Rule

Recommended v1 invariant:

- each user may have at most one non-retired character

Implementation options:

- strict unique `user_id` if retired characters are not needed yet
- partial unique index on `user_id` where `status in ('active','frozen')`

Recommended v1 choice:

- partial unique index to preserve future flexibility

### Notes on JSON Fields

`ability_scores` example:

```json
{
  "str": 16,
  "dex": 12,
  "con": 14,
  "int": 8,
  "wis": 10,
  "cha": 10
}
```

`derived_stats` example:

```json
{
  "maxHp": 12,
  "armorClass": 16,
  "initiativeMod": 1,
  "proficiencyBonus": 2,
  "speed": 30,
  "saveMods": {
    "str": 5,
    "dex": 1,
    "con": 2,
    "int": -1,
    "wis": 0,
    "cha": 0
  }
}
```

### Recommended Indexes

- index on `user_id`
- partial unique index on `user_id` for active/frozen records
- index on `status`
- index on `class_key`
- index on `level`
- index on `last_match_at`

---

## 11. `rules_versions`

### Purpose

Stores versioned rules/configuration snapshots.

### Columns

- `id` UUID PK
- `version_key` text not null unique
- `status` rules version status not null
- `summary` text not null
- `config` jsonb not null
- `created_by_admin_user_id` UUID null FK -> `admin_users.id`
- `activated_at` timestamptz null
- `retired_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `config` stores the actual rules payload used by the engine
- exactly one version should typically be `active` at a time

### Recommended Constraints

- unique on `version_key`

### Recommended Indexes

- unique index on `version_key`
- index on `status`
- index on `activated_at`

### Optional Invariant

Enforcing "only one active rules version" may be done in application logic or with a partial unique index strategy plus status convention.

---

## 12. `disputes`

### Purpose

Stores challenge requests between players.

### Columns

- `id` UUID PK
- `challenger_user_id` UUID not null FK -> `users.id`
- `target_user_id` UUID not null FK -> `users.id`
- `challenger_character_id` UUID not null FK -> `characters.id`
- `target_character_id` UUID not null FK -> `characters.id`
- `origin_chat_id` text null
- `origin_message_id` text null
- `reason` text not null
- `status` dispute status not null default `pending`
- `expires_at` timestamptz null
- `accepted_at` timestamptz null
- `declined_at` timestamptz null
- `cancelled_at` timestamptz null
- `expired_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- challenger and target must be different users
- both character references should belong to the referenced users at creation time

The second constraint is best enforced in application logic plus transaction validation.

### Recommended Indexes

- index on `challenger_user_id`
- index on `target_user_id`
- index on `status`
- index on `expires_at`
- composite index on `(status, created_at desc)`

### Anti-Abuse Constraint

Consider preventing duplicate pending disputes between the same pair:

- partial unique index on `(challenger_user_id, target_user_id)` where `status = 'pending'`

Whether this should be directional or normalized as an unordered pair depends on product policy.

Recommended v1:

- directional uniqueness only

---

## 13. `matches`

### Purpose

Stores the lifecycle and summary state of a resolved or in-progress combat match.

### Columns

- `id` UUID PK
- `dispute_id` UUID not null unique FK -> `disputes.id`
- `rules_version_id` UUID not null FK -> `rules_versions.id`
- `rules_snapshot` jsonb not null
- `status` match status not null
- `winner_character_id` UUID null FK -> `characters.id`
- `end_reason` match end reason null
- `rounds_completed` integer not null default 0
- `started_at` timestamptz null
- `completed_at` timestamptz null
- `errored_at` timestamptz null
- `error_code` text null
- `error_summary` text null
- `admin_finalization_reason` text null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Notes

- `rules_snapshot` stores the immutable exact config used for this match
- `dispute_id` should be unique because a dispute produces at most one match

### Recommended Indexes

- unique index on `dispute_id`
- index on `status`
- index on `winner_character_id`
- index on `rules_version_id`
- composite index on `(status, created_at desc)`

---

## 14. `match_participants`

### Purpose

Stores immutable participant snapshots used during a match.

### Columns

- `id` UUID PK
- `match_id` UUID not null FK -> `matches.id`
- `character_id` UUID not null FK -> `characters.id`
- `user_id` UUID not null FK -> `users.id`
- `slot` smallint not null
- `is_winner` boolean not null default false
- `snapshot` jsonb not null
- `created_at` timestamptz not null

### Constraints

- two rows per v1 match
- unique `(match_id, slot)`
- unique `(match_id, character_id)` recommended

### Snapshot Content

The snapshot should include:

- name
- class
- level
- ability scores
- derived stats
- loadout
- resource state
- action list
- match-start HP

### Recommended Indexes

- index on `match_id`
- index on `character_id`
- index on `user_id`

---

## 15. `match_events`

### Purpose

Stores the ordered structured event log for each match.

### Columns

- `id` UUID PK
- `match_id` UUID not null FK -> `matches.id`
- `round_number` integer not null
- `sequence_number` integer not null
- `event_type` text not null
- `actor_participant_id` UUID null FK -> `match_participants.id`
- `target_participant_id` UUID null FK -> `match_participants.id`
- `public_text` text null
- `payload` jsonb not null
- `created_at` timestamptz not null

### Constraints

- unique `(match_id, sequence_number)`

### Notes

- `payload` carries machine-readable roll and outcome details
- `public_text` is optional pre-rendered narration for Telegram/admin readability

### Recommended Indexes

- index on `match_id`
- unique index on `(match_id, sequence_number)`
- composite index on `(match_id, round_number, sequence_number)`
- index on `event_type`

---

## 16. `bot_sessions`

### Purpose

Stores temporary user-facing Telegram flow state.

### Columns

- `id` UUID PK
- `user_id` UUID not null FK -> `users.id`
- `flow_type` session flow type not null
- `status` session status not null default `active`
- `step_key` text not null
- `data` jsonb not null default `'{}'::jsonb`
- `expires_at` timestamptz not null
- `completed_at` timestamptz null
- `cancelled_at` timestamptz null
- `last_interaction_at` timestamptz not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- at most one active session per user

Recommended implementation:

- partial unique index on `user_id` where `status = 'active'`

### Recommended Indexes

- partial unique index on `user_id` where `status = 'active'`
- index on `expires_at`
- index on `flow_type`

---

## 17. `telegram_updates`

### Purpose

Stores processed Telegram update metadata for idempotency and debugging.

### Columns

- `id` UUID PK
- `telegram_update_id` bigint not null unique
- `telegram_chat_id` text null
- `telegram_user_id` text null
- `update_type` text not null
- `received_at` timestamptz not null
- `processed_at` timestamptz null
- `status` text not null
- `error_summary` text null
- `raw_payload` jsonb null

### Notes

- `raw_payload` can be retained temporarily or permanently depending on privacy policy
- if retention is a concern, keep only diagnostic subsets

### Recommended Indexes

- unique index on `telegram_update_id`
- index on `received_at`
- index on `status`
- index on `telegram_user_id`

---

## 18. `audit_logs`

### Purpose

Stores sensitive system and admin action history.

### Columns

- `id` UUID PK
- `actor_type` text not null
- `actor_user_id` UUID null FK -> `users.id`
- `actor_admin_user_id` UUID null FK -> `admin_users.id`
- `action` text not null
- `target_type` text not null
- `target_id` UUID null
- `reason` text null
- `metadata` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null

### Actor Type Examples

- `system`
- `user`
- `admin`

### Target Type Examples

- `user`
- `character`
- `dispute`
- `match`
- `rules_version`
- `admin_user`
- `bot_session`

### Notes

- use `metadata` for before/after summaries and auxiliary context
- keep `action` normalized and searchable

### Recommended Indexes

- index on `created_at`
- index on `action`
- index on `target_type`
- index on `target_id`
- index on `actor_admin_user_id`
- index on `actor_user_id`

---

## 19. Optional: `admin_invites`

### Purpose

Supports secure creation of new admin accounts if invitation flow is needed.

### Columns

- `id` UUID PK
- `email` text not null
- `role` admin role not null
- `token_hash` text not null unique
- `expires_at` timestamptz not null
- `accepted_at` timestamptz null
- `created_by_admin_user_id` UUID not null FK -> `admin_users.id`
- `created_at` timestamptz not null

### Recommended Indexes

- unique index on `token_hash`
- index on `email`
- index on `expires_at`

---

## 20. Optional: `system_settings`

### Purpose

Stores small global operational toggles not appropriate for code constants.

### Examples

- disable new disputes
- maintenance mode
- current public status message

### Columns

- `key` text PK
- `value` jsonb not null
- `updated_by_admin_user_id` UUID null FK -> `admin_users.id`
- `updated_at` timestamptz not null

### Notes

- keep this table narrow
- do not turn it into a dumping ground for arbitrary configuration that belongs in `rules_versions`

---

## 21. Relationship Summary

### Primary Relationships

- one `user` -> zero or one active `character`
- one `user` -> many `disputes` as challenger
- one `user` -> many `disputes` as target
- one `dispute` -> zero or one `match`
- one `match` -> two `match_participants` in v1
- one `match` -> many `match_events`
- one `rules_version` -> many `characters`
- one `rules_version` -> many `matches`
- one `admin_user` -> many `audit_logs`
- one `user` -> many `audit_logs` when acting directly

---

## 22. Lifecycle Notes

### Character Lifecycle

`active` -> `frozen` -> `active`

or

`active` -> `retired`

Recommended v1:

- use `active` and `frozen`
- reserve `retired` for future expansion

### Dispute Lifecycle

`pending` -> `accepted` -> `match_created`

or

`pending` -> `declined`

or

`pending` -> `expired`

or

`pending` -> `cancelled`

### Match Lifecycle

`queued` -> `running` -> `completed`

or

`queued/running` -> `error`

or

`queued/running` -> `cancelled`

or

`error` -> `finalized_by_admin`

---

## 23. Snapshot Strategy

This is the most important historical integrity rule in the schema.

### At Match Creation, Persist

- `matches.rules_snapshot`
- two `match_participants.snapshot` payloads

### Do Not Depend on Live Rows For Historical Replay

Do not reconstruct old results from:

- current `characters`
- current `rules_versions.config`

Those rows may change later. Historical correctness comes from per-match snapshots.

---

## 24. Transaction Boundaries

The application should use transactions for at least these operations:

### Character Creation

- create or update user
- create character
- complete session
- create audit log if needed

### Dispute Acceptance

- verify dispute still pending
- verify both users and characters eligible
- create match
- create participant snapshots
- update dispute status
- create audit record/system event as needed

### Match Completion

- insert final events
- update match status and winner
- update character record summaries
- update timestamps

### Admin Intervention

- update target entity
- create audit log

This keeps lifecycle state consistent.

---

## 25. Indexing Strategy Summary

Prioritize indexes for:

- status-driven admin dashboards
- user lookup
- match/dispute lookup
- audit filtering
- idempotency

### Minimum Useful Index Set

- all primary keys
- all foreign keys
- unique Telegram/admin identity keys
- `disputes.status`
- `matches.status`
- `audit_logs.created_at`
- `bot_sessions.user_id` partial active uniqueness
- `telegram_updates.telegram_update_id`

Add more specialized indexes after observing real query patterns.

---

## 26. Retention and Cleanup

### Keep Long-Term

- users
- characters
- disputes
- matches
- match snapshots
- match events
- audit logs

### Expire or Prune Carefully

- completed/cancelled `bot_sessions`
- old `admin_sessions`
- raw Telegram update payloads if privacy or storage requires it

### Recommended Cleanup Jobs

- expire stale sessions
- prune old admin sessions
- mark expired disputes

These can start as application jobs and evolve later.

---

## 27. Suggested JSON Payload Shapes

### `rules_versions.config`

Should include:

- version metadata
- class kits
- HP tables
- action definitions
- spell definitions
- tie-break policy
- round limit

### `characters.loadout`

Should include:

- weapons
- spells
- action priorities if engine-controlled

### `characters.resource_state`

Should include:

- spell slots
- per-match ability counts

### `match_participants.snapshot`

Should include:

- all fields required to run the engine without consulting live character tables

### `match_events.payload`

Examples:

- roll details
- attack resolution details
- damage breakdown
- save DC and result
- HP changes

### `audit_logs.metadata`

Should include:

- before/after values where relevant
- source page or workflow
- auxiliary actor context

---

## 28. Suggested ORM Mapping Notes

If using Prisma or Drizzle:

- map enums where practical
- use JSON types for structured payloads
- keep status transitions in domain logic, not ORM hooks
- keep migrations human-reviewed

Recommended:

- use explicit relation names for dual foreign keys to `users` in `disputes`
- define composite/partial indexes in migrations if ORM support is limited

---

## 29. Recommended MVP Cut

If you want the leanest useful first schema, start with:

- `users`
- `admin_users`
- `admin_sessions`
- `characters`
- `rules_versions`
- `disputes`
- `matches`
- `match_participants`
- `match_events`
- `bot_sessions`
- `telegram_updates`
- `audit_logs`

Add `admin_invites` and `system_settings` only if needed immediately.

---

## 30. Bottom Line

The schema should optimize for one thing above all else: trustworthy history.

That means:

- stable Telegram-linked identities
- clear lifecycle states
- immutable match snapshots
- structured event logs
- explicit audit trails

If those foundations are correct, the rest of the application can grow without compromising fairness, explainability, or operational safety.

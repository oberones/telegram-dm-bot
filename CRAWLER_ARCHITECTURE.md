# Crawler Architecture

## 1. Purpose

This document defines the target technical architecture for the cooperative dungeon crawler mode.

It builds on:

- [DUNGEON_CRAWLER_EXPANSION.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DUNGEON_CRAWLER_EXPANSION.md)
- [CRAWLER_RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_RULES_SPEC.md)
- [CRAWLER_SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_SCHEMA.md)
- [CRAWLER_BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_BOT_FLOWS.md)
- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)

The crawler mode is not a small extension of duel arbitration.
It is a second game domain that must share identity, Telegram transport, admin tooling, and deployment infrastructure while introducing:

- party coordination
- persistent run state
- seeded procedural generation
- PvE encounter execution
- permanent inventory and equipment
- recovery for long-lived sessions

---

## 2. Architectural Goals

The crawler architecture should:

1. reuse the existing monolith and deployment model where practical
2. keep game simulation independent from Telegram presentation
3. persist enough run and generation state to resume safely after interruption
4. separate procedural generation from encounter execution cleanly
5. preserve auditability for loot, progression, and admin intervention
6. support both duel mode and crawler mode without letting one corrupt the other

---

## 3. Recommended High-Level Shape

Crawler mode should remain inside the existing modular monolith.

Recommended runtime parts:

1. **Telegram Interface**
   - receives commands and callback actions
   - routes crawler actions to application workflows
   - sends party, room, encounter, and reward messages

2. **Crawler Application Layer**
   - owns party lifecycle
   - owns run lifecycle
   - validates choices and state transitions
   - coordinates generation, encounters, rewards, and recovery

3. **Procedural Generation Module**
   - generates seeded dungeon structure
   - selects room content, encounters, and reward options
   - stores generation outputs for replay and debugging

4. **Encounter Engine**
   - resolves PvE combat from immutable encounter snapshots plus live run resources
   - produces structured combat events
   - remains transport-agnostic

5. **Persistence Layer**
   - stores parties, runs, rooms, encounters, loot, inventory, and audit logs
   - supports resumable live state and immutable history

6. **Admin Panel**
   - inspects parties, runs, encounters, rewards, and stuck states
   - exposes conservative recovery actions

7. **Optional Worker**
   - handles delayed or heavier crawler work later
   - not required for initial crawler MVP

---

## 4. Coexistence With Duel Mode

Crawler mode should not replace the existing dispute system.

Recommended platform structure:

- shared identity, auth, Telegram transport, config, logging, and admin shell
- separate domain modules for:
  - duel arbitration
  - crawler parties and runs
- separate simulation packages for:
  - duel combat
  - crawler encounters
- shared persistence infrastructure, but distinct table families and repositories

This keeps the current bot useful while allowing crawler mode to grow without contorting duel-specific abstractions.

---

## 5. Recommended Codebase Layout

Recommended additions to the current structure:

```text
apps/
  server/
  admin/
packages/
  crawler-domain/
  crawler-engine/
  crawler-generation/
  db/
  domain/
  engine/
  shared/
```

### `packages/crawler-domain`

Responsibilities:

- party workflows
- readiness and membership rules
- run lifecycle
- room choice validation
- loot grant orchestration
- crawler-specific audit events

### `packages/crawler-generation`

Responsibilities:

- seeded generation entry points
- room graph generation
- encounter selection
- loot selection
- generation versioning

This package should be deterministic and mostly pure.

### `packages/crawler-engine`

Responsibilities:

- PvE encounter resolution
- monster behavior selection
- turn order
- player and monster action execution
- encounter event generation

This package should not know about Telegram, HTTP, or SQL.

---

## 6. Core Domain Boundaries

### Boundary 1: Party Management

Owns:

- party creation
- party joining and leaving
- ready states
- run start authorization

Should not own:

- room generation internals
- combat math

### Boundary 2: Run Orchestration

Owns:

- starting runs
- advancing rooms
- resolving non-combat room actions
- transitioning into and out of encounters
- applying run completion or failure

Should be the main state machine for crawler mode.

### Boundary 3: Procedural Generation

Owns:

- seed handling
- floor and room generation
- encounter composition selection
- loot option selection

Should not own:

- Telegram prompts
- mutable party state transitions

### Boundary 4: Encounter Resolution

Owns:

- initiative
- turn loop
- monster AI
- damage, healing, and effect application
- victory and defeat conditions

Should consume snapshots and current run resources, then emit events and results.

### Boundary 5: Persistent Rewards

Owns:

- reward grant records
- inventory ownership
- equipment state changes
- currency/XP updates if used

This boundary must be ledger-friendly and replay-safe.

---

## 7. Runtime State Model

Crawler mode needs two different kinds of state.

### Live Mutable State

Examples:

- party readiness
- active run status
- current room
- current encounter
- current HP and spell slots during a run
- pending player choice

This state lives in the database and is the source of truth for resume and recovery.

### Immutable Historical State

Examples:

- generated room graph for the run
- encounter participant snapshots
- encounter event logs
- reward grants
- admin recovery actions

This state must remain stable after completion for audit and debugging.

---

## 8. Recommended Run Execution Model

Crawler mode should use a state-machine-driven orchestration model.

Top-level run states:

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

Recommended rule:

- every Telegram action first loads the authoritative run state
- the application layer validates that the requested action is legal from the current state
- state transitions occur inside transactions where possible

This is especially important because crawler mode will have many more interruption points than duel mode.

---

## 9. Procedural Generation Architecture

Generation should be deterministic from:

- seed
- generation version
- difficulty tier
- party size
- floor number
- curated content tables

### Recommended Generation Stages

1. create run seed and generation version
2. generate floor count and floor metadata
3. generate room graph per floor
4. assign room types
5. assign encounter or reward templates
6. persist generated outputs before play begins

### Important Rule

Do not rely on regenerating the dungeon from the seed alone during operations.

Persist:

- generation inputs
- generated room nodes and edges
- selected encounters
- selected loot/reward options

This will make recovery much simpler and reduce accidental drift if content tables evolve later.

---

## 10. Encounter Architecture

The crawler encounter system should be a sibling to the duel engine, not a forced extension of it.

### Why

Duel mode assumes:

- two participants
- short lifecycle
- immediate full resolution

Crawler encounters require:

- teams
- one-to-many and many-to-many fights
- monster AI
- run-resource tracking
- possibly partial resolution across Telegram turns

### Recommended Encounter Modes

Support two implementation stages:

1. **Auto-resolve encounter mode**
   - entire encounter resolves in one action
   - good for first playable crawler slices

2. **Interactive turn mode**
   - players choose actions per turn
   - monsters act automatically
   - encounter can span multiple Telegram messages

The architecture should support stage 1 first without preventing stage 2 later.

### Engine Contracts

Inputs:

- encounter snapshot
- player loadouts
- monster templates/snapshots
- current run resources
- deterministic RNG seed/stream

Outputs:

- ordered encounter events
- updated participant state
- outcome summary
- reward eligibility metadata

---

## 11. Telegram Orchestration Model

Telegram remains the primary client, but crawler mode creates longer-lived conversational state.

### Recommended Principles

- Telegram callbacks should identify the run and intended action explicitly
- the server should never trust callback payloads without reloading current state
- the server should render compact summaries in group chat and push personal detail to DM where helpful

### Message Ownership

Recommended split:

- group chat:
  - party lobby
  - room prompt
  - encounter summary
  - loot summary
  - run result
- DM:
  - inventory details
  - equipment changes
  - personal reminders
  - resume prompts

### Resume Strategy

`/run` should be treated as a state rehydration endpoint, not a command that rebuilds state from memory.

It should:

1. load active run membership
2. detect current run state
3. render the next legal prompt for that user

---

## 12. Transaction and Concurrency Strategy

Crawler mode will be far more concurrency-sensitive than duel mode.

### Main Risks

- two users tapping the same room choice
- repeated Telegram callback deliveries
- party membership changing during run start
- duplicate reward grants
- encounter result being applied twice

### Recommended Protections

- reuse/update webhook idempotency tracking
- use row-level locking or equivalent transaction boundaries on:
  - parties
  - active runs
  - active encounters
  - reward grants
- treat reward grant application as idempotent
- use explicit statuses instead of inferring “probably done”

### Design Rule

Every action that changes crawler state should be safe to retry or reject cleanly.

---

## 13. Inventory and Loot Architecture

Permanent loot means the crawler has an economic system.

Recommended layers:

1. **Loot Templates**
   - design-time item definitions

2. **Run Reward Selection**
   - generated choices or grants for a specific run/room/encounter

3. **Reward Ledger**
   - records whether each reward was granted, revoked, or pending

4. **Inventory Ownership**
   - persistent owned items per character or user

5. **Equipment Loadout**
   - active equipped items that affect crawler stats

The critical safety rule is:

- do not mutate persistent inventory without a corresponding reward or ownership record

---

## 14. Admin and Recovery Architecture

Crawler mode will create more stuck states than duel mode.

The admin architecture must support:

- party inspection
- run inspection
- room and encounter detail
- reward grant inspection
- recovery hints
- conservative manual actions

Recommended initial recovery actions:

- cancel forming party
- cancel or abandon run
- cancel stuck encounter
- re-render current prompt
- finalize reward grant if generation and combat already completed cleanly

Avoid broad “edit arbitrary state” tools.

Prefer narrow actions with:

- explicit preconditions
- audit logging
- participant notification

---

## 15. Observability

Crawler mode should add structured logging around:

- party lifecycle
- run generation
- room transitions
- encounter start/end
- reward grants
- recovery actions

Recommended metrics later:

- runs started/completed/failed
- average run length
- encounter failure rates
- loot grant counts
- stuck run count
- average resume count per run

The admin panel should eventually surface the most operationally useful subset of this data.

---

## 16. Deployment and Scaling Direction

Crawler mode can still launch on the current single-server Docker model.

Recommended initial deployment:

- one backend app
- one admin app
- one PostgreSQL instance
- Telegram webhook delivery
- optional polling only for local development

### When to Add a Worker

Introduce a separate worker only when one or more of these become true:

- encounter resolution becomes long-running
- generation becomes expensive
- reward granting needs deferred retries
- recovery tasks become asynchronous

Until then, keep the architecture simple.

---

## 17. Security and Trust Boundaries

Important trust rules:

- Telegram callback payloads are hints, not authority
- current state must always be loaded from the database
- inventory grants must come from server-side reward resolution only
- admin actions must remain role-gated and audited
- generation version and rules version must be stored with runs for later review

Permanent loot and co-op coordination make trust boundaries more important than in duel mode.

---

## 18. Recommended Build Sequence

The architecture is best implemented in this order:

1. add crawler-specific schema and repositories
2. add party formation and lobby workflows
3. add run generation and room persistence
4. add simple auto-resolve PvE encounters
5. add reward grant and inventory persistence
6. add resume and recovery tooling
7. upgrade encounters to interactive turn-based mode if needed

This preserves a playable path without forcing the hardest Telegram interaction problems first.

---

## 19. Key Architectural Decisions

For crawler v1, the recommended decisions are:

1. keep crawler mode inside the existing modular monolith
2. add dedicated crawler domain, generation, and engine packages
3. store generated dungeon outputs explicitly
4. drive all crawler actions through a database-backed run state machine
5. keep Telegram as the primary client with group/DM split responsibilities
6. treat loot and rewards as ledgered persistent data
7. keep admin recovery narrow, explicit, and audited

---

## 20. Next Document

The best next companion document is:

- [CRAWLER_ROADMAP.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ROADMAP.md)

At this point the crawler mode has:

- product expansion scope
- rules contract
- schema design
- Telegram UX flows
- technical architecture

The next practical step is to phase the implementation into a staged build plan from prototype to playable crawler MVP.

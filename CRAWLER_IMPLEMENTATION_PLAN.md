# Crawler Implementation Plan

## 1. Purpose

This document translates the crawler planning set into an actionable implementation checklist.

It builds on:

- [CRAWLER_ROADMAP.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ROADMAP.md)
- [CRAWLER_ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ARCHITECTURE.md)
- [CRAWLER_SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_SCHEMA.md)
- [CRAWLER_CONTENT_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_CONTENT_SPEC.md)
- [CRAWLER_BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_BOT_FLOWS.md)

This is the bridge between planning and code.

It answers:

- what to build first
- which files and packages should be added
- what fixtures and tables are needed
- what the first vertical slices should include
- what can safely wait until later

---

## 2. Implementation Strategy

The crawler should be implemented in narrow vertical slices.

Recommended rule:

- every major slice should end in something testable through Telegram, the DB, or the admin panel

Recommended order:

1. lay structural foundations
2. get party formation working
3. get a stub run working
4. swap the stub into real generation
5. add encounters
6. add rewards and inventory
7. harden recovery and admin operations

Do not start with:

- a huge monster roster
- a huge item catalog
- advanced tactical combat
- a large admin feature surface

---

## 3. Phase C1 Execution Breakdown

### Goal

Stand up the crawler schema, packages, repositories, and seed content contracts.

### 3.1 Database Migration Work

Create a crawler migration that adds:

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

Recommended implementation order inside the migration:

1. enums and constrained text fields
2. independent core tables
3. dependent tables
4. indexes
5. partial unique constraints

### 3.2 Repository Work

Add crawler repository groups in [packages/db/src/repositories.ts](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/packages/db/src/repositories.ts) or adjacent crawler-specific repository files for:

- party CRUD and membership transitions
- run creation and run state loading
- room creation and room traversal updates
- encounter persistence
- reward and inventory ledger writes
- content template loading

### 3.3 Package Scaffolding

Add new packages:

- `packages/crawler-domain`
- `packages/crawler-generation`
- `packages/crawler-engine`

Each package should begin with:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- at least one narrow test file

### 3.4 Seed Content Format

Create initial machine-readable seed content files.

Recommended location:

```text
packages/crawler-generation/src/content/
  themes/
  monsters/
  loot/
  events/
```

Recommended first content files:

- `themes/goblin-warrens.ts`
- `themes/forsaken-crypt.ts`
- `monsters/basic.ts`
- `loot/starter.ts`
- `weights/default-room-weights.ts`

### 3.5 First Tests

Add tests for:

- party uniqueness constraints
- run creation repository helpers
- content loading/parsing
- deterministic generation helper stubs

### Exit Check

Phase C1 is complete when:

- migrations run cleanly
- new packages compile
- repositories can create/load crawler entities
- content fixtures are loadable

---

## 4. Phase C2 Execution Breakdown

### Goal

Get players into a crawler party and start a run, even before real procedural content exists.

### 4.1 Domain Work

Implement in `packages/crawler-domain`:

- create party
- join party
- leave party
- ready/unready
- validate leader start
- create minimal run record

### 4.2 Telegram Work

Extend [apps/server/src/modules/telegram/handle-update.ts](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/apps/server/src/modules/telegram/handle-update.ts) to support:

- `/party`
- party lobby refresh
- `Create Party`
- `Join Party`
- `Ready Up`
- `Leave`
- `Start Run`

Recommended callback payload convention:

- include mode, entity id, and intended action explicitly
- keep payloads versionable

### 4.3 Session Work

Reuse or extend existing bot session handling for:

- active party context
- current party message references if needed

### 4.4 Admin Read APIs

Add read-only routes for:

- active parties
- party members
- active runs

### 4.5 Tests

Add tests for:

- creating a party
- joining a party
- duplicate join prevention
- ready/start gating
- one active party/run per user rules

### Exit Check

Phase C2 is complete when:

- users can create and join a crawler party in Telegram
- the leader can start a run
- the run is visible in the admin/read API

---

## 5. Phase C3 Execution Breakdown

### Goal

Replace the stub run with real deterministic room generation.

### 5.1 Generation Package Work

In `packages/crawler-generation`, implement:

- seed creation utilities
- floor count generation
- room graph generation
- room type assignment
- room weight application
- theme selection

### 5.2 Persistence Work

Store:

- selected theme
- generation version
- floor records
- room records
- room connectivity/ordering representation
- room metadata and prompt payloads

### 5.3 Domain Orchestration

In `packages/crawler-domain`, implement:

- create run from generated structure
- activate first room
- advance room after resolution
- enforce one legal room state transition at a time

### 5.4 Telegram Flow Work

Render:

- room intro card
- valid actions
- follow-up room outcome message

### 5.5 Tests

Add tests for:

- same seed -> same room structure
- invalid room transitions rejected
- room constraints enforced
- first room not elite

### Exit Check

Phase C3 is complete when:

- a started run creates a deterministic room structure
- players can move through rooms
- room state is resumable from DB

---

## 6. Phase C4 Execution Breakdown

### Goal

Add the first playable monster encounter loop.

### 6.1 Engine Work

In `packages/crawler-engine`, implement:

- participant model for players and monsters
- initiative
- turn loop
- bounded action menu
- monster AI priorities
- victory/defeat resolution

Recommended first action set:

- weapon attack
- class signature action
- one simple spell action where applicable
- use consumable

### 6.2 Content Fixture Work

Implement the first actual monster templates from [CRAWLER_CONTENT_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_CONTENT_SPEC.md):

- `Goblin Sneak`
- `Warg`
- `Goblin Boss`
- `Skeleton Guard`
- `Restless Dead`
- `Bone Warden`
- `Giant Rat`

### 6.3 Encounter Domain Work

In `packages/crawler-domain`, implement:

- create encounter from room assignment
- snapshot participants
- route player actions
- apply encounter results back to the run

### 6.4 Telegram Work

Render:

- encounter start message
- active turn prompt
- compact public outcome
- optional DM detail if needed

### 6.5 Tests

Add tests for:

- simple 1v1 encounter
- two-player encounter
- boss encounter setup
- player defeat and removal from run
- encounter completion writes

### Exit Check

Phase C4 is complete when:

- players can fight monsters in Telegram
- encounter events persist
- outcome is reflected in run state

---

## 7. Phase C5 Execution Breakdown

### Goal

Make successful runs produce permanent progression.

### 7.1 Reward System Work

Implement:

- run reward selection
- room reward selection
- reward ledger records
- idempotent grant application

### 7.2 Inventory Work

Implement:

- inventory ownership rows
- equipment slot assignment
- consumable ownership and use

### 7.3 Character Integration

Add crawler-aware derived stats based on:

- equipment
- accessory bonuses
- allowed consumable effects

Recommended v1 rule:

- keep crawler progression separate from duel balance unless explicitly bridged later

### 7.4 Telegram UX

Implement:

- `/inventory`
- `/equipment`
- reward reveal messages
- equip/unequip buttons

### 7.5 Tests

Add tests for:

- reward grant idempotency
- equipment slot validation
- consumable use and ownership updates
- inventory visibility

### Exit Check

Phase C5 is complete when:

- players can receive loot
- inventory persists across runs
- equipment changes affect crawler calculations

---

## 8. Phase C6 Execution Breakdown

### Goal

Make crawler mode supportable under interruption and error.

### 8.1 Resume Work

Implement:

- `/run`
- re-render current room or encounter prompt
- per-user resume guidance

### 8.2 Recovery Work

Implement states and handling for:

- abandoned player
- interrupted encounter
- pending reward grant
- failed room transition
- failed generation

### 8.3 Admin Work

Add admin pages and APIs for:

- parties
- runs
- encounter detail
- reward ledger detail
- recovery hints

Recommended first actions:

- cancel forming party
- abandon run
- cancel stuck encounter
- re-render current prompt
- finalize or revoke pending reward

### 8.4 Tests

Add tests for:

- resume from active room
- resume from active encounter
- admin recovery actions
- stuck reward recovery

### Exit Check

Phase C6 is complete when:

- interrupted crawler play can be resumed
- admins can recover common stuck states without DB edits

---

## 9. Recommended File and Module Additions

Recommended early additions:

```text
apps/server/src/modules/crawler/
  routes.ts
  routes.test.ts

packages/crawler-domain/src/
  index.ts
  parties.ts
  runs.ts
  encounters.ts
  rewards.ts

packages/crawler-generation/src/
  index.ts
  seed.ts
  floors.ts
  rooms.ts
  encounters.ts
  rewards.ts
  content/

packages/crawler-engine/src/
  index.ts
  combat.ts
  ai.ts
  types.ts
  index.test.ts
```

Recommended DB additions:

```text
packages/db/migrations/
  0002_crawler_foundation.sql
```

The exact migration number may vary depending on the repo state.

---

## 10. First Vertical Slices

Recommended implementation slices:

### Slice 1: Party Foundations

Includes:

- crawler tables
- crawler packages
- `/party`
- create/join/ready/leave
- admin read views

### Slice 2: Stub Run

Includes:

- `Start Run`
- run record creation
- one fixed room path
- room prompt rendering

### Slice 3: Real Generation

Includes:

- seeded room generation
- theme assignment
- room weights

### Slice 4: First Encounter

Includes:

- first monster templates
- first encounter engine path
- encounter logs

### Slice 5: First Loot

Includes:

- gold
- one consumable
- one or two permanent items
- inventory display

Each slice should be small enough to test locally end to end.

---

## 11. What To Delay Intentionally

Delay these until the first crawler loop is proven:

- advanced encounter AI
- merchants
- crafting
- multi-theme runs
- PvP crossover between crawler and duel mode
- complex status condition matrix
- broad admin mutation tools
- deep narrative event trees

These are good future features, but bad first-implementation dependencies.

---

## 12. Test Strategy

Crawler mode should ship with three layers of tests:

### Unit Tests

For:

- generation determinism
- encounter resolution
- reward calculations
- loot selection

### Repository Tests

For:

- run state transitions
- reward grants
- inventory updates
- party uniqueness constraints

### Transport/Integration Tests

For:

- `/party`
- run start
- room advance
- encounter action callbacks
- `/inventory`
- `/run`

Recommended rule:

- every new vertical slice adds at least one integration test at the Telegram route/handler level

---

## 13. Operational Readiness Gates

Before calling crawler MVP playable, confirm:

1. local Docker e2e path works for crawler flows
2. restore works with crawler tables included
3. admin can inspect active runs and stuck states
4. reward grants are idempotent
5. one interrupted run can be resumed successfully

---

## 14. Immediate Next Step

The strongest next implementation move is:

1. add the crawler migration baseline
2. scaffold `packages/crawler-domain`, `packages/crawler-generation`, and `packages/crawler-engine`
3. seed the first monster and loot fixtures
4. implement the `/party` vertical slice

That is the shortest path from planning to the first real crawler code.

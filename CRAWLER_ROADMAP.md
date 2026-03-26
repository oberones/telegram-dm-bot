# Crawler Roadmap

## 1. Purpose

This roadmap describes the phased implementation plan for adding the cooperative dungeon crawler mode to the existing Telegram bot platform.

It assumes the current product already has:

- Telegram identity and character creation
- duel arbitration and combat infrastructure
- admin authentication and moderation
- audit logging and recovery tooling
- Docker-based local and production deployment

The crawler roadmap starts from that existing platform and phases in the new game mode incrementally.

---

## 2. Release Philosophy

The crawler should be built as a staged product expansion, not as one massive rewrite.

Recommended approach:

1. get a narrow PvE loop working
2. make it resumable and operable
3. add procedural depth and progression
4. harden it for Beta and later GA

The crawler MVP should optimize for:

- playable
- understandable
- recoverable
- auditable

It does not need to begin as a fully featured roguelike.

### Current Progress Snapshot

Crawler mode has moved well past planning and into a playable prototype.

Completed so far:

- crawler planning set is complete
- crawler schema baseline and package foundations are in place
- `/party` create/join/ready/leave/start-run works in Telegram groups
- seeded procedural runs generate and persist floors and rooms
- PvE encounters resolve and persist encounter logs
- non-combat room flow exists for treasure, event, and rest rooms
- persistent rewards, inventory, equipment, consumables, cumulative gold, and encounter XP are implemented
- admin visibility exists for parties, runs, rewards, inventory, and loadouts
- `/run` resume and inspect flow exists with conservative recovery behavior
- admin can now fail stuck crawler runs conservatively from the recovery surface
- admin can now inspect encounter/reward recovery state and mark stuck encounters errored

Still not complete:

- crawler-specific audit coverage and operational runbooks
- deeper reward reconciliation and rollback-safe recovery actions
- crawler Alpha/Beta hardening and release work

---

## 3. Phase Summary

Recommended crawler build path:

1. Phase C0: Scope Lock and Platform Alignment
2. Phase C1: Schema and Package Foundations
3. Phase C2: Party Formation and Run Skeleton
4. Phase C3: Procedural Dungeon Generation v1
5. Phase C4: PvE Encounter Engine v1
6. Phase C5: Room Flow, Rewards, and Inventory
7. Phase C6: Resume, Recovery, and Admin Operations
8. Phase C7: Alpha Crawler Release
9. Phase C8: Beta Hardening
10. Phase C9: Crawler GA Readiness

Each phase below includes:

- objective
- workstreams
- deliverables
- dependencies
- risks
- exit criteria

---

## 4. Phase C0: Scope Lock and Platform Alignment

Status: [x] Complete

### Objective

Freeze the initial crawler mode contract tightly enough that implementation can proceed without constant redesign.

### Workstreams

#### A. Rules Lock

Confirm the initial crawler gameplay contract in:

- [CRAWLER_RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_RULES_SPEC.md)

Key decisions to keep fixed:

- party size `1-4`
- fully procedural dungeon generation
- run-based death only
- permanent loot
- 5e foundation with bounded simplifications

#### B. UX Lock

Confirm the Telegram contract in:

- [CRAWLER_BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_BOT_FLOWS.md)

#### C. Technical Alignment

Confirm the technical boundaries in:

- [CRAWLER_ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ARCHITECTURE.md)

### Deliverables

- scope-frozen crawler planning set
- agreed MVP definition for first playable crawler slice

### Dependencies

- existing crawler planning documents

### Risks

- too much scope gets pulled into the first implementation
- crawler and duel abstractions get mixed prematurely

### Exit Criteria

- crawler rules are frozen for MVP
- package/runtime boundaries are agreed
- first implementation slice is clearly defined

---

## 5. Phase C1: Schema and Package Foundations

Status: [x] Complete

### Objective

Create the structural foundations for crawler mode without yet trying to ship a full playable run.

### Workstreams

#### A. Database Expansion

Implement the first crawler tables from:

- [CRAWLER_SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_SCHEMA.md)

Recommended first wave:

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

#### B. Package Structure

Add:

- `packages/crawler-domain`
- `packages/crawler-generation`
- `packages/crawler-engine`

#### C. Repository Layer

Add typed crawler repositories and transaction helpers.

#### D. Seed Content Contracts

Create initial content formats for:

- monster templates
- loot templates
- room generation weights

### Deliverables

- crawler migration baseline
- crawler packages scaffolded
- typed repository layer for parties, runs, encounters, and inventory

### Dependencies

- Phase C0

### Risks

- schema over-design before first play test
- unclear boundaries between current and crawler packages

### Exit Criteria

- crawler tables exist
- packages compile
- repositories can create and load crawler entities

---

## 6. Phase C2: Party Formation and Run Skeleton

Status: [x] Complete

### Objective

Ship the first social and stateful crawler loop without real dungeon depth yet.

### Workstreams

#### A. Party Workflows

Implement:

- `/party`
- create party
- join party
- ready up
- leave party
- start run

#### B. Run Bootstrap

Implement minimal run creation:

- create run record
- attach party
- assign seed
- generate a trivial room sequence or fixed stub structure

#### C. Telegram Presentation

Add:

- party lobby cards
- readiness updates
- run start announcements

#### D. Admin Visibility

Add read-only admin views for:

- parties
- active runs

### Deliverables

- players can form a party in Telegram
- leader can start a run
- run records exist and can be resumed or inspected

### Dependencies

- Phase C1

### Risks

- Telegram coordination becomes noisy
- party concurrency bugs around ready/start timing

### Exit Criteria

- multiplayer party setup works reliably
- run creation is idempotent and auditable
- admin can inspect active party/run state

---

## 7. Phase C3: Procedural Dungeon Generation v1

Status: [x] Complete

### Objective

Move from stub runs to reproducible seeded dungeons.

### Workstreams

#### A. Seeded Generation Core

Implement deterministic generation for:

- floor count
- room graph
- room types
- encounter slots
- reward slots

#### B. Persistence of Outputs

Persist:

- seed
- generation version
- generated room graph
- generated encounter assignments
- generated reward assignments

#### C. Room Prompt Rendering

Render Telegram prompts for:

- current room
- room summary
- valid actions and choices

#### D. Basic Non-Combat Rooms

Implement initial room resolution for:

- treasure
- rest
- event

### Deliverables

- seeded dungeon generation service
- stored dungeon outputs per run
- room traversal loop in Telegram

### Dependencies

- Phase C2

### Risks

- generator too random to balance
- generator too opaque to debug

### Exit Criteria

- runs generate reproducibly from seed + version
- room traversal works end to end
- admins can inspect generated dungeon state

---

## 8. Phase C4: PvE Encounter Engine v1

Status: [x] Complete

### Objective

Add the first playable monster combat loop.

### Workstreams

#### A. Monster Content

Add initial curated monster roster:

- low-tier melee enemy
- ranged/skirmisher enemy
- caster/support enemy
- elite encounter unit
- boss encounter unit

#### B. Encounter Resolution

Implement crawler encounter engine support for:

- initiative
- player side vs monster side
- bounded player actions
- monster AI priorities
- encounter completion

#### C. Engine Event Logging

Persist:

- encounter participant snapshots
- encounter events
- encounter outcomes

#### D. Telegram Encounter UX

Implement:

- encounter start card
- action prompts
- outcome summary

Recommended first cut:

- begin with an auto-resolve or minimally interactive model if needed

### Deliverables

- first PvE combat loop
- encounter logs and admin visibility
- monster templates and AI behaviors

### Dependencies

- Phase C3

### Risks

- trying to solve full tactical combat too early
- encounter flow too verbose for Telegram

### Exit Criteria

- a party can enter and finish a monster encounter
- outcomes persist correctly
- encounter results can be explained from logs

---

## 9. Phase C5: Room Flow, Rewards, and Inventory

Status: [ ] In Progress

### Objective

Make crawler runs progression-bearing instead of disposable demos.

### Workstreams

#### A. Reward Grants

Implement:

- room rewards
- encounter rewards
- boss rewards
- reward ledgering

#### B. Persistent Inventory

Implement:

- owned items
- equipment state
- consumable ownership

#### C. Telegram Inventory UX

Implement:

- `/inventory`
- `/equipment`
- equip/unequip flows
- reward reveal messages

#### D. Character Integration

Apply equipment effects and persistent upgrades to crawler calculations cleanly.

### Deliverables

- permanent loot ownership
- inventory management in DM
- reward grants that are auditable and replay-safe

### Dependencies

- Phase C4

### Risks

- duplicate reward grants
- overly complex inventory UX in Telegram

### Exit Criteria

- players can earn and keep loot
- equipment changes persist correctly
- admin can inspect reward grant history

---

## 10. Phase C6: Resume, Recovery, and Admin Operations

Status: [ ] Pending

### Objective

Make crawler mode supportable in the real world.

### Workstreams

#### A. Resume Flows

Implement:

- `/run`
- user re-entry into active run
- current prompt re-rendering

#### B. Recovery States

Handle:

- interrupted room prompts
- interrupted encounters
- abandoned party members
- stuck reward grants
- failed generation or run transitions

#### C. Admin Recovery

Add recovery controls for:

- stuck parties
- stuck runs
- stuck encounters
- reward grant finalization/revocation where appropriate

#### D. Auditability

Add crawler-specific audit events for:

- party lifecycle
- run start/end/failure
- encounter start/end
- reward grant/revoke
- recovery actions

### Deliverables

- resumable active runs
- admin recovery views and actions
- crawler audit trail

### Dependencies

- Phases C2 through C5

### Risks

- long-lived state creates hard-to-reproduce stuck cases
- recovery actions become too broad or unsafe

### Exit Criteria

- interrupted runs can be resumed
- admins can recover common failure modes without DB edits
- crawler actions are auditable

---

## 11. Phase C7: Alpha Crawler Release

Status: [ ] Pending

### Objective

Run the first limited crawler playtest with real users.

### Workstreams

#### A. Alpha Scope Control

Keep crawler Alpha limited to:

- small monster roster
- small loot pool
- bounded dungeon length
- conservative difficulty curve

#### B. Test Plan and Runbook

Create crawler-specific:

- alpha test plan
- bug backlog
- operator runbook
- release checklist

#### C. Playtest Observation

Track:

- completion rates
- failure rates
- confusing room choices
- loot perception
- recovery incidents

### Deliverables

- crawler Alpha test docs
- first real playtest feedback set
- crawler bug backlog

### Dependencies

- Phase C6

### Risks

- content variety too low
- balance feels unfair or flat
- co-op coordination is confusing

### Exit Criteria

- Alpha players can complete runs
- major failure modes are identified
- operator support model is proven

---

## 12. Phase C8: Beta Hardening

Status: [ ] Pending

### Objective

Turn crawler mode from “playable” into “reliably supportable.”

### Workstreams

#### A. Test Coverage

Expand automated coverage for:

- generation determinism
- party lifecycle
- encounter resolution
- reward grant idempotency
- resume and recovery flows

#### B. Balance and Content Tuning

Adjust:

- monster stats
- loot rates
- room distributions
- floor difficulty progression

#### C. Security and Integrity

Harden:

- reward grant safety
- concurrent action handling
- callback idempotency
- admin permissions

#### D. Observability

Add crawler-focused dashboards and metrics.

### Deliverables

- broader automated coverage
- tuned procedural generation tables
- hardened recovery and reward safety

### Dependencies

- Phase C7 feedback

### Risks

- procedural balance churn never settles
- reward economy becomes unstable

### Exit Criteria

- repeated runs are stable
- reward and state transitions are safe under retries
- operator burden is manageable

---

## 13. Phase C9: Crawler GA Readiness

Status: [ ] Pending

### Objective

Prepare crawler mode for stable public operation alongside duel mode.

### Workstreams

#### A. Release Hardening

Finalize:

- runbooks
- release checklist
- backup/restore expectations
- production config guardrails

#### B. Product Readiness

Finalize:

- help text
- player guidance
- admin guidance
- support policy

#### C. Operational Confidence

Confirm:

- restore rehearsal including crawler tables
- recovery rehearsal for active runs
- production deployment confidence

### Deliverables

- crawler GA checklist
- production-ready operator docs
- signoff that crawler mode is fit for broader release

### Dependencies

- Phase C8

### Risks

- crawler-specific operational edge cases remain untested
- support expectations exceed tooling

### Exit Criteria

- crawler mode is stable in production
- admins can operate and recover it safely
- reward and progression systems are trusted

---

## 14. Recommended First Implementation Slice

The best first code slice is:

1. Phase C1 foundations
2. Phase C2 party formation
3. a narrow Phase C3/C4 prototype:
   - one generated floor
   - a few room types
   - one small monster roster
   - simple reward grants

This gets to a playable crawler loop faster than trying to build the full content and recovery system up front.

---

## 15. Major Risks Across All Phases

The biggest crawler risks are:

1. trying to build full roguelike depth before the core Telegram loop is proven
2. underestimating the complexity of resumable run state
3. making reward/inventory mutations insufficiently auditable
4. letting procedural generation become too opaque to debug or tune
5. overfitting crawler systems to duel abstractions instead of giving them proper boundaries

---

## 16. Definition of a Good Crawler MVP

A good crawler MVP is not “feature complete.”

It is:

- a player can form a party
- the party can start a seeded run
- the party can traverse rooms
- the party can fight monsters
- the party can win or fail a run
- players can receive persistent loot
- admins can inspect and recover common crawler issues

If those are true, the crawler will be real enough to iterate on productively.

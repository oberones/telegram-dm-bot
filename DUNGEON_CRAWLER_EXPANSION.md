# Dungeon Crawler Expansion

## 1. Purpose

This document defines the major feature expansion required to evolve the current Telegram arbitration bot into a cooperative, text-based dungeon crawler.

It assumes the following product decisions:

- multiplayer mode: **co-op**
- dungeon generation: **fully procedural**
- death model: **run-based death only**
- loot model: **loot is permanent**
- rules model: **5e is the foundation, but mechanics may be adapted to fit Telegram and game constraints**

This is not a small feature slice. It is effectively a second game mode built on top of the current identity, character, combat, persistence, and admin foundations.

---

## 2. Product Vision

The expanded product becomes a Telegram-first cooperative adventure game where players:

- create a persistent character
- join or host cooperative dungeon runs
- explore procedural rooms through button-driven choices
- fight monsters using a bounded 5e-inspired combat system
- earn permanent loot and progression rewards
- die only within the current run, not permanently

The core fantasy is:

- easy to play in Telegram
- cooperative rather than adversarial
- persistent progression between runs
- highly replayable because dungeons, encounters, and loot are procedural

---

## 3. Strategic Impact

The current bot is built around:

- `1v1` disputes
- deterministic duel resolution
- short-lived match state

The crawler requires the system to support:

- persistent PvE progression
- stateful exploration
- parties instead of isolated duel participants
- monster content and AI behaviors
- inventory and equipment systems
- run lifecycle and recovery
- procedural content generation

This means the crawler should be treated as a new product domain inside the same platform, not as a small extension of the dispute system.

---

## 4. Design Goals

The crawler mode should:

1. preserve the project’s Telegram-first identity
2. feel recognizably 5e-inspired without trying to reproduce full tabletop complexity
3. support cooperative play cleanly
4. remain auditable and recoverable by admins
5. keep runs resumable after bot restarts or user interruptions
6. create meaningful long-term progression through permanent loot
7. use procedural generation to create replayability without requiring hand-authoring every room

---

## 5. Core Product Decisions

### 5.1 Co-op

The crawler is party-based.

Recommended initial party size:

- minimum: `1`
- maximum: `4`

Reason:

- one player should still be able to test or solo-run
- four players is enough for cooperative identity without making Telegram coordination too noisy

### 5.2 Fully Procedural

Dungeons are generated at run start.

Recommended v1 procedural model:

- floor-based room graph
- weighted room types
- weighted encounter tables
- weighted loot tables
- escalating floor difficulty

Avoid “infinite simulation” at first. Use bounded procedural templates with strong content curation.

### 5.3 Run-Based Death

Death should end a character’s participation in the current run, not destroy the character permanently.

Recommended rule:

- if the whole party wipes, the run fails
- if an individual character drops to 0 HP, use a simplified run-state defeat rule rather than full 5e death-save simulation unless that system is intentionally added later

### 5.4 Permanent Loot

Loot earned in successful or partially successful runs becomes part of the player’s persistent profile.

Recommended v1 categories:

- weapons
- armor
- trinkets / accessories
- consumables
- currency

### 5.5 5e Foundation, Not Full Fidelity

The crawler should use 5e concepts:

- armor class
- hit points
- initiative
- attack rolls
- saving throws
- spell slots
- conditions where practical
- monster stat blocks

But it should simplify when necessary for Telegram play:

- bounded action menus
- reduced edge-case complexity
- curated monster abilities
- simplified rest/recovery
- simplified death and resurrection

---

## 6. New Major Systems

The crawler requires at least nine new gameplay systems.

### 6.1 Adventure Runs

A run is the top-level gameplay session.

A run needs:

- party membership
- current floor
- current room
- exploration state
- combat state
- reward state
- completion / failure state

### 6.2 Parties

Players need to be able to:

- host a party
- join a party
- ready up
- start a run
- leave before the run begins

Later:

- reconnect to an active party
- rejoin after Telegram interruption

### 6.3 Dungeon Generation

At minimum, generation should create:

- dungeon seed
- floors
- rooms
- room connectivity
- room types
- encounter composition
- treasure placement

Recommended room types:

- combat
- elite combat
- treasure
- event
- rest
- boss
- empty / flavor

### 6.4 PvE Combat

The current combat engine must expand from duel resolution into party-vs-monster encounters.

Needed additions:

- many participants instead of two
- team alignment
- monster AI
- turn targeting logic
- encounter completion logic
- item and spell usage during fights
- escape or retreat behavior

### 6.5 Monsters

Add a curated monster system:

- monster definitions
- monster roles
- initiative
- AC / HP
- attacks
- save-based abilities
- simple AI priorities
- loot / XP values

Recommended v1 monster roles:

- brute
- skirmisher
- caster
- support
- boss

### 6.6 Loot and Inventory

Players need persistent inventory and equipment.

Minimum capabilities:

- grant loot after encounters or rooms
- store inventory
- equip / unequip items
- consume consumables
- apply stat modifiers from equipment

### 6.7 Progression

Because loot is permanent, progression must also be persistent.

Recommended v1 progression:

- currency
- inventory
- equipment slots
- run count
- monster kills
- optional XP/level progression later

Important recommendation:

- start with permanent loot and equipment first
- defer broad class leveling until crawler balance is clearer

### 6.8 Events and Exploration Choices

Not every room should be combat.

Recommended event system:

- trap choice
- shrine / blessing
- merchant
- cursed chest
- branching path
- risk/reward altar

These should be bounded, deterministic once generated, and easy to present in Telegram buttons.

### 6.9 Recovery and Run Resume

Runs must survive:

- bot restarts
- user disconnects
- partial command delivery
- admin intervention

This means run state must be stored as explicit DB state, not just inferred from recent messages.

---

## 7. Recommended Product Scope by Stage

### Stage A: PvE Foundation

Goal:

- get one player fighting one monster persistently

Includes:

- monster definitions
- player vs monster combat
- simple loot rewards
- persistent run record

Does not include:

- co-op
- procedural dungeon graph
- events
- equipment system

### Stage B: Party Runs

Goal:

- let 2-4 players start a run together

Includes:

- party hosting and joining
- ready state
- party combat
- shared run progression

Still limited:

- linear room sequence
- no full procedural graphs yet

### Stage C: Procedural Dungeon MVP

Goal:

- make the run feel like a real dungeon crawler

Includes:

- seeded dungeon generation
- room graph
- room type tables
- combat and treasure rooms
- simplified event rooms
- floor progression

### Stage D: Persistent Progression

Goal:

- make repeated runs rewarding

Includes:

- inventory
- equipment
- consumables
- currency
- persistent rewards

### Stage E: Expansion Depth

Goal:

- broaden content and replayability

Includes:

- more monsters
- bosses
- environmental effects
- richer event system
- class growth and broader build variety

---

## 8. Telegram UX Changes

The crawler should be heavily button-driven.

### 8.1 New Top-Level Commands

Recommended additions:

- `/adventure`
- `/party`
- `/inventory`
- `/equipment`
- `/run`
- `/retreat`

### 8.2 Party Flow

Example:

1. `/party`
2. create or join party
3. ready up
4. leader starts run
5. party receives dungeon intro

### 8.3 Exploration Flow

Example room prompt:

- room description
- current party HP/resources
- buttons:
  - `Take Left Path`
  - `Take Right Path`
  - `Inspect`
  - `Retreat`

### 8.4 Combat Flow

Do not present fully freeform action entry.

Recommended:

- current actor turn prompt
- compact state summary
- valid action buttons
- target buttons when needed

### 8.5 Run Resume

If a player sends `/run`, the bot should restore:

- run status
- floor / room
- current encounter if present
- current choice if waiting on input

---

## 9. Combat Engine Expansion Requirements

The current engine is duel-oriented. To support crawler mode, it needs a second major capability set.

### 9.1 New Engine Requirements

- multi-participant combat
- team-based targeting
- initiative lists larger than two
- ally and enemy state tracking
- monster actions
- item use
- encounter end states

### 9.2 Engine Boundary Recommendation

Do not overload the current duel API with crawler assumptions.

Recommended approach:

- keep the current duel resolver intact for arbitration mode
- add a new encounter resolver for PvE mode

This preserves:

- backward compatibility
- audit clarity
- simpler testing

### 9.3 Monster AI

Monster AI should be bounded and explicit.

Recommended v1 AI rules:

- choose action by weighted priority
- target lowest HP, nearest threat, or random valid target depending on role
- support units buff or heal
- casters favor special abilities while resources remain

Do not attempt emergent “smart AI” in v1.

---

## 10. Data Model Expansion

The schema will need substantial additions.

### 10.1 New Core Tables

Recommended additions:

- `parties`
- `party_members`
- `adventure_runs`
- `run_floors`
- `run_rooms`
- `run_room_choices`
- `encounters`
- `encounter_participants`
- `encounter_events`
- `monster_templates`
- `loot_templates`
- `inventory_items`
- `equipment_loadouts`
- `consumable_uses`
- `run_rewards`
- `procedural_generation_logs`

### 10.2 Character Expansion

Current characters will need:

- persistent progression fields
- equipment summary
- inventory relationships
- crawler stats and unlocks

### 10.3 Snapshot Policy

Just like dispute matches, runs and encounters must snapshot relevant state:

- character combat state at encounter start
- equipment bonuses
- monster stats
- room context
- loot roll outcomes
- dungeon generation seed

### 10.4 Recovery State

Runs need explicit statuses such as:

- `forming`
- `active`
- `paused`
- `awaiting_choice`
- `in_combat`
- `completed`
- `failed`
- `abandoned`
- `error`

---

## 11. Admin Panel Expansion

The admin panel will need a new crawler operations surface.

Recommended additions:

- parties list/detail
- runs list/detail
- floor/room visualization
- encounter replay
- monster catalog
- loot table management
- item catalog
- run recovery tools
- stuck-turn resolution
- reward correction tools

The crawler will dramatically increase the need for operational visibility.

---

## 12. Procedural Generation Strategy

### 12.1 Recommendation

Use seeded procedural generation with weighted tables.

This gives:

- replayability
- reproducibility
- easier debugging
- admin auditability

### 12.2 Generation Inputs

Suggested inputs:

- seed
- party size
- average gear score or progression score
- floor number
- difficulty tier

### 12.3 Generation Outputs

- room graph
- room type sequence
- encounter picks
- loot rewards
- special event placements

### 12.4 Why Seeded Generation Matters

Seeded generation lets you:

- replay a run for debugging
- inspect fairness
- compare balance across seeds
- explain odd outcomes operationally

---

## 13. Loot Model

Because loot is permanent, it becomes one of the most sensitive systems in the game.

### 13.1 Recommended Loot Categories

- common gear
- rare gear
- consumables
- currency
- crafting or upgrade materials if later added

### 13.2 Recommended Early Rules

- loot is granted only at explicit room or run checkpoints
- all grants are logged
- admin corrections are auditable
- duplicate drop behavior is defined clearly

### 13.3 Equipment Simplicity

For MVP, keep equipment slots narrow:

- weapon
- armor
- accessory

Avoid a full tabletop equipment simulator at first.

---

## 14. 5e Rules Translation Guidance

To keep the crawler recognizable but supportable:

### Keep Close to 5e

- AC and attack rolls
- save DCs
- HP and damage dice
- spell slot usage
- initiative
- action names and broad class identity

### Simplify for Telegram

- bounded action menus
- reduced reaction complexity
- limited condition list
- curated monster abilities
- no grid movement in the first crawler MVP

### Adapt for Game Feel

- encounter pacing
- loot frequency
- healing cadence
- simplified rest model
- class kit tuning for PvE

---

## 15. Major Technical Risks

### Risk 1: State Explosion

The crawler introduces much more persistent state than duel mode.

Mitigation:

- explicit run state tables
- immutable encounter logs
- strict status transitions

### Risk 2: Telegram UX Overload

Too many choices or long logs will become unreadable.

Mitigation:

- button-first design
- compact state summaries
- staged prompts

### Risk 3: Content Balance

Procedural generation plus permanent loot can spiral quickly.

Mitigation:

- heavily curated tables
- narrow MVP content set
- seed-based audits

### Risk 4: Recovery Complexity

Stuck runs and interrupted party turns are inevitable.

Mitigation:

- explicit recovery tooling
- resumable run model
- admin intervention surfaces

### Risk 5: Scope Explosion

Trying to build “full roguelike + full 5e + co-op MMO” will stall delivery.

Mitigation:

- ship PvE in stages
- keep crawler MVP narrow
- reuse existing engine and admin principles where possible

---

## 16. Recommended MVP for the Crawler Expansion

If this feature moves into active implementation, the recommended crawler MVP is:

- 1-4 player co-op party
- one procedural dungeon per run
- 3-5 floors
- combat, treasure, rest, and event rooms
- small curated monster roster
- permanent loot
- persistent inventory and simple equipment
- run-based death
- resumable runs
- admin run inspection and recovery

Not in crawler MVP:

- broad class leveling tree
- giant item ecosystem
- advanced reaction system
- full condition catalog
- hand-authored narrative campaigns

---

## 17. Recommended Development Roadmap

If approved, the implementation path should be:

1. create crawler-specific rules and product specs
2. define crawler schema additions
3. build party and run state infrastructure
4. build PvE encounter engine
5. add monster and loot content systems
6. add Telegram party/run UX
7. add procedural dungeon generation
8. add inventory/equipment persistence
9. add admin run inspection and recovery
10. alpha test the crawler separately from arbitration mode

---

## 18. Recommended Next Documents

The strongest next planning docs for this expansion are:

- `CRAWLER_RULES_SPEC.md`
- `CRAWLER_SCHEMA.md`
- `CRAWLER_BOT_FLOWS.md`
- `CRAWLER_ARCHITECTURE.md`

Those should lock the crawler mode before major implementation begins.

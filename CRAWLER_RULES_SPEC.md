# Crawler Rules Specification

## 1. Purpose

This document defines the initial rules contract for the cooperative dungeon crawler mode.

It translates the crawler vision into a buildable gameplay ruleset for:

- player progression
- party formation
- exploration
- PvE combat
- monsters
- loot
- run failure and success

The goal is not full tabletop fidelity. The goal is a Telegram-friendly, co-op, 5e-founded crawler that is:

- readable
- fair
- recoverable
- replayable

If a rule is not described here, it is not in crawler v1.

---

## 2. Core Principles

### Principle 1: 5e Foundation, Bounded Execution

Crawler mode should feel like D&D:

- armor class
- attack rolls
- damage dice
- saving throws
- spell slots
- monster stat blocks

But it must stay bounded enough for Telegram play.

### Principle 2: Co-op First

Crawler mode is designed around party play, even though solo runs may be allowed.

### Principle 3: Runs Are Temporary, Characters Are Persistent

Characters persist.
Run state does not.
Death is a run failure state, not permanent character deletion.

### Principle 4: Permanent Loot, Logged Gains

Loot earned from crawler mode is persistent and therefore must be:

- explicit
- auditable
- replay-safe

### Principle 5: Procedural, But Reproducible

Dungeon generation must be seeded and reproducible so runs can be:

- debugged
- reviewed
- balanced

---

## 3. Supported Mode in v1

### Supported

- co-op dungeon runs
- party size `1-4`
- fully procedural dungeons
- room-based exploration
- PvE combat
- permanent loot rewards
- run-based death/failure

### Not Supported in v1

- PvP inside crawler mode
- open world exploration
- freeform roleplay parser input
- permanent character death
- multiclassing
- complex crafting
- player housing / guild systems

---

## 4. Party Rules

### Party Size

- minimum: `1`
- maximum: `4`

### Party Start Rules

A run may begin only when:

- all current members are ready
- all characters are eligible
- no member is already in another active run

### Party Composition

Recommended v1 rule:

- duplicate classes are allowed

Reason:

- easier matchmaking
- fewer blocked runs
- better fit for Telegram convenience

### Leaving

- before run start: players may leave freely
- after run start: leaving counts as abandoning the run for that player

Recommended v1 behavior:

- abandoned players are removed from future decisions
- their character gets no further actions in the run

---

## 5. Character Rules in Crawler Mode

### Character Source

Crawler mode uses the same persistent character identity as the existing bot.

### Character Persistence

Characters persist across runs with:

- inventory
- equipment
- long-term loot progression
- career stats

### Character Death

Character death is not permanent.

Recommended v1 rule:

- if a character is defeated in a run, that character is removed from active participation for the rest of the run
- after the run ends, the character returns to persistent play in a recovered state

### Character Eligibility

A character cannot enter a crawler run if:

- the user is suspended
- the character is frozen
- the character is already committed to another active run

---

## 6. Dungeon Structure

### v1 Dungeon Shape

Recommended v1 structure:

- `3-5` floors
- each floor contains a bounded number of rooms
- final floor contains a boss room

### Room Types

Supported room types in v1:

- combat
- elite combat
- treasure
- event
- rest
- boss

### Room Visibility

Recommended v1 rule:

- players do not see the full dungeon map at the start
- they only see current room context and valid next choices

### Generation Model

Each run is generated from:

- a seed
- party size
- difficulty tier
- floor number

Generation must be deterministic from the seed plus config version.

---

## 7. Exploration Rules

### Exploration Loop

For each room, the party:

1. receives a room prompt
2. receives current party state summary
3. chooses one of the valid actions
4. resolves room consequences

### Supported Exploration Actions

- proceed
- choose path
- inspect
- open chest
- rest
- retreat

Not every action appears in every room.

### Decision Model

Recommended v1 approach:

- party leader or designated acting player makes the final choice

Alternative voting systems should wait until later.

### Retreat

Recommended v1 retreat rule:

- retreat can be attempted between combat rounds
- retreat requires unanimous party action
- retreat triggers break-engagement attacks before the party escapes
- if at least one party member survives the break, the party falls back to the previous room with current HP preserved

Reason:

- keeps combat interactive without requiring per-turn tactical input
- preserves real combat risk when disengaging

---

## 8. PvE Combat Rules

### Combat Format

Supported v1 formats:

- `1-1`
- `2-1`
- `2-2`
- `3-2`
- `4-3`
- `4-4`
- boss encounters with one boss plus supporting enemies

Exact encounter sizes come from procedural tables.

### Turn Order

All participants roll initiative.
Combat proceeds in descending initiative order.

### Combat Resources

During a run, combat uses current run state for:

- HP
- spell slots
- consumables
- temporary effects

This is different from duel mode, where each match starts from a clean snapshot.

### Supported Combat Actions in v1

- basic attack
- supported class attack/spell options
- use consumable
- defend
- basic healing action if granted by class/item

### Deferred for Later

- reactions as a broad system
- opportunity attacks
- grappling
- complex forced movement
- large condition tree

---

## 9. Combat Accuracy to 5e

### Keep Close

The crawler should preserve:

- attack rolls vs AC
- saving throws vs DC
- critical hits on natural 20 attack rolls
- automatic miss on natural 1 attack rolls
- spell slot consumption for spellcasting
- class identity through weapon/spell style

### Simplify

The crawler may simplify:

- action economy
- reaction economy
- movement and positioning
- concentration
- death saving throws

### Explicit Recommendation

Do not require a grid in crawler v1.
Positioning should be abstracted into room/encounter logic, not tactical map play.

---

## 10. Class Rules

### Shared Rule

Crawler v1 should begin with the same four classes:

- Fighter
- Rogue
- Wizard
- Cleric

### Design Role in PvE

- Fighter: durable front-liner
- Rogue: high initiative and precision damage
- Wizard: burst and ranged damage, fragile defense
- Cleric: balanced offense, support, and survivability

### Required PvE Adjustment

Class balance must be re-evaluated for party PvE and should not assume duel balance.

### Class Growth

Recommended v1 rule:

- keep class kits shallow at first
- expansion should happen through loot, minor progression, and curated feature upgrades

Avoid full spellbook or feat complexity in crawler v1.

---

## 11. Monster Rules

### Monster Source

Monsters are curated content, not arbitrary SRD import dumps.

### Monster Roles

Supported v1 roles:

- brute
- skirmisher
- caster
- support
- boss

### Monster Requirements

Each monster template needs:

- name
- level or difficulty tier
- role
- HP
- AC
- initiative mod
- attack or spell options
- save modifiers
- loot / reward profile
- AI behavior profile

### AI Rules

Monster AI should be explicit and deterministic from game state plus RNG.

Recommended v1 targeting logic:

- brute: highest-threat or nearest-frontline abstract target
- skirmisher: low-HP or fragile target
- caster: grouped / weakest-save / priority target
- support: heal or buff allies when thresholds are met
- boss: weighted behavior with phase-like priorities

---

## 12. Loot Rules

### Loot Persistence

Loot is permanent once granted and committed.

### Loot Sources

Supported loot sources:

- combat room rewards
- treasure rooms
- elite rewards
- boss rewards
- event rewards

### Loot Categories

- weapons
- armor
- accessories
- consumables
- currency

### Loot Grant Rule

Recommended v1 rule:

- loot is granted at explicit reward resolution points, not immediately on every sub-event

Reason:

- better recovery
- cleaner logging
- easier rollback handling

### Duplicate Items

Recommended v1 rule:

- duplicates are allowed unless an item is explicitly unique

---

## 13. Equipment Rules

### Supported Equipment Slots

Recommended v1 slots:

- weapon
- armor
- accessory

### Equipment Effects

Supported v1 effect types:

- AC bonus
- HP bonus
- attack bonus
- damage bonus
- save bonus
- spell-oriented modifier where clearly bounded

### Equipment Application

Equipment modifies persistent character stats outside runs and is then snapshotted into the run state.

---

## 14. Consumables

### Supported v1 Consumables

- healing potion
- offensive scroll or bomb equivalent
- buff item

### Usage Rule

Consumables are spent permanently when used.

### Telegram Constraint

Consumables must be offered through compact menus.
No freeform inventory text parsing.

---

## 15. Rest and Recovery

### Rest Rooms

Rest is room-based, not freeform.

### Recommended v1 Rest Rule

At rest rooms, the party may receive a bounded recovery effect such as:

- partial HP recovery
- limited resource refresh
- one consumable grant

### Strong Recommendation

Do not implement full short-rest / long-rest tabletop recovery in crawler v1.

Reason:

- too many edge cases
- too much pacing complexity

Instead, use explicit Telegram-friendly recovery nodes.

---

## 16. Run Failure and Success

### Individual Defeat

If a character is defeated:

- they are out for the remainder of the run

### Party Wipe

If all party members are defeated:

- the run fails

### Run Success

A run succeeds when:

- the final objective or boss is completed

### Partial Success

Recommended v1 rule:

- partial rewards may still be retained for progress already banked during the run

Whether unbanked rewards are lost should be an explicit product rule.

Recommended first rule:

- only resolved rewards are kept
- unreached rewards are lost

---

## 17. Reward Banking

Because loot is permanent and death is run-based, reward timing matters.

Recommended v1 rule:

- rewards are banked immediately at explicit reward scenes

This avoids unclear “all loot lost on wipe” frustration and fits Telegram better.

---

## 18. Event Room Rules

Supported v1 event categories:

- blessing
- trap
- merchant
- cursed choice
- shrine
- gamble

Each event must:

- expose bounded choices
- resolve deterministically
- log its result

Avoid large narrative branches in v1.

---

## 19. Difficulty Scaling

### Inputs

Dungeon difficulty should scale from:

- party size
- progression tier
- floor number
- seed-based variance

### Outputs

Difficulty scaling may affect:

- monster HP
- monster attack bonus
- monster count
- elite room frequency
- loot quality

### Recommendation

Prefer content-table scaling over raw stat inflation whenever possible.

---

## 20. Logging and Auditability

Crawler mode must log:

- run seed
- party membership
- room generation outputs
- encounter state
- loot grants
- defeat/failure outcomes
- admin recovery actions

Permanent loot makes auditability non-optional.

---

## 21. Recovery Rules

The system must support:

- resuming an active run
- resolving interrupted room choice prompts
- recovering from interrupted combat turns
- admin cancellation of stuck runs
- admin correction of reward issues

No silent corrections.
All admin actions must be auditable.

---

## 22. Out of Scope for Crawler v1

The following should stay out of initial crawler implementation:

- full tactical positioning grid
- large condition system
- broad summon system
- stealth simulation with line-of-sight
- multiclassing
- player-to-player trading economy
- crafting tree
- permanent death
- hand-authored branching campaign storylines

---

## 23. Recommended Crawler MVP Ruleset

The recommended crawler MVP is:

- 1-4 player co-op
- one seeded procedural dungeon
- 3-5 floors
- combat, treasure, event, rest, and boss rooms
- four starter classes
- curated monster roster
- persistent loot and equipment
- run-based defeat only
- button-first Telegram flow
- explicit run resume and admin recovery

---

## 24. Next Required Documents

The strongest next planning documents are:

- `CRAWLER_SCHEMA.md`
- `CRAWLER_BOT_FLOWS.md`
- `CRAWLER_ARCHITECTURE.md`

Those should be created before major implementation begins.

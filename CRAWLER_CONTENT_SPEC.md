# Crawler Content Specification

## 1. Purpose

This document defines the initial content set for the cooperative dungeon crawler mode.

It builds on:

- [DUNGEON_CRAWLER_EXPANSION.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DUNGEON_CRAWLER_EXPANSION.md)
- [CRAWLER_RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_RULES_SPEC.md)
- [CRAWLER_SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_SCHEMA.md)
- [CRAWLER_BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_BOT_FLOWS.md)
- [CRAWLER_ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ARCHITECTURE.md)
- [CRAWLER_ROADMAP.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CRAWLER_ROADMAP.md)

The goal of this document is to answer:

- what monsters exist in crawler v1
- what loot exists in crawler v1
- how rooms and floors are distributed
- how difficulty should scale
- what reward pacing should feel like

This is a content contract for implementation and tuning, not final flavor text.

---

## 2. Content Design Goals

The v1 crawler content should be:

1. small enough to balance quickly
2. varied enough that runs do not feel identical
3. expressive enough to make classes feel different
4. deterministic enough to tune from logs
5. expandable without rewriting the generation model

Recommended v1 philosophy:

- shallow breadth
- strong readability
- obvious monster roles
- conservative permanent power growth

---

## 3. v1 Scope Overview

Recommended initial content scope:

- `3` dungeon themes
- `5` room types actively used in generation, plus boss rooms
- `10-14` monster templates
- `1-2` bosses per theme
- `12-18` permanent loot items
- `4-6` consumables
- `3` difficulty tiers

This is enough for replayability without creating an impossible balancing surface.

---

## 4. Dungeon Themes

Recommended v1 themes:

### Theme 1: Goblin Warrens

Tone:

- cramped tunnels
- traps
- ambushers
- scavenged loot

Content profile:

- more skirmishers
- higher event/trap frequency
- lighter armor rewards

### Theme 2: Forsaken Crypt

Tone:

- undead
- attrition
- cursed chambers
- radiant-vulnerable enemies

Content profile:

- more brutes and supports
- slightly more rest value
- higher potion/relic frequency

### Theme 3: Arcane Ruins

Tone:

- magical constructs
- unstable chambers
- spell-heavy threats
- enchanted treasure

Content profile:

- more caster enemies
- more status-like encounter effects
- more trinket rewards

Recommended v1 rule:

- each run chooses a single dominant theme at generation time
- off-theme crossover should wait until later

---

## 5. Floor and Room Pacing

### Floor Count

Recommended v1:

- `3` floors for standard runs
- optional `4th` floor for higher difficulty tier only

### Rooms Per Floor

Recommended v1:

- floor 1: `3-4` rooms
- floor 2: `4-5` rooms
- floor 3: `4-5` rooms including boss
- floor 4 if used: `5-6` rooms including boss

### Floor Structure Rule

Each floor should contain:

- at least one combat room
- at least one branching or decision point
- no more than one rest room
- exactly one boss room on the final floor

### Recommended Pacing Curve

Floor 1:

- onboarding
- low complexity encounters
- first meaningful loot

Floor 2:

- mixed room pressure
- first elite encounter chance
- stronger resource drain

Floor 3:

- fewer safe rooms
- higher encounter pressure
- boss finish

---

## 6. Room Types and Weights

Supported room types in generation:

- `combat`
- `elite_combat`
- `treasure`
- `event`
- `rest`
- `boss`

### Base Room Weights

Recommended default non-boss weights:

- combat: `45`
- elite_combat: `10`
- treasure: `15`
- event: `15`
- rest: `15`

These should be adjusted by floor and theme.

### Floor Weight Adjustments

Floor 1:

- combat: `40`
- elite_combat: `5`
- treasure: `20`
- event: `20`
- rest: `15`

Floor 2:

- combat: `45`
- elite_combat: `10`
- treasure: `15`
- event: `15`
- rest: `15`

Floor 3:

- combat: `50`
- elite_combat: `15`
- treasure: `10`
- event: `10`
- rest: `15`

### Constraints

- do not generate two rest rooms back to back
- do not generate two treasure rooms back to back on early floors
- elite rooms should not appear as the first room of a run
- boss room replaces a normal room on the final floor

---

## 7. Encounter Budget Model

v1 should use a simple encounter budget rather than full CR emulation.

Recommended encounter budgets by party size:

- solo: `budget 1.0`
- duo: `budget 1.8`
- trio: `budget 2.5`
- party of four: `budget 3.2`

Recommended difficulty multipliers:

- easy room: `0.8x`
- standard combat room: `1.0x`
- elite room: `1.35x`
- boss room: `1.8x-2.2x`

Recommended floor multipliers:

- floor 1: `1.0x`
- floor 2: `1.15x`
- floor 3: `1.35x`
- floor 4: `1.5x`

Monster templates should carry a simple internal point value:

- minion: `0.5`
- normal: `1.0`
- elite: `1.5`
- boss: `2.5-3.5`

This is easier to tune than pretending v1 is using exact 5e CR.

---

## 8. Monster Role Design

Recommended v1 monster roles:

### Brute

Traits:

- higher HP
- lower initiative
- reliable melee damage

Purpose:

- front-line pressure

### Skirmisher

Traits:

- lower HP
- higher initiative
- moderate single-target damage

Purpose:

- punish squishy backliners

### Caster

Traits:

- low HP
- ranged attacks or save-based abilities
- swingier damage

Purpose:

- force target prioritization

### Support

Traits:

- low to medium HP
- buff, heal, or debuff behavior

Purpose:

- make mixed encounters feel distinct

### Boss

Traits:

- strong HP pool
- at least one special move
- clearer encounter identity

Purpose:

- climactic run finish

---

## 9. Starter Monster Roster

Recommended v1 monster set:

### Goblin Warrens

1. `Goblin Sneak`
- role: skirmisher
- point value: `0.5`
- identity: quick dagger or shortbow strikes

2. `Goblin Boss`
- role: elite
- point value: `1.5`
- identity: stronger melee burst and leadership flavor

3. `Warg`
- role: brute/skirmisher hybrid
- point value: `1.0`
- identity: fast bite pressure

4. `Tunnel Hexer`
- role: caster
- point value: `1.0`
- identity: weak body, annoying ranged magic

### Forsaken Crypt

5. `Skeleton Guard`
- role: brute
- point value: `1.0`
- identity: shielded melee unit

6. `Restless Dead`
- role: support
- point value: `0.75`
- identity: minor heal or bolster to undead allies

7. `Crypt Stalker`
- role: skirmisher
- point value: `1.0`
- identity: burst damage and initiative threat

8. `Bone Warden`
- role: boss
- point value: `3.0`
- identity: durable undead boss with sweeping attack

### Arcane Ruins

9. `Animated Armor`
- role: brute
- point value: `1.0`
- identity: high AC, steady pressure

10. `Arc Spark`
- role: caster
- point value: `0.75`
- identity: low HP ranged construct

11. `Rune Sentinel`
- role: elite
- point value: `1.5`
- identity: tanky construct with magical strike

12. `Rift Adept`
- role: caster/support
- point value: `1.0`
- identity: magical disruption and buffs

13. `Collapsed Magus`
- role: boss
- point value: `3.0`
- identity: arcane boss with force and fire effects

### Shared Fallback Monsters

14. `Giant Rat`
- role: minion/skirmisher
- point value: `0.5`
- identity: simple low-tier filler encounter

Recommended v1 rule:

- every theme should have at least:
  - one basic enemy
  - one pressure or support enemy
  - one elite or boss anchor

---

## 10. Boss Design Rules

Bosses should feel different without introducing huge complexity.

Recommended v1 boss rules:

- one boss per run
- boss may have `0-2` supporting enemies
- boss gets one signature action or rider effect
- boss fights should be short enough to fit Telegram comfortably

Boss design guardrails:

- no full summon loops
- no hard stun-lock mechanics
- no massive healing loops
- no invisible rules text players cannot infer from logs

---

## 11. Monster Ability Guidelines

For v1, monster abilities should use only a small set of mechanic shapes:

- weapon-style attack roll
- save-based damage
- small heal to ally
- small self-buff
- simple debuff marker

Recommended v1 rider effects:

- next attack has advantage
- target takes reduced healing this encounter
- target is marked as preferred focus
- target takes small ongoing damage for a bounded number of turns

Avoid in v1:

- grapples
- charm
- fear pathing logic
- summoned creatures
- complicated area templates

---

## 12. Loot Model

Recommended v1 loot categories:

- weapons
- armor
- accessories
- consumables
- currency

Recommended rarity tiers:

- common
- uncommon
- rare

Avoid legendary-tier permanent items in v1.

### Permanent Loot Philosophy

Permanent loot should provide modest, legible upgrades.

Examples:

- `+1` weapon attack bonus
- `+1` armor AC
- `+1` spell save DC equivalent if that stat is introduced later
- bonus max HP
- once-per-run minor effect

Avoid explosive permanent stacking early.

---

## 13. Starter Permanent Loot Pool

Recommended v1 permanent items:

### Weapons

1. `Balanced Longsword`
- rarity: common
- effect: `+1` melee attack rolls for martial characters

2. `Keen Rapier`
- rarity: common
- effect: `+1` melee damage on finesse attacks

3. `Oak Warhammer`
- rarity: uncommon
- effect: `+1` melee damage and small max HP bonus

4. `Ashen Wand`
- rarity: common
- effect: `+1` spell attack rolls

### Armor

5. `Reinforced Chain`
- rarity: common
- effect: `+1` AC for eligible wearers

6. `Blessed Vestments`
- rarity: uncommon
- effect: `+1` AC and small healing bonus

7. `Shadow Cloak`
- rarity: uncommon
- effect: initiative bonus or first-round defense bonus

### Accessories

8. `Iron Charm`
- rarity: common
- effect: `+2` max HP

9. `Reliquary Token`
- rarity: uncommon
- effect: improve one healing action per run

10. `Rune Ring`
- rarity: uncommon
- effect: small spell damage bonus

11. `Wolf Fang Pendant`
- rarity: common
- effect: small initiative bonus

12. `Lantern Shard`
- rarity: rare
- effect: once per run reroll on a room event or encounter opener

### Consumables

13. `Minor Healing Potion`
- rarity: common
- effect: restore small HP during a run

14. `Arcane Draught`
- rarity: uncommon
- effect: restore a low-tier spell resource once per run

15. `Stoneskin Tonic`
- rarity: uncommon
- effect: temporary damage reduction for one encounter

16. `Flash Powder`
- rarity: common
- effect: grants opener advantage in an encounter

### Currency

17. `Gold`
- use: future vendors, meta progression, or reward sink

Recommended v1 rule:

- only a subset of these should drop at launch
- keep expansion room for later themes

---

## 14. Reward Tables

### Combat Reward Baseline

Standard combat room:

- small gold grant
- low chance of consumable
- low chance of common permanent item

Elite room:

- larger gold grant
- good chance of consumable
- moderate chance of common/uncommon permanent item

Boss room:

- large gold grant
- guaranteed notable reward
- high chance of uncommon item
- rare chance of rare item

### Suggested Drop Chances

Standard combat:

- gold: `100%`
- consumable: `25%`
- permanent item: `10%`

Elite combat:

- gold: `100%`
- consumable: `50%`
- permanent item: `30%`

Boss:

- gold: `100%`
- consumable: `75%`
- permanent item: `100%`
- rare item upgrade chance: `15%`

Treasure room:

- gold: `100%`
- consumable: `40%`
- permanent item: `20%`

### Reward Guardrails

- do not award more than one permanent item per player per run in early tuning
- boss rewards may break that rule only at higher difficulty

---

## 15. Rest and Event Content

### Rest Rooms

Rest rooms should provide one of:

- partial HP recovery
- one small resource recovery
- one choice between two small benefits

They should not function as a full reset.

### Event Rooms

Recommended event outcomes:

- gain small gold
- gain consumable
- take small damage for faster progress
- pick between safe and risky reward
- trigger a mini-encounter or trap

Event rooms should be short and decisional, not lore dumps.

---

## 16. Difficulty Tiers

Recommended v1 tiers:

### Tier 1: Delve

Use:

- onboarding
- low gear assumptions

Content profile:

- fewer elite rooms
- softer bosses
- better recovery pacing

### Tier 2: Descent

Use:

- standard play

Content profile:

- balanced room mix
- moderate elite presence
- normal reward expectations

### Tier 3: Cataclysm

Use:

- geared groups
- repeat players

Content profile:

- higher encounter budgets
- stronger boss support units
- slightly better permanent reward rates

Recommended v1 launch rule:

- ship with Tier 1 and Tier 2 first
- hold Tier 3 until early balance data exists

---

## 17. Content Tuning Rules

When balancing v1 content:

1. tune survivability before tuning damage spikes
2. keep boss fights threatening but short
3. prefer more encounters over bloated HP pools
4. keep loot bonuses small and legible
5. avoid content that requires long rules explanations in Telegram

Signs content is too harsh:

- first-floor wipes are common
- solo runs are impossible on Tier 1
- boss fights regularly take too many message turns

Signs content is too soft:

- parties finish full runs with little resource pressure
- rest rooms feel unnecessary
- loot upgrades are irrelevant to outcomes

---

## 18. Recommended Launch Content Set

For the very first playable crawler implementation, start even smaller than the full v1 pool.

Recommended first code slice:

- themes:
  - Goblin Warrens
  - Forsaken Crypt
- monsters:
  - Goblin Sneak
  - Warg
  - Goblin Boss
  - Skeleton Guard
  - Restless Dead
  - Bone Warden
  - Giant Rat
- room types:
  - combat
  - treasure
  - rest
  - boss
  - one simple event room
- loot:
  - Balanced Longsword
  - Ashen Wand
  - Reinforced Chain
  - Iron Charm
  - Minor Healing Potion
  - Gold

This is enough to prove the system before adding Arcane Ruins and the larger item pool.

---

## 19. Content Versioning

All crawler content should be versioned.

At minimum, version:

- room weight tables
- monster template set
- loot table set
- event pool
- difficulty tuning values

Runs should store the version identifiers used at generation time.

This is required for:

- replay
- debugging
- balance analysis
- safe future tuning

---

## 20. Next Document

The best next companion document is:

- `CRAWLER_IMPLEMENTATION_PLAN.md`

At this point the crawler mode now has:

- feature expansion scope
- rules spec
- schema design
- bot flow spec
- architecture
- roadmap
- content specification

The next useful planning step is to translate Phase C1 into an actual build checklist with migrations, packages, fixtures, and first vertical slices.

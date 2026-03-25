# Rules Spec: Arbitration Combat Engine v1

## 1. Purpose

This document defines the exact rules subset for the first production version of the Telegram arbitration bot.

It is the implementation contract for:

- combat engine behavior
- character generation constraints
- Telegram battle presentation
- admin review and dispute resolution tooling

This is **not** a full implementation of Dungeons & Dragons 5e. It is a **curated, SRD-compatible 5e-inspired combat subset** designed for:

- speed
- transparency
- deterministic adjudication
- manageable implementation complexity

If a rule is not described here, it is **not supported in v1**.

---

## 2. Design Goals

The ruleset must satisfy five goals:

1. Be recognizably D&D-like.
2. Be fast enough to resolve inside Telegram without becoming tedious.
3. Be transparent enough that users can understand why they won or lost.
4. Be narrow enough to test thoroughly.
5. Be flexible enough to expand later without invalidating historical matches.

---

## 3. Core Principles

### Principle 1: Rules Over Flavor

Flavor text is optional presentation. Match outcomes are determined only by structured game rules, snapshots, and recorded dice.

### Principle 2: Immutable Match Snapshots

Once a match begins, participant stats, features, and loadouts are frozen for that match.

### Principle 3: Visibility

All public rolls that affect combat outcomes must be shown in the Telegram combat log in summarized form.

### Principle 4: Bounded Complexity

If a mechanic creates too much ambiguity for asynchronous chat resolution, it is excluded from v1.

### Principle 5: Admins Can Intervene in Process, Not Secretly Rewrite Rules

Admin actions must be auditable. A completed result should not be silently altered.

---

## 4. Supported Match Formats

### v1 Supported

- `1v1` duel

### Not Supported in v1

- `2v2`
- free-for-all
- summoned allies
- NPC assistance
- environmental hazards with custom logic

Those may be added later, but the engine contract for v1 is one combatant versus one combatant.

---

## 5. Match Lifecycle

### Step 1: Dispute Creation

A player challenges another player with a reason.

### Step 2: Acceptance

The target accepts or declines.

### Step 3: Snapshot Lock

When accepted, the engine snapshots:

- character stats
- class
- level
- max HP
- AC
- attack options
- spell/action list
- feature usage limits
- rules version

### Step 4: Initiative

Both combatants roll initiative and turn order is established.

### Step 5: Combat

Combat proceeds by rounds until:

- one combatant reaches 0 HP, or
- the round limit is reached

### Step 6: Resolution

Winner is declared by knockout or tie-break procedure.

### Step 7: Persistence

The match result, event log, and participant snapshots are stored.

---

## 6. Character Framework

### Supported Classes in v1

- Fighter
- Rogue
- Wizard
- Cleric

These four classes give a strong spread of archetypes while keeping implementation bounded.

### Level Range in v1

- supported levels: `1-3`
- recommended launch default: all new characters start at `level 1`

### Leveling Policy for v1

Recommended launch rule:

- characters do **not** level automatically during initial Alpha
- leveling can be turned on later after balance validation

If leveling is enabled later in v1:

- both winners and losers may gain progression equally
- the engine must use level snapshots per match

### Race / Species Policy

To keep the MVP small, use one of these approaches:

- **Option A, recommended:** no racial/species modifiers in v1
- **Option B:** allow a tiny approved list with prebuilt templates

The recommended rule for v1 is:

- characters are mechanically species-neutral
- race/species may exist as flavor text only

### Alignment

- flavor only
- no mechanical impact

---

## 7. Ability Scores and Modifiers

### Supported Abilities

All six standard 5e ability scores exist:

- Strength
- Dexterity
- Constitution
- Intelligence
- Wisdom
- Charisma

### Ability Score Generation

For v1, ability scores should come from **class starter templates**, not custom rolling or point-buy.

Reason:

- faster onboarding
- easier balancing
- less room for unfair optimization

### Ability Modifier Formula

Ability modifier follows standard 5e math:

`modifier = floor((score - 10) / 2)`

Examples:

- 8 -> -1
- 10 -> 0
- 12 -> +1
- 14 -> +2
- 16 -> +3

### Default Starter Array Policy

The engine should not require players to assign stats manually in v1.

Each class gets a predefined stat array. Example direction:

- Fighter: STR-focused, durable
- Rogue: DEX-focused, mobile
- Wizard: INT-focused, low HP
- Cleric: WIS-focused, balanced defense

Exact starter arrays should be stored in configuration, not hard-coded into Telegram text.

---

## 8. Derived Combat Stats

Each character snapshot must include or derive:

- level
- proficiency bonus
- max HP
- current HP at match start
- armor class
- initiative modifier
- speed
- attack bonuses
- damage bonuses
- save modifiers
- available actions
- limited-use resource counters

### Proficiency Bonus

Use standard 5e proficiency bonus by level:

- levels 1-4: `+2`

Since v1 only supports levels 1-3, proficiency bonus is always `+2`.

### Hit Points

HP follows class template configuration.

Recommended v1 policy:

- use fixed HP values by class and level
- do not roll HP on level-up in v1

### Armor Class

AC should be precomputed from:

- armor template
- dexterity modifier if applicable
- shield if applicable

To keep engine logic simple, snapshot the final AC value at match start.

### Speed

Speed exists for future extensibility but has no tactical map effect in v1.

It may be used only for:

- flavor
- deterministic tie-break logic later

For v1, speed does not alter turn economy.

---

## 9. Turn Structure

### Round Structure

Combat is organized into rounds.

Each round:

1. active combatant starts turn
2. engine resolves one chosen action
3. end-of-turn effects are applied
4. next combatant acts

### Turn Economy in v1

Each combatant gets:

- one action per turn

The following are not separately modeled in v1:

- bonus actions
- reactions
- object interactions
- movement positioning

If a class feature normally depends on bonus actions or reactions, it is either:

- excluded, or
- rewritten into a v1-compatible passive/limited-use rule

---

## 10. Initiative

### Initiative Roll

Each combatant rolls:

`1d20 + Dexterity modifier`

### Tie-Breakers

If initiative totals tie:

1. higher Dexterity score wins
2. if still tied, higher Constitution score wins
3. if still tied, reroll initiative between tied combatants

### Initiative Persistence

Initiative is rolled once at the beginning of the match and remains fixed for the whole fight.

---

## 11. Supported Actions

### Universal Actions in v1

Every class may have access to:

- `Attack`
- `Cast Spell` if that class has approved spells
- `Second Wind` for Fighter if available
- `Cunning Strike` is not supported
- `Dodge` only if explicitly enabled later

### Recommended Initial Action Set

To keep combat readable, the initial action set should be:

- one primary attack action per class
- one optional class feature action where appropriate
- one or two simple spells for Wizard and Cleric

### Not Supported in v1

- Grapple
- Shove
- Ready
- Help
- Disengage
- Dash
- Hide as a tactical state
- improvised actions
- opportunity attacks

If a feature relies on unsupported actions, it is not part of the v1 rules.

---

## 12. Attack Resolution

### Attack Roll

An attack roll is:

`1d20 + attack bonus`

### Hit Rule

If attack total is greater than or equal to target AC, the attack hits.

### Critical Hits

- natural 20 on attack roll = critical hit
- critical hit doubles the damage dice
- static modifiers are not doubled

Example:

- normal: `1d8 + 3`
- crit: `2d8 + 3`

### Natural 1

- natural 1 on attack roll = automatic miss
- no fumble table in v1

### Damage Floor

If damage is reduced below 0 by modifiers, minimum damage is `0`.

---

## 13. Damage Types and Resistances

### v1 Supported Damage Types

Track damage type in the event model for future growth, but do not build broad resistance systems into MVP unless a supported spell or feature requires it.

Recommended v1 types:

- slashing
- piercing
- bludgeoning
- force
- radiant

### Resistance / Vulnerability

Not supported in v1 unless a future class kit explicitly introduces one.

### Immunity

Not supported in v1.

---

## 14. Saving Throws

### When Saving Throws Are Used

Saving throws exist only for explicitly supported spells or effects.

### Save Formula

`1d20 + relevant save modifier`

### Spell Save DC

Use:

`8 + proficiency bonus + casting ability modifier`

### Success / Failure

- if total >= DC, the save succeeds
- otherwise the save fails

### Supported Save Types in v1

Only include save types needed by approved spells/effects, likely:

- Dexterity
- Wisdom
- Constitution

The engine should still support all six save modifiers in the snapshot model.

---

## 15. Conditions

### v1 Condition Policy

Conditions are heavily limited because they create complexity fast.

### Supported in v1

- none by default, or
- at most one simple temporary state such as `blessed` if added later

### Not Supported in v1

- prone
- restrained
- grappled
- stunned
- incapacitated
- blinded
- charmed
- frightened
- poisoned
- invisible

Recommended launch choice:

- **no persistent conditions in v1**

This keeps the first engine far easier to test and explain.

---

## 16. Spellcasting

### v1 Spellcasting Philosophy

Spellcasting is supported only in a very narrow, pre-approved form.

No freeform spell list selection in v1.

### Approved Spell Policy

Each spellcasting class gets a tiny fixed list of combat spells. Recommended examples:

- Wizard:
  - `Fire Bolt`
  - `Magic Missile`
- Cleric:
  - `Sacred Flame`
  - `Guiding Bolt`

These are examples of the intended shape. The final approved list should remain very small.

### Spell Slots

Spell slots should be tracked only for spells that consume them.

Recommended v1 behavior:

- cantrips are unlimited
- leveled spells use limited slots based on snapshot

### Concentration

Not supported in v1.

If a spell normally requires concentration:

- it is excluded from the approved v1 spell list

### Area of Effect

Not supported in v1 because combat is 1v1 and positionless.

### Upcasting

Not supported in v1.

### Counterspell / Reaction Magic

Not supported in v1.

---

## 17. Class Kits

These are mechanical archetypes, not full unrestricted class implementations.

### Fighter v1 Kit

Identity:

- highest survivability
- reliable weapon attacks
- simple self-sustain

Supported mechanics:

- melee weapon attack
- optional ranged attack if included in template
- `Second Wind` once per match

`Second Wind` rule:

- usable once per match
- heal `1d10 + level`
- costs the character's action for the turn

Not supported:

- Action Surge
- maneuvers
- fighting style selection if it adds branching complexity

### Rogue v1 Kit

Identity:

- high accuracy or burst potential
- lower durability

Supported mechanics:

- finesse/ranged attack
- Sneak Attack as a simplified rule

Recommended Sneak Attack rule for v1:

- once per turn on a hit, rogue deals extra damage
- no ally-adjacency requirement in 1v1
- trigger condition becomes:
  - first successful hit each round, or
  - hit while acting before opponent in round 1

The exact trigger must be explicit in implementation. Recommended option:

- **once per turn on the rogue's first hit**

This is simpler, though less faithful than full 5e.

Not supported:

- bonus-action Hide
- bonus-action Dash
- reactions like Uncanny Dodge in v1

### Wizard v1 Kit

Identity:

- low HP
- strong magical offense
- limited burst resources

Supported mechanics:

- one attack cantrip
- one guaranteed-hit or save-based leveled spell

Recommended spell pattern:

- `Fire Bolt`: attack roll, unlimited
- `Magic Missile`: automatic hit, limited by spell slots

Not supported:

- concentration spells
- battlefield control spells
- rituals
- summoning

### Cleric v1 Kit

Identity:

- balanced survivability
- radiant offense
- modest consistency

Supported mechanics:

- one attack cantrip or save-based radiant option
- one leveled radiant spell

Recommended spell pattern:

- `Sacred Flame`: target makes Dex save, unlimited
- `Guiding Bolt`: spell attack, limited by spell slots

Optional v1 addition:

- one self-heal spell if balance testing supports it

Not supported:

- concentration buffs
- healing other creatures in team combat
- summons

---

## 18. Recommended Starter Templates

These are recommended balance targets, not final values. Final numbers should live in configuration.

### Fighter Level 1

- high HP
- medium AC
- reliable weapon damage
- 1 use of Second Wind

### Rogue Level 1

- lower HP
- medium AC
- strong single-hit spike via Sneak Attack

### Wizard Level 1

- lowest HP
- low AC
- strong magic offense
- limited spell slots

### Cleric Level 1

- medium HP
- medium AC
- consistent magic damage

Recommended balance target:

- average match length should be `4-8 rounds`

That is short enough for Telegram while still feeling like a duel.

---

## 19. Round Limit and Tiebreak

### Hard Round Limit

Recommended hard limit:

- `10 rounds`

### If No Combatant Reaches 0 HP

Winner is determined in this order:

1. higher remaining HP percentage
2. if tied, higher total damage dealt
3. if tied, higher number of successful hits
4. if tied, one sudden-death round
5. if still tied after sudden-death round, repeat sudden-death until resolved

### Why Percentage Instead of Raw HP

HP percentage is fairer across classes with different base HP totals.

---

## 20. Death, Defeat, and Post-Match State

### In-Match Defeat

If a combatant reaches `0 HP`:

- they are defeated
- the opposing combatant wins immediately

### Death Saves

Not supported in v1.

Reason:

- they prolong matches without adding much arbitration value

### Post-Match Recovery

Characters are restored to full HP after the match ends.

Persistent injuries are not supported in v1.

### Respawn / Iteration Naming

If you want the thematic "Name II / Name III" system from earlier design notes, treat it as:

- presentation and history metadata
- not a core combat rule

It may be added later without changing engine behavior.

---

## 21. Randomness and Fairness

### RNG Source

All dice are generated server-side by the engine.

### Public Combat Rolls

These should appear in the public match log:

- initiative rolls
- attack rolls
- damage rolls
- saving throws
- healing rolls

### Hidden Rolls

No hidden combat-affecting rolls in v1.

### Fairness Requirement

The engine should be replayable from stored event data or deterministic roll history for auditing.

---

## 22. Telegram Presentation Rules

### Required Public Log Content

Each match log must expose enough information for a player to verify the result:

- round number
- acting combatant
- action used
- roll values
- modifiers
- target number or AC where relevant
- damage or healing result
- HP transitions
- match winner

### Compression Rules

To avoid spam:

- multiple low-level events may be grouped into one Telegram message
- storage must still preserve the granular event log

### Flavor Text

Flavor text may wrap a combat event, but must never obscure the numeric outcome.

Good:

> Captain Argot fires a deafening shot. `d20=15 + 5 = 20` vs AC `13`, hit for `1d10=7 + 3 = 10`.

Bad:

> Captain Argot lands a devastating blow.

---

## 23. Unsupported 5e Features in v1

The following are explicitly out of scope:

- multiclassing
- feats
- subclass choice beyond fixed kit behavior
- racial/species mechanics
- inventory management
- ammunition tracking
- encumbrance
- advantage/disadvantage as a general system
- concentration
- reactions
- bonus actions
- movement positioning
- flanking
- cover
- death saves
- grappling
- shove
- stealth state management
- summons
- familiars
- area control
- environmental interaction rules
- custom homebrew items
- attunement
- broad resistance/immunity systems

These can be added later only through explicit versioned rules changes.

---

## 24. Versioning Policy

### Rules Version

Every match must record a `rulesVersion`, for example:

- `arena-v1-alpha`
- `arena-v1-beta`
- `arena-v1-ga`

### Backward Compatibility

Historical matches are resolved only under the rules version captured at match creation.

### Balance Changes

If class kits or spells are adjusted:

- update configuration
- increment rules version
- do not retroactively reinterpret older matches

---

## 25. Admin Interventions

### Allowed Admin Interventions

Admins may:

- cancel a pending dispute
- retry a failed match job
- mark a match as errored
- finalize a failed match manually with a visible reason
- suspend abusive users

### Disallowed Silent Interventions

Admins must not:

- secretly alter completed dice outcomes
- silently swap winners on a completed healthy match
- modify stored snapshots without audit record

### Audit Requirement

Every intervention must record:

- who acted
- when
- why
- what changed

---

## 26. Implementation Notes

### Engine Input Contract

The engine should take:

- two participant snapshots
- rules configuration snapshot
- deterministic RNG source or seed/roll provider

### Engine Output Contract

The engine should return:

- winner
- match end reason
- ordered combat events
- final participant states
- summary data for public presentation

### Recommended Internal Event Types

- `match_started`
- `initiative_rolled`
- `round_started`
- `turn_started`
- `action_declared`
- `attack_rolled`
- `save_rolled`
- `damage_rolled`
- `healing_rolled`
- `hp_changed`
- `resource_spent`
- `match_ended`

---

## 27. Open Configuration Items

These values should be configurable, but locked per rules version:

- class starter stat arrays
- class HP by level
- class AC templates
- approved action lists
- approved spells
- spell slots by level
- round limit
- tie-break policy
- narration verbosity

---

## 28. Recommended Launch Defaults

If you want a concrete v1 starting point, use:

- format: `1v1`
- levels: `1 only`
- classes: Fighter, Rogue, Wizard, Cleric
- species: flavor only
- progression: off initially
- round limit: `10`
- Fighter feature: Second Wind once per match
- Rogue feature: simplified Sneak Attack once per turn on first hit
- Wizard spells: Fire Bolt, Magic Missile
- Cleric spells: Sacred Flame, Guiding Bolt
- no persistent conditions
- no concentration
- no reactions
- no bonus actions

These defaults are narrow, testable, and suitable for Alpha.

---

## 29. Future Expansion Candidates

After GA, likely expansion areas are:

- level progression to 3+
- team combat
- more class kits
- carefully added advantage/disadvantage
- a tiny conditions system
- subclass-flavored templates
- approved healing options
- limited equipment choices

Each of these should be added only through a new versioned rules spec.

---

## 30. Bottom Line

The v1 rules engine should feel like D&D, not attempt to contain all of D&D.

The correct first implementation is:

- 1v1 only
- four constrained class kits
- fixed templates
- visible rolls
- positionless turn-based combat
- small approved spell list
- no reactions, concentration, or tactical map logic

That ruleset is strong enough to power real arbitration while remaining realistic to implement, test, and operate.

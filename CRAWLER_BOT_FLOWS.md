# Crawler Bot Flows

## 1. Purpose

This document defines the Telegram user experience for the cooperative dungeon crawler mode.

It covers:

- command surface
- party formation
- run creation and resume
- room and choice presentation
- combat turn presentation
- loot and inventory interactions
- failure and recovery messaging

The crawler mode must feel:

- compact
- clear
- cooperative
- resumable

This is a Telegram-first UI contract, not a web UI spec.

---

## 2. UX Principles

### Principle 1: Buttons First

Crawler mode should use inline buttons for almost all state-changing actions.

Commands should start or recover flows, but not be the main way to operate inside runs.

### Principle 2: One Clear Prompt at a Time

At any given moment, the user should know:

- where the party is
- what happened last
- what choice is expected now

### Principle 3: Group for Shared Play, DM for Personal Management

Recommended split:

- group chats: party and run activity
- DM: inventory, equipment, detailed logs, and recovery prompts

### Principle 4: Resume Must Be Cheap

If a user disappears and comes back, `/run` should restore their current state quickly.

### Principle 5: Brevity Beats Completeness

Crawler logs must be readable in Telegram.

Detailed data belongs behind:

- “view details” style buttons
- follow-up messages
- admin panel

---

## 3. Recommended Commands

### Core Commands

- `/adventure`
- `/party`
- `/run`
- `/inventory`
- `/equipment`
- `/retreat`
- `/help`

### Optional Later Commands

- `/party_invite`
- `/party_leave`
- `/party_ready`
- `/loot`
- `/map`

For v1, prefer fewer commands and more buttons.

---

## 4. Chat Surface Rules

### Group Chat Use

Group chat should support:

- party creation
- party join
- ready state
- dungeon room prompts
- shared exploration choices
- public encounter summaries
- victory / wipe announcements

### DM Use

DM should support:

- detailed character inspection
- inventory management
- equipment changes
- consumable detail
- run resume
- personal notifications

### Recommended Hybrid Model

For v1 crawler mode:

- group chat is the canonical shared play surface
- DM is the personal management surface

This keeps co-op visible and social while preserving manageable menus.

---

## 5. Party Formation Flow

### Entry Point

User sends:

```text
/party
```

### Initial Response

If user is not already in a party:

- show:
  - `Create Party`
  - `Refresh`

If user is already in a forming party:

- show party summary and relevant actions

### Party Creation

When user taps `Create Party`:

1. bot validates character eligibility
2. bot creates party
3. bot adds creator as leader/member
4. bot posts party lobby card

### Party Lobby Card

Recommended content:

- party leader
- current members
- ready states
- current selected characters
- buttons:
  - `Join Party`
  - `Ready Up`
  - `Leave`
  - `Start Run`

### Start Restrictions

`Start Run` only available to leader and only when:

- all joined members are ready
- all characters are valid
- party size is within limits

---

## 6. Party Join Flow

### Join Path

In group chat:

- another user taps `Join Party`

### Expected Bot Behavior

1. validate user is eligible
2. validate user has a usable character
3. validate user is not already in another active party/run
4. add user to party
5. refresh lobby card

### Errors

Examples:

- “You need a character before joining a party.”
- “Your character is currently frozen.”
- “You are already in another active run.”
- “This party is no longer accepting members.”

---

## 7. Ready Flow

### Ready Up

In lobby:

- user taps `Ready Up`

Bot behavior:

- set member ready state
- refresh lobby summary

### Unready

Recommended v1 support:

- `Not Ready` toggle available before run start

### Leader Start

Once all members are ready:

- leader taps `Start Run`
- bot begins dungeon generation

---

## 8. Run Start Flow

### Bot Sequence

When run starts:

1. generate dungeon
2. create run state
3. mark party `in_run`
4. post run intro
5. show first room

### Run Intro Message

Recommended content:

- dungeon name or generated theme
- party roster
- floor count
- difficulty tier
- seed or short run id

Example structure:

```text
The party descends into the Ashen Vault.

Party:
- Aria the Fighter
- Moss the Cleric
- Vey the Wizard

Floors: 4
Difficulty: 1
Run ID: AV-17
```

---

## 9. Room Presentation Flow

### Standard Room Card

Every room prompt should show:

- floor number
- room number
- room type
- short room description
- current party health/status summary
- available actions

### Example

```text
Floor 1, Room 2
Treasure Room

A cracked stone chest rests beneath a faded mural. The air feels still.

Party:
- Aria 9/12 HP
- Moss 10/10 HP
- Vey 4/7 HP
```

Buttons:

- `Open Chest`
- `Inspect`
- `Move On`

### Room State Rule

Only one unresolved room prompt should be active per run at a time.

---

## 10. Exploration Choice Flow

### Choice Model

Recommended v1:

- the party leader makes final room decisions

Alternative later:

- party voting or approval windows

### Choice Confirmation

When a choice is made:

- the bot posts the result
- then posts the next room or encounter state

### Choice Types

Supported v1 examples:

- choose left / right path
- open chest
- inspect altar
- accept blessing
- decline bargain
- rest here

---

## 11. Encounter Start Flow

### Trigger

A combat room resolves into an encounter card.

### Encounter Card

Recommended content:

- encounter name or threat summary
- enemy list
- party list
- initiative or “rolling initiative” line

Example:

```text
Encounter: Crypt Ambush

Enemies:
- Skeleton Guard
- Skeleton Guard
- Grave Acolyte

Rolling initiative...
```

### Follow-Up

After initiative:

- post the round summary
- let the party choose whether to continue the fight or attempt a retreat before the next round

---

## 12. Combat Round Flow

### Round Prompt

The party receives:

- current party HP/resources
- visible enemy state summary
- buttons for round actions

### Recommended Action Buttons

- `Attack`
- `Vote Retreat`
- `Details`

### Target Selection

If an action needs a target:

- second message or updated buttons list valid targets

Example:

- `Target Skeleton Guard A`
- `Target Skeleton Guard B`
- `Target Grave Acolyte`

### Retreat Vote

Recommended v1:

- retreat requires a unanimous party vote
- when the final vote arrives, enemies get break-engagement attacks before the party escapes
- on success the party returns to the previous room with current HP preserved

### Round Timeout

Recommended v1:

- generous timeout with reminder
- admin recovery if truly stuck

Do not auto-play combat rounds too aggressively in early versions.

---

## 13. Encounter Summary Flow

At key moments the bot should post compact summaries:

- enemy defeated
- player defeated
- round transition
- encounter victory
- encounter failure

### Encounter Victory Message

Recommended structure:

```text
Encounter cleared.

Survivors:
- Aria 5/12 HP
- Moss 8/10 HP
- Vey 1/7 HP

Rewards:
- 18 gold
- Minor Healing Draught
```

### Encounter Failure Message

Recommended structure:

```text
The party has fallen.

Run failed on Floor 2, Room 4.

Banked rewards remain yours.
```

---

## 14. Loot Flow

### Loot Reveal

Loot should be shown as a reward scene, not silently applied.

Recommended:

- reward summary in group
- optional DM detail for affected player

### Loot Buttons

Examples:

- `Take Reward`
- `View Inventory`
- `Continue`

### Permanent Reward Rule

Once the bot posts a committed grant result, that reward should be treated as permanently owned unless an auditable admin correction happens later.

---

## 15. Inventory Flow

### Entry Point

User sends:

```text
/inventory
```

### DM Response

Recommended content:

- equipped items summary
- consumables summary
- recent new loot

Buttons:

- `Weapons`
- `Armor`
- `Accessories`
- `Consumables`
- `Back`

### Item Detail View

On selecting an item:

- show item name
- rarity
- effect summary
- ownership/source note
- buttons:
  - `Equip`
  - `Use`
  - `Back`

Only show valid actions for that item.

---

## 16. Equipment Flow

### Entry Point

User sends:

```text
/equipment
```

### Response

Show current loadout:

- weapon
- armor
- accessory

Buttons:

- `Change Weapon`
- `Change Armor`
- `Change Accessory`

### Equip Action

After item selection:

- confirm equip
- update equipment
- show revised character summary

Recommended v1:

- equipment changes allowed outside active encounters
- ideally blocked during active run combat turns

---

## 17. `/run` Resume Flow

### Purpose

`/run` should be the universal recovery command.

### If User Is In An Active Run

Bot restores:

- run title / floor / room
- party status
- whether the run is awaiting choice or in combat
- next relevant action prompt

### If User Is Not In A Run

Bot responds:

- “You are not currently in an active run.”
- buttons:
  - `Party`
  - `Adventure Help`

### If User Is Defeated But Party Still Lives

Bot should clearly state:

- the run is still active
- this character is out for the rest of the run
- rewards already banked remain safe

---

## 18. `/retreat` Flow

### Purpose

Let parties exit runs either from safe points or by unanimously breaking contact between combat rounds.

### Rule

Recommended v1:

- outside encounters, retreat still abandons the run
- during active encounters, retreat is only available between rounds and requires unanimous party action

### Confirmation

Bot should always ask for confirmation:

- `Confirm Retreat`
- `Stay in Run`

### Result

If confirmed:

- run ends as `abandoned` or `retreated`
- already banked rewards remain
- unresolved future content is lost

If attempted during combat:

- enemies make break-engagement attacks first
- on success the party returns to the previous room with current HP preserved
- if the party is dropped while escaping, the run fails

---

## 19. Failure and Recovery Messaging

The bot must clearly distinguish:

- player defeat
- party wipe
- temporary interruption
- admin recovery intervention

### Example Recovery Message

```text
This run hit an operational problem and has been paused for review.

Progress and banked rewards are preserved.
Use /run later to check status.
```

### Example Admin Intervention Message

```text
An administrator intervened to recover this run.

Reason: stuck encounter resolution
```

---

## 20. Notification Strategy

### Group Notifications

Use group chat for:

- party updates
- room prompts
- encounter summaries
- loot reveals
- run victory/failure

### DM Notifications

Use DM for:

- inventory/equipment detail
- personal reminders
- private error recovery messages
- character-specific loot details when needed

---

## 21. Logging and Detail Controls

Crawler mode should avoid dumping full encounter logs by default in the group.

Recommended:

- compact public summaries
- optional `View Details` button or DM detail message

This keeps long co-op runs readable.

---

## 22. Recommended Telegram UX MVP

The recommended crawler Telegram MVP is:

- `/party` to form group
- `/run` to resume active run
- leader-driven room choices
- button-first combat actions
- group room/encounter summaries
- DM inventory/equipment management
- `/retreat` from safe points
- clear defeat/success messages

---

## 23. Next Document

The strongest next planning doc is:

- `CRAWLER_ARCHITECTURE.md`

That should define how the current duel-oriented engine and runtime expand to support procedural runs, parties, encounters, and persistent progression without collapsing into an unmaintainable monolith.

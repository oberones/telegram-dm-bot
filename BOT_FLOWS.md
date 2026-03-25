# Telegram Bot Flows

## 1. Purpose

This document defines the Telegram user experience for the arbitration bot.

It specifies:

- supported commands
- conversation flows
- callback/button behavior
- session state expectations
- user-visible success and error handling

This is the UX contract for the player-facing Telegram surface. It should be read alongside:

- [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md)
- [RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/RULES_SPEC.md)
- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)

---

## 2. Product Assumptions

The Telegram bot is the only normal-user interface.

Players do not use the admin panel and do not need separate credentials. Identity comes from Telegram user ID.

The first production version is designed for:

- one active character per player
- 1v1 disputes only
- automated combat resolution
- short, readable flows with inline buttons where possible

---

## 3. Design Principles

### Principle 1: Keep Messages Short

Telegram flows should avoid walls of text. The bot should provide short prompts and move the user forward quickly.

### Principle 2: Prefer Buttons Over Memory

If the user can choose from a finite set of options, use inline buttons instead of requiring typed input.

### Principle 3: Typed Input Only When Necessary

Typed input should be used for:

- character name
- dispute reason

Everything else should prefer buttons.

### Principle 4: Flows Must Be Resumable

If a user disappears mid-flow, the bot should either:

- resume where they left off, or
- let them safely restart

### Principle 5: Show Outcomes, Not Just Flavor

Combat logs must always show the core dice and math behind the outcome.

---

## 4. Supported Commands in v1

### Core Commands

- `/start`
- `/help`
- `/create_character`
- `/character`
- `/record`
- `/history`
- `/dispute`
- `/accept`
- `/decline`
- `/forfeit`
- `/cancel`

### Admin Commands

No browser-admin workflows should depend on Telegram admin commands in v1.

If admin commands are ever added, they should remain minimal and not replace the web panel.

---

## 5. Global Behavior Rules

### Private Chat Requirement

Recommended behavior:

- character creation and account-specific flows happen in private chat with the bot
- dispute initiation may begin in private chat or group chat

If a user tries to run a private-only flow in a group:

- the bot should ask them to continue in DM

### One Active Session Per User

Each user may have at most one active wizard/session at a time, such as:

- character creation
- dispute creation

If they start a new flow while another is active:

- the bot should tell them what is in progress
- offer to resume or cancel it

### `/cancel`

`/cancel` aborts the current in-progress flow for that user.

It should:

- clear temporary session state
- not affect completed character data
- not cancel completed or running matches

### Unknown Input Handling

If the bot receives unexpected input during a flow:

- remind the user what step they are on
- repeat the valid options
- avoid silently failing

---

## 6. Player States

The bot should infer a user state for routing:

- `new_user`
- `no_character`
- `character_creation_in_progress`
- `ready`
- `dispute_creation_in_progress`
- `awaiting_dispute_response`
- `in_match`
- `suspended`

These states help determine what commands are valid and what guidance to show.

---

## 7. `/start` Flow

### Goal

Introduce the bot and direct the user to the next sensible action.

### Behavior

#### If user is new and has no character

Bot response should:

- greet user
- explain the bot in one or two sentences
- suggest creating a character

Suggested buttons:

- `Create Character`
- `Help`

#### If user already has a character

Bot response should:

- show a brief welcome back
- summarize character name/class/level
- suggest next actions

Suggested buttons:

- `View Character`
- `Start Dispute`
- `History`

### Example

> Welcome to the arena. You settle disputes by sending your character into a 5e-style duel.  
> You do not have a character yet.

Buttons:

- `Create Character`
- `Help`

---

## 8. `/help` Flow

### Goal

Explain what the bot does and list the core commands.

### Content

Keep it short:

- one sentence on arbitration via fantasy combat
- one sentence on fairness and visible dice
- command list

### Suggested Structure

> This bot resolves disputes through automated 1v1 fantasy combat using a simplified 5e-style ruleset. All important rolls are shown in the match log.

Commands:

- `/create_character`
- `/character`
- `/record`
- `/history`
- `/dispute`
- `/accept`
- `/decline`
- `/cancel`

---

## 9. Character Creation Flow

### Entry Points

The user can enter via:

- `/create_character`
- `Create Character` button from `/start`

### Preconditions

- user must not already have an active character
- user must not be suspended

If the user already has a character:

- bot explains that only one active character is supported in v1
- suggests `/character`

### Flow Steps

#### Step 1: Intro

Bot explains:

- they will create one arena character
- v1 uses fixed starter templates
- the process is short

Buttons:

- `Begin`
- `Cancel`

#### Step 2: Class Selection

Bot presents four class options:

- Fighter
- Rogue
- Wizard
- Cleric

Each button should include a short description in the message:

- Fighter: durable melee combatant
- Rogue: agile burst damage
- Wizard: fragile high-damage caster
- Cleric: balanced radiant caster

Buttons:

- `Fighter`
- `Rogue`
- `Wizard`
- `Cleric`

#### Step 3: Confirm Starter Template

After class selection, bot shows:

- class
- level
- short summary of combat style
- note that stats/loadout use a balanced starter build

Buttons:

- `Use This Class`
- `Pick Another`

#### Step 4: Name Entry

Bot prompts:

> Send the name you want your arena character to use.

Validation:

- required
- max length should be bounded, such as 30-40 chars
- no control characters
- no empty or whitespace-only names

If invalid:

- explain the issue
- ask again

#### Step 5: Final Review

Bot shows:

- character name
- class
- level
- key playstyle summary

Buttons:

- `Create Character`
- `Rename`
- `Start Over`

#### Step 6: Completion

Bot confirms character creation and suggests next steps.

Buttons:

- `View Character`
- `Start Dispute`

### Session State Needed

- selected class
- entered character name
- current wizard step

### Failure Cases

- user disappears mid-flow
- invalid name
- duplicate callback delivery
- persistence failure

Expected behavior:

- preserve progress where possible
- allow `/cancel`
- avoid creating duplicate characters

---

## 10. `/character` Flow

### Goal

Show the user their current character sheet in a compact, readable format.

### Content

Display:

- name
- class
- level
- max HP
- AC
- relevant attack/spell options
- current record summary

Keep the first version compact rather than fully sheet-like.

### Suggested Buttons

- `Record`
- `History`
- `Start Dispute`

### If No Character Exists

Bot response:

- explain they do not have a character yet
- offer creation

Buttons:

- `Create Character`

---

## 11. `/record` Flow

### Goal

Show a concise competitive summary for the player.

### Content

Display:

- wins
- losses
- total matches
- current level if progression is enabled
- most recent result

### Suggested Buttons

- `History`
- `View Character`

---

## 12. `/history` Flow

### Goal

Show recent disputes involving the player.

### Content

Display the most recent N matches, such as 5:

- opponent
- dispute reason
- result
- date

### v1 Recommendation

Keep this as a short text summary with optional buttons to page results later if needed.

### If No History Exists

Bot says:

- no completed matches yet

Buttons:

- `Start Dispute`

---

## 13. Dispute Creation Flow

### Entry Points

Primary entry:

- `/dispute`

Secondary entry:

- `Start Dispute` button

### Supported Invocation Styles

Recommended v1 support:

- `/dispute` starts guided flow
- `/dispute @username reason text here` may be supported later, but guided flow is safer for MVP

### Preconditions

Challenger must:

- have a character
- not be suspended
- not already be in an active match
- not already be in another dispute flow

Target must:

- exist in bot records or be identifiable via Telegram context
- have a character
- not be suspended
- not be in an active match

### Recommendation for v1

For the first version, guided flow is easiest and safest.

### Flow Steps

#### Step 1: Intro

Bot explains:

- disputes are 1v1
- the other player must accept
- combat is automated and logged

Buttons:

- `Choose Opponent`
- `Cancel`

#### Step 2: Opponent Selection

There are two viable designs:

##### Recommended MVP design

User forwards or replies to a message from the target in a shared group context, or starts from a group mention context.

##### Alternative

Ask for exact Telegram username.

The recommended approach is to avoid relying purely on mutable usernames. If username entry is used, the system must still resolve to a stable Telegram user ID before proceeding.

#### Step 3: Reason Entry

Bot prompts:

> What is the dispute about? Send a short description.

Validation:

- required
- bounded length, for example 200 chars
- sanitized before storage/display

#### Step 4: Confirmation

Bot shows:

- opponent
- dispute reason
- reminder that the opponent must accept

Buttons:

- `Send Challenge`
- `Edit Reason`
- `Cancel`

#### Step 5: Sent

Bot confirms the challenge was sent and that the target has been notified.

### Session State Needed

- target user ID
- target display name
- reason text
- current step

---

## 14. Challenge Notification and Response Flow

### Goal

Let the challenged player accept or decline cleanly.

### Notification Content

The target should receive:

- challenger name
- challenger character name
- their own character name
- dispute reason
- short explanation of what accepting means

### Suggested Buttons

- `Accept`
- `Decline`

### Acceptance Preconditions

Before starting the match, re-check:

- both characters still exist
- neither player is suspended
- neither is in another running match
- dispute is still pending

### Accept Result

If valid:

- lock snapshots
- create match
- begin execution

### Decline Result

If declined:

- mark dispute declined
- notify challenger
- notify target

### Expiry

Recommended v1 behavior:

- pending disputes expire automatically after a fixed window, such as 24 hours

On expiry:

- mark dispute expired/cancelled
- notify challenger on next interaction or proactively if desired

---

## 15. `/accept` and `/decline`

### Recommendation

Inline buttons should be the primary mechanism.

`/accept` and `/decline` exist as fallback commands in case:

- buttons fail
- Telegram client strips callback UI
- user wants a typed command path

### Behavior

If the user has exactly one pending incoming dispute:

- accept or decline that dispute

If the user has multiple pending disputes:

- bot asks them to choose which one

Buttons:

- one button per pending dispute

---

## 16. Match Start Flow

### Goal

Make it clear that the dispute has moved into combat.

### Start Message Content

Display:

- both character names
- player names
- dispute reason
- rules version or simplified rules label if desired
- "combat begins" signal

### Suggested Start Message

> Dispute accepted.  
> `Captain Argot LoVallo` vs `Elira Ashglass`  
> Reason: "Who gets final say on the tavern scene?"  
> The arena gates open.

---

## 17. Combat Log Flow

### Goal

Present automated combat in a way that is exciting but still auditable.

### Log Structure

Recommended structure:

1. initiative summary
2. round summaries
3. final result

### Initiative Message

Show:

- both initiative rolls
- resulting turn order

Example:

> Initiative:  
> Argot `d20=14 + 3 = 17`  
> Elira `d20=9 + 2 = 11`  
> Argot acts first.

### Round Summary Message

Each round or turn summary should show:

- acting character
- action used
- roll math
- hit/save outcome
- damage or healing
- HP transition

Example:

> Round 2  
> Argot attacks with Saber: `d20=15 + 5 = 20` vs AC `13`, hit.  
> Damage: `1d6=4 + 3 = 7`. Elira HP `12 -> 5`.

### Final Result Message

Show:

- winner
- final defeat or tie-break reason
- dispute reason

Example:

> Elira falls to 0 HP. `Captain Argot LoVallo` wins.  
> Dispute resolved: "Who gets final say on the tavern scene?"

### Message Batching

To reduce spam:

- one message per round is preferred over one message per atomic event
- internal storage should still preserve granular events

---

## 18. Match Failure and Recovery Messaging

### Goal

Avoid confusing silence when something breaks.

### User-Facing Failure Message

If a match cannot complete:

- acknowledge the issue
- say the match is being reviewed
- avoid exposing internal stack traces

Suggested wording:

> The match hit an internal error before completion. It has been flagged for review and no winner has been recorded yet.

### If Retried Successfully Later

Notify both users:

> Your earlier dispute has been re-run successfully. The result is now available.

---

## 19. `/forfeit` Flow

### Goal

Allow a user to concede when a valid pending or active dispute permits it.

### Recommended v1 Scope

Support forfeit only for:

- pending outgoing challenge withdrawal before acceptance, or
- self-forfeit before automated combat begins

Do not support mid-resolution manual interruption unless the domain model explicitly allows it.

### Behavior Options

Recommended safer v1 behavior:

- if dispute is pending and user is the challenger, `/forfeit` withdraws the challenge
- if user is already in a running automated match, `/forfeit` is not supported

This avoids race conditions during active execution.

### Suggested User Message

> You have no active challenge you can forfeit right now.

or

> Your pending challenge has been withdrawn.

---

## 20. `/cancel` Flow

### Goal

Cancel a wizard or in-progress bot conversation.

### Scope

`/cancel` should:

- exit character creation
- exit dispute creation
- clear temporary session state

`/cancel` should not:

- cancel accepted disputes
- cancel running matches
- delete completed data

### Response

> Your current bot flow has been cancelled.

If nothing is active:

> You do not have an active bot flow right now.

---

## 21. Group Chat Behavior

### Recommended v1 Position

Support group visibility for challenge context and match logs, but keep sensitive flows in private chat where possible.

### Recommended Rules

- `/start`, `/create_character`, `/character`, `/record`, `/history` should prefer private chat
- disputes may be initiated from a group context if that helps identify the target
- accepted match logs may be posted to the relevant chat if the dispute came from that chat

### Privacy Consideration

If the bot is used in groups:

- do not expose private account/session details unnecessarily
- keep personal state minimal in public messages

---

## 22. Session and Callback Design

### Session Requirements

Each active flow should track:

- user ID
- flow type
- step name
- partial form data
- expiration time
- last interaction time

### Callback Data Design

Inline button callback data should be:

- short
- versioned if needed
- unambiguous

Example shape:

- `cc:class:fighter`
- `cc:confirm`
- `dispute:accept:<id>`
- `dispute:decline:<id>`

### Expiration Handling

If a callback is pressed after the underlying session/dispute expired:

- bot should say the action is no longer valid
- offer the next sensible action

---

## 23. Validation Rules

### Character Name

- required
- trimmed
- bounded length
- no control characters
- may allow spaces and punctuation within reason

### Dispute Reason

- required
- trimmed
- bounded length
- sanitized for display

### User Eligibility Checks

Check for:

- suspension
- missing character
- active running match
- invalid target
- expired pending dispute

### Duplicate Event Protection

If Telegram retries the same update:

- do not create duplicate characters
- do not create duplicate disputes
- do not start the same match twice

---

## 24. Error Message Guidelines

### Tone

Messages should be:

- clear
- brief
- non-technical

### Good Error Characteristics

- explain what went wrong
- explain what the user can do next

### Examples

Good:

> You need a character before you can start a dispute.

Good:

> That challenge is no longer pending.

Bad:

> Database constraint violation.

Bad:

> Unknown error.

---

## 25. Suggested Copy Library

### No Character

> You do not have a character yet. Create one to enter the arena.

### Existing Active Flow

> You already have a flow in progress. You can resume it or cancel it first.

### Challenge Sent

> Your challenge has been sent. The other player must accept before combat begins.

### Challenge Declined

> Your challenge was declined. No match was created.

### Challenge Expired

> That challenge has expired.

### Match Error

> The match could not be completed and has been flagged for review.

---

## 26. Anti-Abuse Considerations

### Recommended v1 Guardrails

- rate limit repeated dispute creation
- prevent duplicate pending challenges between the same two users
- prevent self-challenges unless explicitly allowed later
- prevent users in active matches from starting new ones

### Suspended User Behavior

If suspended:

- block character/dispute actions
- provide a minimal message

Suggested wording:

> Your access to arena actions is currently restricted.

---

## 27. Accessibility and Readability

### Readability Rules

- keep messages compact
- avoid jargon unless needed
- show numbers clearly with consistent formatting
- separate flavor from mechanics

### Button Rules

- use short, obvious labels
- avoid too many buttons at once
- place destructive choices like `Cancel` clearly

---

## 28. MVP Flow Summary

The first fully supported player journey should be:

1. user starts bot
2. user creates character
3. user views character
4. user creates dispute
5. target accepts
6. bot runs match
7. both users can review result and history

If this journey is polished and reliable, the product is viable even before richer features arrive.

---

## 29. Future Flow Extensions

After MVP/GA, likely flow additions are:

- team battle setup
- richer match history browsing
- rematch flow
- opt-in challenge settings
- leveling notifications
- season/ranking summaries

These should be added only after the core flows are stable.

---

## 30. Bottom Line

The Telegram bot should behave like a concise guided referee:

- short prompts
- button-first flows
- typed input only for names and reasons
- clear state transitions
- visible combat math

If the bot remains simple and predictable, users will trust it more and the rest of the platform will be much easier to build and support.

# Alpha Test Plan

## Purpose

This document defines the first controlled Alpha test cycle for the Dungeon Master Bot.

The goal of Alpha is not scale. The goal is to exercise the real end-to-end product with a small trusted group and capture:

- product confusion
- rules complaints
- Telegram UX pain points
- operational failure modes
- recovery and moderation gaps

## Alpha Scope

Alpha should stay intentionally narrow:

- 3 to 10 trusted human testers
- DM and small-group usage only
- fixed starter classes only
- Docker deployment matching the target server shape
- one operator acting as admin during the test window
- no custom classes, teams, ladders, or progression systems

## Preconditions

Before opening Alpha:

- Phase 7 work is complete
- latest database migration applies from scratch
- admin bootstrap login works
- Telegram bot is reachable in the intended deployment mode
- backup and restore rehearsal has been completed
- operator has reviewed [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md)

## Test Group

Recommended participants:

- 1 primary operator
- 1 backup operator
- 3 to 8 trusted testers who are comfortable reporting bugs

Recommended tester mix:

- at least 1 user who is comfortable with Telegram but not with tabletop rules
- at least 1 user who knows D&D-style systems well
- at least 1 user who will deliberately try odd or annoying inputs

## Test Window

Recommended Alpha length:

- one focused preparation day
- one 3 to 7 day controlled test window
- one review session at the end of the window

## Core Scenarios

Every Alpha cycle should intentionally run all of these scenarios.

### 1. New User Creation

Steps:

1. a brand-new Telegram user opens the bot
2. they run `/start`
3. they create a character
4. they view `/character`, `/record`, and `/history`

Pass criteria:

- user provisioning succeeds
- character creation is understandable
- character summary is correct

### 2. Group Dispute Creation

Steps:

1. two users with characters join a test group
2. one challenges the other via `/dispute`
3. target accepts from DM
4. both users review the result

Pass criteria:

- targeting works from realistic Telegram flows
- acceptance is clear
- result log is readable

### 3. Dispute Decline

Steps:

1. create a new dispute
2. decline it
3. verify challenger notification
4. verify dispute status in admin

Pass criteria:

- decline path is clear to both users
- no match is created
- admin sees the correct status

### 4. Frozen Character Enforcement

Steps:

1. freeze a character in admin
2. attempt `/dispute` with that character
3. attempt acceptance against that character
4. verify admin audit entries

Pass criteria:

- frozen characters cannot start or accept disputes
- the user-facing copy is understandable
- audit log is present

### 5. Suspended User Enforcement

Steps:

1. suspend a user in admin
2. attempt create-character or dispute actions
3. verify rejection messaging
4. reactivate user and verify recovery

Pass criteria:

- restrictions are enforced consistently
- reactivation restores normal behavior

### 6. Recovery Queue

Steps:

1. inspect the Recovery tab
2. cancel a pending dispute through admin
3. verify user notifications
4. verify audit entry

Pass criteria:

- pending disputes can be resolved without DB edits
- users are notified
- audit log explains what happened

### 7. Match Recovery

Steps:

1. prepare or simulate a flagged match state
2. use admin finalize or cancel
3. verify participant notifications
4. verify audit entry and updated match status

Pass criteria:

- flagged matches can be closed without DB edits
- the final state is visible in admin

## Operator Checklist

Before the test window:

- confirm Docker images build cleanly
- confirm production-like Compose config is in use
- confirm admin login works
- confirm webhook or polling mode is configured intentionally
- confirm at least one backup exists

During the test window:

- monitor `/ready`
- watch admin dashboard and recovery tab
- review audit log after moderation or recovery actions
- log every notable issue in the bug backlog

After the test window:

- export or summarize key issues
- categorize issues by severity
- list rules/balance complaints separately from implementation bugs

## Bug Severity Model

Use this severity model during Alpha:

- `P0`: data loss, unrecoverable production failure, major security issue
- `P1`: core flow broken, wrong match state, incorrect moderation/recovery behavior
- `P2`: confusing UX, misleading copy, poor logs, inconsistent admin visibility
- `P3`: polish issue, small layout/copy annoyance, low-impact defect

## Feedback Template

For each Alpha issue capture:

- timestamp
- tester name
- environment
- scenario
- expected result
- actual result
- severity
- screenshots or copied Telegram log if relevant

## Exit Criteria For Alpha

Alpha can be considered complete when:

- every core scenario above has been run at least once
- no unresolved `P0` issues remain
- all `P1` issues are either fixed or have a clear mitigation
- operators can handle common failures without database surgery
- the next Beta priorities are clearly written down

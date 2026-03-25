# Operator Runbook

## Purpose

This runbook is for the human operator running the Dungeon Master Bot during Alpha.

It is intentionally practical. It focuses on the common things the operator needs to do without reaching for direct database edits.

## Core Responsibilities

During Alpha, the operator is responsible for:

- confirming the stack is healthy before testers start
- watching for failed or stuck disputes and matches
- handling moderation requests
- using the admin panel for recovery actions
- keeping a clear bug backlog
- preserving logs and backup discipline

## Pre-Session Checklist

Before opening the test window:

1. confirm Docker services are up
2. confirm the database migration step succeeded
3. confirm `GET /ready` is healthy
4. confirm Telegram delivery mode is set intentionally
5. confirm admin login works
6. confirm at least one fresh backup exists
7. confirm the Recovery tab and Audit Log tab load in admin

Recommended checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/api/session
```

## Normal User Support

Common questions and first responses:

- "I cannot create a character"
  Check whether the user is suspended, whether they already have an active or frozen character, and whether they are trying to do it in a group chat.

- "I cannot challenge someone"
  Check both users have active characters, neither user is suspended, and the target is already known to the bot.

- "The dispute never finished"
  Check the match in the admin Matches and Recovery views. If it is flagged, use the recovery tools instead of editing the database.

- "My character is gone"
  Check whether the character was retired, frozen, or replaced by a newly created one.

## Moderation Actions

Use the admin panel for these:

- suspend or reactivate a user
- freeze or unfreeze a character
- cancel a pending dispute
- cancel a flagged match
- finalize a flagged match with a winner

Rules:

- always enter a reason when prompted
- prefer the narrowest action that resolves the issue
- do not alter completed matches unless a recovery workflow explicitly supports it
- never bypass the admin UI with direct DB edits during Alpha unless recovery has failed completely

## Recovery Guidance

### Pending Dispute

Use dispute cancellation when:

- the dispute is clearly abandoned
- a tester targeted the wrong user
- a moderation issue makes the dispute inappropriate

Expected outcome:

- dispute becomes `cancelled`
- both users receive Telegram notice
- audit log records the action

### Running or Error Match

Use match cancel when:

- execution is clearly invalid
- the result should not stand
- you do not have a trustworthy winner

Use admin finalize when:

- one winner is clear from available evidence
- the match is stuck but should still be closed

Expected outcome:

- participants receive Telegram notice
- audit log records the action
- match leaves the flagged state

## When Not To Intervene

Do not intervene just because:

- a user dislikes the result
- a user thinks the dice were unlucky
- the combat log is long

Intervene when:

- the system is stuck
- the state is inconsistent
- moderation is required
- a documented recovery action is appropriate

## Audit Review

After any moderation or recovery action:

1. open the Audit Log tab
2. confirm the action appears with a reason
3. confirm the target entity and actor are correct
4. if it does not appear, log a bug immediately

## Backup Discipline

At minimum during Alpha:

- take a backup before major config or release changes
- take a backup before any manual rehearsal of recovery procedures
- keep the latest backup timestamp recorded in the bug backlog or session notes

Reference:

- [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md)

## Escalation Rules

Escalate immediately if:

- data appears missing unexpectedly
- multiple matches enter error/running states without operator action
- admin login fails unexpectedly
- recovery actions do not change system state
- audit logging stops reflecting actions

When escalating, capture:

- timestamp
- affected user IDs or match/dispute IDs
- exact operator action attempted
- screenshots or copied API responses

## End-Of-Day Checklist

At the end of an Alpha session:

1. review the Recovery tab for unresolved items
2. review the Audit Log for the session
3. summarize new bugs and classify severity
4. note any rules complaints separately from implementation bugs
5. confirm whether another backup is needed before shutdown

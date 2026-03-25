# Alpha Release Checklist

## Purpose

This checklist is the operator-facing readiness gate for starting the first Alpha test window.

Use it immediately before inviting testers. If any required item is unchecked, Alpha is not ready.

## Current Decision

- Decision: `GO`
- Recorded on: `2026-03-25`
- Basis: operator review completed, restore rehearsal confirmed, and current Alpha readiness checks accepted

## 1. Deployment Readiness

- [ ] `make test` passes on the release candidate
- [ ] Docker images build successfully for the target environment
- [ ] production-style Compose configuration is present and reviewed
- [ ] server starts successfully behind the intended nginx/Docker setup
- [ ] admin UI loads successfully in the target environment
- [ ] `GET /health` returns `200`
- [ ] `GET /ready` returns healthy with database `ok`

## 2. Configuration Readiness

- [ ] `APP_ENV` is set intentionally for Alpha
- [ ] `DATABASE_URL` points at the correct Alpha database
- [ ] `SESSION_SECRET` is set to a non-default secret
- [ ] `TELEGRAM_BOT_TOKEN` is the intended Alpha bot token
- [ ] `TELEGRAM_WEBHOOK_SECRET` is non-default if using webhook mode
- [ ] `TELEGRAM_DELIVERY_MODE` is set intentionally (`webhook` or `polling`)
- [ ] `ADMIN_BOOTSTRAP_EMAIL` is set
- [ ] `ADMIN_BOOTSTRAP_PASSWORD` is set to a non-default value

## 3. Database Readiness

- [ ] database migrations apply cleanly from scratch
- [ ] admin bootstrap login works against the target database
- [ ] users, disputes, matches, and audit logs can be queried through the admin UI
- [ ] no stale test data remains that would confuse Alpha results

## 4. Telegram Readiness

- [ ] bot responds to `/start` in DM
- [ ] bot responds to `/help` in DM
- [ ] bot can create a character in DM
- [ ] bot can show `/character`
- [ ] bot can delete a character via `/delete_character`
- [ ] bot responds correctly in the intended group-chat setup
- [ ] group dispute targeting works through reply or mention flows

## 5. Admin Readiness

- [ ] admin login works in browser
- [ ] dashboard loads
- [ ] users tab loads
- [ ] characters tab loads
- [ ] disputes tab loads
- [ ] matches tab loads
- [ ] audit log tab loads
- [ ] recovery tab loads
- [ ] suspend/reactivate user works
- [ ] freeze/unfreeze character works

## 6. Recovery Readiness

- [ ] pending dispute cancellation works from admin
- [ ] flagged match cancel works from admin
- [ ] flagged match finalize works from admin
- [ ] recovery actions create audit log entries
- [ ] recovery actions notify affected Telegram users

## 7. Auditability Readiness

- [ ] admin login creates audit log entries
- [ ] failed admin login attempts create audit log entries
- [ ] character creation creates audit log entries
- [ ] dispute creation creates audit log entries
- [ ] dispute acceptance/decline creates audit log entries
- [ ] match completion creates audit log entries
- [ ] moderation actions create audit log entries
- [ ] recovery actions create audit log entries

## 8. Backup and Restore Readiness

- [ ] latest backup exists
- [ ] backup location is known to the operator
- [ ] restore rehearsal has been completed successfully
- [ ] [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md) has been reviewed by the operator

## 9. Alpha Operations Readiness

- [ ] [ALPHA_TEST_PLAN.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ALPHA_TEST_PLAN.md) is reviewed
- [ ] [OPERATOR_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/OPERATOR_RUNBOOK.md) is reviewed
- [ ] [ALPHA_BUG_BACKLOG.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ALPHA_BUG_BACKLOG.md) is ready to receive issues
- [ ] tester list is defined
- [ ] operator and backup operator are identified
- [ ] Alpha start and stop window are scheduled

## 10. Go/No-Go

Alpha is a `GO` only if:

- all required technical checks are complete
- operator recovery paths are working
- audit visibility is working
- backup/restore readiness is confirmed

If any of those are not true, Alpha is a `NO-GO`.

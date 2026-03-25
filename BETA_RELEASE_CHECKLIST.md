# Beta Release Checklist

Use this checklist before cutting or deploying a Beta candidate.

## Release Identity

- [ ] version is set consistently in root and workspace `package.json` files
- [ ] `package-lock.json` reflects the same version metadata
- [ ] [CHANGELOG.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/CHANGELOG.md) includes the release notes or `Unreleased` notes are ready to promote
- [ ] deployment team knows the exact release identifier being shipped

## Validation

- [ ] `make test` passes on the release candidate
- [ ] local Docker stack starts successfully with `npm run docker:local:up`
- [ ] production-style Compose config renders cleanly with `npm run docker:prod:config`
- [ ] Telegram bot basic smoke paths were checked:
  - `/start`
  - `/create_character`
  - `/dispute`
  - `/accept`
  - `/record`
  - `/history`
- [ ] admin panel smoke paths were checked:
  - login
  - dashboard
  - disputes
  - matches
  - audit log
  - recovery

## Security and Secrets

- [ ] production `SESSION_SECRET` is set and not reused from local
- [ ] production `TELEGRAM_BOT_TOKEN` is correct for the target bot
- [ ] production `TELEGRAM_WEBHOOK_SECRET` is set
- [ ] `COOKIE_SECURE=true` in production config
- [ ] bootstrap admin credentials are intentionally set for the release window
- [ ] plan exists to rotate or disable bootstrap credentials after use if appropriate

## Database and Recovery

- [ ] migrations have been reviewed for the release
- [ ] backup completed before deployment
- [ ] restore procedure is still known and documented in [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md)
- [ ] operators know how to use dispute cancel and match recovery actions from the admin panel
- [ ] audit log is showing fresh entries in the target environment

## Deployment

- [ ] release env file is prepared and reviewed
- [ ] target server has the correct Docker Compose files
- [ ] nginx routing expectations are confirmed for server and admin
- [ ] rollback path is understood before deployment starts
- [ ] release notes or operator handoff notes are captured

## Go / No-Go

- [ ] no known blocker-level bugs remain open for this Beta cut
- [ ] no known data-corruption or duplicate-processing bugs remain open for this Beta cut
- [ ] operator or owner signs off on the release
- [ ] release is approved for deployment

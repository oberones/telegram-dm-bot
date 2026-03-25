# Release Process

This document defines the recommended release flow for Beta-era builds.

## Current Version Source

The canonical application version is tracked in:

- [package.json](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/package.json)
- [.cz.json](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/.cz.json)

Commitizen is configured to:

- bump the version
- update workspace version files
- update `CHANGELOG.md`
- create tags using the plain version number

## Pre-Release Validation

Before cutting a release:

```bash
make release-check
```

This runs:

- workspace typecheck
- engine tests
- db tests
- shared/config tests
- server tests
- production-style Compose config rendering
- production-style Docker image build

To print the current version:

```bash
make release-version
```

## Recommended Release Sequence

1. Make sure the working tree is in a good state.
2. Run:

```bash
make release-check
```

3. Review the release readiness docs:

- [BETA_RELEASE_CHECKLIST.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BETA_RELEASE_CHECKLIST.md)
- [DOCKER_DEPLOYMENT.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DOCKER_DEPLOYMENT.md)
- [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md)

4. Cut the version bump with Commitizen:

```bash
cz bump
```

If you want a specific increment level, use the Commitizen option you normally use for `patch`, `minor`, or `major`.

5. Re-run the validation after the bump:

```bash
make release-check
```

6. Commit and push the release commit and tag:

```bash
git push origin <branch>
git push origin --tags
```

## Docker Release and Deploy Flow

On the target server or deployment runner:

1. Ensure the release tag or commit is checked out.
2. Ensure `.env.compose.production` is present and reviewed.
3. Take a backup before deployment.
4. Build and deploy with:

```bash
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

5. Verify:

- `GET /health`
- `GET /ready`
- admin login
- Telegram bot smoke flow
- audit log is receiving fresh entries

## Rollback Reminder

If the release is unhealthy:

1. restore the previous git revision or release tag
2. rebuild and redeploy with the same production compose command
3. restore data only if the issue is data-corrupting and rollback alone is not enough

Use [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md) for database restoration.

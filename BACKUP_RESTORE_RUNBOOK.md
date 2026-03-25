# Backup and Restore Runbook

## Purpose

This runbook describes the minimum backup and restore procedure for the Dungeon Master Bot stack during Phase 7 and beyond.

The current production-critical asset is PostgreSQL. Application containers are rebuildable from source and configuration, but the database contains the authoritative state for:

- users
- characters
- disputes
- matches
- match events
- admin users and sessions
- audit logs

## Scope

This runbook covers:

- local Docker rehearsal on a workstation
- single-server Docker deployment backup expectations
- logical PostgreSQL backup and restore workflow
- verification steps after restore

This does not yet cover:

- point-in-time recovery
- offsite snapshot orchestration
- managed cloud backup providers

## Backup Policy

Minimum policy before Alpha:

- take at least one daily logical PostgreSQL backup
- keep at least 7 daily backups
- store backups outside the running container filesystem
- verify at least one restore rehearsal in a non-production environment

Recommended policy before GA:

- daily full logical backup plus more frequent snapshots if usage grows
- retain 30 daily backups and 12 monthly backups
- copy backups to a second host or object storage
- encrypt backups at rest

## Local Docker Backup

Assumptions:

- local stack is running with `compose.yaml` and `compose.local.yaml`
- database service name is `postgres`
- backup output will be written into `./backups`

Create the backup directory if needed:

```bash
mkdir -p backups
```

Create a logical dump:

```bash
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  pg_dump -U postgres -d dungeon_master_bot --no-owner --no-privileges \
  > backups/dungeon-master-bot-$(date +%Y%m%d-%H%M%S).sql
```

Optional compressed variant:

```bash
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  pg_dump -U postgres -d dungeon_master_bot --format=custom \
  > backups/dungeon-master-bot-$(date +%Y%m%d-%H%M%S).dump
```

## Production Backup

For the single-server Docker deployment, run the same logical backup pattern against the production `postgres` container.

Example:

```bash
mkdir -p /opt/dungeon-master-bot/backups

docker compose -f compose.yaml -f compose.production.yaml exec -T postgres \
  pg_dump -U postgres -d dungeon_master_bot --no-owner --no-privileges \
  > /opt/dungeon-master-bot/backups/dungeon-master-bot-$(date +%Y%m%d-%H%M%S).sql
```

Operational requirements:

- write backups to host storage, not inside the container
- rotate old backups with a simple retention policy
- copy backups off-host on a schedule

## Restore Rehearsal

Do not restore into the live production database as a first verification step.

Preferred rehearsal flow:

1. stop the app stack that talks to the rehearsal database
2. create a fresh PostgreSQL database
3. apply the restore into that fresh database
4. run migrations only if the backup predates the current schema
5. start the server and admin against the restored database
6. verify application-level integrity

### Local Restore Rehearsal

Create a fresh database inside the local `postgres` container:

```bash
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  psql -U postgres -c "DROP DATABASE IF EXISTS dungeon_master_bot_restore;"
```

```bash
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  psql -U postgres -c "CREATE DATABASE dungeon_master_bot_restore;"
```

Restore a SQL backup:

```bash
cat backups/<backup-file>.sql | \
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  psql -U postgres -d dungeon_master_bot_restore
```

Restore a custom-format backup:

```bash
cat backups/<backup-file>.dump | \
docker compose -f compose.yaml -f compose.local.yaml exec -T postgres \
  pg_restore -U postgres -d dungeon_master_bot_restore --no-owner --no-privileges
```

## Post-Restore Verification

Minimum checks after restore:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM characters;
SELECT count(*) FROM disputes;
SELECT count(*) FROM matches;
SELECT count(*) FROM match_events;
SELECT count(*) FROM audit_logs;
```

Application-level verification:

- `/ready` returns healthy against the restored DB
- admin login succeeds
- `/api/users`, `/api/disputes`, and `/api/matches` return expected data
- at least one historical match detail page loads in admin

Telegram-side verification in a rehearsal environment:

- create a new dispute
- accept or decline it
- confirm new audit rows and match/dispute rows are written normally

## Incident Guidance

Use restore when:

- database corruption is suspected
- destructive admin or migration error cannot be repaired safely in place
- host loss requires recovery on a different machine

Do not use full restore first when:

- a single dispute or match is stuck and can be handled through admin recovery tools
- a single user or character needs moderation changes
- the issue is limited to application deployment rather than data integrity

## Current Phase 7 Status

What is done:

- backup procedure is documented
- restore procedure is documented
- local and production command shapes are defined

What still must happen before calling restore fully validated:

- execute at least one full restore rehearsal against a non-production database
- record the exact backup filename, restore timestamp, and verification results
- update this runbook with any command fixes discovered during rehearsal

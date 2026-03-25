# Dungeon Master Bot

Dungeon Master Bot is a Telegram-first dispute arbitration system where users settle arguments by sending fantasy characters into automated 1v1 battles built on a bounded Dungeons & Dragons 5e-inspired ruleset.

Normal users interact through Telegram. Operators and moderators use a browser-based admin panel. The project is designed to run through Docker both locally and in production so workstation and server workflows stay aligned.

Current repo version: `0.11.0`

## Current Status

- Beta hardening is in progress.
- Alpha delivery, moderation, recovery, and backup/restore foundations are complete.
- Core Telegram flows, combat resolution, dispute lifecycle, admin auth, moderation actions, and recovery tooling are implemented.

## Product Summary

The current product supports:

- Telegram character creation using fixed starter class templates
- DM and group-chat bot flows
- Dispute creation, acceptance, and decline
- Automated match resolution with persisted event logs
- Record and history views for users
- Soft deletion of characters by retiring them
- Read-only and operational admin views for users, characters, disputes, matches, recovery state, and audit logs
- Admin moderation actions such as suspend/reactivate user and freeze/unfreeze character
- Admin recovery actions such as cancel pending dispute and cancel/finalize flagged match

## Repository Layout

```text
apps/
  admin/     React + Vite admin panel
  server/    Fastify API, Telegram ingress, admin API
packages/
  db/        PostgreSQL access, migrations, repositories
  domain/    Telegram/domain flows and business logic
  engine/    Deterministic combat engine
  shared/    Shared config and types
infra/
  nginx/     Admin nginx configuration
```

## Architecture

The system is a Docker-friendly modular monolith:

- `apps/server`: Fastify server for health checks, Telegram webhook ingress or polling, and admin API routes
- `packages/domain`: transport-agnostic domain logic for user flows, disputes, and summaries
- `packages/engine`: deterministic 1v1 combat engine
- `packages/db`: repository layer and SQL migrations for PostgreSQL
- `apps/admin`: React admin UI served by nginx

Supporting design documents:

- [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md)
- [ROADMAP.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ROADMAP.md)
- [RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/RULES_SPEC.md)
- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)
- [BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BOT_FLOWS.md)
- [ADMIN_PANEL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ADMIN_PANEL.md)
- [SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/SCHEMA.md)
- [DEPLOYMENT.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DEPLOYMENT.md)
- [DOCKER_DEPLOYMENT.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/DOCKER_DEPLOYMENT.md)

## Prerequisites

- Node.js 20+
- npm
- Docker with Compose support
- PostgreSQL only if you are running outside Docker
- A Telegram bot token from BotFather

For the intended workflow, use Docker locally and in production.

## Environment Configuration

The main application variables live in [.env.example](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/.env.example).

Important variables:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DELIVERY_MODE`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`
- `SESSION_SECRET`
- `COOKIE_SECURE`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_DISPLAY_NAME`
- `ADMIN_BOOTSTRAP_ROLE`

There are separate Compose-oriented example env files for local and production-style runs:

- `.env.compose.local.example`
- `.env.compose.production.example`

## Local Development

Install dependencies:

```bash
npm install
```

Run the server directly:

```bash
npm run dev:server
```

Run the admin app directly:

```bash
npm run dev:admin
```

Run migrations directly:

```bash
npm run migrate
```

## Docker Workflow

### Local

Create a local env file:

```bash
cp .env.compose.local.example .env.compose.local
```

Then start the full stack:

```bash
npm run docker:local:up
```

The local Docker stack includes:

- `postgres`
- `migrate`
- `server`
- `admin`

Default local endpoints:

- API: `http://localhost:3000`
- Admin: `http://localhost:8080`
- Postgres: `localhost:5432`

Local runs use Telegram polling by default so you can test with a real bot token without exposing a public webhook.

### Production-Style

Create a production env file:

```bash
cp .env.compose.production.example .env.compose.production
```

Review the rendered Compose config:

```bash
npm run docker:prod:config
```

Build production-style images:

```bash
npm run docker:prod:build
```

The production override keeps the same service shape, with environment differences for webhook delivery, secure cookies, and loopback-bound ports for host nginx.

## Makefile Shortcuts

The repo includes a Makefile for common tasks:

```bash
make install
make typecheck
make build
make test
make test-engine
make test-server
make migrate
make docker-local-build
make docker-local-up
make docker-local-down
make docker-prod-build
make docker-prod-config
```

`make test` is the main validation command. It runs:

- engine tests
- server tests
- workspace typecheck
- workspace build

## Bot Commands

Current user-facing Telegram commands:

- `/start`
- `/help`
- `/create_character`
- `/character`
- `/delete_character`
- `/record`
- `/history`
- `/dispute`
- `/accept`
- `/decline`
- `/cancel`

### Group Support

Current group behavior:

- `/start`, `/help`, and `/dispute` work in groups
- reply-based disputes are supported
- mention-based disputes are supported
- character creation and character management redirect users to DM

### Dispute Targeting

Supported dispute targeting styles:

- `/dispute @username reason`
- reply to a user with `/dispute reason`
- Telegram mention entities and text mentions

## Admin Panel

The admin panel currently supports:

- admin sign-in and sign-out
- dashboard counts
- users list
- characters list
- disputes list
- matches list
- match detail and event log views
- audit log view
- recovery view for pending disputes and flagged matches
- user suspension/reactivation
- character freeze/unfreeze
- dispute cancellation
- match cancellation/finalization

Bootstrap admin credentials come from your env file. In local examples, the defaults are:

- email: `admin@example.com`
- password: `change-me`

Change them before using a non-local environment.

## HTTP Endpoints

Current notable backend endpoints:

- `GET /health`
- `GET /ready`
- `POST /telegram/webhook`
- `GET /api/session`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/dashboard`
- `GET /api/users`
- `GET /api/characters`
- `GET /api/disputes`
- `GET /api/matches`
- `GET /api/matches/:id`
- operational admin mutation routes for recovery and moderation

## Testing

Current automated coverage includes:

- combat engine tests
- Telegram update handling tests
- Telegram webhook route tests
- admin API route tests
- recovery helper tests
- health/readiness route tests

Run everything:

```bash
make test
```

Run server tests only:

```bash
npm run test:server
```

Run engine tests only:

```bash
npm run test:engine
```

## Operations

Useful operational references:

- [ALPHA_RELEASE_CHECKLIST.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ALPHA_RELEASE_CHECKLIST.md)
- [BETA_RELEASE_CHECKLIST.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BETA_RELEASE_CHECKLIST.md)
- [OPERATOR_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/OPERATOR_RUNBOOK.md)
- [BACKUP_RESTORE_RUNBOOK.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BACKUP_RESTORE_RUNBOOK.md)
- [ALPHA_BUG_BACKLOG.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ALPHA_BUG_BACKLOG.md)
- [BETA_HARDENING_PLAN.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BETA_HARDENING_PLAN.md)

## Security Notes

Current security posture includes:

- hashed admin passwords
- hashed admin session tokens
- HTTP-only admin session cookies
- strict same-site admin cookies
- secure-cookie support in production-style config
- admin role checks on sensitive actions
- audit logging for moderation, recovery, login, logout, and failed login attempts
- webhook secret validation
- webhook idempotency tracking for duplicate Telegram updates

This is still a Beta-hardening project. Review the deployment and runbook docs before treating it as GA-ready.

## Known Limitations

- The combat ruleset is intentionally bounded and does not implement full 5e.
- The server is a modular monolith, not a horizontally scaled distributed system.
- Telegram delivery idempotency is now tracked at webhook ingress, but broader retry/reconciliation hardening is still part of Beta work.
- The admin panel is operationally useful, but not yet a full-featured back-office product.
- Production rollout and GA criteria are still governed by the roadmap and hardening docs.

## Recommended Next Steps

- Continue Beta hardening from [BETA_HARDENING_PLAN.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BETA_HARDENING_PLAN.md)
- Expand duplicate/retry coverage around disputes and match recovery
- Tighten admin session handling and security coverage further
- Run Beta test windows and log findings in [ALPHA_BUG_BACKLOG.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ALPHA_BUG_BACKLOG.md) or a Beta successor backlog

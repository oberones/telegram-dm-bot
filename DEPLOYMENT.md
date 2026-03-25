# Deployment Guide

## 1. Purpose

This document defines the deployment model for the Telegram arbitration bot from local development through GA.

It covers:

- runtime topology
- nginx routing
- environment variables
- process model
- database setup
- Telegram webhook configuration
- deployment workflow
- rollback and recovery expectations

It is the operational companion to:

- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)
- [SCHEMA.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/SCHEMA.md)
- [BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BOT_FLOWS.md)
- [ADMIN_PANEL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ADMIN_PANEL.md)

---

## 2. Deployment Goals

The deployment model should:

1. work cleanly on a single server behind nginx
2. support Telegram webhooks over HTTPS
3. isolate player-facing bot traffic from admin browser traffic
4. make rollout and rollback straightforward
5. support safe upgrades to rules, schema, and application code
6. provide enough observability for Beta and GA operations

---

## 3. Recommended Environment Model

Recommended environments:

- `local`
- `staging`
- `production`

### Local

Purpose:

- feature development
- engine testing
- schema iteration

### Staging

Purpose:

- deployment rehearsal
- webhook testing against non-production bot
- admin panel validation
- migration verification

### Production

Purpose:

- real users
- real disputes
- audited operational control

### Strong Recommendation

Use a separate Telegram bot token for staging if possible. Do not point staging deployments at the production bot.

---

## 4. Recommended Production Topology

### Core Components

Production should consist of:

- nginx
- backend application service
- admin frontend
- PostgreSQL
- optional worker service

### Baseline Topology

```text
Internet
  |
  v
nginx
  |-- /telegram/webhook -> backend app
  |-- /api              -> backend app
  |-- /health           -> backend app
  |-- /ready            -> backend app
  |-- /admin            -> admin frontend
  |
  v
backend app
  |
  +--> PostgreSQL
  |
  +--> optional worker
```

### Recommended Initial Shape

For MVP and early Beta:

- one server
- one Postgres instance
- one backend app process
- one admin frontend build served behind nginx
- optional separate worker process for match execution

This is enough to ship a robust first version.

---

## 5. Domain and TLS Requirements

### Required Public Access

The following must be publicly reachable over HTTPS:

- Telegram webhook endpoint
- admin panel login and API, if remote admins need access

### TLS

Requirements:

- valid HTTPS certificate
- TLS termination at nginx
- HTTP redirected to HTTPS

### Suggested URL Layout

Recommended production URL model:

- `https://your-domain.example/telegram/webhook`
- `https://your-domain.example/api/...`
- `https://your-domain.example/admin`

Alternative:

- separate admin subdomain if desired

Recommended for simplicity:

- single domain with path-based routing

---

## 6. nginx Routing Model

### Responsibilities of nginx

nginx should:

- terminate TLS
- route requests to backend/admin services
- serve static admin assets if desired
- enforce basic request size/time limits
- provide clean path separation

### Recommended Routes

- `/telegram/webhook`
- `/api/`
- `/admin`
- `/health`
- `/ready`

### Routing Strategy

Recommended:

- backend app listens on local port, such as `3000`
- admin frontend served as static assets by nginx or by backend

### Recommended MVP Deployment Choice

Serve the built admin frontend as static files from nginx.

Benefits:

- simpler runtime
- fewer moving parts
- faster admin page loads

The backend remains responsible for `/api`.

---

## 7. Example nginx Shape

This is conceptual, not final production config.

```nginx
server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.example;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location /telegram/webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }

    location /ready {
        proxy_pass http://127.0.0.1:3000;
    }

    location /admin {
        root /var/www/dungeon-master-bot;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

### Notes

- exact static path handling depends on frontend build structure
- admin asset caching can be tuned later
- access restrictions for `/admin` may be added with nginx if desired

---

## 8. Application Process Model

### Required Processes

For production, the application should run as:

- `server` process
- optional `worker` process

### Server Process Responsibilities

- Telegram webhook handling
- API routes
- admin auth
- health/readiness endpoints
- orchestration of domain workflows

### Worker Process Responsibilities

- execute queued match jobs
- retry or recover background tasks
- run cleanup jobs later if desired

### Recommended MVP Options

#### Option A: Single Process

- one backend app handles everything

Good for:

- earliest MVP

Tradeoff:

- less resilient around long-running or retryable workflows

#### Option B: Server + Worker

- backend app receives webhooks/API
- worker executes match jobs

Good for:

- serious Alpha/Beta
- better operational recovery

### Recommendation

Aim for `server + worker` by Beta, even if Alpha starts with a single process.

---

## 9. Process Supervision

### Requirements

Processes should:

- restart automatically on crash
- log to a central place
- start on boot

### Acceptable Options

- `systemd`
- `pm2`
- container orchestrator later if needed

### Recommendation

On a single Linux server, `systemd` is the cleanest default.

Suggested units:

- `dungeon-master-bot-server.service`
- `dungeon-master-bot-worker.service`

---

## 10. Build and Artifact Strategy

### Backend

Recommended:

- compile TypeScript to production JS
- deploy built artifact plus production dependencies

### Admin Frontend

Recommended:

- build static assets
- publish them to a versioned deploy directory
- have nginx serve current assets

### Build Outputs

Suggested structure:

```text
/opt/dungeon-master-bot/
  releases/
    2026-03-25T120000Z/
      server/
      admin/
  current -> /opt/dungeon-master-bot/releases/<release>/
```

This symlink-based release model makes rollbacks easier.

---

## 11. Environment Variables

### Core App Variables

Recommended minimum env set:

- `NODE_ENV`
- `APP_ENV`
- `PORT`
- `APP_BASE_URL`
- `ADMIN_BASE_URL`

### Telegram Variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`

### Database Variables

- `DATABASE_URL`

### Admin Auth Variables

- `SESSION_SECRET`
- `COOKIE_DOMAIN` if needed
- `COOKIE_SECURE=true` in production

### Optional Worker / Queue Variables

- `QUEUE_DRIVER`
- `REDIS_URL` if Redis is introduced later

### Observability Variables

- `LOG_LEVEL`
- `SENTRY_DSN` or equivalent if used

### Operational Controls

- `DEFAULT_RULES_VERSION`
- `DISABLE_NEW_DISPUTES=false`

### Notes

- keep secrets out of the repo
- use environment-specific secret storage
- document all env vars in one canonical place once implementation starts

---

## 12. Database Deployment

### Database Choice

Recommended:

- PostgreSQL for staging and production

### Production Expectations

- dedicated DB user for the app
- regular backups
- migration history preserved
- TLS/network restrictions as appropriate for your server setup

### Migration Rules

Every deployment that changes schema should:

1. back up first if risk justifies it
2. run migrations before switching traffic if needed
3. verify readiness after migration

### Strong Recommendation

Do not hand-edit production schema outside migration tooling except in emergencies.

---

## 13. Telegram Webhook Configuration

### Recommended Mode

Use Telegram webhooks in staging and production.

### Webhook Endpoint

Point Telegram to:

- `https://your-domain.example/telegram/webhook`

### Secret Verification

Use Telegram's webhook secret mechanism and verify it server-side on every request.

### Deployment-Time Steps

When deploying a new environment:

1. ensure nginx route is live over HTTPS
2. ensure backend webhook endpoint is healthy
3. register or update webhook with Telegram
4. verify test update delivery

### Important Safety Rule

Do not switch the production bot webhook to a new deployment until:

- migrations are complete
- backend is healthy
- env vars are confirmed

---

## 14. Health and Readiness Endpoints

### `/health`

Purpose:

- process liveness

Should answer:

- application is running

### `/ready`

Purpose:

- dependency readiness

Should answer success only when:

- database connection is available
- rules/config load is valid
- queue backend is available if required for current mode

### Usage

- nginx/systemd/monitoring can use these endpoints
- `/ready` should gate production confidence more than `/health`

---

## 15. Logging and Monitoring in Deployment

### Logging Requirements

Production logs should include:

- startup/shutdown events
- request errors
- Telegram webhook processing failures
- match execution failures
- admin login and auth failures

### Log Destinations

Acceptable early setups:

- journald via `systemd`
- file logs with rotation

Recommended:

- structured stdout/stderr captured by `systemd` or process supervisor

### Monitoring Requirements

At minimum monitor:

- process uptime
- `/health`
- `/ready`
- DB availability
- webhook error rate
- count of failed matches

---

## 16. Deployment Workflow

### Recommended Release Sequence

For a normal production deploy:

1. build backend artifact
2. build admin frontend
3. create new release directory
4. place artifacts and config references
5. run DB migrations
6. restart or reload backend process
7. restart worker if used
8. switch nginx/static symlink if needed
9. run smoke checks
10. verify webhook and admin login

### Smoke Checks

Recommended post-deploy checks:

- `/health` returns success
- `/ready` returns success
- admin login works
- Telegram webhook receives a test update
- match creation path can be exercised in staging or controlled prod validation

---

## 17. Rollback Strategy

### Application Rollback

If the issue is application-only and schema-compatible:

- point `current` symlink back to prior release
- restart processes
- verify health

### Schema Rollback

Schema rollbacks are more sensitive.

Preferred strategy:

- use backward-compatible migrations where possible
- avoid destructive schema changes in a single step
- if destructive changes are necessary, back up first and plan rollback explicitly

### Rules Rollback

Rules should be versioned independently.

If a rules problem occurs:

- set a safer rules version active for new matches
- do not reinterpret old matches

---

## 18. Backup and Restore

### Backup Requirements

Production backups should cover:

- PostgreSQL database
- env/secret recovery procedure
- deployed build artifacts or reproducible build path

### Database Backup Frequency

Recommended baseline:

- daily full backups
- more frequent logical or snapshot backups if activity justifies it

### Restore Testing

GA should require at least one tested restore rehearsal.

### What Matters Most

The most sensitive data to preserve is:

- users
- characters
- disputes
- matches
- match snapshots
- audit logs

---

## 19. Security in Deployment

### Server Hardening Basics

Recommended:

- firewall only required ports open
- SSH hardened
- app processes run as non-root user
- secrets readable only by app user

### Admin Panel Protection

Recommended options:

- app-level auth only
- app-level auth plus nginx IP allowlist for extra protection

### Secret Handling

Do not:

- commit secrets to git
- place secrets in frontend bundles
- expose secrets in logs

### Cookies and Sessions

In production:

- secure cookies only
- HttpOnly cookies
- SameSite policy chosen intentionally

---

## 20. Staging Workflow

### Goals

Staging should behave like production as closely as possible, with separate secrets and bot identity.

### Recommended Staging Differences

- separate Telegram bot token
- separate domain or path
- separate database
- non-production admin accounts

### Required Staging Uses

- test migrations
- test new rules versions
- test admin flows
- test match execution changes

Staging exists to catch mistakes before production, not just to host a demo.

---

## 21. Local Development Deployment Notes

### Local Stack

Recommended local components:

- local backend server
- local admin frontend dev server
- local PostgreSQL

### Telegram in Local

Options:

- use long polling temporarily in dev if helpful
- or use a tunneling setup for webhook testing

### Important Boundary

Production should still standardize on webhooks even if local development uses a different convenience mode.

---

## 22. Release Readiness Checklist

Before a production release, confirm:

- migrations reviewed
- env vars present
- secrets updated if needed
- backend build succeeds
- admin build succeeds
- release notes captured
- rollback path identified
- health checks defined
- staging verification completed

### Before Enabling Production Webhook

Confirm:

- correct domain
- correct TLS
- correct webhook secret
- backend endpoint reachable

---

## 23. Suggested File and Directory Layout on Server

One reasonable layout:

```text
/opt/dungeon-master-bot/
  releases/
  shared/
    env/
    logs/
  current

/var/www/dungeon-master-bot/
  admin/

/etc/systemd/system/
  dungeon-master-bot-server.service
  dungeon-master-bot-worker.service

/etc/nginx/sites-available/
  dungeon-master-bot.conf
```

Exact paths are flexible, but keeping releases and shared state separate is helpful.

---

## 24. Future Scaling Path

If the product grows, scale in this order:

1. move to dedicated worker process if not already present
2. add Redis-backed queue if DB-backed jobs become limiting
3. tune Postgres indexes and queries
4. split admin/frontend hosting if useful
5. only then consider service extraction

The first bottlenecks are likely operational clarity and job reliability, not raw CPU.

---

## 25. Operational Non-Goals

This deployment plan does not require:

- Kubernetes
- multiple app servers at launch
- CDN complexity beyond standard static serving
- service mesh
- distributed tracing from day one

Those can wait unless real usage proves they are necessary.

---

## 26. Recommended Initial Deployment Decisions

For the first serious implementation, use:

- single Linux server
- nginx as ingress and static asset server
- Node.js backend on localhost port
- PostgreSQL
- `systemd` process supervision
- path-based routing on one domain
- webhook mode in staging and production
- separate staging and production bot tokens

This is enough to reach GA if operated carefully.

---

## 27. Bottom Line

The deployment model should stay boring on purpose: one server, nginx, PostgreSQL, a backend app, and a small admin frontend.

That setup is stable, easy to reason about, and compatible with the product’s real needs. The most important operational habits are:

- protect secrets
- version releases cleanly
- treat migrations carefully
- verify health before switching webhook traffic
- keep rollback and restore practical, not theoretical

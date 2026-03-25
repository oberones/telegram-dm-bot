# Docker Deployment Strategy

## 1. Purpose

This document explains the Docker-first deployment model for the project.

The goal is to keep local and production as close as practical by using:

- the same images
- the same service graph
- the same migration path
- the same Compose base file

Only configuration and exposure mode should differ between environments.

---

## 2. File Layout

The Docker deployment model uses:

- [compose.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.yaml)
  - shared stack definition
- [compose.local.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.local.yaml)
  - workstation overrides
- [compose.production.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.production.yaml)
  - target server overrides
- [Dockerfile.server](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/Dockerfile.server)
  - backend and migration image
- [Dockerfile.admin](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/Dockerfile.admin)
  - admin UI image

---

## 3. Shared Service Topology

Both local and production use the same core services:

- `postgres`
- `migrate`
- `server`
- `admin`

The intended lifecycle is:

1. Postgres becomes healthy
2. migration container runs
3. server starts
4. admin starts

---

## 4. Local Workflow

Local stack:

```bash
docker compose -f compose.yaml -f compose.local.yaml up --build
```

Uses:

- polling mode
- open host ports
- local env file

Env file:

- `.env.compose.local`

---

## 5. Production Workflow

Production stack:

```bash
docker compose -f compose.yaml -f compose.production.yaml up -d --build
```

Uses:

- webhook mode
- loopback-bound app/admin ports
- production env file
- host nginx for TLS termination and reverse proxy

Env file:

- `.env.compose.production`

---

## 6. Why This Matches Your Goal

This setup keeps the provisioning model aligned across workstation and target server:

- same DB container
- same migration container
- same backend image
- same admin image
- same internal Docker network relationships

Differences are intentionally limited to:

- bot token
- secrets
- public URLs
- Telegram delivery mode
- host port exposure

---

## 7. Current Caveat

The current server image runs the backend from TypeScript source using `tsx`.

That is acceptable for parity because both local and production can run the same image, but it is still not the final ideal production posture.

The next hardening step should be:

- compile the backend and migration entrypoints into stable runtime artifacts
- keep the same Compose model
- swap only the server image runtime command

That will preserve parity while making production leaner and more conventional.

---

## 8. Bottom Line

You now have a Docker strategy that is meaningfully aligned between local and server use.

The next refinement is not to redesign Compose again, but to improve the internals of the server image while keeping the same deployment shape.

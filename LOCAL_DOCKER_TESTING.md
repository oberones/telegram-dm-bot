# Local Docker Testing on macOS

## 1. Purpose

This guide explains how to run the app end to end on a macOS workstation using Rancher Desktop with Docker API compatibility.

The local stack now uses the **same base Compose definition** as the target server, with only a local override for:

- open host ports
- polling mode instead of webhooks
- local-facing URLs

That gives you much better parity with the production deployment model.

---

## 2. Compose Model

The Docker setup is split into:

- [compose.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.yaml)
  - shared base stack for all environments
- [compose.local.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.local.yaml)
  - local workstation overrides
- [compose.production.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.production.yaml)
  - target server overrides

This means local and production use:

- the same services
- the same images
- the same migration flow
- the same internal network model

The only intended differences are environment/config values and exposure mode.

---

## 3. Services in the Shared Stack

The shared stack provisions:

- `postgres`
- `migrate`
- `server`
- `admin`

### Service Roles

- `postgres`
  - application database
- `migrate`
  - runs schema migrations before app startup
- `server`
  - Telegram bot backend and API
- `admin`
  - browser admin UI

---

## 4. Local vs Production Differences

### Local

Defined by [compose.local.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.local.yaml):

- exposes Postgres on `5432`
- exposes server on `3000`
- exposes admin on `8080`
- runs Telegram in `polling` mode

### Production

Defined by [compose.production.yaml](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/compose.production.yaml):

- server binds to `127.0.0.1:3000`
- admin binds to `127.0.0.1:8080`
- Telegram runs in `webhook` mode
- intended to sit behind host nginx

---

## 5. Important Telegram Note

Local Docker testing uses:

- `TELEGRAM_DELIVERY_MODE=polling`

That means the local bot process will call `deleteWebhook` for the configured bot token.

Use a separate local testing bot token unless you intentionally want to take over a deployed bot.

---

## 6. First-Time Local Setup

### Step 1: Create the Local Env File

```bash
cp .env.compose.local.example .env.compose.local
```

### Step 2: Fill in Required Values

At minimum:

- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET`

You can usually leave the Docker `DATABASE_URL` alone because the shared stack already points the app at the internal `postgres` service.

---

## 7. Start the Local Stack

Use either:

```bash
docker compose -f compose.yaml -f compose.local.yaml up --build
```

or:

```bash
npm run docker:local:up
```

If you want a clean image rebuild:

```bash
docker compose -f compose.yaml -f compose.local.yaml build --no-cache
docker compose -f compose.yaml -f compose.local.yaml up
```

---

## 8. What Should Happen

1. `postgres` becomes healthy
2. `migrate` runs the SQL migrations and exits successfully
3. `server` starts
4. `admin` starts
5. the backend begins polling Telegram

---

## 9. Local URLs

Once running:

- backend health: [http://localhost:3000/health](http://localhost:3000/health)
- backend readiness: [http://localhost:3000/ready](http://localhost:3000/ready)
- admin UI: [http://localhost:8080](http://localhost:8080)

---

## 10. First Telegram Test

Recommended flow:

1. send `/start`
2. send `/create_character`
3. choose a class button
4. send a character name
5. send `/character`

Also test:

- `/cancel` while character creation is active

---

## 11. Verify the Database

To inspect Postgres:

```bash
docker exec -it dungeon-master-bot-postgres psql -U postgres -d dungeon_master_bot
```

Useful queries:

```sql
select id, telegram_user_id, display_name, status from users;
select id, user_id, name, class_key, level, status from characters;
select id, user_id, flow_type, status, step_key from bot_sessions order by created_at desc;
select version from schema_migrations;
```

---

## 12. Stop and Reset

Stop containers:

```bash
docker compose -f compose.yaml -f compose.local.yaml down
```

Stop and delete DB volume:

```bash
docker compose -f compose.yaml -f compose.local.yaml down -v
```

or:

```bash
npm run docker:local:down
```

---

## 13. Why This Is Better Than the Earlier One-Off Local File

This setup is closer to production because local and server environments now share:

- one base Compose topology
- one database provisioning model
- one migration job
- one application container model

That means local validation is much more representative of the target deployment.

---

## 14. Bottom Line

If you run:

```bash
cp .env.compose.local.example .env.compose.local
npm run docker:local:up
```

you are now exercising essentially the same Docker stack shape that the target server will use, with only local-specific config differences layered on top.

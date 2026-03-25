# Proposal: Telegram Arbitration Bot with 5e Combat and Web Admin

## 1. Product Summary

Build a Telegram-first arbitration platform where disputes are resolved by fantasy characters fighting under Dungeons & Dragons 5e-inspired rules.

The experience has two surfaces:

- **Telegram bot for normal users**
  - Character creation and management
  - Starting and accepting disputes
  - Watching combat unfold in chat
  - Viewing records, rankings, and match history
- **Web admin panel for operators**
  - Manage users, characters, matches, and rules
  - Review logs and resolve edge cases
  - Configure bot behavior and combat presets

You already have:

- an nginx server suitable for TLS termination and reverse proxying
- a Telegram bot token ready for integration

That makes a webhook-based production deployment the right default.

---

## 2. Goals

### Primary Goals

1. Let users resolve disputes entirely from Telegram.
2. Make outcomes feel fair, legible, and auditable.
3. Use recognizable 5e structure without requiring players to know the whole ruleset.
4. Give admins a browser-based control surface for moderation and operations.

### Product Principles

- **Telegram is the main user interface.**
- **All important rolls are visible.**
- **Admins can override process, not secretly rig outcomes.**
- **The rules engine should be deterministic from stored state plus recorded dice rolls.**
- **The MVP should be narrow and reliable before it becomes deep.**

---

## 3. Recommended Scope

### MVP

- Telegram login by identity only; no separate user passwords for players
- One active character per Telegram user
- 1v1 disputes first
- Optional team battles later
- 5e-inspired combat using a constrained rules subset
- Admin panel for review, support, and configuration
- Persistent duel history and audit logs

### Explicitly Out of Scope for MVP

- Full character sheet parity with every 5e class/subclass/spell
- Freeform player-controlled tactical combat
- Live battle maps
- Complex inventory management
- Homebrew automation beyond admin-entered templates

This keeps the first version buildable.

---

## 4. User Experience

### Player Flow in Telegram

1. User starts the bot with `/start`.
2. Bot checks whether they already have a character.
3. If not, bot walks them through a guided creation flow.
4. User starts a dispute, for example:
   - `/dispute @other_user Who gets final say on the tavern scene?`
5. Opponent accepts or declines.
6. Bot snapshots both combatants and runs the match.
7. Bot posts a readable combat log with dice, modifiers, damage, conditions, and winner.
8. Match result is stored and visible later through `/history`, `/record`, or `/character`.

### Admin Flow in Browser

Admins can:

- search users and characters
- inspect active and past disputes
- review battle logs and raw dice rolls
- approve or reject edge-case character edits
- manage rules presets and balance knobs
- pause the bot or disable new disputes
- settle broken matches if a job fails mid-combat

---

## 5. Rules Model: 5e, But Operationally Safe

This project should use **5e-compatible structure**, not the entire tabletop game in unrestricted form.

### Recommendation

Use a **curated 5e combat subset** based on the 5.1 SRD and your own platform rules:

- standard 6 ability scores
- proficiency bonus
- armor class
- initiative
- attack rolls
- weapon damage
- hit points
- saving throws where needed
- a small, approved list of actions, conditions, features, and spells

### Why This Is Better Than "Full 5e" for MVP

- Full 5e is too broad for a Telegram-first UX.
- A constrained ruleset is easier to explain and audit.
- It avoids giant implementation complexity around reactions, spell targeting, edge-case timing, and exotic features.
- It still feels authentically D&D to users.

### Legal / Content Note

If you want published 5e mechanics and content in production, build from the **5.1 SRD / CC-BY material** and your own original content. Avoid copying non-SRD commercial rule text into the app or admin panel.

---

## 6. Game Design Recommendation

### Character Model

Each user has:

- Telegram identity
- display name
- one active combat character
- progression record
- win/loss history

### MVP Character Choices

Keep class choice constrained at launch:

- Fighter
- Rogue
- Wizard
- Cleric

Each class gets:

- a predefined starter build
- a small set of valid actions
- a tiny spell/action list if applicable

This gives variety without making adjudication explode.

### Match Formats

- `1v1` for MVP
- `2v2` later
- `free-for-all` only after the engine is stable

### Match Resolution

Recommended default:

- best-of-one arena combat
- hard round limit, such as 10 rounds
- if no knockout, winner determined by:
  1. remaining HP
  2. total damage dealt
  3. sudden-death tiebreak round

That prevents endless stalemates.

---

## 7. Functional Requirements

### Telegram Bot

- `/start`
- `/help`
- `/create_character`
- `/character`
- `/record`
- `/history`
- `/dispute @user [reason]`
- `/accept`
- `/decline`
- `/forfeit`

### Character Management

- Create one character per Telegram user
- Guided creation flow with validation
- Restrict edits between matches
- Persist a rules snapshot for each match so later changes do not rewrite history

### Match System

- Create dispute request
- Verify both parties are eligible
- Require acceptance
- Lock participant sheets at match start
- Run combat server-side
- Post readable round-by-round output to Telegram
- Store full event log

### Admin Panel

- Dashboard with current service state
- Users and character browser
- Match queue and active match monitor
- Audit log viewer
- Rules configuration
- Manual intervention tools

### Logging and Auditability

Store:

- inbound Telegram command events
- accepted dispute reason
- combat snapshots
- RNG outputs
- action-by-action battle log
- admin interventions

This is critical because arbitration systems fail socially if people think results are opaque.

---

## 8. Technical Architecture

### Recommended Stack

- **Backend:** Node.js + TypeScript
- **Bot framework:** `grammY`
- **Web server / API:** Fastify
- **Admin UI:** React + Vite
- **Database:** PostgreSQL
- **ORM:** Prisma or Drizzle
- **Queue / jobs:** BullMQ + Redis, or a simpler DB-backed job runner for MVP

### Why This Stack

- TypeScript gives one language across bot, engine, and admin panel.
- `grammY` is strong for Telegram bot workflows and middleware.
- Fastify is lightweight and production-friendly.
- PostgreSQL is safer than SQLite once you have concurrent bot traffic plus admin actions.
- A queue protects long-running battles and retry logic.

### Deployment Topology

1. nginx terminates HTTPS.
2. nginx routes:
   - `/telegram/webhook` -> backend bot/API service
   - `/admin` -> admin frontend
   - `/api` -> backend API
3. Backend validates Telegram webhook traffic.
4. Backend writes to PostgreSQL.
5. Background worker executes battle jobs and retries safely.

### Alternative for Fastest MVP

If you want the smallest first deploy:

- single Node.js service
- PostgreSQL
- no Redis initially
- battle execution inline or via a DB table job loop

That is acceptable if traffic is low.

---

## 9. System Components

### A. Telegram Bot Layer

Responsibilities:

- parse commands and callback actions
- guide users through conversations
- enforce permissions
- send combat logs and notifications

### B. Arbitration Engine

Responsibilities:

- validate combatants and rules
- create immutable match snapshot
- roll dice
- resolve turns, attacks, damage, saves, and conditions
- produce machine-readable combat events and Telegram-friendly narration

This engine should be independent from Telegram so it can be tested and reused by the admin panel.

### C. Admin API

Responsibilities:

- admin auth and session handling
- CRUD for users, characters, rule presets, and disputes
- dashboards and audit endpoints
- manual resolution endpoints

### D. Admin Frontend

Responsibilities:

- operational visibility
- editing approved fields
- support workflows
- incident handling

---

## 10. Data Model

### Core Entities

```ts
type User = {
  id: string
  telegramUserId: string
  telegramUsername?: string
  displayName: string
  role: "player" | "admin"
  status: "active" | "suspended"
  createdAt: Date
  updatedAt: Date
}

type Character = {
  id: string
  userId: string
  name: string
  class: "fighter" | "rogue" | "wizard" | "cleric"
  level: number
  abilityScores: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
  maxHp: number
  armorClass: number
  speed: number
  proficiencyBonus: number
  loadout: Json
  rulesVersion: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

type Dispute = {
  id: string
  initiatedByUserId: string
  reason: string
  status: "pending" | "accepted" | "declined" | "running" | "completed" | "cancelled" | "error"
  createdAt: Date
  updatedAt: Date
}

type Match = {
  id: string
  disputeId: string
  rulesVersion: string
  status: "queued" | "running" | "completed" | "error"
  winnerCharacterId?: string
  startedAt?: Date
  completedAt?: Date
}

type MatchParticipant = {
  id: string
  matchId: string
  characterId: string
  snapshot: Json
}

type MatchEvent = {
  id: string
  matchId: string
  round: number
  sequence: number
  eventType: string
  payload: Json
  publicText: string
  createdAt: Date
}

type AuditLog = {
  id: string
  actorUserId?: string
  actorType: "system" | "player" | "admin"
  action: string
  targetType: string
  targetId: string
  payload: Json
  createdAt: Date
}
```

### Important Design Rule

Never compute historical match results from the current live character sheet. Store a participant snapshot at match start.

---

## 11. Admin Authentication

Because the user-facing product is Telegram-only, the admin panel can use a separate auth flow.

### Recommendation

- Admin accounts live in your app database.
- Login via email + passwordless link or a strong local auth provider.
- Put the admin panel behind nginx and only expose it over HTTPS.
- Consider an IP allowlist if the operator set is tiny.

If you already use a reverse proxy and server you control, this is straightforward.

---

## 12. Battle Presentation in Telegram

Telegram messages should be concise enough to read but detailed enough to trust.

### Suggested Message Pattern

- Match start summary
- Initiative result
- One short update per turn or one compact summary per round
- Match result and reason

Example:

> Round 2: Captain Argot attacks. `d20=14 + 5 = 19` vs AC `13` -> hit.  
> Damage: `1d6=4 + 3 = 7`. Elira HP `12 -> 5`.

For longer fights, batch multiple combat events into a single message to avoid spamming chat rate limits.

---

## 13. Operational Concerns

### Reliability

- Use Telegram webhooks behind nginx
- Verify webhook secret/token
- Make match execution idempotent
- Use DB transactions around state changes
- Keep admin overrides fully logged

### Security

- Validate every Telegram identity by user ID, not username alone
- Sanitize all admin-entered text
- Protect the admin panel with strong auth and CSRF-safe session handling
- Rate limit bot commands to prevent abuse

### Observability

- structured application logs
- error tracking
- health endpoint for nginx and uptime monitoring
- admin-visible failed job list

---

## 14. MVP Build Plan

### Phase 1: Foundation

- Create Node.js/TypeScript service
- Add Telegram webhook integration
- Add PostgreSQL schema
- Add admin auth scaffold
- Add nginx route plan

### Phase 2: Character System

- Guided character creation in Telegram
- Starter class templates
- `/character` and `/record`
- Admin list/detail pages for users and characters

### Phase 3: Match Engine

- Dispute request and acceptance flow
- Immutable match snapshots
- Basic 1v1 5e subset combat
- Telegram battle narration
- Match history

### Phase 4: Admin Operations

- Dashboard
- Match inspection
- Retry/cancel/finalize tools
- Rules preset editor

### Phase 5: Hardening

- Tests for combat resolution
- Audit logs
- rate limiting
- health checks
- production deployment docs

---

## 15. Suggested Directory Layout

```text
apps/
  bot/
  admin/
packages/
  engine/
  db/
  shared/
infra/
  nginx/
docs/
```

If you want to keep it smaller, a single app plus internal modules is fine for MVP. The key separation is between:

- Telegram transport
- combat engine
- admin API/UI

---

## 16. Biggest Risks

### 1. Rules Explosion

If you promise "full 5e," implementation complexity jumps immediately. Solve this by publishing a narrow supported rules list.

### 2. Perceived Unfairness

If users cannot see why they lost, they will distrust the system. Solve this with visible rolls, snapshots, and logs.

### 3. Admin Abuse Concerns

If admins can silently alter outcomes, the platform loses legitimacy. Solve this by making interventions explicit and auditable.

### 4. Telegram UX Friction

Multi-step flows can get messy in chat. Solve this with inline buttons, short prompts, and resumable sessions.

---

## 17. Recommended First Build Decision

If we start implementation, the best first version is:

- Node.js + TypeScript
- `grammY` bot
- Fastify API
- PostgreSQL
- React admin panel
- webhook deployment behind nginx
- 4 supported starter classes
- 1v1 arena combat only
- curated 5e subset using SRD-compatible mechanics

That is ambitious enough to be useful and still small enough to finish.

---

## 18. Immediate Next Steps

1. Confirm the MVP rules scope:
   - full 5e simulation is not recommended
   - curated 5e subset is recommended
2. Pick the initial class list and whether leveling is in v1.
3. Define the admin roles:
   - super admin only
   - or operator + moderator split
4. Turn this proposal into:
   - database schema
   - API routes
   - Telegram command flows
   - deployment config

---

## 19. Bottom Line

Yes, this is a very buildable project with your current setup.

The right architecture is a Telegram-first bot backed by a TypeScript service, PostgreSQL, a reusable combat engine, and a lightweight browser admin panel behind nginx. The most important product decision is to implement a **bounded 5e rules subset** rather than unrestricted full 5e from day one.

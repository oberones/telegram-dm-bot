# Architecture: Telegram Arbitration Bot

## 1. Purpose

This document defines the target technical architecture for the Telegram arbitration bot through MVP, Beta, and GA.

It translates the product direction in [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md) and the engine contract in [RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/RULES_SPEC.md) into:

- service boundaries
- runtime responsibilities
- data ownership
- deployment topology
- operational behavior
- scaling and hardening direction

This architecture is optimized for:

- Telegram-first product usage
- browser-based admin operations
- deterministic combat resolution
- maintainability by a small team

---

## 2. Architectural Goals

The system should:

1. Keep the combat engine independent from Telegram and the admin UI.
2. Provide a reliable webhook-based Telegram integration behind nginx.
3. Make every match auditable and replayable from stored state plus roll history.
4. Give admins enough browser tooling to operate the service without direct database edits.
5. Stay simple enough to build iteratively on a single server, then evolve if traffic grows.

---

## 3. High-Level Architecture

### Core Runtime Components

The recommended system has five core parts:

1. **Telegram Bot Interface**
   - receives Telegram updates
   - parses commands and button callbacks
   - manages player-facing flows
   - sends match summaries and results back to Telegram

2. **Application API**
   - owns business workflows
   - validates permissions and state transitions
   - serves admin panel data
   - exposes internal endpoints for operations and health

3. **Combat Engine**
   - resolves matches from immutable snapshots and rules configuration
   - produces structured combat events and summary output
   - contains no Telegram or browser concerns

4. **Persistence Layer**
   - stores users, characters, disputes, matches, events, rules versions, and audit logs
   - guarantees historical match stability through snapshot storage

5. **Admin Panel**
   - browser UI for operators and moderators
   - reads and manages app state through the Application API

### Supporting Infrastructure

- **nginx** for HTTPS termination and request routing
- **PostgreSQL** for primary storage
- **optional worker process** for background match execution
- **structured logging and monitoring** for operations

---

## 4. Recommended Deployment Model

### Production Topology

Recommended production layout:

```text
Internet
  |
  v
nginx
  |-- /telegram/webhook  -> backend app
  |-- /api               -> backend app
  |-- /admin             -> admin frontend
  |-- /health            -> backend app
  |
  v
Backend App
  |-- Telegram workflow handlers
  |-- business logic / API
  |-- auth/session handling
  |
  v
PostgreSQL

Optional:
Backend Worker
  |-- match execution jobs
  |-- retries / recovery helpers
```

### Why This Model Fits Your Setup

You already have nginx and a Telegram bot token, so webhook delivery is a natural fit.

Benefits:

- Telegram can reach the app through a stable HTTPS endpoint
- nginx can isolate admin paths from bot paths
- the same backend can initially serve both bot and admin APIs
- a worker can be added later without redesigning the product

---

## 5. Monolith First, Clean Boundaries Always

### Recommended Build Strategy

Build this initially as a **modular monolith**, not a microservice system.

That means:

- one backend deployable
- one database
- one admin frontend
- optional separate worker process using the same codebase

### Why a Modular Monolith Is Correct Here

- traffic is likely low to moderate at launch
- the domain is still evolving
- engineering overhead is lower
- deployment is simpler on a single server
- you still get clean boundaries inside the codebase

### Required Internal Separation

Even in a monolith, the code should be separated into modules with strict boundaries:

- `bot` transport logic
- `api` route handlers
- `domain` application workflows
- `engine` combat resolution
- `db` persistence
- `auth` admin auth/session handling
- `shared` types/config/errors

This keeps future extraction possible if needed.

---

## 6. Proposed Codebase Layout

Recommended top-level structure:

```text
apps/
  server/
  admin/
packages/
  engine/
  db/
  domain/
  shared/
infra/
  nginx/
docs/
```

### `apps/server`

Responsibilities:

- Fastify server bootstrap
- Telegram webhook endpoint
- REST or RPC API routes
- admin auth endpoints
- health and readiness endpoints
- orchestration of domain services

### `apps/admin`

Responsibilities:

- React admin panel
- login UI
- dashboards
- list/detail views
- moderation and recovery tools

### `packages/engine`

Responsibilities:

- pure combat engine
- class kits and rules resolution
- event generation
- deterministic RNG abstraction
- engine tests

### `packages/db`

Responsibilities:

- schema
- migrations
- typed models
- repository helpers
- transaction helpers

### `packages/domain`

Responsibilities:

- business workflows
- user provisioning
- character creation orchestration
- dispute lifecycle
- match execution coordination
- audit logging helpers

### `packages/shared`

Responsibilities:

- shared types
- env parsing
- constants
- error models
- serialization helpers

---

## 7. Service Boundaries and Responsibilities

### A. Telegram Bot Interface Layer

This layer should know:

- Telegram update structure
- command parsing
- callback payload formats
- message composition rules

This layer should **not** know:

- low-level database schema
- combat resolution internals
- admin auth/session logic

The bot layer should call domain services such as:

- `startCharacterCreation(user)`
- `createDispute(challenger, target, reason)`
- `acceptDispute(disputeId, userId)`
- `getCharacterSheet(userId)`

### B. Domain Layer

The domain layer is the product brain.

It should:

- validate business rules
- enforce state transitions
- coordinate DB access
- invoke the combat engine
- create audit logs
- expose clean workflows to both bot and admin APIs

The domain layer should **not** care whether it was called from Telegram or the browser.

### C. Combat Engine Layer

The engine should accept:

- participant snapshots
- rules snapshot
- RNG provider

And return:

- winner
- end reason
- ordered event stream
- final states
- summary payload

The engine should **not** perform:

- DB reads/writes
- network calls
- Telegram formatting
- admin permission checks

### D. Persistence Layer

The DB package should expose:

- repositories for core entities
- transaction boundaries
- mapping from stored JSON/config to typed snapshots

It should avoid embedding business logic that belongs in domain workflows.

### E. Admin Panel Layer

The admin frontend should:

- call API endpoints only
- never access the database directly
- show audit visibility for sensitive actions

---

## 8. Runtime Request Flows

### Flow 1: New Telegram User Creates Character

```text
Telegram User
  -> Telegram sends webhook update
  -> nginx routes /telegram/webhook to backend
  -> bot handler parses command
  -> domain provisions user if needed
  -> character creation session state is stored
  -> bot sends next prompt
```

Key architectural notes:

- Telegram user ID is the stable identity key
- creation progress should be resumable
- session state should be stored server-side

### Flow 2: Player Starts a Dispute

```text
Player command
  -> bot handler validates syntax
  -> domain checks user eligibility
  -> domain creates pending dispute
  -> bot notifies challenged user
```

### Flow 3: Challenge Accepted and Match Starts

```text
Opponent accepts
  -> bot handler calls domain
  -> domain verifies eligibility again
  -> domain snapshots both characters + rules version
  -> domain creates match record
  -> domain executes or enqueues match
  -> engine resolves combat
  -> events stored
  -> bot posts summary/result
```

### Flow 4: Admin Reviews Failed Match

```text
Admin opens /admin
  -> frontend loads failed matches from API
  -> admin inspects snapshots, events, logs
  -> admin retries or cancels
  -> domain performs action + audit logging
  -> updated state reflected in dashboard
```

---

## 9. Match Execution Model

### Recommended MVP Model

Use one of two execution approaches:

#### Option A: Inline Execution

When a dispute is accepted:

- backend creates match
- backend immediately runs engine in the request lifecycle or a controlled async continuation

Advantages:

- fewer moving parts
- easiest first implementation

Tradeoffs:

- less resilient if process restarts mid-match
- harder to retry safely if execution is tightly coupled to webhook handling

#### Option B: Background Job Execution

When a dispute is accepted:

- backend creates match in `queued` state
- worker picks up the match
- worker runs engine
- worker persists event log and result

Advantages:

- cleaner retry model
- safer under restart conditions
- better separation of responsibilities

Tradeoffs:

- requires a job model and worker process

### Recommendation

For a serious arbitration system, **Option B is preferable**, even if implemented simply with a database-backed queue before Redis/BullMQ is introduced.

---

## 10. Data Ownership and Persistence Strategy

### Source of Truth

PostgreSQL is the source of truth for:

- users
- characters
- disputes
- matches
- participant snapshots
- match events
- admin users
- audit logs
- rules versions

### Snapshot Strategy

Historical correctness depends on snapshotting.

At match creation, store:

- character mechanical state
- action list
- resources
- rules version/config

Do not recompute old matches from live class definitions or current user profiles.

### Event Storage Strategy

Store event logs as structured records, not only formatted text.

Each event should include:

- event type
- round
- sequence number
- actor
- target if applicable
- machine-readable payload
- optional public narration text

This allows:

- Telegram rendering
- admin inspection
- debugging
- replay tooling later

---

## 11. API Architecture

### API Style

Use a clean JSON API for the admin panel and internal orchestration.

Possible patterns:

- REST
- lightweight RPC-style endpoints

Either is fine. The critical thing is keeping workflows explicit and permissions consistent.

### Recommended Endpoint Groups

#### Public/Internal Bot Endpoints

- `POST /telegram/webhook`
- `GET /health`
- `GET /ready`

#### Admin Auth Endpoints

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`

#### Admin Data Endpoints

- `GET /api/users`
- `GET /api/users/:id`
- `GET /api/characters`
- `GET /api/characters/:id`
- `GET /api/disputes`
- `GET /api/disputes/:id`
- `GET /api/matches`
- `GET /api/matches/:id`
- `GET /api/audit-logs`

#### Admin Action Endpoints

- `POST /api/disputes/:id/cancel`
- `POST /api/matches/:id/retry`
- `POST /api/matches/:id/finalize`
- `POST /api/users/:id/suspend`
- `POST /api/characters/:id/freeze`

### API Design Rule

Actions with side effects should be explicit endpoints rather than hidden behind generic updates.

That improves auditability and keeps admin operations safer.

---

## 12. Authentication and Authorization

### Player Authentication

Players authenticate implicitly through Telegram identity.

Trust boundary:

- stable Telegram user ID, not username

No separate web login is required for players in v1.

### Admin Authentication

Admins use a separate browser auth flow.

Recommended model:

- local admin accounts in the application DB
- passwordless email login or strong password + session auth
- secure cookies
- CSRF protection where applicable

### Authorization Model

Recommended initial roles:

- `super_admin`
- `operator`
- `moderator`

Suggested scope:

- `super_admin`: full access
- `operator`: retry/cancel/finalize operational workflows
- `moderator`: user suspension and dispute moderation, but limited system config access

### Authorization Enforcement

Authorization belongs in domain and API layers, not only in the frontend.

---

## 13. State Management Strategy

### Character Creation Sessions

Telegram onboarding flows need temporary state.

Recommended storage:

- database-backed session table, or
- Redis later if needed

Requirements:

- resumable
- expires automatically
- tied to Telegram user ID

### Match State

Matches should move through explicit states, for example:

- `pending`
- `accepted`
- `queued`
- `running`
- `completed`
- `declined`
- `cancelled`
- `error`

Transitions should be enforced centrally in domain services.

### Idempotency

Telegram may resend updates. Handlers must be safe against duplicate delivery.

Recommended patterns:

- update deduplication table
- transactionally guard state transitions
- idempotent match enqueue behavior

---

## 14. Combat Engine Architecture

### Engine Shape

The engine should be a pure or near-pure module with clear inputs and outputs.

```ts
resolveMatch({
  rules,
  participants,
  rng,
}): MatchResolutionResult
```

### Internal Engine Submodules

Recommended structure:

- `rules/`
- `classes/`
- `actions/`
- `dice/`
- `resolution/`
- `events/`
- `validation/`

### Engine Responsibilities

- validate input snapshots
- roll initiative
- determine turn order
- choose or resolve class actions
- apply hit/miss logic
- apply save logic
- update HP/resources
- determine winner
- emit ordered event stream

### Decision Logic

In v1, action selection should be deterministic based on class kit logic and available actions.

Examples:

- Wizard casts highest-priority available legal spell
- Fighter uses Second Wind only under a configured HP threshold
- Rogue uses primary attack each turn

This is necessary because users are not manually controlling every turn in Telegram.

### Why This Matters

The system is an arbitration engine, not a tactical multiplayer game. The combat must be:

- automatic
- fair
- explainable
- reproducible

---

## 15. Rules Configuration Architecture

### Configuration as Data

Class kits, spell lists, and match parameters should be stored as versioned configuration data, not hard-coded throughout the app.

Configuration includes:

- class templates
- HP tables
- AC templates
- approved actions
- spell definitions
- resource limits
- round limit
- tie-break logic

### Rules Versioning

Each released rules set gets a unique version identifier.

At match start:

- store the exact rules version
- ideally persist a rules snapshot or immutable config reference

This protects historical integrity and enables safe balancing over time.

---

## 16. Admin Panel Architecture

### Frontend Stack

Recommended:

- React
- Vite
- TypeScript
- a lightweight router
- a data-fetching layer that respects auth/session state

### Admin Panel Sections

Recommended pages:

- login
- dashboard
- users list/detail
- characters list/detail
- disputes list/detail
- matches list/detail
- audit logs
- rules/config viewer

### UI Design Principle

The admin panel is an operations product, not a marketing site.

It should optimize for:

- fast inspection
- clear status indicators
- safe action confirmations
- visible audit consequences for sensitive actions

### Sensitive Action UX

Actions like cancel, retry, suspend, or finalize should:

- require a confirmation step
- collect a reason where appropriate
- show that the action will be audited

---

## 17. Logging, Monitoring, and Observability

### Structured Logging

Application logs should be structured and include:

- request IDs
- Telegram update IDs where applicable
- user IDs
- dispute IDs
- match IDs
- error category

### Health Endpoints

Recommended endpoints:

- `/health` for process liveness
- `/ready` for dependency readiness

### Monitoring Targets

Track:

- webhook errors
- failed match executions
- admin login failures
- DB connection issues
- queue lag if worker model is used

### Error Tracking

If possible, integrate an error tracking service or at minimum preserve structured crash/error logs with enough context to investigate.

---

## 18. Security Architecture

### Threat Areas

Main security concerns are:

- forged or replayed webhook requests
- unauthorized admin access
- abuse of player-facing commands
- unsafe admin actions
- injection through freeform text fields

### Security Controls

Recommended baseline:

- HTTPS only via nginx
- Telegram webhook secret verification
- secure admin sessions
- server-side input validation
- output escaping/sanitization where needed
- rate limiting for command abuse
- audit logs for all privileged actions

### Data Protection

At minimum:

- protect DB credentials
- rotate secrets safely
- back up PostgreSQL regularly
- restrict admin account creation

---

## 19. Reliability and Recovery

### Failure Scenarios to Design For

- Telegram retries webhook delivery
- backend restarts during character creation
- backend restarts during match execution
- DB transaction fails mid-state transition
- admin action races with automated match flow

### Recovery Principles

- state transitions must be explicit and durable
- incomplete work should be restartable or cancellable
- no failure should require silent data patching as the normal recovery path

### Match Recovery Model

Recommended:

- if match execution fails before completion, set match to `error`
- preserve partial diagnostic context
- allow admin retry or manual finalization

Do not leave ambiguous running state without a recovery path.

---

## 20. Performance and Scale Expectations

### Expected Early Load

This product likely starts with:

- low concurrency
- short request bursts around disputes
- modest admin usage

### Performance Priorities

The main performance concerns are not raw scale but:

- handler idempotency
- DB correctness under retries
- readable Telegram pacing
- quick admin inspection

### Scaling Path

If usage grows:

1. separate worker process cleanly
2. introduce Redis-backed job queue if needed
3. add DB indexing and query tuning
4. isolate admin/frontend serving if necessary
5. split services only if operationally justified

There is no reason to start with a distributed architecture.

---

## 21. Local Development Architecture

### Recommended Dev Setup

Local development should support:

- backend app
- admin frontend
- PostgreSQL

Optional in later stages:

- worker process

### Local Workflow

Developers should be able to:

1. start PostgreSQL
2. run migrations
3. start backend
4. start admin frontend
5. use a Telegram test bot or simulated engine tests

### Test Strategy by Layer

- engine unit tests for match resolution
- domain tests for workflow/state transitions
- API tests for admin operations
- integration tests for Telegram update handling

---

## 22. Release Evolution Plan

### Alpha Architecture

At Alpha:

- one backend service
- one admin frontend
- PostgreSQL
- optional inline match execution or simple DB-backed worker

### Beta Architecture

At Beta:

- backend plus dedicated worker recommended
- stronger audit coverage
- broader monitoring
- stricter admin auth and recovery workflows

### GA Architecture

At GA:

- dedicated worker if match execution is non-trivial
- tested backup/restore procedure
- stable deployment/rollback flow
- complete operator tooling for common incidents

The architecture should mature operationally more than it expands structurally.

---

## 23. Non-Goals

This architecture does not aim to support, in v1:

- player-controlled tactical maps
- real-time websocket combat UI for players
- microservice decomposition
- public API platform for third parties
- full 5e rules engine parity

Avoiding these non-goals keeps the system implementable and supportable.

---

## 24. Key Architectural Decisions

The most important decisions in this architecture are:

1. **Use a modular monolith first.**
2. **Keep the combat engine transport-agnostic.**
3. **Use PostgreSQL as the source of truth.**
4. **Snapshot participants and rules at match start.**
5. **Make admin actions explicit and auditable.**
6. **Prefer background job execution for matches when practical.**
7. **Use nginx as the single ingress point for webhook, API, and admin traffic.**

If these decisions hold, the system should remain understandable and evolvable through GA.

---

## 25. Recommended Next Deliverables

The next implementation-oriented documents should be:

1. `BOT_FLOWS.md`
   - Telegram commands, prompts, callbacks, and user journey details
2. `ADMIN_PANEL.md`
   - pages, permissions, and operational actions
3. `SCHEMA.md` or actual migrations
   - concrete tables, columns, indexes, and constraints
4. `DEPLOYMENT.md`
   - nginx routes, environment variables, process model, and rollout steps

---

## 26. Bottom Line

The right architecture for this project is a Telegram-first modular monolith: a TypeScript backend behind nginx, a React admin panel, PostgreSQL for persistence, and a deterministic combat engine isolated from transport concerns.

That gives you a system that is realistic to build on one server, easy to reason about, and strong enough to reach GA without painting the product into a corner.

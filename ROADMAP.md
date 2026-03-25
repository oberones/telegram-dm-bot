# Roadmap to GA: Telegram Arbitration Bot

## 1. Purpose

This roadmap describes the phased development plan required to take the Telegram arbitration bot from concept to general availability (GA).

The target product is:

- a **Telegram-first user experience** for creating characters and resolving disputes
- a **browser-based admin panel** for operations, moderation, and rules management
- a **5e-inspired combat engine** using a curated, supportable rules subset
- a **production deployment** behind nginx using your existing server and Telegram bot integration

The roadmap assumes a practical MVP-first approach, then progressive hardening toward a stable public release.

---

## 2. Release Philosophy

### Product Goal

Reach a GA release that is:

- operationally stable
- fair and auditable
- safe to administer
- understandable to users
- supportable by a small operator team

### Core Constraints

- End users interact through Telegram only.
- Admin workflows happen in a web browser.
- The combat engine must be testable independent of Telegram.
- The system must log enough information to explain outcomes.
- Rules scope must remain intentionally bounded through GA.

### What "GA" Means Here

For this product, GA should mean:

- the service can run continuously in production
- the primary user flows are complete and reliable
- admins can recover from failures without direct database edits
- the rules and result logs are understandable and trusted
- security, monitoring, backups, and deployment procedures are in place

---

## 3. Phase Summary

The recommended development path is:

1. Phase 0: Product Definition and Rule Freezing
2. Phase 1: Technical Foundation
3. Phase 2: Data Model and Persistence
4. Phase 3: Telegram Identity and Character Creation
5. Phase 4: Combat Engine v1
6. Phase 5: Dispute Workflow in Telegram
7. Phase 6: Admin Panel v1
8. Phase 7: Auditability, Moderation, and Recovery
9. Phase 8: Alpha Release
10. Phase 9: Beta Hardening
11. Phase 10: GA Readiness and Launch

Each phase below includes:

- objective
- workstreams
- deliverables
- dependencies
- risks
- exit criteria

---

## 4. Phase 0: Product Definition and Rule Freezing

### Objective

Lock the product shape tightly enough that implementation can move without repeated architectural churn.

### Why This Phase Matters

The biggest risk in this project is uncontrolled scope growth, especially around "full 5e" expectations, character customization, and admin powers. This phase exists to prevent that.

### Workstreams

#### A. Rules Scope Definition

Define the initial supported rules subset:

- supported classes
- supported actions
- supported attacks
- supported spells, if any
- initiative model
- critical hit behavior
- tie-break rules
- status conditions included in MVP
- level progression policy

#### B. Product Policy Definition

Define:

- who may initiate disputes
- whether self-disputes are allowed
- whether users must opt in before being challenged
- what counts as a valid dispute reason
- whether leveling is automatic after all matches or only some match types
- how admin interventions are shown to users

#### C. Operational Policy Definition

Define:

- who can access admin
- whether admins can edit characters directly
- whether admins may cancel or rerun matches
- whether admins may alter completed results
- what actions require audit logging

#### D. Content and Legal Constraints

Define the content boundary:

- use SRD-compatible 5e content only
- avoid copying non-SRD rules text
- use original flavor text and UI copy

### Deliverables

- finalized [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md)
- MVP rules specification document
- admin permissions matrix
- release scope statement for Alpha, Beta, and GA

### Dependencies

- none; this phase should happen first

### Risks

- unresolved rule ambiguity causes rework later
- too many supported options make engine complexity explode

### Exit Criteria

- MVP class list is frozen
- rules subset is frozen
- admin capabilities are defined
- Alpha/Beta/GA scope is explicitly documented

---

## 5. Phase 1: Technical Foundation

### Objective

Stand up the project structure and baseline services so feature work happens on a stable base.

### Workstreams

#### A. Repository and App Structure

Set up the codebase layout for:

- bot service
- API/backend service
- admin frontend
- shared combat engine package
- shared types/config package

#### B. Tooling

Add:

- TypeScript configuration
- package manager workspace setup
- linting
- formatting
- test runner
- environment variable handling
- local development scripts

#### C. Deployment Skeleton

Prepare:

- production environment variable contract
- nginx route expectations
- process model for app and worker
- local and production config separation

#### D. Secrets and Configuration

Define:

- Telegram bot token handling
- database connection configuration
- admin session secrets
- webhook secret validation

### Deliverables

- initial app skeleton
- shared config module
- local dev startup flow
- production deployment notes

### Dependencies

- Phase 0 scope decisions

### Risks

- poor separation between engine and transport leads to brittle code
- configuration sprawl makes deployment error-prone

### Exit Criteria

- the codebase can boot locally
- services compile and run
- environment variables are documented
- deployment assumptions are written down

---

## 6. Phase 2: Data Model and Persistence

### Objective

Create the canonical storage model for users, characters, disputes, matches, events, and audit logs.

### Workstreams

#### A. Database Schema Design

Implement schema for:

- users
- characters
- disputes
- matches
- participant snapshots
- match events
- audit logs
- admin accounts and sessions

#### B. Versioning Strategy

Define how to version:

- rules presets
- character snapshots
- balance changes

This matters because match history must remain stable even if current rules change.

#### C. Data Access Layer

Implement:

- typed database client
- core repositories/services
- transactional helpers for match state changes

#### D. Seed and Migration Strategy

Add:

- migration pipeline
- local development seed data
- admin bootstrap path

### Deliverables

- database schema
- migration files
- typed persistence layer
- initial seed/bootstrap flow

### Dependencies

- Phase 1 codebase structure

### Risks

- historical matches become inconsistent without snapshots
- weak transaction boundaries lead to duplicate or broken match state

### Exit Criteria

- database can be migrated from scratch
- core entities can be created and queried
- snapshot strategy is implemented and documented

---

## 7. Phase 3: Telegram Identity and Character Creation

### Objective

Implement the first complete user-facing flow: a Telegram user creates and views a character.

### Workstreams

#### A. Telegram Bot Connection

Implement:

- webhook endpoint
- Telegram request validation
- command router
- message and callback handling

#### B. User Provisioning

When a user messages the bot:

- create or link an app user from Telegram identity
- store stable Telegram user ID
- capture display metadata safely

#### C. Character Creation Wizard

Build guided Telegram flows for:

- selecting class
- naming character
- confirming starter build
- reviewing summary before save

The wizard should be resumable if interrupted.

#### D. Character Display

Implement:

- `/character`
- `/help`
- `/start`

### Deliverables

- connected Telegram bot
- create-character flow
- view-character flow
- user and character creation from Telegram

### Dependencies

- Phase 2 persistence layer

### Risks

- Telegram chat UX becomes confusing if the flow is too long
- username-based assumptions cause identity mismatches

### Exit Criteria

- a new Telegram user can create a character successfully
- a returning user can retrieve their character
- interrupted creation can be resumed or safely restarted

---

## 8. Phase 4: Combat Engine v1

### Objective

Build the reusable combat engine that resolves a match from an immutable rules and character snapshot.

### Workstreams

#### A. Rules Engine Core

Implement:

- initiative
- turn order
- hit resolution
- damage calculation
- HP updates
- win conditions
- round limits and tie-break rules

#### B. Class Kit Support

Support the frozen MVP classes with bounded action sets.

For each class:

- legal actions
- attack modifiers
- damage rules
- any limited-use features

#### C. Event Model

Emit structured combat events for:

- initiative rolls
- turn start
- action selection
- attack roll
- damage roll
- hit/miss
- status changes
- victory

#### D. Determinism and Testability

Ensure:

- injected RNG source
- replayability from stored rolls or seeds
- unit coverage for edge cases

### Deliverables

- standalone combat engine package
- structured event output
- rules snapshot input format
- unit tests for core combat behavior

### Dependencies

- Phase 0 rules freeze
- Phase 2 data model

### Risks

- rules edge cases multiply unexpectedly
- unclear engine boundaries make it hard to test without Telegram

### Exit Criteria

- engine can resolve a full match without Telegram dependencies
- event logs are usable for both bot narration and admin inspection
- core combat logic is covered by automated tests

---

## 9. Phase 5: Dispute Workflow in Telegram

### Objective

Turn the engine into a complete arbitration experience inside Telegram.

### Workstreams

#### A. Dispute Creation

Implement `/dispute` flow:

- validate challenger and target
- validate both users have eligible characters
- capture reason text
- create pending dispute

#### B. Acceptance and Match Start

Implement:

- accept/decline flow
- eligibility re-check at acceptance time
- creation of immutable participant snapshots
- transition to queued/running match state

#### C. Match Narration

Implement Telegram-friendly presentation:

- match intro message
- initiative summary
- per-round or per-turn summaries
- final result message

#### D. Failure Handling

Implement:

- safe retries
- partial-failure recovery
- user-visible error handling when a match cannot complete

### Deliverables

- end-to-end dispute flow in Telegram
- match execution from accepted dispute
- combat logs delivered to users
- persisted match history

### Dependencies

- Phase 3 Telegram bot
- Phase 4 combat engine

### Risks

- duplicate update handling creates duplicate matches
- verbose logs hit Telegram limits or become unreadable

### Exit Criteria

- two users can complete a full dispute from Telegram
- match history is persisted correctly
- failed runs do not corrupt state silently

---

## 10. Phase 6: Admin Panel v1

### Objective

Deliver the first browser-based operational interface so the system is manageable without terminal or database access.

### Workstreams

#### A. Admin Authentication

Implement:

- admin user model
- login flow
- session management
- protected routes

#### B. Dashboard

Display:

- service health
- active disputes
- running matches
- failed matches
- recent admin actions

#### C. Entity Management

Provide pages for:

- users
- characters
- disputes
- matches
- audit logs

#### D. Read-Only First Bias

Prefer read-only inspection first, then narrow edit powers after the data model and workflows are proven.

### Deliverables

- admin login
- dashboard
- detail pages for core entities
- initial management tooling

### Dependencies

- Phase 2 persistence layer
- Phase 5 dispute execution

### Risks

- broad edit access can undermine trust or damage data
- admin UI becomes tightly coupled to internal DB structure

### Exit Criteria

- admins can investigate system state from the browser
- admins can locate a user, character, dispute, or match quickly
- admin authentication is enforced correctly

---

## 11. Phase 7: Auditability, Moderation, and Recovery

### Objective

Add the operational safety features required before inviting real usage beyond a small internal test set.

### Workstreams

#### A. Audit Logging

Ensure all important actions are captured:

- bot commands
- match lifecycle transitions
- admin logins
- admin edits
- retries, cancellations, and overrides

#### B. Moderation Controls

Add:

- suspend player
- disable new disputes
- freeze a character
- restrict abusive users

#### C. Recovery Tools

Admins should be able to:

- retry failed matches
- cancel stuck matches
- mark disputes as resolved manually with reason
- inspect raw event logs and snapshots

#### D. Data Protection

Implement:

- backup procedure
- restore procedure
- migration rollback approach

### Deliverables

- full audit log coverage
- moderation controls
- recovery tools
- backup and restore runbook

### Dependencies

- Phase 6 admin panel

### Risks

- insufficient logging makes disputes socially unresolvable
- recovery requires direct DB manipulation, which is not acceptable near GA

### Exit Criteria

- key admin/system actions appear in audit logs
- failed and stuck matches can be handled without DB surgery
- backup and restore process is tested

---

## 12. Phase 8: Alpha Release

### Objective

Release the system to a very small trusted group and validate the real end-to-end experience.

### Scope

Alpha should be intentionally small:

- limited operator set
- limited player count
- fixed starter classes only
- no broad customization
- no advanced team modes yet

### Workstreams

#### A. Internal Test Plan

Run scenarios for:

- new user creation
- interrupted character creation
- successful dispute
- declined dispute
- bot restart during match
- admin recovery of failed match

#### B. Gameplay Feedback

Collect feedback on:

- fairness
- readability
- pacing
- amount of randomness
- satisfaction with class balance

#### C. Ops Validation

Validate:

- logging
- deployment process
- restart safety
- nginx routing
- webhook reliability

### Deliverables

- alpha deployment
- bug backlog categorized by severity
- rules tuning notes
- updated operator runbook

### Dependencies

- Phases 1 through 7

### Risks

- users dislike the pacing or explanation of outcomes
- combat balance feels obviously skewed

### Exit Criteria

- core flows are exercised by real users
- major usability failures are identified
- no critical data loss or unrecoverable failures occur

---

## 13. Phase 9: Beta Hardening

### Objective

Improve reliability, performance, usability, and supportability until the product is ready for wider production use.

### Workstreams

#### A. Reliability and Performance

Add and tune:

- background execution reliability
- concurrency protections
- idempotency on webhook handling
- rate limiting
- performance profiling for match execution

#### B. Security Hardening

Implement and verify:

- secure session handling
- CSRF protection where applicable
- input validation everywhere
- secret rotation process
- admin account recovery process

#### C. Product Polish

Refine:

- Telegram prompts
- inline buttons and message formatting
- admin dashboard clarity
- rules explanations
- error messages and user guidance

#### D. Test Expansion

Increase coverage across:

- unit tests for engine
- integration tests for API and bot flows
- regression tests for match outcomes
- migration tests

### Deliverables

- beta release
- hardened deployment
- improved test suite
- security and operational checklist

### Dependencies

- alpha findings

### Risks

- hidden race conditions only appear under real traffic
- support burden grows if Telegram flows remain confusing

### Exit Criteria

- no known critical security issues
- no known critical data integrity issues
- operational incidents can be handled by documented procedures
- primary flows are reliable over sustained beta usage

---

## 14. Phase 10: GA Readiness and Launch

### Objective

Finalize the product for stable public or organization-wide availability.

### Workstreams

#### A. Launch Checklist

Confirm:

- production deployment is repeatable
- monitoring and alerting are active
- backups are scheduled
- restore process has been tested
- incident contacts are defined
- admin access is controlled

#### B. Documentation

Prepare:

- operator guide
- admin guide
- rules reference
- support and incident playbook
- deployment and rollback guide

#### C. Final Product Decisions

Lock:

- supported classes
- leveling policy
- admin intervention policy
- support boundaries
- release notes for GA

#### D. Soft Launch then GA

Recommended:

- soft launch to an expanded but still controlled audience
- observe for a short stabilization window
- then declare GA

### Deliverables

- GA deployment
- final docs set
- launch checklist evidence
- known limitations list

### Dependencies

- successful beta hardening

### Risks

- launching without tested recovery/documentation creates avoidable incidents
- expanding scope too late destabilizes the release

### Exit Criteria

- system meets reliability and security baseline
- support and ops runbooks exist
- admins can manage the service without engineering intervention for common issues
- product limitations are understood and documented

---

## 15. Cross-Phase Engineering Tracks

Some work should continue across multiple phases rather than appearing once.

### A. Testing

Testing should grow continuously:

- engine unit tests early
- API and bot integration tests midstream
- regression coverage before Beta and GA

### B. Security

Security should not wait until the end:

- secret handling from Phase 1
- auth hardening by Phase 6
- full security review before GA

### C. Observability

Logging, health checks, and visibility should start early and deepen over time.

### D. Documentation

Keep docs current as phases complete instead of trying to reconstruct them all at launch time.

---

## 16. Suggested Milestones

These are the major checkpoints that matter most:

### Milestone A: "First Character"

Complete when:

- a Telegram user can start the bot
- create a character
- view it later

### Milestone B: "First Complete Match"

Complete when:

- one user challenges another
- the other user accepts
- the engine runs
- the result is shown and stored

### Milestone C: "Operable Service"

Complete when:

- admins can inspect users, disputes, matches, and failures from the browser
- failures can be recovered without DB editing

### Milestone D: "Trusted Arbitration"

Complete when:

- audit trails are complete
- results are explainable
- users and operators trust the system enough for real decisions

### Milestone E: "GA"

Complete when:

- the service is stable, supportable, monitored, and documented

---

## 17. Features That Should Wait Until After GA

To protect the release, these should generally stay post-GA unless they become essential:

- team battles
- free-for-all matches
- advanced spell libraries
- broader subclass support
- custom items and homebrew content workflows
- ladders, tournaments, or seasons
- AI-generated narration
- deep character inventory systems

These are good expansion paths, but they are not required to ship a strong first version.

---

## 18. Recommended Immediate Next Deliverables

After this roadmap, the best next documents to create are:

1. `RULES_SPEC.md`
   - exact supported 5e subset
2. `ARCHITECTURE.md`
   - service boundaries, deployment, and runtime model
3. `SCHEMA.md` or actual DB migrations
   - canonical persistence model
4. `BOT_FLOWS.md`
   - Telegram conversation flows and command behavior
5. `ADMIN_PANEL.md`
   - admin pages, permissions, and intervention design

---

## 19. Bottom Line

The path to GA is very achievable if the scope remains disciplined.

The most important strategic decisions are:

- keep the game rules bounded
- separate the combat engine from Telegram
- invest early in audit logs and recovery tools
- treat admin power as visible and accountable

If those principles hold, the project can move from concept to a trustworthy GA product in a controlled, phased way.

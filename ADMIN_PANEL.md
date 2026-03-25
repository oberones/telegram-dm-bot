# Admin Panel Specification

## 1. Purpose

This document defines the browser-based admin panel for the Telegram arbitration bot.

It specifies:

- admin user roles
- page structure
- permissions
- operational workflows
- intervention rules
- audit and safety requirements

The admin panel exists so operators can manage the system without terminal access or direct database edits.

This document should be read alongside:

- [PROPOSAL.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/PROPOSAL.md)
- [ROADMAP.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ROADMAP.md)
- [RULES_SPEC.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/RULES_SPEC.md)
- [ARCHITECTURE.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/ARCHITECTURE.md)
- [BOT_FLOWS.md](/Users/oberon/Projects/coding/telegram-bots/dungeon-master-bot/BOT_FLOWS.md)

---

## 2. Admin Panel Goals

The admin panel should let operators:

1. understand the current state of the system quickly
2. inspect users, characters, disputes, matches, and logs
3. intervene safely when automation fails
4. moderate abusive or invalid use
5. review and manage rules/configuration
6. do all of the above with strong audit visibility

It should not become an invisible "god mode" that undermines trust in match outcomes.

---

## 3. Core Design Principles

### Principle 1: Read-First, Edit-Second

Inspection tools should come before broad editing powers.

### Principle 2: Explicit Actions

Important actions should be deliberate and named, such as:

- retry match
- cancel dispute
- suspend user

Avoid generic silent editing for sensitive state.

### Principle 3: Audit Everything Important

Any action that changes user eligibility, dispute lifecycle, match lifecycle, or rules should be logged.

### Principle 4: Protect Trust

Admins may manage process failures, but they should not silently rewrite fair completed outcomes.

### Principle 5: Fast Triage

The panel should help an operator answer these questions quickly:

- is the system healthy?
- is anything stuck?
- why did a specific match fail?
- is a player abusing the system?

---

## 4. Intended Users

The panel is for internal operators only.

### User Types

- `super_admin`
- `operator`
- `moderator`

### Role Summary

#### Super Admin

Can:

- manage admin accounts
- change rules/config visibility and release state
- perform all operator and moderator actions
- finalize exceptional cases

#### Operator

Can:

- inspect all system entities
- retry/cancel failed operational workflows
- review snapshots and logs
- freeze characters or disable disputes if policy allows

#### Moderator

Can:

- inspect user-facing entities
- suspend users
- cancel pending disputes for policy reasons
- review history and reports

Moderators should have limited or no access to deep system configuration.

---

## 5. Authentication and Access

### Authentication Model

Admins use a separate browser login flow.

Recommended options:

- passwordless email magic link
- or username/password with secure session management

### Session Requirements

- secure cookies
- server-side session validation
- session expiry
- logout support

### Access Restrictions

Recommended additional controls:

- optional IP allowlist for small trusted operator teams
- strict admin account creation policy
- no self-service public signup

---

## 6. Navigation Structure

Recommended top-level navigation:

- Dashboard
- Users
- Characters
- Disputes
- Matches
- Audit Log
- Rules
- Admins
- System

For MVP, `Admins` and some `System` features may be visible only to super admins.

---

## 7. Dashboard

### Purpose

Give operators a fast operational overview.

### Required Dashboard Widgets

- system health status
- number of running matches
- number of failed matches
- number of pending disputes
- recent admin actions
- recent errors or alerts
- user suspension count

### Recommended Visual Sections

#### System Status

Show:

- backend health
- database readiness
- worker status if present
- rules version currently active

#### Queue / Match Status

Show:

- queued matches
- running matches
- errored matches
- completed matches in recent window

#### Moderation Snapshot

Show:

- recently suspended users
- recently cancelled disputes

#### Audit Snapshot

Show:

- latest sensitive admin actions

### Primary Actions from Dashboard

- view failed matches
- view pending disputes
- view audit log

---

## 8. Users Page

### Purpose

Let admins inspect and manage player accounts.

### Users List

Columns should include:

- display name
- Telegram username if present
- Telegram user ID
- account status
- active character
- total matches
- last activity

### User Detail View

Show:

- identity metadata
- account status
- active character summary
- match history summary
- dispute history summary
- moderation notes if supported
- recent audit actions affecting this user

### Supported Actions

By role and policy:

- suspend user
- unsuspend user
- view linked character
- view user-related disputes/matches

### Guardrails

- suspension should require confirmation
- optional reason field is strongly recommended
- action must be audited

---

## 9. Characters Page

### Purpose

Let admins inspect player character state and handle edge cases.

### Characters List

Columns should include:

- character name
- class
- level
- owner
- status
- current rules version
- total matches
- last updated

### Character Detail View

Show:

- core stat summary
- max HP
- AC
- action/spell kit
- progression summary if enabled
- recent matches
- current restrictions or freeze state
- audit history for edits or freezes

### Supported Actions

Recommended MVP-safe actions:

- freeze character from new matches
- unfreeze character
- inspect full snapshot-compatible data

### Editing Policy

Recommended v1:

- avoid freeform direct editing of core combat stats in the panel
- use read-only views for most mechanics
- if edits become necessary later, expose narrow explicit actions only

Reason:

Direct stat editing risks undermining trust and complicating auditability.

---

## 10. Disputes Page

### Purpose

Provide visibility into challenge requests and their lifecycle.

### Disputes List

Columns should include:

- dispute ID
- challenger
- target
- reason
- status
- created at
- updated at

### Filters

Recommended filters:

- pending
- accepted
- declined
- cancelled
- expired
- by user
- by date range

### Dispute Detail View

Show:

- challenger and target
- associated characters at time of dispute
- dispute reason
- status history
- linked match if one exists
- audit entries related to this dispute

### Supported Actions

Recommended:

- cancel pending dispute
- mark dispute expired if policy requires manual handling

### Guardrails

- completed disputes linked to completed matches should not be casually editable
- cancellations require reason and audit trail

---

## 11. Matches Page

### Purpose

Give admins deep visibility into the most sensitive object in the system: arbitration outcomes.

### Matches List

Columns should include:

- match ID
- dispute ID
- participants
- status
- winner
- rules version
- started at
- completed at

### Filters

- queued
- running
- completed
- errored
- by player
- by rules version
- by date range

### Match Detail View

This is one of the most important views in the panel.

It should show:

- dispute context
- participant identities
- participant snapshots
- rules version
- match summary
- event timeline
- final winner or error state
- linked audit actions

### Match Timeline / Event Viewer

The detail page should support reading the fight as:

- compact public summary
- structured event log for operator diagnosis

Recommended sections:

- overview tab
- participant snapshot tab
- event log tab
- audit tab

### Supported Actions

Recommended role-gated actions:

- retry errored match
- cancel stuck queued/running match
- manually finalize failed match with visible reason

### Guardrails

- completed healthy matches should not expose "change winner" controls
- exceptional manual finalization must be visibly marked as admin-resolved
- all actions require audit logging

---

## 12. Audit Log Page

### Purpose

Provide a searchable history of sensitive system and admin actions.

### Audit Log List

Columns should include:

- timestamp
- actor
- actor role/type
- action
- target type
- target ID
- short summary

### Filters

- by actor
- by action type
- by target type
- by target ID
- by date range

### Detail View

Each audit item should expose:

- full payload
- before/after summary where relevant
- reason text if provided
- related entity links

### Actions That Must Be Logged

At minimum:

- admin login/logout
- user suspension changes
- character freeze changes
- dispute cancellation
- match retry/cancel/finalize
- rules/config changes
- admin account changes

---

## 13. Rules Page

### Purpose

Let authorized admins inspect the currently active rules and versioned configs.

### Recommended v1 Scope

Start read-only unless there is a very strong reason to edit config in-browser.

### Rules List / Overview

Show:

- active rules version
- available rules versions
- release status
- summary of class kits
- round limit
- tie-break settings
- approved actions/spells

### Future Editable Controls

If later enabled, keep edits narrow and versioned:

- create new draft rules version
- promote draft to active
- compare version differences

### Guardrails

- never silently mutate rules that may affect in-flight or historical matches
- config changes should produce a new version and be audited

---

## 14. Admins Page

### Purpose

Let super admins manage internal operator access.

### Visibility

Super admin only.

### Admin List

Columns:

- name/email
- role
- status
- last login
- created at

### Supported Actions

- invite/create admin
- disable admin
- change role
- force session invalidation if needed

### Guardrails

- admin creation and role changes must be audited
- avoid allowing admins to remove their own final super-admin access accidentally

---

## 15. System Page

### Purpose

Expose service-level operational information useful to trusted operators.

### Recommended Content

- environment label
- app version/build SHA if available
- active rules version
- DB health
- worker health
- queue depth if present
- recent deployment timestamp

### Optional Tools

Depending on implementation maturity:

- re-run health checks
- view scheduled cleanup status
- view retention/cleanup jobs

### Guardrails

- do not expose raw secrets
- do not place dangerous infrastructure controls here unless absolutely necessary

---

## 16. Common Operational Workflows

### Workflow 1: Investigate a Failed Match

1. open Dashboard
2. click errored match count or Matches filter
3. open Match detail
4. inspect participant snapshots and event log
5. choose:
   - retry
   - cancel
   - manually finalize with reason
6. confirm action
7. action is audited

### Workflow 2: Suspend an Abusive User

1. open Users
2. search for player
3. open User detail
4. click `Suspend User`
5. enter reason
6. confirm
7. account status updates and action is audited

### Workflow 3: Cancel a Pending Dispute

1. open Disputes
2. filter `pending`
3. open dispute
4. click `Cancel Dispute`
5. enter reason
6. confirm
7. dispute status updates and action is audited

### Workflow 4: Review Historical Match Fairness Question

1. open Matches
2. search by match ID or player
3. inspect snapshots, event timeline, and rules version
4. confirm outcome was produced by stored rules and logged rolls

This workflow is central to user trust.

---

## 17. Permission Matrix

Recommended starting permissions:

### Moderator

Can:

- view dashboard
- view users
- view characters
- view disputes
- view matches
- view audit logs relevant to moderation
- suspend/unsuspend users
- cancel pending disputes

Cannot:

- manage admins
- change rules
- finalize failed matches unless explicitly granted

### Operator

Can:

- everything in read-only inspection
- retry/cancel/finalize match workflows
- freeze/unfreeze characters
- inspect detailed logs and snapshots

Cannot:

- manage admins
- publish new rules versions unless explicitly granted

### Super Admin

Can:

- all moderator and operator actions
- manage admin accounts
- manage rules/config release state
- access system-level controls

---

## 18. Safety Patterns for Sensitive Actions

### Confirmation Dialogs

Actions like:

- suspend user
- cancel dispute
- retry match
- finalize match
- freeze character

should show a confirmation dialog.

### Reason Capture

Require or strongly encourage a reason for:

- suspension
- cancellation
- manual finalization
- configuration changes

### Audit Preview

Good admin UX should remind the operator:

- this action will be logged

### Destructive Language

Use precise action wording, for example:

- `Cancel Pending Dispute`
- `Retry Failed Match`
- `Finalize Match as Admin Resolution`

Avoid vague labels like `Save` or `Update` for sensitive operations.

---

## 19. Search and Filtering Requirements

The panel will become difficult to operate without strong filtering.

### Global Search Targets

Recommended searchable entities:

- user display name
- Telegram username
- Telegram user ID
- character name
- dispute ID
- match ID

### Essential Filters

#### Users

- status
- last activity

#### Characters

- class
- level
- frozen/not frozen

#### Disputes

- status
- challenger
- target
- date range

#### Matches

- status
- rules version
- participant
- date range

#### Audit Logs

- actor
- action
- target type
- date range

---

## 20. Data Presentation Rules

### Readability

The panel should favor scanability over decorative density.

### Time Display

Show:

- absolute timestamps
- consistent timezone handling

Recommended:

- operator-local display with clear formatting

### IDs

Important records should display copyable IDs:

- user ID
- dispute ID
- match ID
- audit ID

### Snapshots

Participant snapshots should be visibly marked as:

- immutable match-time data

This helps operators distinguish between live characters and historical match state.

---

## 21. Error and Empty States

### Error States

If data fails to load:

- explain the problem briefly
- offer retry
- avoid raw stack traces

### Empty States

Examples:

- no pending disputes
- no failed matches
- no recently suspended users

These should be calm and informative, not alarming.

### Example Empty State

> No failed matches right now.

For operational pages, good empty states reduce noise and anxiety.

---

## 22. Audit Requirements by Page

### Users

Audit:

- suspension changes
- moderation note changes if supported

### Characters

Audit:

- freeze/unfreeze
- any future stat/config edits

### Disputes

Audit:

- cancellation
- manual expiry or override

### Matches

Audit:

- retry
- cancel
- manual finalization

### Rules

Audit:

- draft creation
- version activation
- rule/config changes

### Admins

Audit:

- account creation
- role changes
- disablement

---

## 23. Implementation Notes

### Frontend Architecture

Recommended:

- route per page type
- reusable table/filter components
- detail pages with tabs where useful
- optimistic updates only where low-risk

For sensitive actions, prefer waiting for server confirmation before showing success.

### API Design Guidance

The frontend should call explicit endpoints for sensitive actions, such as:

- `POST /api/users/:id/suspend`
- `POST /api/disputes/:id/cancel`
- `POST /api/matches/:id/retry`

### Session Handling

The admin frontend should gracefully handle:

- expired session
- unauthorized role
- lost connectivity

---

## 24. MVP vs Later

### MVP Admin Panel

Must have:

- login
- dashboard
- users list/detail
- characters list/detail
- disputes list/detail
- matches list/detail
- audit log
- basic operational actions

### Beta / GA Enhancements

May add:

- richer rules diffing
- saved filters
- bulk moderation tools
- incident notes
- notifications for failed matches
- deployment/system diagnostics

---

## 25. Non-Goals

The admin panel is not intended to be:

- a player-facing product
- a live tactical combat viewer
- a full game design studio for unbounded rule editing
- a replacement for proper logs/monitoring infrastructure

It is an operational console first.

---

## 26. Recommended MVP Build Order

Build the panel in this order:

1. admin auth
2. dashboard
3. matches list/detail
4. disputes list/detail
5. users list/detail
6. audit log
7. characters list/detail
8. rules/system/admin pages

Why this order:

- match and dispute visibility is the most operationally critical
- user moderation is next
- rules/admin management can come after core operational safety

---

## 27. Bottom Line

The admin panel should function like a trustworthy control room:

- fast overview
- deep inspection where needed
- narrow, explicit interventions
- complete audit visibility

If the Telegram bot is the public face of the system, the admin panel is the operational spine that makes the product supportable through Beta and GA.

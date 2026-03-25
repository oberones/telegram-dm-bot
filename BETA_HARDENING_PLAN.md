# Beta Hardening Plan

## Purpose

This document defines the immediate focus for Beta hardening while iteration remains fast.

Beta is where we shift from "feature complete enough to try" into "reliable enough to trust repeatedly."

## Current Beta Priorities

### 1. Integration Coverage Expansion

Add tests for:

- `/accept` and `/decline` Telegram flows
- mention-based `/dispute` targeting
- character deletion flow
- admin login success and failed login auditing
- admin recovery cancel/finalize routes beyond current happy-path coverage

### 2. Data Integrity and Idempotency

Harden:

- duplicate Telegram update handling
- repeated callback safety
- repeated admin recovery action safety
- protection against duplicate dispute or match creation under retries

### 3. Security and Session Hardening

Improve:

- admin session validation depth
- CSRF posture for admin POST routes
- clearer secret rotation procedure
- bootstrap-admin transition plan for non-local environments

### 4. Product Polish

Refine:

- Telegram copy and help text
- admin recovery explanations
- audit log readability
- error messages during moderation/recovery flows

### 5. Operational Confidence

Add:

- Beta release checklist
- issue triage rhythm
- incident summary template
- more explicit deployment rollback notes if needed

## Suggested Beta Exit Markers

Beta is in good shape when:

- `make test` is consistently green
- integration coverage includes the highest-risk Telegram and admin flows
- no major duplicate-state bugs remain open
- operators can explain and recover common failures quickly
- admin auth and recovery behavior feel boring and predictable

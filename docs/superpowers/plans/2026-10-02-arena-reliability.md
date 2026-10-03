# Arena Reliability Implementation Plan

> **For agentic workers:** Use Superpowers TDD, verification and scoped code review. Independent file ownership allows parallel work; shared server integration belongs to the controller.

**Goal:** Apply every recommendation from the approved audit while preserving accounts, balances, matches and the existing layout.

**Architecture:** Add focused policy/storage helpers to the existing vanilla web/Node SQLite application. Integrate them through existing API routes and keep legacy contracts intact.

**Tech Stack:** Node 24, SQLite, vanilla JS/CSS, Tesseract; bounded private image analysis.

**Spec:** ../specs/2026-10-02-arena-reliability-design.md

## Global Constraints

- No real payments, settlement or test accounts on production. Preserve existing balances and completed matches.
- House fee 900 basis points, existing integer rounding, draw refunds, idempotency and independent review.
- Deadline does not award victory; payment availability remains server-owned.
- Preserve unrelated workspace edits and all Tibia services. Publish only Fifa GO after verification.

## Tasks

- [x] Baseline: isolated managed worktree from ad88498; run existing suite.
- [x] Policies: deadlines/readiness, compatibility validation, risk/visual-hash matching and skill ranking; unit tests first. Own policy modules and tests only.
- [x] Storage: incremental SQLite persistence, ledger reconciliation/migration, paged projections, private archival and bounded visual worker; tests first. Own database/storage/image/package files only.
- [x] Frontend: deferred render synchronization, wallet refresh, issue/reporting/prize, filters, account compatibility fields, paged lists, personal rank/admin capacity; tests first. Own frontend files only.
- [x] API integration: summaries/cursors, phases/risk/review, Pix references, independent upload/body preparation, deadline worker and archival, readiness/compatibility routes. Controller owns server.mjs and integration tests.
- [x] Independent review of each scope plus complete diff; fix findings and run full suite.
- [ ] Local desktop/mobile visual verification, migration/restart check, commit as Djow and publish GitHub/site with backup and rollback; verify delivered version.

## Review Focus

- Legacy balances and automatic settlements remain valid after migration.
- Concurrent join/upload/cancel cannot produce extra reserves, photos or rewards.
- Delayed or closed-modal updates eventually render without replacing input text.
- Cursor history is complete and never crosses account ownership.
- Archived evidence retains authorization and missing image analysis cannot auto-pay.

## Decisions

- Operational defaults: invitation 24h, preparation 10m, ready 2m, play 60m, review target 24h, archive 30d; stored deadlines preserve agreements and human review handles abandonment.
- Manual review threshold: 500 Coin entry, configurable and stored per new/open room.
- Apply in current session with agents on disjoint files and controller integration. Existing user approval covers applying the audited changes; no redundant approval request.

## Verification before publication

- Existing baseline: 224/224 tests passed.
- Final full suite: 283/283 tests passed; independent storage/integration reviews approved after regression fixes.
- Dependency audit: no known vulnerabilities found.
- Local desktop and 390 px mobile verification: Arena filters, reserve/join/preparation/readiness withdrawal, wallet, history, personal ranking and declared game-ID profile. No production transactions.
- Release procedure records active commit, private backup, dependency smoke and domain asset checks in the publication artifacts.

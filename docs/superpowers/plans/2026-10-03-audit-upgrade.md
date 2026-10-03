# Fifa GO — approved audit upgrade

Approved by the user: apply all recommendations from the preceding audit, using Superpowers. Architecture work across existing modules; preserve production data, wallet ledger, 9% room agreement, authenticated private evidence, existing design, and Tibia services. Payments remain unconfigured. No fabricated integrations.

## Design decisions
- Fix safety issues before adding convenience: compare both independent evidence photos, guard environment changes, validate penalty outcome, admission cap, full pending totals, bounded requests, staged upload cleanup and streamed downloads.
- Keep SQLite transactions and ledger validation. Cache serialized baseline rows instead of rescanning every SQL table; continue checking financial invariants.
- Account recovery uses one-time recovery codes generated after authenticated password verification; this works without an unconfigured email provider. Google accounts use Google recovery. Session revocation and password changes are private and invalidate old sessions.
- Add opt-in browser notifications with explicit permission; background Web Push requires configuration and will be identified as such. Never claim notifications work after the app closes without an actual push transport.
- Preserve unpaid/real Pix records; allow independent staff recovery of a paid closed order only with original proof, unique bank reference, amount and dates verified. No automated bank verification.
- Define application retention operationally: closed photos archive after 30 days; quota counts archives; deletion requests are reviewed and anonymization excludes pending disputes and financial records. Do not delete existing evidence automatically.
- Keep the separate local collection clearly marked as a demo; add achievements derived from real validated account results with original icons, no purchases or official licensed claims.

## Tasks
- [x] 1. Domain helper: structured extra time / penalties, environment guard, admission cap, deposit pending aggregate; regression tests.
- [x] 2. Storage: streamed private evidence, total quota/free space/orphan cleanup, baseline SQLite row diff cache; tests.
- [x] 3. Frontend helpers: bounded client requests, wallet/ranking/profile views, dual evidence component, notices, focus-safe history; tests.
- [x] 4. Controller integration: server routes, play actions, safe paid-order recovery, per-account login throttle, recovery/session endpoints and UI, room activity counts, wizard platform, concise free summary, app retention docs.
- [x] 5. Full regression suite, independent review, local desktop/mobile UI review with disposable data only.
- [ ] 6. Commit as Djow, push existing repository, publish isolated Fifa GO release, verify official assets/API/pages, archive worktree.

## Interface / conflict scan
| Tasks | Producer / consumer | Decision |
| 1 → 4 | domain helpers → server routes | Root owns server.mjs; agent helper only. |
| 2 → 4 | storage APIs and database → server | Preserve existing read/usage, add stream and capacity APIs; root wires after report. |
| 3 → 4 | client/views → play.js | Root owns play.js; helper agent owns account-views, backend-client, new frontend modules only. |
| Each | tests vs production | Real behavior, red before green; no production balance mutation in testing. |
| 4 → 6 | migrations/config → release | Backup before restart; no demo conversion or payments activation. |

Verification: Node 24 `node --test *.test.mjs backend/*.test.mjs`, syntax checks for changed JS, local page interactions at desktop/mobile, authenticated test fixtures outside production, official smoke requests and screenshots after release.

# Handoff — D1 hard-limit screener

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-2 input preparation, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/d1CapacityGate.ts`: validates a flat metrics JSON and screens caller-supplied aggregates against documented D1 hard limits. Checks projection sanity, 10 GB database ceiling, Workers Paid (and 500 MB Free ceiling when false), 2 MB row, R2-only binaries, 100 KB statement, 100 bound parameters, 50 MB result, 30 s p99 statement and 50/1,000 queries per invocation.
- Reports five always-open review items: size comfort, write-throughput headroom, indexed query shape, growth/retention and recovery/billing. `hardGatesPassed` is explicitly separated from DCR-2 acceptance.
- Added `backend-server/apps/api/src/scripts/d1-capacity-gate.ts` and npm script `capacity:gate`:
  `npm run capacity:gate -- --input <metrics.json> [--out <report.json>]`
- Added `d1CapacityGate.test.ts` with 6 tests.
- Updated `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BASELINE_REPORT.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with the media-inventory and backup-verifier suites — 16/16 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke with a valid fixture printed `D1 hard-limit screening: PASS` and `DCR-2 capacity gate: REVIEW REQUIRED (5 items)`.
- CLI smoke with an over-limit fixture exited 1 and reported every expected hard-limit failure.
- No MongoDB, D1, Cloudflare account, credential or production data access. These changes are uncommitted; the prior explicit commit/push authorization applied only to the 2026-11-22 changes.

## Important limitation

A hard-limit PASS is not DCR-2 acceptance. The tool does not collect metrics, does not verify a restore, and does not evaluate whether the dataset fits *comfortably* below 10 GB or whether throughput headroom is *substantial*. Those remain owner judgments with evidence. The screener uses decimal byte/ms units and depends on caller-supplied aggregates.

## Remaining / next

1. Owner supplies real aggregates in the documented input shape, plus Workers Paid confirmation.
2. Review the five open items with query/index, growth/retention, recovery and billing evidence.
3. Approve/refine the D1 schema and rehearse a restore before any production import.
4. DCR-3 detailed inputs, DCR-4 scope, credential rotation and a verified backup remain open.
5. Commit/push of this new slice requires separate explicit authorization.

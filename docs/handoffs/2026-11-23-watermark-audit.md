# Handoff — Watermark candidate audit

**Date:** 2026-11-23
**Task:** YUGM-DB-001 — final delta-sync input preparation, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/watermarkAudit.ts`: audits a caller-supplied snapshot or JSONL export for a proposed watermark field. Reports coverage, missing/invalid values, unique composite `(value, _id)` keys, duplicate keys, input-order inversions, sample gaps and a stable digest.
- Added `backend-server/apps/api/src/scripts/watermark-audit.ts` and npm script `delta:watermark`:
  `npm run delta:watermark -- --snapshot <dir> --field <name> [--out <report.json>]`
  or `npm run delta:watermark -- --input <records.jsonl> --field <name> [--out <report.json>]`
- Added `watermarkAudit.test.ts` with 7 tests.
- Updated `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with adjacent migration suites — 15/15 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on a generated JSONL fixture — `viable: true`, `already sorted: true`, no values echoed beyond IDs/digests.
- No MongoDB, D1, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

A viable result only means the proposed field can form a deterministic composite cursor over the supplied records. It does **not** prove that MongoDB can export by that cursor, and it does not choose the watermark. Non-date opaque strings are accepted as logical cursor values. The owner decisions in `final-delta-sync-design.md` remain open.

## Remaining / next

1. Owner decides the exact watermark field/order, hard-delete representation, child-row replacement scope and cutover window.
2. Owner approves an export, then run `delta:watermark` against real records.
3. Implement delta export/upsert in a separately authorized slice with dry-run and checkpoint behavior.
4. Preserve the baseline snapshot and rehearse a restore before any cutover.
5. Commit/push of this slice requires separate explicit authorization.

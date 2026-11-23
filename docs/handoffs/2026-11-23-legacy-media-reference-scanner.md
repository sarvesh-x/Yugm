# Handoff — Legacy media reference scanner

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-4 input preparation, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/legacyMediaReferences.ts`: reads either a JSONL export (`--input`) or an already-copied snapshot directory (`--snapshot`) and recursively scans string values for source-verified legacy media forms:
  - public `/uploads/<file>` (relative or absolute, including query-bearing URLs);
  - private `/api/trust-verification/media/<file>` and `/api/admin/assets/staging/<file>`;
  - `/api/badge-art/<id>/<version>`;
  - inline `data:image/...` values;
  - other absolute HTTP(S) URLs;
  - managed `/media/uploads/...` endpoints, reported separately so they are not mistaken for legacy binaries.
- Reports counts, normalized field paths, extensions, de-queried URL digests, long-string skips and a stable report digest. Raw URLs and customer content are never emitted.
- Added `backend-server/apps/api/src/scripts/legacy-media-references.ts` and npm script `inventory:legacy-media`:
  `npm run inventory:legacy-media -- --input <records.jsonl> [--out <report.json>]`
  or `npm run inventory:legacy-media -- --snapshot <snapshot-directory> [--out <report.json>]`
- Added `legacyMediaReferences.test.ts` with 7 tests.
- Updated `docs/cloudflare-migration/decision-request.md` (DCR-4), `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with the D1 screener, media inventory and backup verifier suites — 23/23 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on a generated JSONL fixture — correct counts and URL digests, no raw URL echo.
- No MongoDB, R2, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

This counts references, not existing binaries. It does not solve the documented finding that historical missing `/uploads` files cannot be reconstructed from database references alone, and it is not a media backup. URL digests are taken after stripping query/hash so signed URLs group by object path; raw values are intentionally never written to the report. No public/private bucket policy is asserted because DCR-4 is still open.

## Remaining / next

1. Owner approves a specific media export or snapshot copy and supplies the DCR-4 environment inputs and option A/B/C selection.
2. Run both `inventory:media` and `inventory:legacy-media` on that approved input; cross-check counts against the unresolved `/uploads` recovery gap.
3. Create a verified media backup and rehearse a restore before any cutover.
4. DCR-2 metrics, DCR-3 detailed inputs and credential rotation remain open.
5. Commit/push of this slice requires separate explicit authorization.

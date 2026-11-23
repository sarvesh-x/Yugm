# Handoff — Read-only snapshot export CLI

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-2 snapshot creation.

## Done

- Added `backend-server/apps/api/src/migration/nativeCollectionReader.ts`: keyset-paginated reads over an injected native MongoDB collection, supporting ObjectId and canonical string `_id` values.
- Added `backend-server/apps/api/src/scripts/export-snapshot.ts` and the `snapshot:export` npm script.
- The CLI wires `connectDatabase()` (env-provided URI, never printed) to `exportCollection()` and `writeSnapshotManifest()`, producing the manifest + JSONL snapshot format the other migration tools consume.
- Safety: requires `--confirm-isolated-export <label>`; accepts only collections present in reviewed `MAPPINGS`; refuses to overwrite an existing manifest; prints only aggregate counts/bytes; never prints the URI or records.
- String `_id` collections (`assets`, `media_objects`, `media_upload_sessions`, `media_quota_reservations`) are handled by default and overridable via `--string-id`.

## Verification performed

- New reader tests — 3/3 passed.
- Full API suite — 462/462 passed.
- API typecheck — passed.
- Strict credential guard — zero findings across 30 tracked config files.
- CLI guard paths verified to reject before any connection: missing args, missing collections, unreviewed collection.
- Opt-in `npm run test:export --workspace @yugm/api` passed against a disposable loopback MongoDB: 3 `users` (ObjectId) and 2 `media_objects` (string `_id`) exported, manifest and batch files verified.
- No real MongoDB connection was made, and no snapshot was exported by the assistant. These changes are uncommitted.

## Important limitation

The CLI has never been run against a real database. It is read-only with respect to the source and writes only to `--out`, but a production export can be large and must be separately approved. Use isolated staging or a restored backup. A successful export is not DCR-2 evidence; it only supplies the snapshot that `metrics:from-snapshot` can read.

## Usage

```powershell
cd C:\Users\longl\StudioProjects\Yugm\backend-server\apps\api
npm run snapshot:export -- --out "C:\path\to\snapshot" --confirm-isolated-export "staging-2026-11-23" --collections "users,wallet_transactions"
```

Use `--all-reviewed` instead of `--collections` only when a full export is intended and approved.

## Remaining / next

1. Owner runs the CLI against isolated staging or a restored backup.
2. Owner runs `metrics:from-snapshot` on the resulting snapshot.
3. Owner fills the 11 remaining metric fields and runs readiness runbook steps 3-10.
4. Commit/push of this slice requires new explicit authorization.

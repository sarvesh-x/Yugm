# 2026-11-26 — Account deletion R2/media cleanup

## Scope
Repair the 30-day account purge so it removes the deleted user's R2 objects and upload-staging rows, not just D1 metadata. No hosted operation, deploy or commit.

## Findings
- `purgeD1Account` cascaded `user_profile_media`, `user_owned_*` etc. but never queried `media_objects`, `media_variants`, `media_upload_sessions` or `media_quota_reservations`, leaving R2 objects and staging keys behind after anonymization.
- `user_auth_profile.source_id` is a primary key, so the graph's nullable-null update could not legally clear it.

## Changes
- `d1AccountDeletion.ts`: collect user-owned media objects, variants, upload sessions and quota reservation before cascade; add them as purge roots; collect R2 bucket/key pairs; delete R2 objects after the D1 transaction commits (best effort). `purgeExpiredD1Accounts` and `purgeD1Account` accept an optional `D1MediaBuckets` map.
- `d1AccountDeletion.ts`: `user_auth_profile` graph edge is now non-nullable so the row is deleted instead of nulling its PK.
- `d1Maintenance.ts`: `runD1Maintenance` accepts `buckets?` and forwards it to `purgeExpiredD1Accounts`.
- `d1Api.ts`: the scheduled maintenance path passes all five R2 buckets when media is enabled.

## Verification actually run
- Backend TypeScript typecheck (all workspaces) — pass.
- `npm run test:d1-worker` — 3/3 pass.
- `npm run test:domain` — 4/4 pass.
- `git diff --check` — clean.

## Open
- R2 deletion is best-effort after commit; a failed delete leaves an orphaned object reclaimed by later media sweeps.
- Hosted migration `0042` and production LiveKit remain unprovisioned.

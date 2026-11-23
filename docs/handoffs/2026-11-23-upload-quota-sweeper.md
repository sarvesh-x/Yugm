# Handoff — Expired upload-session quota sweeper

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-4 quota-leak local fix.

## Done

- Added bounded `sweepExpiredUploadSessions()` to `backend-server/apps/api/src/services/media.ts`.
- The sweeper atomically claims expired PENDING/PROCESSING upload sessions, marks them EXPIRED, sets `quotaReserved: false`, releases held quota exactly once and best-effort deletes the staging object.
- Wired the sweeper into `services/jobs.ts` local maintenance with error isolation.
- Added an integration test covering expired-session sweep, quota release, staging deletion and idempotent replay.
- Updated ADR-0005, DCR-4 decision request, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- `npm.cmd exec -- tsx --test src/services/media.integration.test.ts src/services/media.test.ts` — 14/14 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- No provider, credential, Cloudflare account, deploy or production data access. These changes are uncommitted.

## Important limitation

The sweeper runs only in local/inline maintenance. No Cloudflare Cron trigger or production job deployment has been provisioned. Staging object deletion is best-effort; quota release remains committed if deletion fails.

## Remaining / next

1. Owner approves scheduled-maintenance provisioning/deploy separately.
2. Fix Android progress/cancel wiring and post-grant failure handling in a separate client slice.
3. Implement the accepted private-media policy at the resource boundary before private category cutover.
4. Commit/push of this slice requires separate explicit authorization.

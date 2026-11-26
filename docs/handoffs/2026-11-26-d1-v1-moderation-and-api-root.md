# D1 v1 moderation and API root

- **Date:** 2026-11-26
- **Slice:** Mount 3 `/api/v1/moderation` routes and the `/api` root on the shared D1 Worker.

## What changed

- Added `POST /v1/moderation/report`, `POST /v1/moderation/appeal`, and `GET /v1/moderation/status` to `backend-server/apps/api/src/migration/d1Moderation.ts`.
- Added the legacy `/api` discovery response in `backend-server/apps/api/src/migration/d1App.ts`.
- Added fixture coverage in `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs`.

## Behavior preserved

- Auth required on all three moderation routes (checked before validation for `report`/`appeal`).
- Report validation matches legacy zod shape; report + moderation queue are inserted together, returning `{ reportId, queueId, status: "PENDING" }` with 201.
- Appeal validates action ID, requires the action to target the current user, rejects `UNBAN`, and creates a HIGH-priority pending queue item with the legacy reason/notes shape.
- Status returns legacy safety/status fields with defaults (`trustScore` 100, `riskLevel` LOW), recent moderation actions, strikes/reason, and pending appeal count.
- `/api` root returns the legacy service/version/environment/uptime/health/authentication/endpointGroups payload without authentication.

## Boundaries

- `POST /v1/moderation/report` requires at least one target (`targetUserId`, `roomId`, or `messageId`); the legacy flow would attempt a queue insert that could not satisfy the D1 NOT NULL constraint. This is now a 400 validation error instead of a 500.
- Legacy push/socket side effects for report/queue creation are not emitted; MongoDB remains authoritative.
- No new migration.

## Verification

- `npm.cmd run typecheck` (backend-server) — passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 577 D1 / 571 matched / 67 missing; `/api/v1` 5/0 and `/api/` 1/0.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1).
- `npm.cmd run secrets:check:strict` — passed.
- Scoped `git diff --check` — warning only: LF/CRLF in `d1Moderation.ts`.
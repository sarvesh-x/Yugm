# Handoff: Worker runtime compatibility and image processing boundary

**Date:** 2026-11-22  
**Task:** YUGM-WORKER-1101  
**State:** Locally implemented and verified; deployed staging not redeployed or verified.

## What changed

- Added `backend-server/apps/api/src/services/imageProcessor.ts`: host-neutral processor registry and non-sensitive health detail.
- Added `backend-server/apps/api/src/services/imageProcessor.node.ts`: the only API module importing `sharp`; installed by `apps/api/src/index.ts`.
- Added `backend-server/apps/cloudflare-worker/src/imageProcessor.ts`: Cloudflare Images binding provider using `.info()` and `.input().transform(...).output({ format: "image/webp", ... })`.
- `runtime.ts` installs the Worker provider before API modules load. `media.ts` and `assets.ts` no longer import Sharp. Scheduled maintenance is no longer part of the Sharp chain.
- Added `images: { binding: "IMAGES" }` to `wrangler.jsonc`, `wrangler.staging.jsonc` and `wrangler.production.jsonc`.
- Split `/health` (liveness, Worker shell) from `/ready` (database, storage and image processor readiness). CI, `test/realtime.mjs` and `test/staging-smoke.mjs` now gate on `/ready`.
- Added structured JSON logs and controlled `503 WORKER_UNAVAILABLE` responses for Worker request/binding failures; alarm retries log structured failure events.
- Fixed an `IndexOptionsConflict` found by the local suite: asset/media schema index names/options now match migrations v6/v9, and known legacy default-named indexes are dropped first. Index-only; no documents rewritten.
- Documentation: [runtime boundary](../infrastructure/worker-runtime-image-processing.md), API health/readiness and asset contract updates, Worker README/audit links, CI audit row, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`, `INDEX.md`.

## Verification passed

- `npm.cmd run typecheck` from `backend-server` (all workspaces).
- `npm.cmd test --workspace apps/api` — 360/360, including the new registry test and all managed-media integration tests.
- `npm.cmd run test:hardening --workspace apps/api` — 34/34.
- `npm.cmd run dry-run:staging --workspace apps/cloudflare-worker` — binding table includes `env.IMAGES (Images)`.
- Wrangler dry-run with `--outdir`, then grep of emitted `index.js` — no Sharp import/path or `createRequire(import.meta.url)`; only a source-map comment names the Node-only file.
- `npm.cmd run test:realtime --workspace apps/cloudflare-worker` — passed after the index fix, covering `/ready`, media, WebSockets, bonds, PK alarms, reconnect/heartbeat and room closure.

Known non-blocking warning: `whatwg-url` default export from `unenv` during bundling (pre-existing).

## Remaining / next

1. Obtain explicit authorization to deploy `yugm-api-staging` with the new `IMAGES` binding.
2. Verify deployed `/health`, `/ready` (`images.configured=true`, `db.ready=true`, `storage.ready=true`), representative auth/REST routes, media upload, scheduled maintenance, Durable Object init and realtime.
3. Confirm staging no longer emits Error 1101 and review structured logs for `worker_request_failed`, `worker_binding_failed` and `scheduled_room_work_failed`.
4. Live R2 managed-upload cycle, D1/R2/Queue binding decisions and production deployment remain separate approvals.

Do not commit, push, deploy, provision, migrate applied data, change credentials or publish a release without explicit authorization.

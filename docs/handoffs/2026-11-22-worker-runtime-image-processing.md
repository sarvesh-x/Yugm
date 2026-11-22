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

## Commit, push and staging deploy (2026-11-22)

- Committed all work as `80d46af` and pushed to `origin/master`, triggering Cloudflare staging run #76 (`https://github.com/sarvesh-x/Yugm/actions/runs/45048524822`).
- All pre-deploy CI steps passed: install, typecheck, unit tests, hardening (34/34), Worker realtime suite, and admin build.
- The deploy step itself succeeded and the new Worker code went live. The CI gate failed because the already-live Durable Object kept serving the prior script generation for roughly 3-4 minutes, during which `/ready` returned the controlled `503 WORKER_UNAVAILABLE`. The gate's original short retry window elapsed first (exit code 4 from `jq` on empty input).
- After the Durable Object restarted, direct probes passed with no Error 1101 and no error events in a fresh `wrangler tail`:
  - `/health` → `ok: true`
  - `/ready` → `ok: true`, `db.ready: true`, `db.name: YugmStaging`, `storage.ready: true`, `images.configured: true`, `images.provider: cloudflare-images`; scheduled `lastCronRun` present.
- Fix applied: widened the CI `/ready` retry window to `--retry 40 --retry-delay 5 --retry-max-time 480` and documented the restart delay in the troubleshooting guide.

## Remaining / next

1. Verify the next CI run goes green with the widened gate.
2. Verify representative auth/REST routes, a media upload cycle, and realtime on deployed staging.
3. Live R2 managed-upload cycle, D1/R2/Queue binding decisions and production deployment remain separate approvals.

Do not provision, migrate applied data, change credentials or publish a release without explicit authorization.

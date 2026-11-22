# Worker runtime and image processing boundary

**Date:** 2026-11-22  
**Status:** Local source, bundle and runtime checks passed. Deployed staging is **not** verified; no deploy was authorized or performed.

## Problem and root cause

The deployed `yugm-api-staging` Worker returned Cloudflare Error 1101 during initialization. The stack showed Sharp's ESM entry calling `createRequire(import.meta.url)` with an undefined path under `nodejs_compat`.

The import chain was:

- `src/index.ts` → `src/runtime.ts` → `../../api/src/app.js`
- `app.ts` → admin media/assets routes → `services/media.ts` and `services/assets.ts` → `sharp`
- scheduled maintenance → `services/jobs.ts` → dynamic `import("./badges.js")` → `services/assets.ts` → `sharp`

Dynamic imports do not remove a module from the Worker bundle. Any module reachable from the Worker's module graph, including scheduled jobs, can pull a native library into the bundle.

## Implemented boundary

- `backend-server/apps/api/src/services/imageProcessor.ts` is the host-neutral registry (`ImageProcessor`, metadata/resize contracts, `setImageProcessor`, `getImageProcessor`, `getImageProcessorHealth`).
- `backend-server/apps/api/src/services/imageProcessor.node.ts` is the **only** API module that imports `sharp`. It is installed by the Node entry point `apps/api/src/index.ts`.
- `backend-server/apps/cloudflare-worker/src/imageProcessor.ts` implements the same contract with the Cloudflare Images binding. It uses only binding APIs; no native filesystem, child-process or Sharp import.
- `apps/cloudflare-worker/src/runtime.ts` installs the Worker processor **before** dynamically loading API modules, so both HTTP and scheduled maintenance paths resolve through the registry.
- Shared services (`media.ts`, `assets.ts`) no longer import Sharp. If no processor is installed, managed session creation returns `503 "Managed media uploads are unavailable on this host"`, which preserves the Android legacy `/upload/avatar` fallback contract.

## Image behavior preserved

- Signature, MIME, byte-count, dimension, quota and expiry validation remain server-side and unchanged.
- Metadata uses Images `.info(stream)`. Resize/WebP uses `.input(stream).transform(...).output({ format: "image/webp", quality, anim })`.
- `fit=scale-down` preserves aspect ratio and avoids upscaling, matching the Node provider's `inside` + `withoutEnlargement` behavior.
- Gif/animated sources use the first frame for derived variants; EXIF/metadata is stripped by the transformation. Private originals are preserved for moderation and rollback.
- Idempotent completion, atomic avatar reference commit, prior-version preservation and short-lived signed download grants remain unchanged.
- No signed URL or canonical private key is persisted in a public DTO.

Only the Cloudflare Images **transformation/info binding** is used. No Images storage upload, custom domain or paid Images service was enabled.

## Health, readiness and errors

- `GET /health` and `GET /api/health` are lightweight liveness probes. The Worker answers `/health` in the Durable Object shell before runtime startup, so it must not be used as a dependency gate.
- `GET /ready` and `GET /api/ready` are served by Express after the Node runtime starts. They check database connection, storage configuration and image processor installation. Redis and job workers are reported but not required because both hosts have inline fallbacks.
- CI (`cloudflare-staging.yml`), the local Worker realtime suite and the opt-in staging smoke suite now gate startup on `/ready`, including `.images.configured`.
- Express errors are logged as structured JSON with `requestId`, route, status, code, error name and message; production logs omit stacks. Worker runtime, binding and alarm failures log `worker_request_failed`, `worker_binding_failed` and `scheduled_room_work_failed` events and return a controlled `503 WORKER_UNAVAILABLE` JSON response instead of an opaque platform error where the failure is catchable.

## Binding and startup configuration

- `images: { binding: "IMAGES" }` was added to `wrangler.jsonc`, `wrangler.staging.jsonc` and `wrangler.production.jsonc` for parity.
- The staging Worker still uses `STORAGE_DRIVER=mongodb`; no D1, R2 or Queue binding/provisioning or storage-driver switch is part of this fix.
- No credential value was added, printed or duplicated. Existing credential remediation findings remain open.
- A separate startup defect found by the local suite is also fixed: Mongoose auto-created asset/media indexes under default names while additive migrations v6/v9 tried to create the same keys with explicit names. Schema index names/options now match the migrations, and the migrations drop known legacy default-named equivalents before creating named indexes. This is index-only; no document is rewritten.

## Verification actually run

- `npm.cmd run typecheck` from `backend-server` (all workspaces) — passed.
- `npm.cmd test --workspace apps/api` — **360/360** passed, including the new `imageProcessor.test.ts` registry test and all managed-media integration tests.
- `npm.cmd run test:hardening --workspace apps/api` — **34/34** passed.
- `npm.cmd run dry-run:staging --workspace apps/cloudflare-worker` — passed; binding table includes `env.IMAGES (Images)`. The pre-existing `whatwg-url` default-export warning from `unenv` remains.
- `wrangler deploy --dry-run --config wrangler.staging.jsonc --outdir ...` followed by grep of emitted `index.js` — no `node_modules/sharp`, `sharp/dist`, `from "sharp"`, `require("sharp")`, `imageProcessor.node` or `createRequire(import.meta.url)` matches. Only a source-map comment mentions the Node-only filename.
- `npm.cmd run test:realtime --workspace apps/cloudflare-worker` — passed against a disposable loopback MongoDB replica set after the index fix. It covered `/ready`, GridFS media, Socket.IO auth/rooms/realtime, bonds gifts, PK alarms/recovery, reconnect, heartbeat and room closure.

Not run: deployed staging requests, live R2 upload cycle, D1/R2/Queue provisioning, production deployment, Android device QA. Do not mark Error 1101 fixed until deployed staging serves `/ready` with `images.configured=true` and stops producing 1101.

## Troubleshooting checklist

1. Reproduce with `curl -fsS "$STAGING_API/ready"` and inspect `images.configured`; use `/health` only for liveness.
2. Inspect structured logs for `worker_request_failed`, `worker_binding_failed` and `scheduled_room_work_failed`.
3. Rebuild the dry-run bundle and grep the emitted JavaScript for Sharp paths before deploying.
4. Search API/Worker sources for `from "sharp"`, `require("sharp")` and `imageProcessor.node`; only `imageProcessor.node.ts` may import it.
5. Confirm the deployed binding table contains `env.IMAGES` and that no paid Images storage feature was inadvertently enabled.
6. Check that migrations v6/v9 and the `AssetObject`/`MediaObject` schema still use matching index names before assuming a startup `IndexOptionsConflict` is unrelated.

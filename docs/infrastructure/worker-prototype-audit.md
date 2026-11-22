# Existing Cloudflare Worker prototype audit

**Date:** 2026-11-22  
**Status:** Phase 0 source audit. The prototype is experimental and is not the target production architecture.

## Scope and evidence

This audit inspected `backend-server/apps/cloudflare-worker` directly, including its README, package scripts, three Wrangler configurations, TypeScript sources and test scripts. The existing [Cloudflare migration audit](../cloudflare-migration/audit.md) was used as background, not as proof. The 2026-11-22 runtime/image remediation is documented separately in [Worker runtime and image processing boundary](worker-runtime-image-processing.md).

## Current implementation

### Entry point and lifecycle

`src/index.ts` exports a single `YugmApi` Durable Object and a default Worker `fetch` handler:

- The default handler resolves `API_SERVICE.idFromName("yugm-global-api")`, so every request reaches one global object instance.
- `YugmApi.fetch()` calls `ensureReady()`, then forwards ordinary HTTP requests to `handleAsNodeRequest(8787, request)`.
- Socket.IO upgrade requests on `/socket.io` or `/socket.io/` are delegated to `src/socketBridge.ts`.
- Requests to `/api/pk/*` schedule a fallback alarm 15 seconds ahead before forwarding, then reschedule after the response.
- `alarm()` runs PK deadlines and, at most every 15 minutes, maintenance and socket maintenance. Failures retry after 30 seconds.
- Startup refuses `YUGM_STAGE=production`. It only accepts `local` or `staging`, requires database name `YugmStaging`, and requires `STAGING_DB_ISOLATED=true` for staging.
- Binding values are copied into `process.env` before the API modules load.

### Node compatibility runtime

`src/runtime.ts` starts the existing Express app inside the Durable Object:

- Imports API config/app/services: database, auth indexes, Firebase, jobs, achievement seeder, cosmetics, production indexes, migration, Redis, Socket.IO, official rooms, storage, room lifecycle, LiveKit and bonds.
- Configures LiveKit from bindings.
- Connects MongoDB, creates indexes, runs migrations, seeds defaults, connects Redis and starts job workers with local cron disabled.
- Creates a Node HTTP server from `createApp()` and listens on port 8787.
- Initializes Socket.IO with `transports: ["websocket", "polling"]` and a `WorkerUpgradeServer` shim instead of the Node `ws` engine.

### Socket.IO bridge

`src/socketBridge.ts` implements the small `ws`-like surface Engine.IO expects:

- Validates GET upgrade, `transport=websocket`, `EIO=4`, and no existing `sid`.
- Builds an Engine.IO-shaped request object with headers, query and `cf-connecting-ip`.
- Calls Engine.IO `verify()` and `handshake()` before returning a `101` response with `WebSocketPair`.
- Enforces `maxHttpBufferSize` and translates messages/errors/close events.
- Uses the standard, non-hibernating `server.accept()` path and depends on Engine.IO internals.

### Configurations and scripts

| File | Purpose | Notable facts |
|---|---|---|
| `wrangler.jsonc` | Local development | Compatibility date `2026-08-04`, `nodejs_compat`, `API_SERVICE` SQLite Durable Object binding, aliases for `mongoose` and `iconv-lite`, observability logs enabled but traces disabled. Its `vars` block contains plaintext credentials; see [the finding](tracked-worker-credentials-finding.md). |
| `wrangler.staging.jsonc` | Deployed staging prototype | Same runtime shape, `YUGM_STAGE=staging`, `YugmStaging`, CORS restricted to the staging Pages origin, observability enabled. Secrets are expected outside the file. |
| `wrangler.production.jsonc` | Guarded production config | `YUGM_STAGE=production`, database name `Yugm`, `STORAGE_DRIVER=mongodb`, `CORS_ORIGIN=*`. Production startup is deliberately disabled in code. |

Package scripts provide `dev`, `typecheck`, local realtime test, opt-in staging smoke/admin tests, staging deploy and production/staging dry runs.

### Tests

- `test/realtime.mjs`: local disposable MongoDB replica set plus a local Worker. Covers health, GridFS upload/public range retrieval/private authorization/quota contention/oversize rejection, Socket.IO auth, room join acknowledgement, typing and room broadcasts, bonds gift reservation/realtime, PK start/ready/restart recovery/close, reconnect within grace, heartbeat, invalid/revoked tokens and room closure.
- `test/staging-smoke.mjs`: opt-in remote staging smoke against the documented staging URL, with explicit `--confirm-isolated-staging` and ignored `.dev.vars.staging`. Creates and removes its own fixtures.
- `test/staging-admin.mjs`: opt-in staging admin login/session fixture with cleanup.
- No Android device test, no production-scale load test, and no full API contract suite through the Worker were observed in these scripts.

## Known limitations

From README and source:

- Singleton Durable Object means no horizontal scaling and loss of in-process state on restart/hibernation.
- Uploads are capped at 10 MiB and stored in MongoDB GridFS; the Node API permits much larger recordings.
- MongoDB media quota is 128 MiB by default and shares the free database's 0.5 GB capacity with all other data and indexes.
- Failed or interrupted uploads can leave an unused reservation requiring reconciliation.
- Socket.IO uses non-hibernating WebSockets; Durable Object active duration cost is unbounded by application design.
- Engine.IO internals make the bridge fragile across dependency changes.
- Room presence and disconnect cleanup have incomplete process-restart recovery.
- Production startup is disabled, and no production data or R2 resource has been touched.
- The tracked local config exposes credentials; treat them as compromised.

## Target replacement direction

The target architecture must not preserve the singleton wrapper as production design:

- Split the Express monolith into Workers handlers with typed repositories and service boundaries.
- Move authoritative relational state to D1 or PostgreSQL/Hyperdrive after the capacity decision.
- Preserve binaries in R2 with immutable versioned keys and a single upload pipeline.
- Scope Durable Objects by conversation, room, user presence or other coordination boundary, and use hibernation-compatible WebSockets where possible.
- Preserve the Socket.IO/Engine.IO wire protocol only if a tested adapter can reproduce authentication, acknowledgements, rooms and dedupe; otherwise define an explicit versioned protocol migration with Android and admin clients.
- Use Queues for durable async work, KV only for non-critical cache/config, and Cron for bounded idempotent maintenance.
- Keep secrets in deployed Worker secrets/secret manager and ignored local files, never in tracked configuration.

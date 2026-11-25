# Cloudflare Worker

The local and production D1 entrypoints use the `yugm` database with separate
bindings. The [D1 admin setup](../../../docs/handoffs/2026-11-25-d1-admin-auth-and-media.md)
covers login, Pages CORS, local and hosted bootstrap SQL, and the admin
migration status. The prototype information below describes the legacy
staging entrypoint.

The Worker is a staging prototype. Production startup is deliberately disabled
until the migration acceptance checks in [the audit](../../../docs/cloudflare-migration/audit.md)
are complete. It does not proxy to the current backend and it does not need an
R2 subscription. The current deployment and production credentials must not be
used as staging fixtures.

## Local checks

From `backend-server`:

```sh
npm ci
npm --workspace apps/cloudflare-worker run typecheck
npm --workspace apps/cloudflare-worker run dry-run:staging
npm --workspace apps/cloudflare-worker run test:realtime
```

The last command creates a disposable, loopback-only MongoDB replica set and a
local Worker. It tests `/ready` startup gating, Socket.IO WebSocket
authentication, room acknowledgements, broadcasts, disconnect/reconnect and
heartbeat, PK alarm recovery after a Worker restart, room closure, GridFS
uploads, byte ranges, private media access and media quota contention. It does
not connect to an existing user database or prove production capacity. The
MongoDB test binary must be available or downloadable for the platform running
the test.

## Image processing and health checks

The Worker must not bundle `sharp` or any other natively loaded Node library.
Image work goes through the host-neutral registry in
`apps/api/src/services/imageProcessor.ts`; the Worker installs the Cloudflare
Images binding provider before API modules load, while the Node API installs
the Sharp provider in its own entry point. Dynamic imports and scheduled jobs
are part of the Worker bundle, so they must also use the registry. See
[the runtime boundary](../../../docs/infrastructure/worker-runtime-image-processing.md)
for the Error 1101 root cause, bundle checks and troubleshooting steps.

The `IMAGES` binding is declared in all three Wrangler configs and uses
transformation/info APIs only; no paid Images storage is enabled. If the
binding is absent, managed uploads return `503` and clients use the documented
legacy upload fallback.

Use `/health` only for cheap liveness. The Worker answers it before runtime
startup. Use `/ready` for dependency readiness and deployment gates; it checks
database, storage and image processor configuration. CI and the staging smoke
suite use `/ready`.

Staging has also been deployed to `yugm-api-staging.sarveshkumar10101.workers.dev`.
The opt-in `test:staging` and `test:staging-admin` scripts use the ignored
`.dev.vars.staging` file and create and remove only their own fixture records.
These scripts mutate the isolated staging database; do not point the file at a
production cluster. One longer room-close run timed out before two later passes.

## Staging prerequisites

- Authenticate Wrangler to the intended Cloudflare account on the Workers Free
  plan, and create an entirely separate MongoDB Atlas Free cluster with a
  separate database user for staging. Verify the hostname, database and user are
  not production resources before proceeding.
- Use separate, randomly generated `JWT_SECRET` and other staging credentials.
  Set `MONGODB_URI`, `JWT_SECRET`, and `STAGING_DB_ISOLATED=true` as secrets
  in the staging Worker; `YugmStaging` is the only accepted database name.
  The isolation flag is an operator assertion, not a technical guarantee that
  the cluster is separate. Never put credentials in source control or chat.
- Configure a free LiveKit test project and its credentials if testing voice or
  video; the Worker cannot supply media transport by itself. Configure the
  staging Pages origin explicitly in CORS before testing the admin app.
- Only use disposable staging users and data. Worker startup creates indexes,
  runs migrations and seeds default data, while scheduled maintenance includes
  account and room cleanup. Run through the audit's acceptance checks before
  granting access to real users.

## Current limits

The Worker temporarily limits uploads to 10 MiB and stores them in MongoDB
GridFS. MongoDB media has a configurable 128 MiB payload quota by default;
the free database's 0.5 GB total also includes all non-media records and indexes.
Failed or interrupted uploads can leave a conservative unused reservation.
Existing files must be inventoried and reconciled before a cutover.

WebSocket connections use non-hibernating Durable Objects and the existing
Engine.IO implementation. The bridge depends on Engine.IO internals, so its
integration test must pass after every dependency change. Process-restart
recovery for room presence and disconnect cleanup is still incomplete. The
Worker has not been tested against Android devices or deployed Cloudflare
limits. Do not infer production capacity from a local test.

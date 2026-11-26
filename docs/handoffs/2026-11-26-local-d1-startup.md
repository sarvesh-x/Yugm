# Local D1 startup

The debug Worker's default D1 persistence directory was absent. The previous launcher opened that directory without applying migrations, so the schema check returned `D1_SCHEMA_UNAVAILABLE` when requests reached an empty database.

From `backend-server`, run `npm run dev` to apply pending migrations for local `yugm` and then start the Worker at `127.0.0.1:4000`. The default directory is `apps/cloudflare-worker/auth-local/.wrangler/state`. Pass `-- --persist-to <path>` to use an existing debug D1/R2 directory. Wrangler reports migration failures before the launcher starts the Worker. `npm run d1:setup:local` is available for migration-only runs. [Emulator configuration](2026-11-24-local-d1-auth-emulator.md) · [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

## Verification

- `npm run dev` initialized the default local directory through `0041` using Wrangler 4.164.0. `GET /ready` returned HTTP 200 and `storage: "d1"` on port 4000. Wrangler listed zero pending migrations.
- An empty Google auth request with `Host: 10.0.2.2:4000` returned HTTP 422 `VALIDATION` from the live local Worker.
- `npm run dev:auth --workspace @yugm/cloudflare-worker -- --port 4127 --persist-to <path>` also returned HTTP 200 from `/ready` with a fresh directory containing spaces. Wrangler listed zero pending migrations for that directory.
- `npm run test:auth-worker --workspace @yugm/cloudflare-worker` passed. A live Firebase sign-in and hosted D1 were outside this verification.

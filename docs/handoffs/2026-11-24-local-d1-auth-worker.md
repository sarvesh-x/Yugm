# Local D1 Auth Worker

The loopback Worker runs the existing Auth HTTP routes with the D1 account, access and session stores. It starts its own Express bridge and loads only the Auth router. The standard API and staged Worker still use the legacy runtime. [Worker entry point](../../backend-server/apps/cloudflare-worker/src/authLocal.ts) · [Local configuration](../../backend-server/apps/cloudflare-worker/auth-local/wrangler.jsonc)

## Local commands

Run from `backend-server`.

```powershell
npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker
npm.cmd exec --workspace @yugm/cloudflare-worker -- wrangler d1 execute AUTH_DB --config auth-local/wrangler.jsonc --local --file ../api/migrations/d1/0001_initial.sql
npm.cmd run dev:auth --workspace @yugm/cloudflare-worker
```

The first command builds the local Worker with a Wrangler dry run and runs the bundle on workerd with an ephemeral D1 binding and generated signing keys. It needs no credentials. For interactive development, put a unique local `JWT_SECRET` of at least 32 characters and the test Firebase project's `FCM_PROJECT_ID` in `backend-server/apps/cloudflare-worker/auth-local/.dev.vars`. Git ignores this file. The D1 command writes the draft schema to the dedicated local database. Check `/health` and `/ready` on the loopback URL printed by Wrangler. Readiness checks initialization and the Auth schema. Leave live rollout configuration out of the local file.

## Verified

- The Worker served liveness, returned `503` with a blank D1 database, and became ready after applying the schema. A non-loopback hostname and a route outside Auth returned `404`.
- The HTTP fixture rejected a token from the wrong project and an unverified email without writing data. A verified signup stored the Firebase UID and a hashed refresh token in D1. `/auth/me`, refresh rotation, immediate access revocation, logout and return sign-in passed. Only the stubbed Firebase certificate endpoint was allowed by the fixture's outbound handler. [Worker test](../../backend-server/apps/cloudflare-worker/test/auth-worker.mjs)
- The local Wrangler schema command applied 207 statements. The Worker dry run emitted an Auth bundle with no Sharp module or Node image processor and reported the existing `whatwg-url` alias warning.
- Worker typecheck, 22 focused API tests and `npm.cmd run secrets:check:strict` passed. The API tests cover the mounted App Check gate, MongoDB and D1 session contracts, and the end-to-end Auth journey. Run them with `npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/migration/d1AuthSessionStore.test.ts`.

## Remaining acceptance

The fixture uses generated Firebase keys with App Check disabled. Live Firebase, App Check on Workers and the full Android Auth journey still need test-project and device evidence. Auth includes Mongoose for in-memory schema behavior and uses the existing Redis limiter's isolate-local fallback. Shared rate limiting, protected routes outside Auth, realtime and production import still need their own work and verification. No Cloudflare resource was provisioned, no deployment was made, and no staging or production data was used. [Migration gate tracker](../migration/MIGRATION_PROGRESS.md)

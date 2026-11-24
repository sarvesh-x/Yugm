# Local D1 Profile reads

The loopback Worker now serves authenticated reads for `GET /api/users/me`, `GET /api/users/:id`, `GET /api/users/public/:id` and `GET /api/users/by-username/:username`. The `public` alias follows the authentication requirement observed in the mounted MongoDB API. Profile reads and Express share session verification and public-profile serialization. [Local Worker](../../backend-server/apps/cloudflare-worker/src/authLocal.ts) · [D1 reader](../../backend-server/apps/api/src/migration/d1ProfileReads.ts)

## What passed

- The mounted MongoDB fixture and the D1 handler returned matching JSON for own-profile and viewer reads. The fixture covered relationship counts, self-only wallet data, contact-data omission, trust level, legacy missing and null fields, profile media ordering, username aliases, invalid IDs and blocked pairs in both directions. Session revocation denied a subsequent D1 read.
- D1 visits preserved imported row identity on repeat reads and skipped self and private visitor activity. The bundled Worker recorded a visit through its execution context after a permitted viewer read. [Profile fixture](../../backend-server/apps/api/src/routes/profileJourney.characterization.test.ts) · [Worker smoke test](../../backend-server/apps/cloudflare-worker/test/auth-worker.mjs) · [Workers execution context](https://developers.cloudflare.com/workers/runtime-apis/context/)
- The draft schema tracks legacy missing values separately from explicit nulls. It adds indexes for relationship counts and a unique profile-visitor key. The regular API still reads and writes through MongoDB. The local Worker reports users offline because it has no live presence provider. [Draft schema](../../backend-server/apps/api/migrations/d1/0001_initial.sql)

## Reproduce from `backend-server`

```powershell
$env:YUGM_RUNTIME = 'cloudflare'
$env:NODE_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:1/profile-unit'
$env:REDIS_URL = ''
$env:JWT_SECRET = 'profile-local-test-fixture-signing-key'
npm.cmd run schema:d1 --workspace @yugm/api
npm.cmd exec --workspace @yugm/api -- tsx --test --test-concurrency=3 --test-reporter=spec src/routes/profileJourney.characterization.test.ts src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/migration/d1AuthSessionStore.test.ts src/migration/mappings.test.ts src/migration/mappings-bonds.test.ts
npm.cmd run typecheck --workspace @yugm/api
npm.cmd run typecheck --workspace @yugm/cloudflare-worker
npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker
npm.cmd run secrets:check:strict
```

All 52 focused API checks passed. Both typechecks, the local Worker smoke test and the strict credential check passed. The fixtures use disposable MongoDB and ephemeral local D1. A previously initialized Wrangler development database needs a fresh local persistence directory for the revised draft schema. `CREATE TABLE IF NOT EXISTS` does not add the new column to an existing table.

## Resume here

The follow-up wired `PATCH /api/users/me` and verified the committed response and first-completion effects against the mounted fixture. The Android Profile journey, live presence, staging verification and production acceptance remain open. [Profile edit follow-up](2026-11-24-d1-profile-edits.md) · [Current task](../CURRENT_TASK.md)

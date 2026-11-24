# Local D1 Profile edits

The loopback Worker now handles `PATCH /api/users/me` on D1 using the existing Profile validation and normalization. It shares the Auth session guard and checks that the session is still active when claiming the write. The response comes from the committed profile, with self-only email, completion state and legacy field shapes. The standard API, staging and production still use MongoDB. [Worker entry](../../backend-server/apps/cloudflare-worker/src/authLocal.ts) · [D1 Profile edit](../../backend-server/apps/api/src/migration/d1ProfileEdits.ts)

First completion saves the Profile and terms, grants 80 account XP, advances Battle Pass progress and applies any account-level coin award in one D1 batch. The batch includes the grant receipts, wallet entry and level-up inbox row when earned. A concurrent edit that loses its write claim re-reads before trying again. The draft initial schema adds a Profile edit token and unique indexes for completion-related receipts. Use a fresh local Wrangler persistence directory for the revised draft. This change did not apply a migration to an existing database. [Completion statements](../../backend-server/apps/api/src/migration/d1ProfileCompletion.ts) · [Draft D1 schema](../../backend-server/apps/api/migrations/d1/0001_initial.sql) · [D1 batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

## Verification

- The mounted MongoDB and D1 fixtures matched the full setup and repeat-edit responses. They covered generated avatars, clearing a list, and the account-level reward. A forced conflict in the wallet ledger rolled back the Profile and reward writes. After removing the conflicting fixture row, retrying earned the expected 80 XP, 25 coins, inbox entry and Battle Pass progress. [HTTP fixture](../../backend-server/apps/api/src/routes/profileJourney.characterization.test.ts)
- The bundled Worker passed with local D1 as its only service binding. It exercised session revocation, validation, username conflict, concurrent setup with one completion reward, distinct concurrent edits and advancement in an existing premium Battle Pass. [Worker smoke test](../../backend-server/apps/cloudflare-worker/test/auth-worker.mjs)
- All 67 focused API checks, both typechecks and the Worker smoke test passed. The strict tracked-config credential scan returned zero findings. The schema and static inventories were regenerated.

## Reproduce from `backend-server`

```powershell
$env:YUGM_RUNTIME = 'cloudflare'
$env:NODE_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:1/profile-unit'
$env:REDIS_URL = ''
$env:JWT_SECRET = 'profile-local-test-fixture-signing-key'
npm.cmd run schema:d1 --workspace @yugm/api
npm.cmd exec --workspace @yugm/api -- tsx --test --test-concurrency=3 --test-reporter=spec src/routes/profileJourney.characterization.test.ts src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/migration/d1AuthSessionStore.test.ts src/services/profileCompletion.test.ts src/routes/profileFeatures.test.ts src/migration/mappings.test.ts src/migration/mappings-bonds.test.ts
npm.cmd run typecheck --workspace @yugm/api
npm.cmd run typecheck --workspace @yugm/cloudflare-worker
npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker
npm.cmd run secrets:check:strict
node scripts/production-inventory.cjs
```

## Resume here

Exercise Android setup and Edit Profile against the loopback D1 Worker. Check consent, server-confirmed navigation after setup, validation and retry behavior, and the saved profile after reloading. The D1 fixture verified inbox persistence. Live `PROFILE` and `TASKS` invalidation, presence, managed-avatar upload and old-object cleanup need separate parity checks. Staging and production checks remain open. Settings follows the local Profile device check. [Current task](../CURRENT_TASK.md) · [Journey order](../migration/implementation-plan.md#journey-order)

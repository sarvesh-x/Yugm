# Profile HTTP baseline and local D1 import

Android's Profile ViewModel reads the signed-in user's profile by ID through `GET /api/users/:id`. `GET /api/users/me` goes through the same server projection. Profile setup and editing send `PATCH /api/users/me`. Setup only proceeds after the response reports `profileCompleted`. The edit screen uses the returned name, handle and account state, with some other display fields still taken from its local draft. [Profile ViewModel](../../android-client/feature/profile/src/main/java/com/yugm/app/feature/profile/viewmodel/ProfileViewModel.kt) · [Android API](../../android-client/core/api/src/main/java/com/yugm/app/core/api/UserApi.kt) · [Profile setup](../../android-client/feature/auth/src/main/java/com/yugm/app/feature/auth/viewmodel/ProfileSetupViewModel.kt)

## Observed behavior and fixes

- The original `PATCH` committed the normalized fields and granted completion XP, but returned an incomplete `user` with `profileCompleted` set to false. The handler spread a hydrated Mongoose document before serialization, losing access to the model getters. It now serializes the committed document and adds the active Bond count and self-only email fields to the result. [HTTP handler](../../backend-server/apps/api/src/routes/users.ts)
- The mounted API returned `401` for anonymous reads, including `/users/public/:id`. The earlier friends router is mounted at `/api` and requires a session. An authenticated viewer receives the profile without contact details or wallet balance, and a blocked viewer receives `404`. Own and viewer reads derive relationship counts from their source rows. [Application mounts](../../backend-server/apps/api/src/app.ts) · [Friends guard](../../backend-server/apps/api/src/routes/friends.ts)
- Invalid values returned `422` and duplicate handles returned `409`. The fixture verified normalized text and ordered lists, omitted fields, explicit empty lists, generated avatars, preserved wallet balance, consent and completion timestamps, and one `PROFILE_COMPLETE` grant including Battle Pass XP. Successful writes emitted `PROFILE` and `TASKS` invalidations to the actor after commit. The warm MongoDB `/auth/me` snapshot still returned pre-edit values until its session-context cache expired. [Fixture](../../backend-server/apps/api/src/routes/profileJourney.characterization.test.ts)
- The first D1 import hit a mismatch between the Bond mapper and draft schema. The normalized milestone and per-actor preference tables now accept the data with unique keys. Duplicate milestone days produce a reported rejection. A clean import of the synthetic profile, relationships and progression records then passed with zero rejects. The import preserved the avatar state, active-bond counts, milestone order and completion XP. [Bond mapping](../../backend-server/apps/api/src/migration/mappings.ts) · [Draft schema](../../backend-server/apps/api/migrations/d1/0001_initial.sql)

## Reproduce from `backend-server`

```powershell
$env:YUGM_RUNTIME = 'cloudflare'
$env:NODE_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:1/profile-unit'
$env:REDIS_URL = ''
$env:JWT_SECRET = 'profile-local-test-fixture-signing-key'
npm.cmd run schema:d1 --workspace @yugm/api
npm.cmd exec --workspace @yugm/api -- tsx --test --test-concurrency=3 --test-reporter=spec src/routes/profileJourney.characterization.test.ts src/services/profileCompletion.test.ts src/services/authProfileContract.test.ts src/routes/profileFeatures.test.ts src/migration/mappings-bonds.test.ts src/migration/mappings.test.ts
npm.cmd run typecheck --workspace @yugm/api
npm.cmd run typecheck --workspace @yugm/cloudflare-worker
npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker
```

The profile fixture starts a disposable MongoDB replica set, overrides the unit-test URI for its HTTP tests and imports those fixture rows into an ephemeral local D1 binding. The 46 focused cases passed. The schema generator emitted the 147-table draft. The API and Worker typechecks and the local Auth Worker smoke test passed against this work.

## Resume here

The follow-up wired the local D1 reader and compared it against this fixture. Implement D1 edit parity with atomic profile completion and idempotent reward effects, then verify the Android edit and setup flow. Live FCM, shared realtime invalidation, avatar upload/cancel, production import and rollout remain open. [D1 read follow-up](2026-11-24-d1-profile-reads.md) · [Current task](../CURRENT_TASK.md)

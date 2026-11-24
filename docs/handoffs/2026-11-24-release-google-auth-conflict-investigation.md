# Release Google sign-in conflict investigation

**Status:** read-only investigation; root cause not confirmed. No source, configuration, database, secret or deployed resource was changed.

## Symptom

A release APK reported:

`Auth failed provider=GOOGLE phase=BACKEND_EXCHANGE: This account is already linked to another sign-in method. Contact support to recover the account.`

at 2026-11-24 19:31:42 local time. `AuthViewModel` logs the server's 409 message verbatim; the text originates in `findOrCreateFirebaseUser()` when an existing account found by email or phone has a different, non-empty `firebaseUid`.

## Environment actually exercised

- The release build uses `YUGM_PRODUCTION_ORIGIN` from `android-client/local.properties`, currently `https://yugm-api-staging.sarveshkumar10101.workers.dev`. `app/build.gradle.kts` compiles that value into `BuildConfig.API_BASE_URL` as `<origin>/api`. This is the staging Worker, not a production origin.
- `wrangler.staging.jsonc` sets `YUGM_RUNTIME=cloudflare`, `MONGODB_DB_NAME=YugmStaging` and `STORAGE_DRIVER=mongodb`. It has no R2 bucket bindings. Yugm application data and GridFS media are therefore in MongoDB `YugmStaging`; the Google identity itself is in Firebase project `yugm-e985e`.
- Hosted D1 is not on this request path.

## Server behavior

`POST /api/auth/google` verifies the Firebase ID token, then `findOrCreateFirebaseUser()` looks up the account by Firebase UID, verified email and phone. For a given token and unchanged Mongo state, the conflict is deterministic: it requires an existing user whose stored `firebaseUid` differs from the token's `sub`. No code path in the current API silently rebinds `firebaseUid` to a different Firebase identity. Auto-merging by email would be an account-takeover risk and was not done.

## Verification run

Commands used from `backend-server/`:

- `npm.cmd exec -- wrangler whoami` — confirmed access to the Cloudflare account containing the staging Worker.
- `npm.cmd exec -- wrangler tail --config apps/cloudflare-worker/wrangler.staging.jsonc --format json --method POST` — run twice in read-only mode and stopped after the owner completed retries.

Observed invocations all used Worker script version `32b29867-287f-41fb-b500-59e5b48c0854`, so no staging deploy occurred between the failures and captures.

| Local time | Request | Status |
| --- | --- | --- |
| 19:35:47 | `POST /api/auth/google` (first successful retry) | 200 |
| 19:35:47 | `POST /api/vibe/init` | 201 |
| 19:35:47 | `POST /api/notifications/device-token` | 200 |
| 19:55:00 | `POST /api/rooms/:id/end` | 200 |
| 19:55:10 | `POST /api/auth/logout` | 200 |
| 19:55:18 | `POST /api/auth/google` | 200 |
| 19:55:18 | `POST /api/notifications/device-token` | 200 |

No 409, Worker exception or application error log appeared in either capture. The owner reported using the same Google account. The 19:31 failure itself was not captured because live tail does not replay past requests, and request bodies containing ID tokens are not exposed by `wrangler tail`.

## Assessment

The current staging account state accepts this Google identity. The earlier conflict was not reproducible in two capture windows. Because the code path is deterministic, a differing Google credential/account selection, a different build/origin at 19:31, or different Mongo state at that time remains possible. The available evidence does not distinguish those cases. Persisted Cloudflare logs, a Mongo record lookup and token/UID comparison were not performed.

## Next steps

1. Confirm whether the release APK is intentionally targeting staging. If production is intended, set the correct `YUGM_PRODUCTION_ORIGIN` before rebuilding; do not change it here.
2. If the 409 recurs, reproduce it with a live tail running and note whether any account-chooser or app-data change occurred.
3. Only with explicit authorization: either add temporary non-sensitive logging (UID/email hashes and route outcome) to staging, or run an authorized read-only Mongo lookup for the affected email and compare the stored `firebaseUid` with the Firebase UID. Do not rewrite the stored identity as a routine retry.

## Not run

No database query, credential read, code change, build, deploy, provision, migration, commit or push was performed for this investigation. The repository was clean immediately after the preceding commit; unrelated uncommitted files appeared in the working tree later and were left untouched.

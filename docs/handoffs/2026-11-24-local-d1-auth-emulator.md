# Local D1 Auth + Profile emulator runbook

**Scope:** Local development only. The owner chose to keep this slice limited to **Auth + Profile**. Firebase remains the identity provider. Staging, production, the normal Node API and all other journeys remain on their current paths.

The startup commands below also run the later local Worker routes. Android debug fixes the API and socket origin at emulator loopback. Current coverage includes cosmetics, the notification inbox and core clan membership. See the [whole-app local expansion handoff](2026-11-24-local-d1-r2-app-expansion.md) for current routes and remaining gaps.

## What changed

- `backend-server/apps/cloudflare-worker/src/authLocal.ts` now accepts `10.0.2.2` as a loopback host. Android debug builds on the emulator force `http://10.0.2.2:4000/api`, and the Worker previously rejected that Host header with `404`.
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs` now asserts that `/health` succeeds through the emulator host while an unrelated hostname still returns `404`.

The Worker still fails with `503` when `MONGODB_URI` or `REDIS_URL` is present in the Worker environment or inherited process environment. This keeps MongoDB out of the local Auth + Profile path.

## Run locally

From `backend-server`:

1. Stop any local Node API or other process using port `4000`.

2. Create the ignored local config file
   `backend-server/apps/cloudflare-worker/auth-local/.dev.vars` with only:

   - `JWT_SECRET` — a unique local value of at least 32 characters
   - `FCM_PROJECT_ID` — the Firebase test project ID

   Do not add `MONGODB_URI` or `REDIS_URL`. If either is exported in the terminal, unset it before starting the Worker. Do not commit this file or paste its values into notes or issues.

   Wrangler does not expose ordinary shell variables as Worker bindings. Setting `JWT_SECRET` or `FCM_PROJECT_ID` only in the terminal leaves `env.FCM_PROJECT_ID` empty and `/ready` returns `503`. Use `.dev.vars`, or a temporary `--env-file` outside the repository for disposable smoke runs.

3. Run the credential-free smoke test:

   ```powershell
   npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker
   ```

4. Apply the versioned schema and reference catalog migrations to local `yugm`. Debug uses its original local storage ID and `remote: false`. [Database setup and checks](2026-11-24-d1-schema-and-reference-seed.md)

   ```powershell
   npm.cmd run d1:setup:local
   ```

   If an older pre-migration draft is missing columns, use the recovery steps below to initialize a new persistence directory while preserving the old database.

5. Start the Worker on port `4000`:

   ```powershell
   npm.cmd run dev
   ```

6. Check the endpoints:

   ```powershell
   curl http://127.0.0.1:4000/health
   curl http://127.0.0.1:4000/ready
   ```

   `/ready` should report `storage: "d1"`.

   `D1_CONFIG_REQUIRED` means the local Worker needs the settings named in the response. Fully stop and restart Wrangler after pulling binding changes or editing `.dev.vars`.

   `D1_SCHEMA_UNAVAILABLE` means the local database is empty or missing required tables or columns. Earlier drafts could have the expected table count while missing fields. Apply the schema in a fresh persistence directory to keep the original local data available:

   ```powershell
   $persist = Join-Path $env:TEMP ("yugm-auth-local-" + [guid]::NewGuid().ToString("N"))

   npm.cmd run d1:setup:local -- --persist-to $persist
   npm.cmd run dev:auth --workspace @yugm/cloudflare-worker -- --port 4000 --persist-to $persist
   ```

   This exact command sequence was verified: `/ready` returned `storage: "d1"`. If you keep the default persistence directory, fully stop and restart Wrangler as well, because `.dev.vars` is read at startup.

   A credential-free `POST /api/auth/google` with an empty JSON body returns `422 VALIDATION` when the route is accepting requests. [Emulator 503 recovery](2026-11-24-emulator-auth-startup-recovery.md)

7. Run a debug build on an Android emulator. Gradle sets the API to `http://10.0.2.2:4000/api` and the event origin to `http://10.0.2.2:4000`. Debug App Check is disabled for this local HTTP host. [Build type routing](../features/release-build-configuration.md)

## Expected journey

- Firebase email/password, Google, Facebook or phone sign-in
- Yugm backend auth exchange through D1
- `/auth/me`
- ProfileSetup
- `PATCH /api/users/me` through D1
- Home navigation after server-confirmed profile completion
- session restore after app restart
- refresh, logout and revoked-session behavior

## Verification run

From `backend-server` on 2026-11-24:

- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, including the `10.0.2.2` host assertion, a check that a `MONGODB_URI` binding makes `/ready` return `503`, and the Android-shaped generated-avatar PATCH payload.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- `wrangler d1 execute AUTH_DB --config auth-local/wrangler.jsonc --local --file ../api/migrations/d1/0001_initial.sql --persist-to <temporary directory>` — executed 223 commands; the isolated database reported 147 tables.
- `wrangler dev --config auth-local/wrangler.jsonc --local --ip 127.0.0.1 --port 4000 --persist-to <temporary directory> --env-file <temporary env file>` — started successfully with disposable process-only values. `/health` returned `{ "ok": true, "service": "yugm-auth-local" }`, `/ready` returned `{ "ok": true, "service": "yugm-auth-local", "storage": "d1" }`, and `/health` with `Host: 10.0.2.2:4000` succeeded.
- `git diff --check` from the repository root — clean.

Agent-run checks did not create a repository `.dev.vars`; the temporary env file was outside the repository and used only a generated local secret and a non-live Firebase project ID. The owner later created the ignored `.dev.vars` and confirmed that `/ready` returned `storage: "d1"` after starting the Worker with a fresh persistence directory. No credential values were shared with the agent. No live Firebase call, Android emulator run, deploy, provision or production data access was performed by the agent in this slice; the Android journey remains to be reported by the owner.

## Android API trace

A static trace of the debug Android sources confirmed that the scoped journey uses only mounted routes for its authoritative work:

- Auth: `POST /auth/google` (including email/password with `provider="email"`), `POST /auth/facebook`, `POST /auth/phone`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` and `POST /auth/verify-email`.
- Profile writes: `PATCH /users/me`. Generated avatars are local UI state serialized into that request as `avatarType` / `avatarParts`; no separate HTTP call is needed. The Worker fixture now sends that exact shape and verifies it in both the edit response and a following profile read.
- Profile reads: `GET /users/me`, `GET /users/{id}`, `GET /users/public/{id}` and `GET /users/by-username/{username}`. ProfileSetup and Edit Profile do not call a dedicated username-availability endpoint; uniqueness is enforced by the D1 `PATCH` conflict path.

Unmounted calls observed on the same journey are expected to return `404` from this Worker:

- Managed avatar upload was originally unmounted here: the Android client starts with `POST /media/uploads`, the catch-all returned `404`, and the client falls back to legacy multipart only for `503`/`501`, so choosing a photo failed. This was superseded later on 2026-11-24 by the [local D1 + R2 media slice](2026-11-24-local-d1-r2-media.md), which mounts the managed route. The legacy `/upload/avatar` route remains unmounted.
- Push-token sync (`POST /notifications/device-token`). It is best-effort and failures are swallowed.
- Profile supplementary sections (`/users/{id}/rooms`, `/followers`, `/following`, PK stats/history, clan, visitors, badges and vibe) are fetched with `runCatching` after the main profile response, so they leave those sections empty without blocking the profile screen.
- Home/Discover and other tab endpoints are outside this slice and do not block navigation to `MainTabs("discover")`.

`PATCH /api/auth/profile` exists only in the non-candidate Express router and has no Android caller, so its absence from the D1 router does not affect this journey.

## Limits

- The Worker covers Auth, Profile, managed avatars, player cosmetics, wallet overview, the inbox and core clan membership. Chat, Rooms and other unported wallet routes are still open. [Local route coverage](2026-11-24-local-d1-r2-app-expansion.md)
- A D1 token is not accepted by the MongoDB-backed Node API; treat this as a separate local backend.
- Managed avatar upload is now mounted by the later [local D1 + R2 media slice](2026-11-24-local-d1-r2-media.md). This Auth/Profile runbook's original generated-avatar coverage (`avatarType` / `avatarPartsJson`) remains valid. The isolated config now has five local-only R2 bindings and an Images binding; the normal Node API and its MongoDB-backed legacy upload path are unchanged. Workers still have no writable filesystem, so uploaded bytes are written through R2 bindings. Because the media tables and `upload_token_hash` column were added after the first local database, use a fresh persistence directory when running the full slice.
- Post-profile push-token sync and optional Profile/Discover sections return `404` by design in this slice. They are non-fatal; see [Android API trace](#android-api-trace).
- Live `PROFILE` / `TASKS` invalidation, presence and live Android managed-avatar parity remain open; the local Worker fixture now covers the managed flow.
- The D1 schema is still a local draft, not an owner-approved production schema.

## Next acceptance

Run the debug Android journey above against a real Firebase test project, record the observed behavior, then decide whether to move to Settings. Production D1, staging cutover, traffic switching and MongoDB removal still require separate explicit approvals.

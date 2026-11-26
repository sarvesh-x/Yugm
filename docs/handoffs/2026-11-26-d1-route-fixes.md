# Discover, dating and realtime route fixes

- Discover applies the existing room-access rules in trending, recommended rooms, hub counts and hub drilldowns. Users outside a private room's access rules cannot see it in those responses. Hub keys match tags and languages case-insensitively. Profile recommendations match either shared interests or languages and observe blocked and deleted profile visibility.
- Account sockets register online state, Android sends authenticated heartbeats, and closing the final account socket clears its presence. Online Discover uses the socket presence snapshot and filters the caller, blocked profiles and deleted profiles. Discover, Dating and recommended chat pass online IDs to D1 as a single JSON argument. Dating rejects self-likes and self-passes after normalizing IDs, and recommended chat bounds fractional limits.
- Room WebSocket replay filters events to the current join time. Android ignores duplicate event IDs. Account deletion closes the removed account's user sockets and waits for best-effort invalidation to the other participants' user scopes.

## Local connection and room-creation follow-ups

- The `503` observed by Android came from the local Worker's missing `LIVEKIT_*` bindings. Missing or invalid media configuration now returns `503 ROOM_MEDIA_UNCONFIGURED` with "Voice and video are unavailable in this environment. Room chat is still available." instead of being masked as "Unexpected server error". PK opponent-media reads use the same validator so they cannot leak a partially configured token either.
- Android moved LiveKit setup out of the room-join path into a cancellable media job. Text chat and realtime stay usable when media is unavailable, the unavailable room id is cached, mic-state changes no longer retry before an authorized token exists, and `YugmHttpClient` suppresses the request reference for this expected code.
- The fixture-level room-creation `422` was caused by a no-media fixture omitting `language` and `category`; those fields are now supplied. The Android `CreateRoomScreen`/`RoomApi` payload was inspected and already includes both fields, so no client payload change was needed. The app-level "unexpected error" text was not reproduced; if it persists, capture the exact response body and logcat to distinguish it from the LiveKit-unavailable `503`.
- The PK-history fixture now gives its live battle the newest `started_at`, so the 100-row admin live list includes it regardless of earlier fixtures.
- No LiveKit credential was read, copied or used. The temporary dev-script change that would have auto-loaded `apps/api/.env` was reverted. The local Worker was restarted with its original configuration and `/ready` returned `ok: true`, `storage: "d1"` on `http://127.0.0.1:4000`. Local voice/video remains unavailable until non-secret/local LiveKit bindings are supplied; this is now an explicit, typed, non-blocking condition.

## Checks

- D1 Worker fixtures cover private-room exclusion and invitation access, normalized hub lookups, authenticated online listings, self-swipes, room replay after rejoining, socket notifications on account deletion, and room chat continuing after a typed media-unconfigured `503`.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — 1/1 passed.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — 1/1 passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 644 D1 / 638 matched / 0 missing; `/api/pk` 22 mounted / 0 missing.
- `npm.cmd run secrets:check:strict` — passed; 29 tracked config files, no credential-bearing assignments found.
- With `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`, `:core:api:testDebugUnitTest --tests "com.yugm.app.core.api.RoomSocketClientTest" --rerun` and `:feature:room:compileDebugKotlin --rerun` both ended in `BUILD SUCCESSFUL`.
- `git diff --check` reported only existing LF/CRLF notices. No schema migration is required. Live production, a full Android app run, hosted operations, commits and pushes were outside this verification.

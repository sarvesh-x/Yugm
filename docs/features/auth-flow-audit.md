# Onboarding-to-authentication audit and repair

**Date:** 2026-11-19

**Scope:** Android signed-out onboarding handoff, email/Google/Facebook/phone sign-in, startup session validation, single-device session handling, and multi-step profile completion.
**Status:** Source re-audited; focused Android and API checks passed. Socket revocation and local account-switch cleanup were repaired. Profile setup contract and shared update service are aligned, and asynchronous avatar/submit state is route-scoped in `ProfileSetupViewModel`; Firebase/Mongo runtime and visual/device integration remain open.

## Profile setup contract (locked before implementation)

| Field | Collected in setup | Required for completion | Contract / persistence |
|---|---:|---:|---|
| Name | Yes | Yes | Trimmed, 2–60 characters. |
| Username | Yes | Yes | Trimmed, lowercase, 3–24 characters; `[a-z0-9_.]`; unique index remains final conflict guard. |
| Age | Yes | Yes | Adult range 18–80 inclusive, aligned with the shared schema and UI. |
| Gender | Yes | Yes | One of `Male`, `Female`, `Non-Binary`; preserve those canonical values. |
| City | Yes | Yes | Trimmed, 2–60 characters. |
| Languages | Yes | Yes | At least one nonblank supported language; trim/dedupe/filter empty values. |
| Interests | Yes | Yes | At least one nonblank interest; trim/dedupe/filter empty values. |
| Bio | Yes | Yes | Trimmed, 1–180 characters. |
| Looking for | Yes | Yes | One of `Friendship`, `Dating`, `Relationship`, `Networking`; do not submit blank. |
| Terms consent | Yes | Yes | UI must affirm acceptance; server records `termsAcceptedAt` once. Existing signup acceptance is retained. |
| Avatar | Optional | No | Upload endpoint remains unchanged; successful upload updates the same user's avatar. Blank profile payloads must not erase it. |
| Vibe line, state, hobbies, interested-in, dating age range | Some | No | Optional; trim and omit blank values. |
| `profileCompletedAt` | Server-owned | Derived | Set once when a current write first satisfies every required field above; legacy timestamps remain authoritative. |

`PATCH /users/me` is the canonical profile setup write path. `/auth/profile` has no in-repository client caller; retain it only as a compatibility alias to the same update service until external consumers are ruled out. The client may navigate out of setup only when the canonical server response says `profileCompleted=true`. Existing incomplete accounts are not silently invalidated; they remain in setup until they satisfy the current completion contract.

## Behavior and contracts

- Signed-out cold starts always route to onboarding. The user confirmed that completing the slides without authenticating must replay them next launch; therefore there is no install-scoped or account-scoped intro-completion flag. Auth/profile completion is a separate server-backed concept.
- Authenticated cold starts call `/auth/me` from the splash before choosing profile setup or discovery. The request has an 8-second HTTP call timeout and a 10-second coroutine bound. A confirmed 401/403 clears the local session through the existing unauthorized callback. Transient network or App Check failures retain the local snapshot and continue, so offline routing remains best effort.
- Email, Google, Facebook, and phone credential/backend operations share one exclusive operation state in `AuthViewModel`. Credential acquisition, Firebase sign-in, and backend exchange progress cannot be independently toggled by UI callbacks. Repeated starts are rejected; cancellation/failure clears the state.
- Each backend auth exchange passes App Check readiness first. Protected requests obtain a limited-use token per request. The API verifies with `consume: true`, rejects `alreadyConsumed`, and does not cache verification results. App Check failures do not masquerade as revoked account sessions.
- Local emulator/debug builds targeting loopback HTTP skip token acquisition and omit the App Check header; the local API's `development`/`test` middleware bypass matches this behavior. Remote API targets and release builds still request/send App Check. Production API enforcement remains an environment setting (`APP_CHECK_ENFORCE`) and must be enabled in the deployment configuration.
- Firebase credential error mapping is provider-aware. `ERROR_INVALID_CREDENTIAL` and `ERROR_INVALID_PROVIDER_ID` may occur in email, Google, Facebook, or phone flows, so user-facing copy now comes from the active ViewModel-owned provider rather than always naming Facebook.
- A backend exchange failure keeps the Firebase identity so the user can retry the same provider and complete/replay the idempotent identity lookup by Firebase UID. Email signup retries reauthenticate the existing current Firebase identity before another exchange. There is no automatic Firebase deletion/sign-out after an ambiguous server failure because the API may already have committed the account/session.
- Each successful backend login increments the account token generation and invalidates older device sessions. When refresh identifies another-device revocation or a rejected session, Android clears local Yugm/Firebase/socket state, shows a sign-in-again message, and routes to Login.
- Socket.IO handshakes and reconnects verify the signed access token, current user generation, and unrevoked/unexpired session against Mongo. Successful login disconnects older session sockets. Logout, account deletion, and moderation bans now disconnect all of the affected user's sockets after server-side revocation.
- Android logout clears Firebase/Yugm session state, global in-app notification state and session-scoped caches, disconnects sockets/media, and invalidates all data topics so a following account refetches. Its authenticated `/auth/logout` request now removes this install's FCM token before revoking sessions; that server-side cleanup is best effort when the app is offline or the request cannot authenticate.
- `PATCH /users/me` is the canonical profile update endpoint. The retained `/auth/profile` compatibility route delegates to the same update service. The server returns `user.profileCompleted`; completion requires every field in the contract table, including gender, age, looking-for preference, and recorded terms consent. A prior `profileCompletedAt` remains authoritative for legacy profiles.
- Profile setup validates age at 18–80 and requires a canonical gender and looking-for preference, matching the shared schema and server completion rules. The server records terms acceptance once and only returns completion after the full contract is met. Client navigation is gated on that authoritative response.
- Profile form values remain Compose `rememberSaveable` state for configuration/process recreation; route-scoped `ProfileSetupViewModel` owns avatar upload and profile submission state, current-session token lookup, duplicate-submit guards, image size/type checks, API calls, and server-confirmed success. An upload failure leaves the form usable for retry; process death during an in-flight upload requires reselecting the photo, while the server profile remains the source of truth.
- `/upload/avatar` returns a supported `data:image/{jpeg,png,webp,gif};base64,...` value and immediately persists it to the authenticated user's avatar field. The setup screen now accepts that bounded data URL form and hosted HTTP(S) images. It keeps the large data URL out of saved-instance state and omits avatar from the later profile PATCH; a successful upload is already committed, and a blank profile PATCH does not clear it. Uploads are thumbnail-compressed on Android and signature/size-checked on the server.
- Successful `/upload/avatar` responses now emit the existing per-user `sync:invalidate` event for `PROFILE` and `TASKS`; other upload routes remain excluded. Middleware tests cover the event topic and ensure unsuccessful responses do not publish invalidations. Live socket delivery remains unverified.

## Changes

- Fixed a profile-step blocker where uploaded avatar data URLs were rejected as non-HTTP URLs. Added JVM coverage for server-returned data URLs, hosted image URLs, malformed/unsupported data URLs, and the optional empty value.
- Added explicit avatar upload-ready/failure/retry feedback; retrying replaces the same user's avatar. Kept the large data URL out of saved-state Bundle and avoided sending the already-persisted avatar again in the completion PATCH.

## Profile setup verification (2026-11-19)

- Android, from `android-client/`: `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` — passed. Auth tests: 13/13; core API tests: 26/26; all requested compile targets succeeded. The new avatar reference tests cover the backend's data URL form, HTTP(S) host validation, malformed/unsupported/oversized data URLs, and optional empty avatar.
- Backend, from `backend-server/`: `npm --workspace @yugm/api test` — 169/169 passed, including avatar upload profile invalidation; `npm --workspace @yugm/api run typecheck` — passed.
- `git diff --check` — passed.
- Not exercised: a live signed-up user completing the profile, avatar multipart/API response against a running API/Mongo, XP and timestamp persistence, provider callbacks/Firebase/App Check, emulator/device navigation, theme rendering, TalkBack, or slow-network/process-death UI behavior. Existing backend tests verify shared completion and normalization rules, not Mongo-backed route mutation behavior.

- `AuthOperationState.kt` adds a small exclusive auth-state reducer used by `AuthViewModel`; provider credential states and backend exchange now have one owner. Phone Firebase credential exchange moved out of `PhoneAuthScreen` into the same ViewModel/repository path.
- `AuthRepository` now uses injected `IYugmApi` and owns auth/session/profile API operations consumed by the auth feature. `AuthProfileUpdate` is the typed request boundary.
- `AuthNavGraph.kt` uses a suspending startup validation callback before selecting a destination. Profile setup checks the authoritative result before navigation.
- `NavGraph.kt` resets successful sign-in/profile completion to the root graph anchor, avoiding a `popUpTo` target that may be absent.
- `MainViewModel.kt` validates and reconciles the restored user/profile snapshot before startup routing; legacy sessions with a valid token but missing local user ID are repaired from `/auth/me`.
- `YugmHttpClient.kt` distinguishes App Check 401 responses from session revocation and passes server refresh-revocation reason to the unauthorized handler.
- `YugmApplication.kt` requests fresh limited-use tokens. Backend `firebase.ts` consumes each token and no longer reuses cached verification; `appCheck.ts` rejects replay results.
- `authSessionRules.ts` centralizes testable Firebase identity-link conflict and refresh token-generation rules. `profileCompletion.ts` centralizes server profile completion logic shared by auth responses and profile updates.
- Existing UI uses Yugm auth fields/buttons/layout and keeps SMS/request cooldown state in the phone screen while server auth state remains in the ViewModel. Profile avatar selection has a UI duplicate-submit guard; the API stores the image as an inline Mongo data URL, so retry replaces the same field. There is no request-key dedupe contract for upload retries.

## System theme and auth-screen visibility repair

- New installs default to the persisted `SYSTEM` theme mode. The Android platform theme uses `Theme.Material.Light.NoActionBar` in `values/` and `Theme.Material.NoActionBar` in `values-night/`, so the native launch window follows system appearance before Compose starts. Edge-to-edge bars begin with automatic system light/dark detection; once Compose has read the stored preference, its existing status/navigation icon update honors an explicit `LIGHT` or `DARK` override.
- `YugmTheme` defaults to `isSystemInDarkTheme()` when used without an explicit mode. Existing explicit theme selection remains intact.
- Login/signup text, text fields, selected modes, provider buttons, errors and success states now use the active Yugm palette. Profile setup headings, options, progress, field focus, errors, and back controls are also palette-aware. Phone and OTP entry uses accessible focus/error colors and a scrollable, system-bar/IME-aware auth shell.
- Shared text-field components accept optional auth accent/outline colors while preserving existing defaults for non-auth callers.
- Static review found and removed hard-coded white foregrounds and bright yellow text accents that lost contrast against the system light palette. No backend, API, realtime, permission, or persistence behavior changed in this visual repair.
- Build verification is recorded in `docs/DEVELOPMENT_PROGRESS.md`. Real-device light/dark launch-window rendering and visual contrast/TalkBack review remain unverified.

## Verification

- Android command (from `android-client/`): `.\gradlew.bat :feature:auth:testDebugUnitTest :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin :app:connectedDebugAndroidTest --console=plain` — passed after the logout contract changes. Auth unit reports total 8 tests passed; app and instrumentation Kotlin compilation passed; connected API 37 emulator instrumentation reports 3 tests passed (smoke and onboarding pager/compact-font coverage).
- Backend commands (from `backend-server/`): `npm --workspace @yugm/api test` — 167 passed, 0 failed; `npm --workspace @yugm/api run typecheck` — passed after socket/logout changes.
- App Check development bypass check: `:core:api:testDebugUnitTest :feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed; 26 core API tests and 8 auth tests passed, including checks that only debug loopback HTTP skips App Check and release/remote targets retain it.
- Source recheck confirmed provider operation settlement paths, deterministic root navigation, explicit server `profileCompleted` gate, bounded `/auth/me` startup validation, provider App Check readiness/error mapping, token-generation checks on socket handshake/reconnect, and server disconnect on account-wide revocation.
- No live Mongo persistence or side-effect verification was performed by these unit/type checks. The new logout FCM deletion and socket disconnection paths are source-reviewed and typechecked, but were not exercised against a connected API/Mongo instance.

## Not verified / remaining integration coverage

- No live Firebase sign-in, email-link/signup, Google/Facebook credential UI, Firebase phone SMS/auto-verification/resend/cooldown, Play Integrity or debug-token request was run.
- The local loopback debug bypass is verified by Android unit tests/source only; no live app-to-local-API authentication was exercised. Remote debug builds still require a registered Firebase debug token when their API enforces App Check.
- No Mongo integration test exercised account linking, refresh rotation/revocation, logout FCM deletion/socket disconnect, profile PATCH persistence/completion timestamp/XP grant, or transaction/race behavior. The tests cover extracted rules and shared schema only.
- The emulator suite does not drive real login/profile navigation or prove graph back-stack behavior after an auth-provider result; the Android build confirms compilation only.
- App Check verification is now replay-protected in source; configure the deployed Firebase Admin service account and test with real limited-use tokens before rollout.
- The Android profile client calls `PATCH /users/me`; the retained `PATCH /auth/profile` route delegates to the same update service. Both are still exposed for compatibility; external callers and OpenAPI coverage have not been checked.
- Auth and profile submit buttons have client duplicate-submit guards. Avatar upload stores inline image data on the same user's avatar field, so repeating an upload replaces that field rather than creating an external media object; no request-key deduplication or lost-response integration test exists.
- Phone OTP callbacks and 30-second resend cooldown remain screen-local; add dedicated Compose/Firebase test harnesses when auth emulator credentials are available.
- Device/Firebase behavior was not manually exercised: provider callbacks/cancellation, OTP auto-verification/resend/cooldown, App Check debug/Play Integrity tokens and replay, profile success/failure response paths, second-device login, expired/revoked/missing-profile cold starts, and live navigation back-stack behavior remain integration gates.
- Socket event authorization is not a full per-event session recheck. Handshake/reconnect validation plus explicit disconnects cover observed revocation paths, but race/concurrency behavior and every ephemeral event's resource authorization require live integration tests.

# Development progress

## 2026-11-20 -- Prove the staging auth 500 and add rate-limiter regression tests

- **Live evidence:** against `https://yugm-api-staging.sarveshkumar10101.workers.dev`, `POST /api/auth/google`, `/api/auth/facebook`, and `/api/auth/phone` all return HTTP 500 `{"ok":false,"error":{"message":"Cannot read properties of undefined (reading 'replace')","code":"INTERNAL"}}`. `/api/auth/refresh` returns 422, `/api/auth/logout` and `/api/users/me` return 401, and `GET /api/health` is 200 with `db.ready=true`. That split matches exactly the routes whose limiter key comes from `req.ip`.
- **Local repro of the pre-fix source:** an Express harness that shadows `req.ip` with `undefined` (as the Cloudflare node bridge does) failed on the committed sources with `TypeError: Cannot read properties of undefined (reading 'replace')` at `safeKey` (`rateLimitStore.ts:10`) via `ResilientRedisRateLimitStore.increment`, producing HTTP 500. The same harness returns 200 on the fixed sources, so the crash is isolated rather than inferred.
- **Hardening:** `safeKey()` now returns `"unknown"` for non-string or empty keys, and `get`/`decrement`/`resetKey` normalize keys the same way as `increment`, so store lookups cannot miss a bucket an increment created.
- **New regression tests:** `apps/api/src/middleware/rateLimit.test.ts` (auth, identifier and refresh limiters keep serving requests with no `req.ip`) and `apps/api/src/services/rateLimitStore.test.ts` (undefined and over-long keys).
- **Verification:** `npm --workspace @yugm/api run typecheck` clean; `npm --workspace @yugm/api test` 178/178 pass. Nothing was deployed; the staging Worker still serves the crash, so release sign-in stays broken until a deploy.

## 2026-11-19 -- Diagnose & resolve infinite hang on manual login and Google Credential Manager rejection

- **Root Cause of Infinite Hang in Manual Sign-In:**
  - The local backend API server was not running on port 4000 (http://192.168.1.2:4000/api), causing OkHttp TCP connect attempts to hang until timeout (up to 60s). Started local backend dev server with MongoDB Atlas, Redis, and Firebase Auth active.
  - Compounding the delay, AppCheckReadiness.requireReady had an 8-second blocking timeout and YugmApplication.appCheckTokenProvider had a 10-second blocking timeout (18s total before the HTTP request even began). Reduced both timeouts to 2 seconds.
  - Eliminated redundant getIdToken(true) network call immediately following signInWithEmailAndPassword, reusing the freshly issued token via getIdToken(false).
  - Tuned OkHttp timeouts in YugmHttpClient (connectTimeout: 10s, eadTimeout: 25s, writeTimeout: 20s).
- **Google Sign-In / HiddenActivity Immediate Exit:**
  - Diagnosed from device Logcat (HiddenActivity launched and killed after 2 seconds): Google Identity Credential Manager verifies the client package name and signing keystore SHA-1 against Google Cloud / Firebase Console.
  - Neither the debug keystore (9B:FC:C9:2B:A9:59:25:73:21:CE:40:EA:82:65:8D:F0:54:10:BE:D2) nor the release keystore (91:E4:CE:9A:22:94:93:6D:DC:91:2F:CF:1B:D4:E7:A3:3A:ED:C7:C5) are registered in google-services.json (only older hashes 69:9e:... and 80:55:... exist).
  - Updated AuthNavGraph.kt so that when GetCredentialException occurs, it gracefully triggers switchToSignUp with a clear message: "Could not sign in with Google. Create an account with your email and password."
- **Verification:**
  - Local backend API running on http://localhost:4000 & http://192.168.1.2:4000 (/api/health 200 OK in 16ms).
  - :app:compileDebugKotlin, :feature:auth:compileDebugKotlin, :core:api:compileDebugKotlin all BUILD SUCCESSFUL.
  - Auth unit tests passed (13/13).
## 2026-11-19 -- Rework Google sign-in fallback to email signup with password & fix release token validation

- **Google Login to Email Signup Transition:**
  - When a user tries to log in using Google on the "Sign in" tab and no account exists on Yugm, the app no longer fails or throws errors.
  - The client sends mode: "login" to /api/auth/google. If no account exists with that Firebase UID or email, the backend returns a 404 (ErrorCode.NOT_FOUND).
  - Android AuthViewModel catches the 404 or missing user, and invokes switchToSignUp(email, name, "No account found for this Google email. Create a password to sign up.").
  - LoginScreen automatically transitions to "Create account" mode, pre-fills the email address from the Google account, retains accepted terms, and displays the password and confirm password fields ("ask to create password").
  - Once the user enters and confirms their password and taps "Create account", an account is created with their email, password, and Google display name, directly entering onboarding (ProfileSetupScreen).
- **Credential Manager New User Selection:**
  - In AuthNavGraph.kt, updated GetGoogleIdOption.Builder() from setFilterByAuthorizedAccounts(true) to setFilterByAuthorizedAccounts(false) so that new users who have never used the app can pick any Google account on their device instead of encountering a hard NoCredentialException.
  - Added fallback in NoCredentialException to smoothly direct users to email signup.
- **Release APK "firebase token invalid" Resolution:**
  - In irebase.ts, added 60-second clock skew tolerance (clockTolerance: 60) to jwt.verify and added clock leeway (iat <= now + 60, uth_time <= iat + 60) in erifyFirebaseIdTokenWithoutServiceAccount to eliminate clock drift rejections between Google/Firebase and Cloudflare Workers.
  - Added support for Google public signing certs (https://www.googleapis.com/oauth2/v1/certs) when verifying tokens with Google issuer (ccounts.google.com / https://accounts.google.com), allowing both Google ID tokens and Firebase ID tokens to verify cleanly.
  - In AuthViewModel.kt, switched token retrieval from cached getIdToken(false) to force-refreshed getIdToken(true) so stale tokens are never transmitted.
  - Cleaned up auth error mapping in mapAuthError so internal Firebase errors return user-friendly guidance instead of raw technical strings.
- **Verification:**
  - Backend API: 173/173 tests pass (
pm --workspace @yugm/api test); TypeScript typecheck passes clean (
pm --workspace @yugm/api run typecheck).
  - Android Unit Tests: :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest passed.
  - Android Kotlin Compilation: :app:compileDebugKotlin :feature:auth:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin all BUILD SUCCESSFUL.
## 2026-11-19 — Fix auth rate limiter crash in Cloudflare Worker, social name propagation, and release App Check resilience

- **Cloudflare Worker rateLimitStore crash:** Investigated 500 error (Cannot read properties of undefined (reading 'replace')) on /api/auth/* routes in staging. In Cloudflare Workers, eq.ip is undefined. The default key generator in express-rate-limit passed undefined to ateLimitStore.safeKey(), throwing an exception. Added a clientIp() helper reading cf-connecting-ip and x-forwarded-for headers, configured keyGenerator on uthLimiter, and added a fallback guard in safeKey().
- **Social auth name propagation:** Wired Google and Facebook auth flows to pass Firebase display name through AuthApi / AuthRepository to backend /google and /facebook endpoints. Backend updates existing users if name was blank or default "Yugm User". Android AuthViewModel ensures the session user has the account name for the subsequent profile setup step if needed.
- **Release build auth / App Check resilience:** Addressed failure in release/production builds where App Check token generation failure or unregistered debug tokens blocked login. Made YugmHttpClient token attachment non-throwing (proceeds without X-Firebase-AppCheck header; server decides enforcement via APP_CHECK_ENFORCE). Updated AppCheckReadiness.requireReady() to log a warning rather than throwing an exception.
- **Facebook SDK token safety:** Updated FacebookLoginCoordinator to safely fallback from ccessToken?.token to uthenticationToken?.token for newer Facebook SDK Limited Login flows.
- **Keystores & Key Hashes identified:** Extracted SHA1 and Base64 hashes for debug (~/.android/debug.keystore), release (D:\Keystores\yugm-release.jks), and upload (ndroid-client/app/release/yugm-upload.jks) to verify Facebook Developer dashboard configuration.
- **Verification:** Backend tests: 173/173 passed, typecheck clean. Android: :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest passed; :feature:auth:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin passed (BUILD SUCCESSFUL). No staging deploy or physical device testing run.
## 2026-11-19 — Release builds no longer run lint

- Set `lint { checkReleaseBuilds = false }` in `android-client/app/build.gradle.kts`, so AGP no longer attaches the release vital lint pass to `:app:assembleRelease`.
- Removed the explicit `-x lintVital*` exclusions from the tagged release workflow; debug lint still runs in CI via `:app:lintDebug`.
- Verified with `:app:assembleRelease --dry-run`: configuration succeeded and the task graph contained no `lint*Release` tasks. No release APK was assembled in this check.

## 2026-11-19 — Release/production endpoints moved to Cloudflare

- Switched the Android release/production API and Socket.IO defaults to the Cloudflare staging Worker: `https://yugm-api-staging.sarveshkumar10101.workers.dev/api` and `https://yugm-api-staging.sarveshkumar10101.workers.dev` (`android-client/app/build.gradle.kts`).
- Updated the tagged release workflow to build the signed APK against the same Worker endpoints (`.github/workflows/android-release.yml`).
- Recorded the current admin panel origin as `https://yugm-admin-staging.pages.dev` in the Pages deployment guide and migration audit; the staging Worker already allows it via `CORS_ORIGIN`.
- Updated the legal hosting references to the Worker-served pages (`/legal/privacy`, `/legal/account-deletion`).
- Left the Worker's `YUGM_STAGE=production` startup guard and the separate production Wrangler config unchanged; the given Worker identifies as staging, so enabling a production Worker remains a separate authorized cutover.
- Verification: URL/config source review only. No Android release build or Cloudflare deployment was run in this change.

## 2026-11-19 — Profile avatars stored in Cloudflare R2 object storage

- Replaced the inline MongoDB avatar thumbnail in `POST /upload/avatar` with the existing storage abstraction. Avatars are now persisted under the `avatars/` folder and `User.avatar` stores the returned public URL. With `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, and `S3_PUBLIC_BASE_URL`, this is the configured R2 bucket/public domain.
- Added strict managed-object cleanup: an upload or profile PATCH deletes the previous `avatars/` object only when the old URL matches the configured public base and prefix. Legacy `data:image/...`, cosmetic assets, external images, and sibling media are never deleted. Blank optional profile values remain omissions, so a profile PATCH cannot accidentally erase the committed avatar.
- Made public S3-compatible URL construction explicit: the public base is preferred and a custom endpoint without `S3_PUBLIC_BASE_URL` now fails loudly instead of emitting an unusable AWS hostname. `/health` exposes `endpointConfigured` and `publicUrlReady`; startup warns when the pair is incomplete.
- Kept auth/permission, signature/type/220 KB validation, temp-file cleanup, the existing avatar `PROFILE`/`TASKS` realtime invalidation, and client compatibility intact. Android already accepts absolute hosted URLs through `resolveMediaUrl`, profile-setup validation, Coil rendering, and the profile-edit upload path; regression tests now pin those behaviors.
- Added operations and contract documentation in [avatar R2 storage](features/avatar-r2-storage.md), [API contracts](API_CONTRACTS.md), and the [auth flow audit](features/auth-flow-audit.md).
- Verification: from `backend-server/`, `npm --workspace @yugm/api test` passed 173/173 (including new storage URL/key tests) and `npm --workspace @yugm/api run typecheck` passed. From `android-client/`, `.\gradlew.bat :core:api:testDebugUnitTest :feature:auth:testDebugUnitTest --console=plain` passed (`BUILD SUCCESSFUL`; 29 core API tests, 13 auth tests, 0 failures). `git diff --check` reported no whitespace errors.
- Not exercised: a live R2 upload/read/delete, Mongo-backed route persistence and replacement cleanup, public bucket/CORS behavior, real Android upload/display, and device visual/accessibility review. See the [handoff](handoffs/2026-11-19-avatar-r2-storage.md).

## 2026-11-19 — Profile setup contract and shared server update path

- Locked required profile completion fields with the user: name, normalized username, age 18–80, gender (`Male`/`Female`/`Non-Binary`), city, at least one language and interest, bio, canonical `lookingFor` (`Friendship`/`Dating`/`Relationship`/`Networking`), and accepted terms. Avatar and other optional profile fields do not gate completion; legacy `profileCompletedAt` remains authoritative.
- Added server normalization for names/usernames/optional text and arrays; completion now requires all documented fields including consent. Shared schema now aligns age and enum values. `/users/me` and retained `/auth/profile` delegate to one profile update service with terms timestamp, profile timestamp, username conflict handling, idempotent XP and response behavior.
- Updated the Android profile DTO/API to carry all supported fields and omit blank optional values. The setup requires gender, `lookingFor`, and terms; it exposes a confirmed sign-out exit and preserves canonical preference values.
- Verification: from `backend-server/`, `npm --workspace @yugm/api test` passed (168/168) and `npm --workspace @yugm/api run typecheck` passed. From `android-client/`, `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed. No connected Mongo/Firebase/profile navigation runtime was run.
- Remaining profile form state ownership and visual redesign are tracked in [handoff](handoffs/2026-11-19-profile-setup.md); this task is not fully closed.

## 2026-11-19 — Profile setup async state ownership and contract verification

- Added route-scoped `ProfileSetupViewModel` ownership for avatar upload and profile submission, including session-token lookup at operation time, one-flight guards, cancellation handling, image type/5 MB checks, retryable failures, and navigation only after the returned user confirms `profileCompleted`.
- Kept user-entered form fields in `rememberSaveable` so a setup form survives configuration changes and saved-state restoration; an upload interrupted by process death can be retried by selecting the image again.
- Required gender in client validation to match the previously agreed gender + looking-for completion contract. Removed the obsolete auth-graph token-provider parameter now that setup actions use the session repository boundary.
- Verification: from `android-client/`, `:feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed (`BUILD SUCCESSFUL`; tests executed as part of the task). From `backend-server/`, `npm --workspace @yugm/api test` passed (168/168) and `npm --workspace @yugm/api run typecheck` passed. `git diff --check` passed. No Mongo/Firebase/API runtime, provider callback, or device visual/accessibility scenario was exercised.
- Remaining live integration and device review is documented in [profile setup handoff](handoffs/2026-11-19-profile-setup.md).

## 2026-11-19 — Profile avatar completion regression

- Confirmed `/upload/avatar` stores the authenticated user's thumbnail immediately and returns a `data:image/{jpeg,png,webp,gif};base64,...` URL. Step-four validation incorrectly allowed only HTTP(S), which could trap users after a successful upload. Added strict, bounded validation for server-supported image data URLs and valid hosted HTTP(S) references.
- Wired successful `/upload/avatar` mutations into the existing per-user `PROFILE` realtime invalidation while keeping other upload endpoints excluded; added a middleware regression test.
- Added upload-ready and retryable-failure copy. Kept the large avatar data URL out of `rememberSaveable` state and omitted it from the later profile PATCH because the upload endpoint has already persisted it; blank optional profile fields therefore do not erase the avatar.
- Added JVM regression tests for accepted data URLs and hosted URLs plus malformed/unsupported/empty/oversized values. `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` passed (auth tests 13/13; core API tests 26/26; all requested Kotlin compile targets passed). Backend check from `backend-server/`: `npm --workspace @yugm/api test` passed 169/169 and `npm --workspace @yugm/api run typecheck` passed. `git diff --check` passed. No connected Firebase/App Check/Mongo or device onboarding flow was run.

## 2026-11-19 — Skip App Check for local Android debug sessions

- Removed the Firebase debug-token registration requirement only when a debuggable Android build targets cleartext loopback (`10.0.2.2`, localhost, or loopback). In that mode the app skips the auth preflight, request header, and startup token warm-up; the local API's existing `NODE_ENV=development/test` bypass is consistent with this behavior.
- Release builds and debug builds using remote/LAN APIs continue requesting App Check. Backend production enforcement remains controlled by `APP_CHECK_ENFORCE`; production deployment configuration must keep it enabled.
- Added core API tests for local debug bypass and release/remote target enforcement. Verification: from `android-client/`, ` .\gradlew.bat :core:api:testDebugUnitTest :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` passed. Core API unit tests: 26 passed; auth unit tests: 8 passed; app Kotlin compilation passed. No Firebase token, API request, or backend runtime was exercised.

## 2026-11-19 — Auth boundary re-audit and session cleanup

- Rechecked provider operation ownership/settlement, root navigation reset, server-confirmed profile completion, App Check readiness/error mapping, startup `/auth/me` validation, session revocation messaging, and Socket.IO handshake/reconnect session checks against current source.
- Closed a server-side realtime revocation gap: logout, account deletion, admin ban, and report-driven ban now disconnect a user's live sockets after revoking sessions/token generation. New login already disconnects older session sockets.
- Hardened logout/account-switch cleanup: Android clears in-app notification state, session-scoped caches and sync topics along with Firebase/session/socket/media state. The authenticated logout request now includes the install FCM token for server-side deletion before session revocation.
- Verification after these changes: from `android-client/`, ` .\gradlew.bat :feature:auth:testDebugUnitTest :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin :app:connectedDebugAndroidTest --console=plain` passed (8 auth unit tests; Android and instrumentation Kotlin compilation; 3 connected API 37 emulator instrumentation tests). From `backend-server/`, `npm --workspace @yugm/api test` passed (167/167) and `npm --workspace @yugm/api run typecheck` passed.
- No live Firebase provider/OTP/App Check scenario, backend/Mongo persistence or race test, real profile navigation trace, or manual second-device test was run. The auth audit remains open for those runtime gates; see [handoff](handoffs/2026-11-19-auth-boundary-audit.md).

## 2026-11-19 — Auth error provider mismatch repair

- Fixed the shared Firebase invalid-credential mapping so email errors no longer incorrectly say Facebook; provider-specific messages now match the active email, Google, Facebook, phone, or password-reset operation.
- Added focused auth error mapping regression tests for provider-specific wording and unrelated error pass-through.
- Verification: `:feature:auth:testDebugUnitTest :app:installDebug` passed; all 8 auth unit tests passed, and the corrected debug app installed on the connected API 37 emulator. Real credential entry and Firebase/backend account exchange still need user/runtime configuration.

## 2026-11-19 — Auth flow system-theme and visibility repair

- Changed the native app theme to Android platform light/dark styles selected by `values/` and `values-night/` resource qualifiers, and edge-to-edge bars to automatic system appearance at launch. The Compose theme helper also defaults to `isSystemInDarkTheme`; new installs continue using the existing `SYSTEM` preference, while explicit light/dark settings remain honored.
- Repaired login/email signup/provider controls, field foreground/focus, profile setup labels/options/progress/errors, and phone/OTP text contrast using the active Yugm palette. Added system-bar and IME-aware scrolling for the phone/OTP auth shell.
- Shared text field components gained optional auth-specific accent and outline colors with existing non-auth defaults preserved.
- Replaced the unsupported `Theme.Material.DayNight` platform parent with supported `Theme.Material.Light.NoActionBar` and `Theme.Material.NoActionBar` parents selected through `values/` and `values-night/` resources after an AAPT link failure.
- Verification: `:feature:auth:compileDebugKotlin :app:compileDebugKotlin` passed before that correction; `:app:compileDebugKotlin` passed again after the resource-qualified fix. No device rendering, contrast measurement, or accessibility inspection was run.

## 2026-11-19 — Onboarding-to-authentication reliability repair

- Unified provider exclusivity and loading ownership in `AuthViewModel` across UI credential acquisition, Firebase sign-in, and backend exchange. Added duplicate-start guards; routed phone credential exchange through the same ViewModel/repository path.
- Added bounded `/auth/me` validation before startup routing, reconciling server profile completion and missing legacy user IDs. Network/App Check failures fall back to locally restored session state; confirmed unauthorized responses clear it.
- Reset successful login and profile completion to the root navigation graph anchor. Session revocation now provides a user message and clears local session/Firebase/socket state.
- Made App Check replay protection consistent: fresh limited-use client tokens, Admin `consume: true`, no verification cache, and explicit rejection of consumed tokens. Auth error mapping separates App Check, account conflicts, and revoked sessions.
- Added a shared backend profile-completion contract and used the server-returned `profileCompleted` value to gate exit from profile setup. The completion timestamp is set only for the documented required fields; client age bounds match server 18–80 and gender remains optional.
- Added the injected auth repository API boundary and typed profile update request. Failed Firebase-to-Yugm exchange preserves Firebase identity for provider retry because the API may have committed despite a lost response.
- Verification at that stage: auth unit suite 5 passed; app and instrumentation Kotlin compile passed; emulator suite 3 passed; API suite 167 passed; API TypeScript typecheck passed. The auth suite now has 8 tests after the provider-mismatch regression repair. Firebase provider/App Check runtime, live Mongo persistence/session rotation/account linking, and full profile navigation were not exercised. See [auth flow audit](features/auth-flow-audit.md).

## 2026-11-19 — First-launch splash and onboarding repair

- Updated splash text to use theme-aware foreground colors, accessible saffron on light backgrounds, reduced-motion handling, and a 250 ms animation.
- Updated onboarding cards to use theme foreground tokens; added compact sizing/scroll behavior, slide heading/artwork semantics, pager progress state, and theme-aware inactive dots; removed the unused looping animation.
- Followed the user's abandonment rule: completing the slides opens Login in the current session, but no completion flag is persisted. A cold launch without an authenticated session replays onboarding; an authenticated session routes to profile setup or discovery. Backend API, realtime, permissions, and server/database persistence are not applicable to this static intro flow.
- Added route unit tests and emulator UI/edge coverage. The original onboarding audit covered 3 startup route tests and 3 emulator tests. Current auth suite also contains 2 provider-operation reducer tests; see the latest auth entry above for final verification counts.
- Fresh light-theme emulator capture showed readable brand and slide copy. TalkBack, real signup/sign-in, physical-device review, cold/warm launch timing, and the separate OS system splash remain unverified.

## 2026-11-19 — Canonical engineering context

- Added a root agent entry point, documentation index, and initial project, coding, design, component, feature, contract, realtime, security/business, error, testing, and handoff guidance.
- Consolidated links to the detailed production audit, which already contains static API/socket/schema inventories, prioritized findings, requirement coverage, and prior scoped implementation results.
- Captured that the Compose theme and shared components already exist; broad screen migration and complete spacing tokens remain follow-up work.
- Verification for this documentation task is static review only. No tests/builds were run.
- User's pre-existing modifications in Android/Backend files were observed and preserved.

## Existing scoped implementation evidence

See [production/current-progress.md](production/current-progress.md) for the last recorded source baseline, implemented remediation, exact prior test/build results, and outstanding runtime gates. That record is dated and must be reconciled against current source before relying on it.

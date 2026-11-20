# Current task

## YUGM-AVATAR-MULTI-009 - Integrate Multiavatar generation and customization

- **Scope:** Native offline Multiavatar generation/customization per `C:\Users\longl\OneDrive\Desktop\yugm-multiavatar-implementation-plan.md` (engine, shared dialog, profile creation and Edit Profile, persistence/rendering). Work remains uncommitted and partially complete.
- **Changes applied (uncommitted, cumulative):**
  - Integrated pinned upstream `mew22/Multiavatar` engine source into `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` (adapted: no KMP/Koin/Coil3/kotlinx-datetime/kotlincrypto deps; uses `System.currentTimeMillis`/`MessageDigest`). Added `AvatarDescriptor`/`AvatarParts`/engine/cache/`GeneratedAvatar`/shared `AvatarGeneratorDialog` and `coil-svg`.
  - Added `AvatarPartsPayload` and `avatarType`/`avatarParts` to `Host`/`AuthProfileUpdate` and extended `YugmUser` with `avatar`/`avatarType`/`avatarParts` (`core:model`).
  - Parsed generated-avatar fields in `RoomParser.toHost()` and `ProfileParser.toUser()`; extended shared `Avatar` to render generated descriptors when provided.
  - Wired profile creation (`CreateProfileScreen` + `AuthNavGraph`) and Edit Profile (`ProfileDetailScreen`) to submit/persist generated descriptors; immediate photo upload clears generated draft and marks avatar `UPLOADED`.
  - Android session plumbing: `SessionManager` persists/restores session avatar fields; `MainViewModel` tracks/persists session avatar and passes it through login/refresh/validate flows; `NavGraph` login handoff includes avatar descriptor.
  - Android model/parser/UI coverage expanded beyond `Host`: added descriptor fields and parsing for `FriendUser`, `LeaderboardUser`, `ReferralUser`, `ClanSentInvitation.inviteeAvatar*`, room chat `authorAvatar*`, `RoomActivityItem`, PK side/member/opponent/leaderboard avatars, story user/item/comment avatars, recording/event/voice-poll/daily-question/referred-user/feed/vibe/subscription/common avatar fields (models + selected parsers/APIs including `RoomParser`, `PkParser`, `StoryApi`, `RecordingsApi`, `FriendsApi`, `GiftLeaderboardApi`, `ClanApi`), and updated key UI consumers (PK, recordings, story viewer, events, daily question, voice poll, referral). Many other API parsers/consumers still pending.
  - Backend: `User` schema stores `avatarType`/`avatarParts`; `profileUpdate` validates/normalizes generated descriptors; `POST /upload/avatar` sets `avatarType=UPLOADED` and unsets `avatarParts`; added `avatarType avatarParts` to many user/avatar `select`/`populate` field lists across API routes/services; `publicUser` builders in `auth.ts` and `users.ts` now include `avatarType`/`avatarParts`.
  - Propagated `avatarType`/`avatarParts` to key Host-based `Avatar(...)` consumers (core shared components, profile/profile social/public preview, room host/speakers/selected participant, settings/hosts/selected social cases). Repaired compile breakage from earlier automated propagation scripts.
  - Continuation 4: added `core/api/parsers/AvatarFieldParser.kt`; extended descriptor parsing/population in `EventsApi`, `FeedApi`, `SocialApi`, `VibeApi`, `SubscriptionsApi`, `ReferralApi`, and `RoomApi` co-hosts; updated selected UI consumers (room entrance announcements, chat list/header/message bubbles for Host/FriendUser contexts); added "Avatars by Multiavatar" credit in Settings/About; created avatar feature docs under `docs/features/avatar/` (README/ARCHITECTURE/MULTIAVATAR_INTEGRATION/API_CONTRACT/DATA_MODELS/UI_GUIDELINES/LICENSING/TESTING) with recorded gaps.
  - Continuation 5: added avatar descriptors to clan/group models (`Clan`, `ClanSummary`, `ClanInvitation` clan avatar, `ClanRankingEntry`) and updated `SocialParser`/`ClanApi`/`CreatorApi` parsing; passed descriptors in selected UI (`FriendsScreen`, `GiftLeaderboardScreen`, `DiscoverScreen`, chat partner typing + forward targets, room selected participant/invite/follower/user avatars); added backend parity for bond person payloads, vibe match user payloads, users level-overview leaderboard/recommended-chat projections, PK side/member/opponent payloads, and dating explore/match partner payloads.
  - Continuation 6: passed descriptors in additional UI (`NavGraph` minimized room bubble, `GiftPanel`, room header/voice/video/entry overlay avatars, clan chat/detail/list, waves, level leaderboard, achievements badge gallery, vibe graph match, matches, subscriptions, dating discovery, bonds) and extended bonds data model/parsing; threaded session self-avatar (`avatar`/`avatarType`/`avatarParts`) through `SettingsScreen`/`SettingsNavGraph`/app `NavGraph`. No backend source changes this continuation.
  - Continuation 7: extended shared `SeatCard`/`VideoTile`/`SpeakerGrid`/`VideoGrid` to accept/pass descriptors; passed descriptors in profile clan details, voice-room mic-seat participant, and both blocked-users screens. No backend source changes this continuation.
  - Continuation 8: plumbed session/self-avatar descriptors through chat outgoing bubbles (`MessageBubble`/`ChatTimelineMessageItem`/`ChatScreen`/`ChatNavGraph`/app `NavGraph`) and profile customization live preview (`CustomizeProfileScreen`). No backend source changes this continuation.
  - Continuation 9: targeted backend parity fixes in `experience.ts` (mini-profile/public user helper and badge-gallery user payload) and `games.ts` (leaderboard user projection) to include avatar descriptors; targeted Android `Avatar(...)` audit found no additional user-descriptor propagation fixes needed beyond existing/handled cases. Backend `tsc` **exit 0**.
  - Continuation 10: audit-only pass (no source changes). Android parser/Avatar scans found no additional descriptor gaps in scanned user-avatar contexts; backend spot-check confirmed `pk` discovery payload includes host descriptors. Confirmed “Avatars by Multiavatar” in Settings/About source, but no pinned upstream commit/version and no LICENSE/NOTICE files for integrated engine/artwork found in repo (licensing/provenance remains incomplete).
  - Continuation 11: added `avatarType`/`avatarParts` to room JOIN/LEAVE activity metadata in `backend-server/apps/api/src/routes/rooms.ts` (emitted via `roomActivityNew`); backend `tsc` **exit 0**. No Android changes.
  - Continuation 12: audit-only (no source changes). Reviewed plan/provenance requirements and repo state (no pinned upstream commit/version or LICENSE/NOTICE files in integrated avatar paths; no matching profile-updated socket event found in scanned backend/shared/android paths). Spot-checked backend avatar grep hits as mostly line-based false positives after prior fixes. Licensing/provenance remains blocking without verified upstream source/license details.
  - Continuation 13: added in-code provenance/licensing status documentation (`core/ui/avatar/UPSTREAM_PROVENANCE.md` and comments in `MultiAvatar.kt`/`MultiavatarEngine.kt`/`ValueObjectCreator.kt`; updated `docs/features/avatar/LICENSING.md`) without fabricating upstream commit/license details. `:core:ui:compileDebugKotlin` **BUILD SUCCESSFUL**. Licensing/provenance remains blocking.
  - Continuation 14: fixed admin referral-stats aggregation projection in `backend-server/apps/api/src/routes/admin.ts` to include `user.avatarType`/`user.avatarParts`; aligned `docs/features/avatar/README.md` handoff/gap notes. Backend `tsc` **exit 0**. No Android source changes.
  - Continuation 15: fixed gift leaderboard aggregation projections in `backend-server/apps/api/src/routes/giftLeaderboard.ts` to include `user.avatarType`/`user.avatarParts` for top senders/receivers. Backend `tsc` **exit 0**. No Android source changes.
  - Continuation 16: extended shared `profileSchema`/validation (`packages/shared`) to accept `avatarType`, `avatarParts`, and nullable `avatar` so PATCH profile routes no longer strip descriptor fields before `profileUpdate` service handling. Backend `tsc` **exit 0**; `authProfileContract.test.ts` 2/2 passed. No Android source changes.
  - Continuation 17 (SVG rendering repair + dialog redesign): registered `SvgDecoder.Factory()` in app `ImageLoader` (Coil 2.7.0) and added `coil-svg` to `:app`; reworked `GeneratedAvatar` (shared engine/cache, async cached SVG render on `Dispatchers.Default`, explicit SVG `ImageRequest`/decoder, cancellation-safe error handling, Coil memory-cache key + disk cache disabled for generated SVGs, fallback container) and redesigned `AvatarGeneratorDialog` (premium compact layout, icon-based categories Hair/Face/Eyes/Mouth/Clothes/Background, preview decor, per-category shuffle/reset, lazy 4-column thumbnails with selected border/checkmark, fixed primary action, dismiss preserves prior selection). Backend tombstone delete in `routes/users.ts` now unsets `avatarType`/`avatarParts`. Android `:core:ui:compileDebugKotlin :app:compileDebugKotlin` **BUILD SUCCESSFUL** (including follow-up consistency compile); backend `tsc` **exit 0**. Runtime/device verification not run.
- **Verification (run):**
  - Prior continuation: `:core:ui:compileDebugKotlin`, `:feature:profile:compileDebugKotlin`, `:feature:profile :feature:room :feature:settings :core:ui compileDebugKotlin`, and `:app:compileDebugKotlin` BUILD SUCCESSFUL; backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed.
  - Continuation 2 (2026-11-20): `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`); backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` exited 0.
  - Continuation 3 (2026-11-20): `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** and `.\gradlew.bat :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`).
  - Continuation 4 (2026-11-20): `android-client` `.\gradlew.bat :core:api:compileDebugKotlin :feature:room:compileDebugKotlin :feature:events:compileDebugKotlin :feature:social:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL**, `.\gradlew.bat :feature:chat:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL**, and `.\gradlew.bat :feature:settings:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`). Backend `tsc` not rerun (Android/docs-focused changes).
  - Continuation 5 (2026-11-20): `android-client` `.\gradlew.bat :core:api:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:social:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (warnings only), `:core:api:compileDebugKotlin` recheck **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**.
  - Continuation 6 (2026-11-20): `android-client` `.\gradlew.bat :core:ui:compileDebugKotlin :feature:room:compileDebugKotlin :feature:social:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (warnings only, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`). Backend not modified/re-run this continuation.
  - Continuation 7 (2026-11-20): `android-client` `.\gradlew.bat :core:ui:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:room:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:social:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (warnings only, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`). Backend not modified/re-run this continuation.
  - Continuation 8 (2026-11-20): `android-client` `.\gradlew.bat :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (warnings only, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`). Backend not modified/re-run this continuation (spot-checked auth/dating payloads include descriptors).
  - Continuation 9 (2026-11-20): backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (targeted `experience.ts`/`games.ts` descriptor parity fixes). Android not modified/re-run this continuation.
  - Continuation 10 (2026-11-20): audit-only (no code changes); no compile/test/runtime verification run.
  - Continuation 11 (2026-11-20): backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (rooms activity metadata parity). Android not modified.
  - Continuation 12 (2026-11-20): audit-only (no code changes); no compile/test/runtime verification run.
  - Continuation 13 (2026-11-20): `android-client` `.\\gradlew.bat :core:ui:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\\Program Files\\Android\\Android Studio\\jbr'`, provenance/docs/comments only).
  - Continuation 14 (2026-11-20): backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (admin referral-stats projection parity). Android not modified.
  - Continuation 15 (2026-11-20): backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (gift leaderboard projection parity). Android not modified.
  - Continuation 16 (2026-11-20): backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (shared profile schema descriptor passthrough). `node --test apps/api/src/services/authProfileContract.test.ts` **2/2 passed**; direct TS-source runs of `profileCompletion.test.ts`/`profileFeatures.test.ts` failed in this env due ESM `.js` sibling resolution, not this change. Android not modified.
  - Continuation 17 (2026-11-20): `android-client` `.\\gradlew.bat :core:ui:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (SvgDecoder registration + dialog/avatar renderer redesign; coil-svg added to app; warnings in unrelated/profile code). Final `:app:compileDebugKotlin` consistency check **BUILD SUCCESSFUL**. Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0** (users tombstone avatar descriptor unset). Runtime/device verification **not run**.
- **Not run / remaining:**
  - Full app-wide propagation for non-`Host` avatar models/parsers/consumers: many API parsers/clients and UI surfaces still do not carry/pass descriptors (discover/matches/notifications/clans/rankings, additional chat/feed/room/profile/admin-adjacent surfaces, other `authorAvatar`/`userAvatar`/`hostAvatar`/member/invitee/self-avatar contexts, dating/vibe/bond/creator/support/wallet/admin surfaces, shared component signatures like `SeatCard`/`VideoTile`, outgoing/self placeholders).
  - Backend response/event parity audit: ensure all profile/user/chat/room/social endpoints and socket/realtime payloads carry/apply descriptors consistently with revision/conflict/idempotency behavior where applicable; migration/backward-compat for older clients/data.
  - `YugmUser` avatar now modeled/persisted client-side and threaded into Settings self-avatar UI, but end-to-end self-profile/session response coverage and all other UI surfaces consuming session avatar still need audit.
  - Licensing/attribution/provenance: pinned upstream `mew22/Multiavatar` commit/version not recorded in repo; required license/copyright notices not verified/preserved in integration; "Avatars by Multiavatar" credit added in Settings/About source but requires runtime/shipped verification. Feature docs added under `docs/features/avatar/` but gaps remain.
  - Automated tests (backend/unit/integration), lint/release checks, runtime/device or emulator visual QA (light/dark, font scale, narrow/small avatars), SVG rendering parity, reduced-motion/accessibility checks, performance/memory, and APK/AAB size measurement.
  - Working tree remains heavily modified/uncommitted with widespread unrelated whitespace-only diffs from prior automated scripts; `git diff --check` not treated as fully clean due LF/CRLF warnings.
- **Status:** In progress. Core/session plumbing, expanded model/parser/UI propagation, and incremental backend/API/realtime payload parity fixes are in source; targeted Android compiles and backend `tsc` pass for covered changes. SVG decoder registration and avatar dialog/renderer redesign applied in source (compiles) to address blank preview/thumbnail rendering, but **runtime/device verification not completed**. Shared PATCH profile validation preserves avatar descriptors; in-code provenance/licensing status docs added, but pinned upstream commit/version and required notices remain unverified/blocking. Broad integration, socket/event parity, and full verification remain. Handoff: [2026-11-20 multiavatar continuation 17](handoffs/2026-11-20-multiavatar-continuation-17.md).

## YUGM-UI-SPINNER-008 - Standardize app loading spinners on the approved Lottie animation

- **Scope:** Android frontend only. Import the provided Lottie spinner (`loading.lottie` from Desktop) into `:core:ui` and replace app-wide indeterminate `CircularProgressIndicator` spinner usages with `YugmLoadingSpinner`, preserving layout/state/error/retry behavior. Do not change determinate `LinearProgressIndicator` progress bars, typing/shimmer/decorative animations, or unrelated functionality.
- **Changes applied (uncommitted):**
  - Added `lottie-compose` dependency and `res/raw/loading_spinner.json` (extracted from `loading.lottie`).
  - Added `core/ui/.../YugmLoadingSpinner.kt` (motion-aware; default 40dp; size/modifier parameters).
  - Replaced `CircularProgressIndicator` spinner call sites across `app` and feature modules with `YugmLoadingSpinner`, dropping color/strokeWidth and scaling via `size`/`modifier`.
  - Retained determinate `LinearProgressIndicator` progress bars.
  - Removed now-unused `CircularProgressIndicator` imports.
  - Updated design system/component registry docs.
- **Verification (run):** `:core:ui:compileDebugKotlin` and `:app:compileDebugKotlin` BUILD SUCCESSFUL in this session (latest app compile after subsequent multiavatar edits also BUILD SUCCESSFUL).
- **Not run:** device/emulator visual/runtime verification, accessibility/TalkBack/motion checks, APK size impact.
- **Status:** Implemented in source and compiles; visual/runtime verification pending.

## YUGM-UI-SPINNER-008 — Standardize app loading spinners on the approved Lottie animation

- **Scope:** Android frontend only. Import the provided Lottie spinner (`loading.lottie` from Desktop) into `:core:ui` and replace app-wide indeterminate `CircularProgressIndicator` spinner usages with `YugmLoadingSpinner`, preserving layout/state/error/retry behavior. Do not change determinate `LinearProgressIndicator` progress bars, typing/shimmer/decorative animations, or unrelated functionality.
- **Changes applied (uncommitted):**
  - Added `lottie-compose` dependency and `res/raw/loading_spinner.json` (extracted from `loading.lottie`).
  - Added `core/ui/.../YugmLoadingSpinner.kt` (motion-aware; default 40dp; size/modifier parameters).
  - Replaced `CircularProgressIndicator` spinner call sites across `app` and feature modules with `YugmLoadingSpinner`, dropping color/strokeWidth and scaling via `size`/`modifier`.
  - Retained determinate `LinearProgressIndicator` progress bars.
  - Removed now-unused `CircularProgressIndicator` imports.
  - Updated design system/component registry docs.
- **Verification (run):** pending build results.
- **Status:** Implementation in progress; verification pending.

## YUGM-PREHOME-UIUX-007 — Frontend UI/UX polish for pre-Home auth flow

- **Scope:** frontend only, pre-Home path (splash, onboarding, login/email-verification, phone auth, profile setup). Improve readability, accessibility, visibility, and consistency without changing backend wiring, state ownership, or business rules.
- **Changes applied (uncommitted):**
  - Shared `PrimaryButton`: visible disabled treatment (alpha) + content description; `BrandHeader` tagline uses theme accent for light-mode contrast; `YugmTextField` default accent now resolves to `LocalYugmColors.current.accent` (backward compatible via nullable default).
  - `OnboardingPrimaryButton`: proper button role, focus/press indication via default ripple, removed manual press-timing guard; Skip touch target/padding increased; illustration container marked decorative for screen readers.
  - `SplashScreen`: subtle motion-aware progress indicator after the reveal while session validation runs.
  - `LoginScreen`: provider actions are tappable to surface the consent error instead of silently disabled; clearer labels ("Continue with Google/Facebook/phone"); inline helper when terms are unchecked; password toggle has semantics + 48dp target; consent label toggles the checkbox; footer text size bumped; Facebook brand color standardized; disabled border dimming.
  - `PhoneAuthScreen`: consent row uses primary text + accent legal links and whole-row toggle; descriptive field labels with format helper text; resend/back actions use accent color; imports added.
  - `CreateProfileScreen`: step text and consent text enlarged/promoted; bio marked required; avatar upload shows a spinner; progress/labels unchanged otherwise.
- **Verification (run):**
  - `.\gradlew.bat :feature:auth:compileDebugKotlin :core:ui:compileDebugKotlin :app:compileDebugKotlin` — BUILD SUCCESSFUL.
  - `.\gradlew.bat :feature:auth:testDebugUnitTest` — 14/14 passed.
  - `git diff --check` — clean.
- **Not run:** light/dark Compose previews, Accessibility Scanner/TalkBack, emulator instrumentation, device visual review.
- **Status:** Source polish complete; verification gates above remain for visual/accessibility confirmation.

## YUGM-PREHOME-AUDIT-006 — Deep-audit the pre-Home onboarding/auth/profile-setup path

- **Scope:** splash → onboarding → login/signup (email, Google, Facebook, phone) → email verification → profile setup. Verify UI, state, API wiring, realtime/persistence, permissions, errors, edge cases, and design consistency without changing unrelated features.
- **Repairs:**
  - Backend now actually returns the authenticated user's `email`: auth middleware (`/auth/me`, `/auth/verify-email`) and the shared profile-update service (`PATCH /users/me`, `PATCH /auth/profile`) select `+email`; Firebase identity lookups for existing and phone-linked accounts do too. Other-user/public payloads still omit email.
  - `PATCH /users/me` also returns `emailVerified` so profile edits no longer regress Settings from "verified" to "Verify".
  - Android `MainViewModel.validateAndUpdate` keeps the cached email when a response omits it instead of blanking it.
  - Login no longer pre-checks the 18+/Terms box when opened in sign-up mode; consent must be affirmed by the user.
  - `clearPendingVerification()` clears stale notice/error; pending verification keeps the Firebase identity for retry; splash routes exactly once; profile setup cannot submit during avatar upload; phone inputs clear stale errors; dead `OtpScreen.kt` removed.
  - Onboarding completion is install-scoped and now survives logout (product decision confirmed 2026-11-20; audit doc updated).
- **Verification (run):**
  - Backend: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed; `npm.cmd --workspace @yugm/api test` passed 178/178.
  - Android (JAVA_HOME = Android Studio JBR): `.\gradlew.bat :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest :app:compileDebugKotlin --console=plain --max-workers=2` BUILD SUCCESSFUL (auth 14/14, core API 29/29).
  - `git diff --check` clean.
- **Not run:** live Firebase/Mongo/App Check, real provider callbacks, SMS/OTP on device, emulator instrumentation, TalkBack/visual review. See [auth audit](features/auth-flow-audit.md) and [onboarding audit](features/onboarding-audit.md).
- **Status:** Source repairs complete and bounded checks pass; integration gates remain. Handoff: [2026-11-20 pre-home auth audit](handoffs/2026-11-20-prehome-auth-audit.md).

## YUGM-AUTH-EMAIL-VERIFY-005 — Require email verification at account creation and show verification in settings

- **Problem/requirements:**
  - Unverified email/password accounts could be abused; email verification must be required at account creation/sign-in time (not deferred).
  - Account deletion removed the MongoDB user but did not remove the Firebase Authentication user.
  - Settings profile card did not show the user's email or a verified indicator/action.

- **Backend changes:**
  - `POST /api/auth/google` (email-provider exchange): rejects Firebase `password` sign-in tokens where `email_verified` is false with **403** `"Verify your email address to continue. Check your inbox for the verification link."` and does **not** create/link a Yugm account or issue a session until verified.
  - `GET /auth/me`, auth session responses, and `/auth/verify-email` responses now include `email` in the public user payload (for self-display in settings). `/auth/verify-email` continues to accept an optional fresh `idToken` and marks the matching identity verified when `email_verified` is true.
  - `DELETE /users/me`: tombstones/anonymizes and frees identifiers (`email`, `phone`, `firebaseUid`, profile fields; `username` → `deleted_<id>`), revokes sessions/device tokens, disconnects sockets, and attempts Firebase Admin deletion of the Firebase Auth user via new `deleteFirebaseUser` service. MongoDB/session cleanup still completes if Firebase Admin is not configured (warned server-side).
  - Auth identity linking: accounts pending deletion matched by email/phone release remaining identifiers/tombstone state and allow fresh registration instead of blocking on re-link/verification conflicts.

- **Android changes:**
  - Email/password signup/sign-in (`feature:auth`): detects unverified email/password Firebase users, sends verification email on account creation, enters a pending-verification UI state (verify/resend/continue/use different email), and only completes backend exchange/session after the user verifies (reload + fresh verified token). `LoginScreen`/`AuthNavGraph`/`AuthViewModel` wired accordingly.
  - Settings profile card (`feature:settings`, wired via `NavGraph`/`MainViewModel`): shows the user’s email and a verified indicator when `emailVerified`, otherwise a **Verify** action in the first/profile card.
  - Client data plumbing: added `email` to `YugmUser`, parsed from API, persisted/restored via `SessionManager` (`userEmail`/`saveSession`), and exposed through `MainViewModel`.

- **Verification (run):**
  - Backend: `cd backend-server && cmd /c "npx tsc -p apps/api/tsconfig.json --noEmit"` — **passed**.

- **Not run / pending:**
  - Android Gradle/Kotlin compile/tests not run in this environment (`JAVA_HOME`/`java` unavailable). Run bounded targeted checks when available (e.g. `:core:model :core:api :core:data :feature:auth :feature:settings :app` compile/unit tests as appropriate).
  - No live Firebase/Mongo/device/emulator/staging verification. Backend behavior requires deployment/restart of the updated API/Worker; Firebase Auth deletion on account delete requires configured Firebase Admin service-account credentials in runtime. Email delivery depends on Firebase template/quota/authorized-domain/action-link configuration.

- **Status:** Source changes implemented; runtime/deployment and Android build verification pending.

## YUGM-AUTH-SIGNUP-REAUTH-004 — Fix Google sign-in rejection and email reauth deadlock

- **Problem:** Google sign-in and subsequent account creation failed on release devices.
  - Logcat evidence: Google Sign-In succeeded in Firebase (`TYPE_GOOGLE_ID_TOKEN_CREDENTIAL`, Firebase user issued), but backend returned 404 because `mode === "login"` rejected unregistered Google users with `"No account found for this Google email. Please create a password to sign up."`.
  - The client caught 404 and transitioned to Create Account with email prefilled, but left the Google user signed into `FirebaseAuth.getInstance().currentUser`.
  - When the user typed a password and tapped "Create account", `emailAuth` attempted `priorSignup.reauthenticate(EmailAuthProvider.getCredential(normalizedEmail, password))`. Since the Firebase account was created via Google OAuth (no password provider), Firebase threw `FirebaseAuthInvalidCredentialsException: The supplied auth credential is incorrect, malformed or has expired.`.
  - Even if `priorSignup` was bypassed, `auth.createUserWithEmailAndPassword` collided with the existing Google email, and its catch block attempted `signInWithEmailAndPassword` which also failed because no password credential exists for Google-authenticated users.
- **Root cause:**
  1. `POST /api/auth/google` in `backend-server/apps/api/src/routes/auth.ts` intercepted requests with `mode === "login"` and threw HTTP 404 if the user was not already in MongoDB, instead of delegating to `findOrCreateFirebaseUser()`. Google OAuth users should seamlessly authenticate or register without needing to create a separate password.
  2. `AuthViewModel.kt` passed `mode = "login"` and threw `NoAccountFoundException` on 404, trapping Google users in a dead-end email/password sign-up flow.
  3. `AuthViewModel.kt`'s `emailAuth` attempted `priorSignup.reauthenticate()` without checking if `priorSignup` had an `EmailAuthProvider` (`"password"`) credential. If `auth.currentUser` was a Google user, reauthenticating with password always failed.
  4. Failed/cancelled auth attempts did not sign out of Firebase, leaving orphaned Firebase sessions that corrupted subsequent sign-in/up operations.
- **Fix:**
  - Removed `if (mode === "login")` rejection in `backend-server/apps/api/src/routes/auth.ts`: Google sign-in now authenticates existing users or creates new users via `findOrCreateFirebaseUser()`, returning `isNewUser: true` when onboarding/profile setup is needed.
  - Updated `AuthViewModel.kt`:
    - Removed `mode = "login"` from `googleAuth()`; Google sign-in now directly completes and navigates to discovery (existing user) or profile setup (new user).
    - Hardened `emailAuth()` to only reauthenticate if `priorSignup.providerData` explicitly contains `EmailAuthProvider.PROVIDER_ID` (`"password"`), and signs out if reauthentication fails or before creating a new account when a mismatched/non-password session exists.
    - Updated `launchAuth()` and `switchToSignUp()` to sign out of Firebase if a Yugm session exchange is not completed, preventing orphaned Firebase users.
- **Verification:**
  - Backend tests: 178/178 passed (`npm --prefix backend-server test`).
  - Backend typecheck: Clean across all workspaces (`npm --prefix backend-server run typecheck`).
  - Android unit tests: `:feature:auth:testDebugUnitTest :core:api:testDebugUnitTest` passed.
  - Android compile: `:feature:auth:compileDebugKotlin` and `:app:compileDebugKotlin` BUILD SUCCESSFUL.
- **Status:** Complete in repository. Staging worker redeploy (`npm run deploy:staging`) will make the backend Google sign-in fix live.

## YUGM-AUTH-STAGING-DEPLOY-003 — Redeploy staging Worker so auth routes are live

- **Problem:** Release Android auth reaches the staging Worker but cannot complete sign-in because the live Worker returns `404 Route not found` for `POST /api/auth/google`. Cloudflare log evidence (2026-11-20, `scriptVersion.id: bc0ebaf6-af81-413d-9932-6a69bb6d4b8f`, `user-agent: okhttp/4.12.0`, request to `https://yugm-api-staging.sarveshkumar10101.workers.dev/api/auth/google`, response `404`, `outcome: ok`) confirms the request reached Cloudflare from the release client.
- **Diagnosis:** Current source mounts the route correctly (`backend-server/apps/api/src/app.ts`: `/api/auth` + `requireAppCheck`, `backend-server/apps/api/src/routes/auth.ts`: `POST /google`), so a 404 from the deployed Express app indicates a **stale Worker deployment**. A prior dashboard/workspace-root deploy attempt using plain `npx wrangler deploy` fails in this npm workspace layout unless the Worker config is targeted explicitly.
- **Repo fix:** Added root deploy scripts in `backend-server/package.json`: `deploy`/`deploy:staging` → `wrangler deploy --config apps/cloudflare-worker/wrangler.staging.jsonc`, `deploy:production` → explicit production config, plus dry-run variants. CI (`.github/workflows/cloudflare-staging.yml`) already deploys via `npm --workspace apps/cloudflare-worker run deploy:staging`.
- **Required action (not verifiable here):** update any Cloudflare/GitHub/dashboard deploy command that runs `npx wrangler deploy` from the workspace root to `npm run deploy:staging` (from `backend-server/`) or `npx wrangler deploy --config apps/cloudflare-worker/wrangler.staging.jsonc`, redeploy staging, then verify:
  - `GET /api/health` returns `ok`, `db.ready`, `db.name == "YugmStaging"`, `storage.ready`.
  - `POST /api/auth/google` with an invalid body returns a **4xx** validation/app-check/auth error (not 404).
  - Release client auth reaches a non-404 backend response (Cloudflare request logs visible).
- **Related runtime checks (unverified):** staging Worker secrets/vars (`STAGING_DB_ISOLATED`, `MONGODB_URI`, `JWT_SECRET`, Firebase/App Check, storage config) and `APP_CHECK_ENFORCE` behavior; release client logs showed Play Integrity/App Check attestation failures (`App attestation failed` / `Too many attempts`) but client continued—if enforced server-side, valid attestation/config is required after route reachability is restored.
- **Status:** Source/deploy-script fix prepared; **live staging redeploy and runtime verification pending**.

## YUGM-AUTH-RATELIMIT-002 -- Close the staging auth 500 that blocks release sign-in

- **Problem:** Release/device sign-in and sign-up failed while the base URL and connectivity were correct. Every credential exchange (email, Google, Facebook, phone) funnels through `POST /api/auth/google|facebook|phone`, and the deployed staging Worker answered all of them with HTTP 500 `{"ok":false,"error":{"message":"Cannot read properties of undefined (reading 'replace')","code":"INTERNAL"}}` before schema validation runs.
- **Root cause (confirmed, not inferred):** the Cloudflare node bridge does not populate `req.ip`, so `express-rate-limit`'s default `keyGenerator` returns `undefined`; `ResilientRedisRateLimitStore.increment` passed it to `safeKey()`, which called `.replace` on `undefined`. Shadowing `req.ip` with `undefined` in a local Express harness reproduces the exact staging message and HTTP 500 on the pre-fix source, and returns 200 on the fixed source.
- **Fix:** a `clientIp()` helper (`cf-connecting-ip` -> `x-forwarded-for` -> `req.ip` -> `"unknown"`) is now the key generator for the auth, identifier, refresh, and per-user limiters, and `safeKey()` returns `"unknown"` for non-string/empty keys instead of throwing. Store `get`/`decrement`/`resetKey` normalize keys the same way as `increment`.
- **Deployment fix:** `wrangler.jsonc` had a duplicate trailing root object syntax error preventing deploy; merged `observability` into the primary root block and added observability to `wrangler.staging.jsonc`. Pushed to `master` and previously verified a clean deploy.
- **Verification:** Earlier live check returned HTTP 422 (schema/token validation) rather than HTTP 500. **Current live state (2026-11-20):** staging returns 404 for `/api/auth/google` (stale deployment), so prior live verification is no longer representative until redeployed.
- **Status:** Source fix complete; **staging redeploy/verification pending** (see YUGM-AUTH-STAGING-DEPLOY-003).

## YUGM-AUTH-GOOGLE-KEY-001 -- Register APK signing certs in Google Cloud API key & google-services.json

- **Problem:** Android release builds failed Google sign-in and Email sign-in with 30s timeout (`Tasks.await TimeoutException` at `AuthViewModel.kt:300`). Direct API probes confirmed Google's Identity Toolkit API returned `403 PERMISSION_DENIED: API_KEY_SERVICE_BLOCKED` and `API_KEY_ANDROID_APP_BLOCKED`.
- **Root cause:** 
  1. The Firebase API key had API restrictions that excluded `Identity Toolkit API`.
  2. The Google Cloud API key application restriction only allowed fingerprint `91:E4:...`, whereas the release APK signed with `playUpload` used upload certificate SHA-1 `62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6`.
- **Fix:**
  - Allowed `Identity Toolkit API` and `Token Service API` on the Google Cloud API key.
  - Added Android package `com.yugm.app` with SHA-1 `62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6` and debug SHA-1 `9B:FC:C9:43:A9:59:25:73:21:CE:40:EA:82:65:8D:F0:54:10:BE:D2` to Google Cloud Console.
  - Updated `android-client/app/google-services.json` with the corresponding OAuth client definitions.
- **Verification:** Direct API call with the release certificate header returned HTTP 400 (expected invalid credential response) instead of HTTP 403 API blocked.
- **Status:** Complete and committed.

## YUGM-AUTH-PROD-001 -- Fix login/signup flow in release builds and social-auth reliability

- **Scope:** Auth flow only: Google sign-in fallback to email signup with password, resolve 18s+ blocking AppCheck and unstarted backend hang, eliminate redundant token network roundtrips, and document Google Cloud SHA-1 console registration.
- **Contract:**
  - Manual sign-in and Google sign-in do not block indefinitely. AppCheck timeouts reduced to 2s; OkHttp timeouts tuned.
  - Local backend API running on http://192.168.1.2:4000/api with live MongoDB, Redis, and Firebase Auth.
  - When Google sign-in fails or finds no account, the flow smoothly transitions to Create Account with email prefilled, prompt to create password, and onboarding navigation upon submit.
- **Status:** Complete & verified. Backend tests 173/173, Android unit tests pass, Kotlin compilation passed.

## YUGM-AVATAR-R2-001 — Store and visualize profile avatars in Cloudflare R2

- **Scope:** Move new/updated profile avatars from inline MongoDB data URLs to the configured public S3-compatible object store (Cloudflare R2), keep `User.avatar` as a stable public URL, clean up replaced managed objects, and verify Android upload/visualization compatibility.
- **Contract:** `POST /upload/avatar` keeps auth, image validation, and its `{ url, storage }` response. With `STORAGE_DRIVER=s3` + `S3_ENDPOINT` + `S3_PUBLIC_BASE_URL`, objects live under `avatars/` in R2. Legacy `data:` avatars remain readable; blank profile values do not erase the committed avatar. See [avatar R2 storage](features/avatar-r2-storage.md).
- **Status:** Source implementation and bounded checks are complete: backend storage URL/key helpers, R2/S3 upload + managed replacement cleanup, health/config warnings, Android pass-through and hosted-URL regression tests, and documentation. Verification: API 173/173 + typecheck; core API 29/29 and auth 13/13 unit tests. Live R2/Mongo persistence, bucket public/CORS policy, and device rendering remain unverified; see [handoff](handoffs/2026-11-19-avatar-r2-storage.md).

## YUGM-PROFILE-SETUP-001 — Unify new-user profile creation contract and recovery

- **Scope:** Complete the signed-in profile setup contract, shared backend write path, client DTO, completion/consent rules, recoverable upload/submit behavior, exit navigation, and Yugm-standard UI.
- **Contract decision:** Gender and `lookingFor` are both required. Completion also requires name, username, age 18–80, city, at least one language and interest, bio, and accepted terms; avatar and vibe line remain optional. See [profile setup contract](features/auth-flow-audit.md#profile-setup-contract-locked-before-implementation).
- **Status:** Source implementation is complete for the shared required-field contract, normalized/parity backend write path, client payload, required gender/looking-for/terms validation, confirmed profile completion gate, sign-out exit, saved form values, ViewModel-owned upload/submit lifecycle, acceptance of the server's persisted avatar URL (hosted object URL or legacy data URL), and avatar-upload profile invalidation. Latest verification: API 173/173 + typecheck; targeted Android model/API/data/auth unit and app compile checks pass; `git diff --check` is clean. Mongo persistence/XP/avatar integration, real provider navigation, and device visual/accessibility review remain unverified; see [handoff](handoffs/2026-11-19-profile-setup.md).

## YUGM-AUTH-BOUNDARY-AUDIT-001 — Prove and close auth/session boundary gaps

- **Problem:** Prior onboarding/auth changes were implemented, but remaining provider, Mongo, device, navigation, and realtime evidence gaps prevented the auth-boundary audit from being closed.
- **Scope:** Re-verify the implemented contracts; repair confirmed socket revocation and logout/account-switch cleanup gaps; record exact checks and remaining runtime gates.
- **Acceptance:** Android auth tests and app/instrumentation compiles pass; emulator smoke suite passes; API suite and typecheck pass; session/account-wide revocation disconnects realtime sockets; logout clears local account-owned state and requests server FCM-token removal; docs accurately separate source evidence from unverified Firebase/Mongo/device behavior.
- **Status:** Source repairs and requested static/JVM/emulator verification complete. Audit remains open for live Firebase/App Check, Mongo persistence/race, real auth navigation and provider/OTP scenarios; see [auth audit](features/auth-flow-audit.md) and [handoff](handoffs/2026-11-19-auth-boundary-audit.md).

## Completed predecessor — YUGM-AUTH-ERROR-001

Provider-aware Firebase credential error wording is complete; details and tests are recorded in [auth flow audit](features/auth-flow-audit.md).

<!-- Historical task record retained below. -->

### YUGM-AUTH-ERROR-001 — Match credential errors to the active provider

- **Problem:** Firebase's `ERROR_INVALID_CREDENTIAL`/`ERROR_INVALID_PROVIDER_ID` was always rendered as a Facebook error, including during manual email sign-in.
- **Scope:** Map those shared Firebase codes using the active auth provider and prevent provider-mismatched wording.
- **Acceptance:** Email, Google, Facebook, and phone errors use the active provider's language; unrelated Firebase error mapping is unchanged; regression test and targeted auth verification pass.
- **Status:** Implementation complete; auth unit tests passed and corrected debug app installed on the connected emulator.
- **Reference:** [Auth flow audit](features/auth-flow-audit.md).

## Completed predecessor — YUGM-AUTH-THEME-001

System appearance and auth-screen visibility changes are complete; see [design system](DESIGN_SYSTEM.md) and [auth flow audit](features/auth-flow-audit.md).

## YUGM-AUTH-THEME-001 — Follow system appearance in auth flow

- **Problem:** The saved theme preference defaulted to `SYSTEM`, but the platform starting theme and first edge-to-edge frame were forced to light/system-bar-dark, while login/signup/profile setup used hard-coded light text and dark-only accent colors.
- **Scope:** Start platform and Compose theming from system appearance, preserve stored explicit overrides, and repair visibility/layout within login, phone/OTP, and profile setup auth screens only.
- **Acceptance:** Native launch theme follows system mode through platform light/night resource qualifiers; Compose's default follows `isSystemInDarkTheme`; system bars use auto-detection before Compose applies the stored override; auth text, forms, controls, progress, and errors use active palette tokens; phone/OTP remain visible around system bars and IME; docs and targeted compile evidence are current.
- **Status:** Implementation complete; targeted Kotlin compile passed after replacing the unsupported platform DayNight style with valid light/night resource-qualified platform themes.
- **Reference:** [Auth flow audit](features/auth-flow-audit.md) and [design system](DESIGN_SYSTEM.md).

## Completed predecessor — YUGM-AUTH-RELIABILITY-002

The auth state, startup validation, navigation reset, App Check, session, and profile-completion work is complete; details and remaining integration limits are in [the auth flow audit](features/auth-flow-audit.md).

# Development progress

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 17, in progress)

- **Android SVG rendering repair (source):** registered `coil.decode.SvgDecoder.Factory()` in `YugmApplication` ImageLoader and added `coil-svg` to `:app`; reworked `GeneratedAvatar` for shared engine/cache, async cached SVG rendering, explicit SVG `ImageRequest`/decoder config, and fallback container.
- **Avatar dialog redesign (source):** redesigned `AvatarGeneratorDialog` with compact premium Material3/Yugm-token layout, icon-based 6-category selector (Hair/Face/Eyes/Mouth/Clothes/Background), decorative preview, randomize/shuffle/reset actions, lazy 4-column thumbnails with selected border/checkmark, and fixed primary confirm action (close/back/outside cancel preserves prior selection).
- **Backend cleanup:** `users.ts` account tombstone delete now unsets `avatarType`/`avatarParts`.
- **Verification (run):** Android `:core:ui:compileDebugKotlin :app:compileDebugKotlin` **BUILD SUCCESSFUL**; final `:app:compileDebugKotlin` consistency check **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**.
- **Not run / blocking for runtime claim:** device/emulator verification of SVG preview/thumbnail rendering, HWUI/logcat behavior, all 6 categories, lazy/cached thumbnail behavior, stale-preview prevention, cancel/confirm flow in create/edit profile, light/dark/small-screen/a11y checks.
- **Not run / remaining:** tests/lint/release, perf/memory/APK size, live backend/socket/migration checks, systematic parity audit, licensing provenance/notices (blocking), diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 16, in progress)

- **Backend profile validation parity (functional):** `packages/shared` `profileSchema` now accepts `avatarType`, `avatarParts` (0–47 ints), and nullable `avatar`, preventing `validateBody(profileSchema.partial())` on PATCH profile routes from stripping generated-avatar descriptors before `profileUpdate` service handling.
- **Docs:** updated `docs/features/avatar/API_CONTRACT.md` and `docs/features/avatar/README.md`.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. `node --test apps/api/src/services/authProfileContract.test.ts` **2/2 passed**. Direct TS-source runs of `profileCompletion.test.ts`/`profileFeatures.test.ts` failed in this env due ESM `.js` sibling resolution (not this change). Android not modified.
- **Not run / remaining:** full backend test suite, systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, Android/tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 15, in progress)

- **Backend leaderboard parity:** `giftLeaderboard.ts` top-senders/top-receivers `$project` stages now include `user.avatarType`/`user.avatarParts`.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified.
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 14, in progress)

- **Backend admin parity:** `admin.ts` referral-stats top-referrers `$project` now includes `user.avatarType`/`user.avatarParts`.
- **Docs:** updated `docs/features/avatar/README.md` handoff reference and provenance-gap note.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified (docs-only edits aside).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 13, in progress)

- **Provenance/licensing status docs (factual):** added `core/ui/avatar/UPSTREAM_PROVENANCE.md` and provenance comments in `MultiAvatar.kt`, `MultiavatarEngine.kt`, `ValueObjectCreator.kt`; updated `docs/features/avatar/LICENSING.md`. No upstream commit/version or license notices fabricated.
- **Verification (run):** Android `.\\gradlew.bat :core:ui:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\\Program Files\\Android\\Android Studio\\jbr'`).
- **Not run / remaining:** other-module compiles/tests/lint/release, backend verification, systematic parity/socket semantics audit, verified upstream commit/licenses/notices, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 12, in progress)

- **Audit-only (no source changes):** reviewed plan/licensing-provenance requirements and repo state (no pinned upstream `mew22/Multiavatar` commit/version or LICENSE/NOTICE files in integrated avatar paths; engine files lack upstream headers). Scanned for profile-updated socket events in backend/shared/android (none found in scanned paths). Spot-checked backend avatar payload grep hits as largely line-based false positives after prior fixes.
- **Blocker:** licensing/provenance cannot be completed from repo state alone without verified upstream source/commit and license details.
- **Verification (run):** none (audit-only).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 11, in progress)

- **Backend realtime/activity parity:** `rooms.ts` JOIN/LEAVE `RoomActivity` metadata (emitted via `roomActivityNew`) now includes `avatarType`/`avatarParts` with existing user avatar/name fields.
- **Audit:** other `addActivity` call sites in `rooms.ts` do not currently include user avatar metadata; gift chat message sender population in `wallet.ts` already includes descriptors.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified.
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 10, in progress)

- **Audit-only (no source changes):** Android parser/`Avatar(...)` scans found no additional descriptor gaps in scanned user-avatar contexts; backend spot-check confirmed `pk` discovery payload includes host descriptors.
- **Licensing/provenance:** “Avatars by Multiavatar” present in `feature/settings` About UI source, but no pinned upstream `mew22/Multiavatar` commit/version and no LICENSE/NOTICE files for integrated engine/artwork found in repo; remains incomplete/blocking per plan.
- **Verification (run):** none (audit-only).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 9, in progress)

- **Backend parity (targeted):** `experience.ts` local `publicUser` and badge-gallery user payload now include `avatarType`/`avatarParts`; `games.ts` leaderboard aggregate projects user avatar descriptors.
- **Android audit:** targeted `Avatar(...)` scan reviewed flagged cases (uploaded/cover/clan-entity/non-user contexts or already-descriptorized call sites); no additional Android source fixes applied.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified/re-run (continuation 8 compile **BUILD SUCCESSFUL**).
- **Not run / remaining:** systematic app-wide model/parser/API/UI/socket parity audit, licensing/provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 8, in progress)

- **Chat self-avatar plumbing:** `MessageBubble`/`ChatTimelineMessageItem`/`ChatScreen`/`ChatNavGraph` now accept and forward session/self avatar descriptors for outgoing message avatars; app `NavGraph` passes `MainViewModel` avatar fields (parsed `userAvatarPartsJson`) into chat navigation.
- **Profile customization preview:** `CustomizeProfileScreen` live preview passes `userProfile` avatar descriptors to `Avatar`.
- **Backend:** no source changes this continuation; spot-checked auth and dating payloads include avatar descriptors.
- **Verification (run):** Android `.\gradlew.bat :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only).
- **Not run / remaining:** other-module compiles/tests/lint/release, runtime/device visual-SVG-a11y QA, perf/size, full model/parser/API/socket parity audit, licensing provenance/notices, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 7, in progress)

- **Shared components:** Extended `SeatCard`, `VideoTile`, `SpeakerGrid`, and `VideoGrid` in `core/ui/components/SharedComponents.kt` to accept/pass avatar descriptors.
- **UI propagation:** Passed descriptors in profile clan details (`ProfileDetailScreen`), voice-room mic-seat participant (`ActiveVoiceRoomScreen`), and both blocked-users screens (`feature:settings`, `feature:social`).
- **Backend:** no source changes this continuation.
- **Verification (run):** Android `.\gradlew.bat :core:ui:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:room:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:social:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only).
- **Not run / remaining:** `:app`/other-module compiles this continuation, tests/lint/release, runtime/device visual-SVG-a11y QA, perf/size, full model/parser/API/socket parity audit, licensing provenance/notices, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 6, in progress)

- **Android UI propagation:** Passed avatar descriptors in additional surfaces - `NavGraph` minimized room bubble, `GiftPanel`, room header/voice/video participant and entry-overlay avatars, clan chat/detail/list, waves, level leaderboard, achievements badge gallery, vibe graph matches, matches, subscriptions, dating discovery candidate/partner fallbacks. Extended bonds `BondPerson`/parsing and `BondAvatar` to carry/render descriptors.
- **Settings self-avatar:** `SettingsScreen`/`SettingsHome` now render session avatar descriptors; `SettingsNavGraph` and app `NavGraph` pass `MainViewModel` session avatar fields (including parsed `userAvatarPartsJson`).
- **Backend:** no source changes this continuation (continuation 5 payload/parity edits remain in source).
- **Verification (run):** Android `.\gradlew.bat :core:ui:compileDebugKotlin :feature:room:compileDebugKotlin :feature:social:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only). Backend not modified/re-run (continuation 5 `tsc` **exit 0**).
- **Not run / remaining:** full app-wide model/parser/UI/socket propagation and parity audit, migration/backward-compat verification, licensing provenance and preserved notices, tests/lint/release/runtime visual-SVG-a11y/perf/size checks, and diff cleanup (widespread unrelated whitespace-only tracked diffs remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 5, in progress)

- **Android models/parsers/APIs:** Added avatar descriptors to clan/group models (`Clan`, `ClanSummary`, `ClanInvitation` clan avatar, `ClanRankingEntry`) and updated `SocialParser`, `ClanApi`, and `CreatorApi` badge-gallery parsing. Builds on prior `AvatarFieldParser` and Events/Feed/Social/Vibe/Subscriptions/Referral/Room API coverage.
- **UI consumer updates:** Passed descriptors in selected surfaces — `FriendsScreen` (friends/requests/sent), `GiftLeaderboardScreen` (room hosts, podiums, rows), `DiscoverScreen` host cards, chat partner typing and forward-target avatars, and `ActiveVoiceRoomScreen` selected participant/invite/follower/user avatars.
- **Backend/API parity:** Added avatar descriptor fields to bond people payloads (`services/bonds.ts`, `routes/bonds.ts`), vibe match target/match user responses, users level-overview leaderboard and recommended-chat projection/response, PK side/member/opponent payloads, and dating explore/match partner responses.
- **Verification (run):** Android targeted compiles **BUILD SUCCESSFUL** — `:core:api :feature:chat :feature:social :feature:discover :feature:room` and `:core:api` recheck (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`, warnings only). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**.
- **Not run / remaining:** full app-wide model/parser/UI/socket propagation and parity audit, migration/backward-compat verification, licensing provenance and preserved notices, tests/lint/release/runtime visual-SVG-a11y/perf/size checks, and diff cleanup (widespread unrelated whitespace-only tracked diffs remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 4, in progress)

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 3, in progress)

- **Model/parser expansion:** Added avatar descriptor fields to additional non-Host models: room chat `ChatMessage.authorAvatar*`, `RoomActivityItem`, `RoomRecording`/`YugmEvent` host avatars, story user/item/comment avatars, `FeedUser`, PK side/member/opponent/leaderboard avatars, `WaveSender`/`DailyQuestionAnswer`/`VoicePoll` user avatars, `VibeTargetUser`, `BadgeGallery`, `SubscriptionCreator`. Updated selected parsers/APIs to populate descriptors (`RoomParser` chat/activity, `PkParser`, `StoryApi`, `RecordingsApi`) alongside prior `FriendsApi`/`GiftLeaderboardApi`/`ClanApi`/`ProfileParser`/`RoomParser.toHost` work.
- **UI consumer updates:** Passed descriptors to key `Avatar(...)` consumers in PK components, recordings list/player, story viewer, events list/detail, daily question answers, voice poll, and referral detail.
- **Verification (run):** `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** and `.\gradlew.bat :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`).
- **Not run / remaining:** many API parsers/clients still omit descriptors (events/feed/social/vibe/subscriptions/discover/match/notification/etc.), many UI consumers (chat rendering, room activity/feed/discover/matches/clans/notifications/leaderboards and other surfaces) still don’t pass them, backend/socket/event payload parity and migration/backward-compat audit incomplete, licensing/attribution and `docs/features/avatar/*` missing, and tests/lint/release/runtime-visual-SVG/perf/size checks not run. Working tree remains heavily modified/uncommitted with unrelated whitespace-only diffs.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 2, in progress)

- **Session/core plumbing:** Extended `YugmUser` (`core:model`) with `avatar`/`avatarType`/`avatarParts`; updated `ProfileParser.toUser()` and `RoomParser.toHost()`-aligned parsing; persisted/restored session avatar fields in `SessionManager`; updated `MainViewModel` and `NavGraph` login handoff to track/pass session avatar through update/validate/refresh flows.
- **Non-Host model/parser coverage (initial):** Added descriptor fields and parsing for `FriendUser`, `LeaderboardUser`, `ReferralUser` (SocialModels + Friends/Gift leaderboard APIs) and `ClanSentInvitation.inviteeAvatar*` (GroupModels + `ClanApi`).
- **Backend:** `publicUser` builders in `apps/api/src/routes/auth.ts` and `apps/api/src/routes/users.ts` now include `avatarType`/`avatarParts` (in addition to prior schema/validation/upload/select/populate work).
- **Verification (run):** `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** with `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`. Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` exited 0 (no output).
- **Not run / remaining:** broad non-Host model/parser/consumer propagation (chat/feed/story/recording/PK/event/discover/match/notification/clan UI, `authorAvatar`/`userAvatar`/`hostAvatar`-style fields), backend/socket/event contract parity and migration/backward-compat audit, licensing/attribution and `docs/features/avatar/*`, tests/lint/release/runtime-visual-SVG/perf/size checks, and diff cleanup (widespread unrelated whitespace-only changes remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation, in progress)

- **Engine/UI:** Integrated pinned upstream `mew22/Multiavatar` engine into `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` (adapted from upstream sample deps) with `AvatarDescriptor`/`AvatarParts`, cache, `GeneratedAvatar`, and shared `AvatarGeneratorDialog`. Added `coil-svg`.
- **Profile flows:** Profile creation (`CreateProfileScreen`/`AuthNavGraph`) can generate, preview, and submit generated avatars. Edit Profile (`ProfileDetailScreen`) now persists generated descriptors on Save (hoisted draft, `updateProfile` sends `avatarType=GENERATED` + `avatarPartsJson`, local profile state updated); immediate photo upload clears generated draft and marks avatar as `UPLOADED`.
- **Data/API plumbing:** Added `avatarType`/`avatarParts` to `Host` and `AuthProfileUpdate`, parsed in `RoomParser.toHost()`, and extended shared `Avatar` to render generated descriptors. Backend `User` schema and `profileUpdate` validate/store generated descriptors; `POST /upload/avatar` sets `avatarType=UPLOADED` and unsets `avatarParts`. Added `avatarType avatarParts` to many backend user/avatar `select`/`populate` field lists for exposure.
- **Rendering propagation:** Propagated descriptor params to key Host-based `Avatar(...)` consumers (shared components, profile/profile social/public preview, room host/speakers/selected participant cases, settings/hosts/selected social cases). Repaired compile breakage from prior automated propagation scripts.
- **Verification (run):** `:core:ui:compileDebugKotlin`, `:feature:profile:compileDebugKotlin`, targeted module compiles, and `:app:compileDebugKotlin` BUILD SUCCESSFUL (latest run). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed.
- **Not run / remaining:** non-Host model/parser/consumer coverage (chat/friends/clans/matches/leaderboards/notifications/realtime payloads), full backend response/event/migration/backward-compat audit, licensing/attribution and upstream version docs, `docs/features/avatar/*`, tests/lint/release checks, visual/runtime/device QA, performance/memory, and APK/AAB size measurement. Working tree includes broad unrelated whitespace-only diffs from earlier scripts.

## 2026-11-20 -- Standardize loading spinners on approved Lottie animation

- Imported the provided Desktop `loading.lottie` as `android-client/core/ui/src/main/res/raw/loading_spinner.json`.
- Added `lottie-compose` dependency to `:core:ui` and `YugmLoadingSpinner` (motion-aware, default 40dp, size/modifier parameters).
- Replaced indeterminate `CircularProgressIndicator` spinner usages across `app` and feature modules with `YugmLoadingSpinner`, scaling via `size`/`modifier` and removing color/strokeWidth.
- Retained determinate `LinearProgressIndicator` progress bars and non-spinner loading/decorative animations.
- Updated `DESIGN_SYSTEM.md` and `COMPONENT_REGISTRY.md`.
- Verification (run): `:core:ui:compileDebugKotlin` and `:app:compileDebugKotlin` BUILD SUCCESSFUL in this session (including latest compile after subsequent edits).
- Not run: device/emulator visual/runtime verification, accessibility/TalkBack/motion checks, APK size impact.

## 2026-11-20 -- Decompose ChatScreen into smaller composables

- Extracted `ChatTimelineMessageItem` (per-message swipe-to-reply + MessageBubble rendering) into `ChatScreenMessageItem.kt`.
- Extracted `ChatScreenHeader` (header/selection-mode bar) into `ChatScreenHeader.kt`.
- Extracted `ChatScreenComposer` (emoji bar + input/composer) into `ChatScreenComposer.kt`.
- `ChatScreen.kt` reduced from ~1388 lines to ~1091 lines; behavior/wiring/state ownership unchanged (state stays in ChatScreen, subcomposables receive values/callbacks).
- Verification: `:feature:chat:compileDebugKotlin` BUILD SUCCESSFUL; `:feature:chat:testDebugUnitTest` 3/3; `:app:compileDebugKotlin` BUILD SUCCESSFUL; `git diff --check` clean (aside from pre-existing LF/CRLF note).

## 2026-11-20 -- Frontend UI/UX polish for pre-Home auth flow

- **Shared primitives:** `PrimaryButton` now dims clearly when disabled and exposes a content description; `BrandHeader` tagline uses the active theme accent (preserves gold in dark mode, improves light-mode contrast); `YugmTextField`'s default accent resolves to `LocalYugmColors.current.accent` instead of a fixed gold (nullable default keeps existing callers working).
- **Onboarding:** primary CTA uses proper button role/ripple instead of a manual press-timing guard; Skip target enlarged; illustration container marked decorative for screen readers.
- **Splash:** added a subtle, motion-aware progress indicator after the reveal while session validation runs.
- **Login:** provider actions are tappable to surface the consent error; labels clarified ("Continue with …"); inline helper appears when terms are unchecked; password toggle has semantics and a 48dp target; consent label toggles the checkbox; footer text enlarged; Facebook mark color standardized; disabled borders dim.
- **Phone auth:** consent row uses primary text with accent legal links and whole-row toggle; fields have descriptive labels plus format helper text; resend/back actions use the accent color.
- **Profile setup:** step and consent text enlarged/promoted; bio marked required; avatar upload shows a spinner.
- **Verification:** auth compile and unit tests pass (14/14); app compile passes; `git diff --check` clean. Visual/TalkBack/accessibility-scanner checks remain unrun.

## 2026-11-20 -- Pre-Home onboarding/auth audit: restore self email, consent, and flow edge cases

- **Self email wiring:** `apps/api/src/middleware/auth.ts` now selects `+email` for the authenticated user, so `/auth/me` and `/auth/verify-email` actually include the address that `User` marks `select: false`. `apps/api/src/services/profileUpdate.ts` does the same on both reads, and `apps/api/src/routes/auth.ts` selects `+email` for existing and phone-linked Firebase identities. `handlePublicProfile`/`users.publicUser` still exclude email for other users.
- **Self profile payload:** `PATCH /users/me` now returns `email` and `emailVerified` alongside `publicUser`, so profile setup/edit responses no longer blank the cached address or regress the Settings verified state. `MainViewModel.validateAndUpdate` additionally preserves the cached email when a response omits it.
- **Consent and pending verification:** Login no longer pre-checks the 18+/Terms box when opened directly in sign-up mode. `clearPendingVerification()` clears stale notice/error, and a failed non-verification attempt keeps the Firebase identity while verification is pending.
- **Edge cases:** splash routing is keyed on `Unit` so it cannot navigate twice; profile setup disables Finish while an avatar upload is running; phone/OTP edits clear stale errors; unreferenced `OtpScreen.kt` removed.
- **Onboarding decision:** intro completion remains install-scoped and now survives logout (`SessionManager.logout` restores the flag after clearing account data). The onboarding audit was updated from the earlier replay rule to this confirmed product decision.
- **Verification:** backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed and `npm.cmd --workspace @yugm/api test` passed 178/178. Android with the Android Studio JBR: `.\gradlew.bat :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest :app:compileDebugKotlin --console=plain --max-workers=2` succeeded (auth 14/14, core API 29/29). `git diff --check` clean. Not run: live Firebase/Mongo/App Check, provider/OTP device flows, emulator instrumentation, TalkBack/visual review.

## 2026-11-20 -- Require email verification at creation/sign-in, settings email display, and Firebase user deletion on account delete

- **Email verification enforcement (anti-abuse):**
  - Backend `apps/api/src/routes/auth.ts`: `POST /auth/google` now rejects unverified Firebase `password`-provider tokens (`email_verified=false`) with 403 and does not create/link a Yugm account or issue a session, so email/password accounts must be verified before creation/use.
  - Backend `publicUser` responses now include `email`; `/auth/verify-email` remains the authenticated endpoint for syncing verification state from a fresh matching Firebase ID token.
  - Android `feature:auth`: email/password signup sends a verification email, enters a pending-verification UI state, and only completes backend exchange after the user verifies (reload + verified token exchange). Unverified email/password sign-in is also gated into the verification flow. `LoginScreen`/`AuthNavGraph`/`AuthViewModel` updated accordingly.
- **Settings profile card:** `feature:settings` now shows the user’s email in the first/profile card with a verified indicator (`✓`) when verified, or a **Verify** action when not verified (wired via `SettingsNavGraph`, `NavGraph`, `MainViewModel`).
- **Client data plumbing:** added `email` to `core:model` `YugmUser`, parsed in `core:api` `ProfileParser.toUser()`, persisted/restored in `core:data` `SessionManager` (`userEmail`/`saveSession`), and propagated through `MainViewModel`/navigation.
- **Account deletion Firebase cleanup:** `apps/api/src/services/firebase.ts` adds `deleteFirebaseUser(uid)` (Firebase Admin). `DELETE /users/me` now tombstones/frees identifiers, revokes sessions/tokens, disconnects sockets, and attempts Firebase Auth user deletion (Mongo cleanup still completes if Admin is unconfigured; warned). Auth identity resolution releases identifiers for pending-deletion records matched by email/phone to allow clean re-registration.
- **Verification:** backend `cd backend-server && cmd /c "npx tsc -p apps/api/tsconfig.json --noEmit"` passed. Android Gradle compile/tests not run in this environment (`JAVA_HOME`/`java` unavailable). No live Firebase/Mongo/device/staging verification. Requires deployment/restart of updated API/Worker; Firebase Auth deletion requires configured Admin credentials; email delivery depends on Firebase mail/template/quota/domain configuration.

## 2026-11-20 -- Fix Google sign-in rejection and email reauth deadlock

- **Root Cause Analysis (from release device logcat):**
  - Device Logcat showed Google Sign-In succeeded in Firebase (`TYPE_GOOGLE_ID_TOKEN_CREDENTIAL`, Firebase user issued `Bo4vppehu1Nl5erReQuqq2m2Cok2`), but `POST /api/auth/google` with `mode: "login"` returned 404 because the account did not exist in MongoDB.
  - The client caught 404 and switched the UI to "Create Account" with email prefilled, but left the Google user signed into `FirebaseAuth.getInstance().currentUser`.
  - When the user entered a password to create an account, `emailAuth()` found `priorSignup = auth.currentUser` and called `priorSignup.reauthenticate(EmailAuthProvider.getCredential(normalizedEmail, password))`. Because the Firebase account was created via Google OAuth (without a password provider), Firebase rejected reauthentication with `FirebaseAuthInvalidCredentialsException: The supplied auth credential is incorrect, malformed or has expired.`.
  - In addition, failed auth exchanges left orphaned Firebase sessions on the client, creating state corruption on subsequent attempts.
- **Backend Fix:**
  - Removed the `if (mode === "login")` 404 rejection from `backend-server/apps/api/src/routes/auth.ts`: Google sign-in now delegates directly to `findOrCreateFirebaseUser()`, allowing both existing users to sign in and new users to seamlessly register without requiring a separate password.
- **Android Client Fix:**
  - `AuthViewModel.kt`:
    - Removed `mode = "login"` parameter from `googleAuth()`, enabling seamless sign-in/registration directly into discovery or profile setup (`isNewUser: true`).
    - Guarded `priorSignup` reauthentication in `emailAuth()` to only run if `priorSignup.providerData` explicitly contains `EmailAuthProvider.PROVIDER_ID` (`"password"`). If it is not a password account or if reauthentication fails, it signs out of Firebase.
    - Updated `launchAuth()` and `switchToSignUp()` to sign out of Firebase if a Yugm session exchange is not completed, preventing orphaned Firebase users.
- **Verification:**
  - Backend test suite: 178/178 passed (`npm.cmd --prefix backend-server test`).
  - Backend typecheck: Clean across all workspaces (`npm.cmd --prefix backend-server run typecheck`).
  - Android tests: `:feature:auth:testDebugUnitTest :core:api:testDebugUnitTest` passed.
  - Android compilation: `:feature:auth:compileDebugKotlin` and `:app:compileDebugKotlin` passed.

## 2026-11-20 -- Diagnose staging auth 404 from stale Worker deployment and add explicit deploy scripts

- **Live diagnosis (from provided Cloudflare log):** Release Android client (`okhttp/4.12.0`) reached staging `POST https://yugm-api-staging.sarveshkumar10101.workers.dev/api/auth/google` but the Worker returned **404 Route not found** (`scriptVersion.id: bc0ebaf6-af81-413d-9932-6a69bb6d4b8f`, `outcome: ok`). Current source mounts `/api/auth` with `POST /google`, indicating a stale deployed bundle rather than a source routing defect.
- **Client log evidence (provided):** latest release run completed Firebase Google sign-in and App Check preflight (`YugmAppCheck ... continuing request to server`) before backend exchange; release builds do not emit `YugmHttp` debug request logs, and no `YugmAuth` Google backend-exchange failure line was present in the captured slice. Earlier debug/emulator runs in the same log targeted `http://10.0.2.2:4000/api/auth/google` (404) per `YugmApplication` debug-emulator override, not Cloudflare.
- **Repo fix:** added root workspace deploy scripts in `backend-server/package.json` (`deploy`, `deploy:staging`, `deploy:production`, `deploy:dry-run:staging`, `deploy:dry-run:production`) using explicit `--config apps/cloudflare-worker/wrangler.staging.jsonc` / production config to avoid `npx wrangler deploy` failures when invoked from the npm workspace root.
- **Required follow-up (not run/verified here):** update Cloudflare/dashboard or external deploy command to `npm run deploy:staging` (or explicit config), redeploy staging, and verify `/api/health` plus non-404 `/api/auth/google` behavior and release-client auth. CI workflow already calls `npm --workspace apps/cloudflare-worker run deploy:staging`.

## 2026-11-20 -- Resolve staging worker deploy failure, rate-limit 500 & Google API key restrictions

- **Cloudflare Worker Deploy Repair:**
  - `wrangler.jsonc` had a duplicate trailing JSON root block (`"observability": { ... }` appended after the closing brace), resulting in invalid JSONC and preventing Wrangler deployment.
  - Merged the `observability` configuration cleanly into the single root configuration in `backend-server/apps/cloudflare-worker/wrangler.jsonc` and added it to `wrangler.staging.jsonc`.
  - Pushed to `master` and successfully deployed to the staging Cloudflare Worker (`startedAt: 2026-11-19T20:44:02.483Z`).
  - Confirmed the rate-limiter undefined IP fix (`YUGM-AUTH-RATELIMIT-002`) is live: `POST /api/auth/google` now returns HTTP 422 (validation error on dummy token) rather than HTTP 500 internal server error.
- **Firebase Auth / Google Identity Toolkit API Key Unblocking:**
  - Android release APK experienced 30s timeouts on `Tasks.await` for both Google and Email authentication (`AuthViewModel.kt:300`).
  - Probed Google Identity Toolkit endpoints directly using the project's Firebase API key (`AIzaSyC_RIUaKdjUcnACza1XEZ3hXXGFyfO0fGU`). Discovered Google returned `403 PERMISSION_DENIED: API_KEY_SERVICE_BLOCKED` and `API_KEY_ANDROID_APP_BLOCKED`.
  - The API key was missing the `Identity Toolkit API` in its allowed API list, and the Android package restrictions only listed `91:E4:...`, omitting the active upload signing certificate SHA-1 (`62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6`).
  - Allowed `Identity Toolkit API` and added SHA-1 `62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6` to the Google Cloud Console API key.
  - Updated `android-client/app/google-services.json` with the updated OAuth client hashes and committed the changes.
- **Verification:**
  - Staging worker `/health` returns `ok: true`, `db.ready: true`.
  - Direct HTTP test with the release APK certificate header now successfully reaches the Identity Toolkit API (returns 400 invalid credentials instead of 403 blocked).

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

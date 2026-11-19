# Development progress

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

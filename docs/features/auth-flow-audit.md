# Onboarding-to-authentication audit and repair

**Date:** 2026-11-19

**Scope:** Android signed-out onboarding handoff, email/Google/Facebook/phone sign-in, startup session validation, single-device session handling, and multi-step profile completion.
**Status:** Source changes implemented and focused unit/emulator/API checks passed. Provider/Firebase/Mongo runtime remains unverified.

## Behavior and contracts

- Signed-out cold starts always route to onboarding. The user confirmed that completing the slides without authenticating must replay them next launch; therefore there is no install-scoped or account-scoped intro-completion flag. Auth/profile completion is a separate server-backed concept.
- Authenticated cold starts call `/auth/me` from the splash before choosing profile setup or discovery. The request has an 8-second HTTP call timeout and a 10-second coroutine bound. A confirmed 401/403 clears the local session through the existing unauthorized callback. Transient network or App Check failures retain the local snapshot and continue, so offline routing remains best effort.
- Email, Google, Facebook, and phone credential/backend operations share one exclusive operation state in `AuthViewModel`. Credential acquisition, Firebase sign-in, and backend exchange progress cannot be independently toggled by UI callbacks. Repeated starts are rejected; cancellation/failure clears the state.
- Each backend auth exchange passes App Check readiness first. Protected requests obtain a limited-use token per request. The API verifies with `consume: true`, rejects `alreadyConsumed`, and does not cache verification results. App Check failures do not masquerade as revoked account sessions.
- Firebase credential error mapping is provider-aware. `ERROR_INVALID_CREDENTIAL` and `ERROR_INVALID_PROVIDER_ID` may occur in email, Google, Facebook, or phone flows, so user-facing copy now comes from the active ViewModel-owned provider rather than always naming Facebook.
- A backend exchange failure keeps the Firebase identity so the user can retry the same provider and complete/replay the idempotent identity lookup by Firebase UID. Email signup retries reauthenticate the existing current Firebase identity before another exchange. There is no automatic Firebase deletion/sign-out after an ambiguous server failure because the API may already have committed the account/session.
- Each successful backend login increments the account token generation and invalidates older device sessions. When refresh identifies another-device revocation or a rejected session, Android clears local Yugm/Firebase/socket state, shows a sign-in-again message, and routes to Login.
- `PATCH /users/me` remains the profile update endpoint (there is no `/auth/profile` route in current source). The server returns `user.profileCompleted`; both auth and user routes use one server helper. A completion timestamp is set only when name, username, nonblank bio, city, and at least one nonblank interest are present. A prior `profileCompletedAt` remains authoritative for legacy profiles.
- Profile setup validates age at 18–80, matching `profileSchema`; gender stays optional on both client and server. Terms are accepted at auth and may be recorded as a true consent timestamp through the profile update. Completion ignores optional gender/age/terms and only succeeds from the explicit server response.

## Changes

- `AuthOperationState.kt` adds a small exclusive auth-state reducer used by `AuthViewModel`; provider credential states and backend exchange now have one owner. Phone Firebase credential exchange moved out of `PhoneAuthScreen` into the same ViewModel/repository path.
- `AuthRepository` now uses injected `IYugmApi` and owns auth/session/profile API operations consumed by the auth feature. `AuthProfileUpdate` is the typed request boundary.
- `AuthNavGraph.kt` uses a suspending startup validation callback before selecting a destination. Profile setup checks the authoritative result before navigation.
- `NavGraph.kt` resets successful sign-in/profile completion to the root graph anchor, avoiding a `popUpTo` target that may be absent.
- `MainViewModel.kt` validates and reconciles the restored user/profile snapshot before startup routing; legacy sessions with a valid token but missing local user ID are repaired from `/auth/me`.
- `YugmHttpClient.kt` distinguishes App Check 401 responses from session revocation and passes server refresh-revocation reason to the unauthorized handler.
- `YugmApplication.kt` requests fresh limited-use tokens. Backend `firebase.ts` consumes each token and no longer reuses cached verification; `appCheck.ts` rejects replay results.
- `authSessionRules.ts` centralizes testable Firebase identity-link conflict and refresh token-generation rules. `profileCompletion.ts` centralizes server profile completion logic shared by auth responses and profile updates.
- Existing UI uses Yugm auth fields/buttons/layout and keeps SMS/request cooldown state in the phone screen while server auth state remains in the ViewModel.

## System theme and auth-screen visibility repair

- New installs default to the persisted `SYSTEM` theme mode. The Android platform theme uses `Theme.Material.Light.NoActionBar` in `values/` and `Theme.Material.NoActionBar` in `values-night/`, so the native launch window follows system appearance before Compose starts. Edge-to-edge bars begin with automatic system light/dark detection; once Compose has read the stored preference, its existing status/navigation icon update honors an explicit `LIGHT` or `DARK` override.
- `YugmTheme` defaults to `isSystemInDarkTheme()` when used without an explicit mode. Existing explicit theme selection remains intact.
- Login/signup text, text fields, selected modes, provider buttons, errors and success states now use the active Yugm palette. Profile setup headings, options, progress, field focus, errors, and back controls are also palette-aware. Phone and OTP entry uses accessible focus/error colors and a scrollable, system-bar/IME-aware auth shell.
- Shared text-field components accept optional auth accent/outline colors while preserving existing defaults for non-auth callers.
- Static review found and removed hard-coded white foregrounds and bright yellow text accents that lost contrast against the system light palette. No backend, API, realtime, permission, or persistence behavior changed in this visual repair.
- Build verification is recorded in `docs/DEVELOPMENT_PROGRESS.md`. Real-device light/dark launch-window rendering and visual contrast/TalkBack review remain unverified.

## Verification

- Android `:feature:auth:testDebugUnitTest`: 8 tests passed (startup destinations, auth operation exclusivity/duplicate starts, and provider-aware credential errors).
- Android `:app:compileDebugKotlin` and `:app:compileDebugAndroidTestKotlin`: passed.
- Android `:app:connectedDebugAndroidTest`: 3 emulator tests passed (existing app smoke test and onboarding pager/compact-font regression coverage).
- Backend `npm --workspace @yugm/api test`: 167 tests passed, including added profile completion, field contract, Firebase UID conflict rule, session generation, and App Check replay-result cases.
- Backend `npm --workspace @yugm/api run typecheck`: passed.

## Not verified / remaining integration coverage

- No live Firebase sign-in, email-link/signup, Google/Facebook credential UI, Firebase phone SMS/auto-verification/resend/cooldown, Play Integrity or debug-token request was run.
- No Mongo integration test exercised account linking, refresh rotation/revocation, profile PATCH persistence/XP grant, or transaction/race behavior. The tests cover extracted rules and shared schema only.
- The emulator suite does not drive real login/profile navigation or prove graph back-stack behavior after an auth-provider result; the Android build confirms compilation only.
- App Check verification is now replay-protected in source; configure the deployed Firebase Admin service account and test with real limited-use tokens before rollout.
- The server profile endpoint is `/users/me`, not the requested example `/auth/profile`. Keep client, route, shared profile schema, and OpenAPI aligned if the route is renamed in a separate migration.
- Idempotency is guarded client-side for auth and avatar/profile button submits. Avatar upload is a separate non-idempotent media write without a client request key; verify upload deduplication/recovery before adding resumable/retry behavior.
- Phone OTP callbacks and 30-second resend cooldown remain screen-local; add dedicated Compose/Firebase test harnesses when auth emulator credentials are available.

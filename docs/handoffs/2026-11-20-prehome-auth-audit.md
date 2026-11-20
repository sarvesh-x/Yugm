# Handoff — pre-Home onboarding/auth audit (2026-11-20)

## What was audited

The full path before Home: platform/Compose splash → four onboarding slides → login/signup (email/password, Google, Facebook, phone) → email-verification pending state → profile setup → Home. Checked UI, ViewModel/state ownership, API contracts, persistence, realtime hooks, permissions, error handling, and edge cases against source.

## Repairs made (uncommitted)

Backend:

- `apps/api/src/middleware/auth.ts`: authenticated user query selects `+email`. This makes `/auth/me` and `/auth/verify-email` actually return the address that `User.email` hides with `select: false`.
- `apps/api/src/services/profileUpdate.ts`: both user reads select `+email`, so `PATCH /users/me` and the compatibility `PATCH /auth/profile` return it.
- `apps/api/src/routes/auth.ts`: existing-by-UID and phone-linked identity lookups select `+email`, so returning and legacy phone accounts keep their email in auth responses.
- `apps/api/src/routes/users.ts`: self-only `PATCH /users/me` response adds `email` and `emailVerified`; other-user/public builders are unchanged and still omit email.

Android:

- `app/.../MainViewModel.kt`: `validateAndUpdate` only overwrites `userEmail`/`sessionManager.userEmail` when the parsed email is non-blank, so responses that omit contact data cannot erase it.
- `core/data/.../SessionManager.kt`: `logout()` preserves `onboardingCompleted` across the preference clear. Intro completion is install-scoped per the product decision below.
- `feature/auth/.../LoginScreen.kt`: removed the auto-check of the 18+/Terms checkbox when the screen opens directly in sign-up mode. Consent must be user-affirmed.
- `feature/auth/.../AuthViewModel.kt`: `clearPendingVerification()` also clears `notice`/`error`; a failed non-verification attempt keeps Firebase signed in while verification is pending.
- `feature/auth/.../SplashScreen.kt`: routing effect keyed on `Unit` to prevent a second `navigate()` if the motion preference changes mid-splash.
- `feature/auth/.../CreateProfileScreen.kt`: primary action disabled while an avatar upload is in flight.
- `feature/auth/.../PhoneAuthScreen.kt`: phone/OTP edits clear stale local and ViewModel errors.
- Deleted `feature/auth/.../OtpScreen.kt` (no references; duplicated the live phone/OTP UI).

## Product decision recorded

Onboarding completion persists per install and survives logout. The earlier `docs/features/onboarding-audit.md` rule ("abandoned onboarding must replay; no completion flag") was superseded by commit `4ae89bf` and confirmed by the product owner in this session. Both audits now document the current rule. Signing out clears account data but not the intro flag; reinstalling shows the slides again.

## Verification actually run

- Backend typecheck (from `backend-server/`): `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` — passed.
- Backend tests: `npm.cmd --workspace @yugm/api test` — 178/178 passed. (`npm`/`npx` `.ps1` shims are blocked by PowerShell execution policy; use `npm.cmd` or `node node_modules/...`.)
- Android (from `android-client/`, `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`): `.\gradlew.bat :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest :app:compileDebugKotlin --console=plain --max-workers=2` — BUILD SUCCESSFUL; auth 14/14, core API 29/29.
- `git diff --check` — clean (Git emitted an LF→CRLF warning for `profileUpdate.ts`; no whitespace errors).

## Not verified / next gates

- No live Firebase sign-in, App Check, Mongo-backed auth/profile response, or real signup → verify-email → profile-setup walkthrough.
- Phone SMS, auto-retrieval, resend cooldown, and change-number behavior were not exercised on a device.
- Emulator instrumentation, TalkBack, and light/dark visual review were not re-run.
- Staging Worker still needs the deploy/verification described in `docs/CURRENT_TASK.md` (`YUGM-AUTH-STAGING-DEPLOY-003`); auth routes must return non-404 and email/verification behavior should be rechecked there.
- Settings' Verify action resends silently when the email is still unverified; no snackbar/toast feedback exists. Left unchanged as a UX follow-up.

## Working tree

All changes above are uncommitted. No commit, push, deploy, migration, or seed was run. Review `git status`/`git diff` before continuing; unrelated user work should be preserved.

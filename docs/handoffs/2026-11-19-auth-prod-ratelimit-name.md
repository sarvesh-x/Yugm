# Handoff: Google Sign-In Fallback to Email Signup, Release Token Validation & Auth Flow Rework

**Date:** 2026-11-19  
**Task ID:** YUGM-AUTH-PROD-001  
**Status:** Implementation, Unit Tests, and Compile Verification Complete; Device E2E & Staging Deploy Pending Authorization

---

## 1. Problem Summary & User Request

1. **New User Google Login Issue:**
   - When a new user opened the app without registering and tapped "Google" on the "Sign in" screen, sign-in failed.
   - **Root Cause 1 (Credential Manager):** `GetGoogleIdOption.Builder()` was hardcoded with `setFilterByAuthorizedAccounts(true)`. For a new user who has never authorized Yugm, Credential Manager immediately threw `NoCredentialException` without displaying any Google accounts.
   - **Root Cause 2 (User Request Rework):** When no account exists on Yugm for that Google account, instead of failing or producing an error, the flow must seamlessly transition to "Create account" with the Google email prefilled, ask the user to create a password ("ask to create password"), and directly start onboarding upon creation.
2. **Release APK "firebase token invalid":**
   - In release builds, users encountered "Invalid Firebase ID token" / "firebase token invalid".
   - **Root Cause 1 (Clock Skew in Cloudflare Workers):** `verifyFirebaseIdTokenWithoutServiceAccount` in `firebase.ts` strictly validated `iat <= now` with zero clock tolerance. Any millisecond clock drift between Firebase/Google auth servers and Cloudflare Workers resulted in 401 "Invalid Firebase ID token claims".
   - **Root Cause 2 (Token Freshness):** Client called `getIdToken(false)`, returning stale cached tokens.
   - **Root Cause 3 (Token Issuer Handling):** Backend only verified Firebase public certs; any token issued with Google accounts issuer (`accounts.google.com`) was rejected.

---

## 2. Changes Implemented

### Backend Server (`backend-server/apps/api/`)
1. **`src/services/firebase.ts`:**
   - Added `getGoogleSigningCerts()` to fetch Google public certs from `https://www.googleapis.com/oauth2/v1/certs`.
   - In `verifyFirebaseIdTokenWithoutServiceAccount`:
     - Added `clockTolerance: 60` to `jwt.verify`.
     - Added 60s leeway for timestamps (`iat > now + 60`, `auth_time > iat + 60`).
     - Added native verification for Google ID tokens (`iss: "accounts.google.com"` or `"https://accounts.google.com"`).
2. **`src/routes/auth.ts`:**
   - In `authSchema`, added optional `mode: z.enum(["login", "signup"])`.
   - In `POST /api/auth/google`:
     - If `mode === "login"`, queries MongoDB for an existing user by `firebaseUid` or `email`.
     - If no existing record is found, returns `404 Not Found` (`ErrorCode.NOT_FOUND`, "No account found for this Google email. Please create a password to sign up.").
     - If existing record is found, or if `mode` is omitted/"signup", signs in or creates the account as normal.

### Android Client (`android-client/`)
1. **`core/api/src/main/java/com/yugm/app/core/api/AuthApi.kt` & `IYugmApi.kt` & `YugmApi.kt`:**
   - Added optional `mode: String? = null` parameter to `googleAuth()`.
2. **`core/data/src/main/java/com/yugm/app/core/data/repository/AuthRepository.kt`:**
   - Propagated `mode: String? = null` parameter to `AuthApi.googleAuth()`.
3. **`feature/auth/src/main/java/com/yugm/app/feature/auth/viewmodel/AuthViewModel.kt`:**
   - Added `isCreateAccount`, `prefilledEmail`, and `prefilledName` observable states.
   - Added `switchToSignUp(email, name, message)` and `setAuthMode(create)`.
   - Updated `googleAuth` to accept `email` and `name`, use `getIdToken(true)` for fresh tokens, and pass `mode = "login"`.
   - Added `NoAccountFoundException`. When caught in `launchAuth`, automatically switches to sign-up mode with the email prefilled.
   - Updated `emailAuth` to use `getIdToken(true)` and pass `prefilledName` to backend when creating an account.
   - In `mapAuthError`, masked raw backend Firebase errors with user-friendly guidance.
4. **`feature/auth/src/main/java/com/yugm/app/feature/auth/navigation/AuthNavGraph.kt`:**
   - Changed `setFilterByAuthorizedAccounts(true)` to `setFilterByAuthorizedAccounts(false)` in `GetGoogleIdOption`.
   - Passed `googleCredential.id` (email) and `googleCredential.displayName` (name) into `authViewModel.googleAuth`.
   - Wired `initialEmail`, `initialCreateAccount`, and `onModeChange` to `LoginScreen`.
5. **`feature/auth/src/main/java/com/yugm/app/feature/auth/screens/LoginScreen.kt`:**
   - Added `initialEmail`, `initialCreateAccount`, and `onModeChange` parameters.
   - Added `LaunchedEffect` triggers to auto-select "Create account", show password and confirm password fields, and preserve terms acceptance.

---

## 3. Verification Completed

- **Backend Unit Tests:**
  `npm --workspace @yugm/api test` -> **173 / 173 passed** (2.6s)
- **Backend Typecheck:**
  `npm --workspace @yugm/api run typecheck` -> **Clean (0 errors)**
- **Android Unit Tests:**
  `:feature:auth:testDebugUnitTest :core:api:testDebugUnitTest` -> **All tests passed**
- **Android Compilation:**
  - `:core:api:compileDebugKotlin` -> **BUILD SUCCESSFUL**
  - `:core:data:compileDebugKotlin` -> **BUILD SUCCESSFUL**
  - `:feature:auth:compileDebugKotlin` -> **BUILD SUCCESSFUL**
  - `:app:compileDebugKotlin` -> **BUILD SUCCESSFUL** (19s)

---

## 4. Remaining Steps (Requires Authorization / Device)

1. **Deploy Staging Worker:**
   - Deploy backend fixes to Cloudflare staging worker (`wrangler deploy`) so the 500 rate limiter fix, Google cert verification, and `mode: "login"` endpoint logic are live on staging.
2. **Live Device Test:**
   - Open app on device -> Tap "Google" on the Sign In tab.
   - Verify all Google accounts on device appear.
   - For an account not registered on Yugm, verify automatic transition to "Create account" with email prefilled, prompt to create password, and navigation to `ProfileSetupScreen` upon submit.

---

## 5. 2026-11-20 Update — Rate-limiter crash confirmed as the release sign-in blocker

**Live staging still fails (deploy is the missing step):**

| Request | Result |
| --- | --- |
| `GET /api/health` | 200, `db.ready=true`, `db.name=YugmStaging` |
| `POST /api/auth/google` (`{}` or a dummy 24-char `idToken`) | 500 `Cannot read properties of undefined (reading 'replace')` |
| `POST /api/auth/facebook` | 500, same message |
| `POST /api/auth/phone` | 500, same message |
| `POST /api/auth/refresh` | 422 (validation) |
| `POST /api/auth/logout` | 401 (missing token) |
| `PATCH /api/users/me` | 401 (missing token) |

The split is diagnostic: `/auth/google|facebook|phone` are the only probed routes behind `authLimiter`, whose default key generator is `req.ip`. The Cloudflare node bridge leaves `req.ip` undefined, so `increment(undefined)` reached `safeKey()` and crashed before `validateBody`. `/auth/refresh` uses `refreshLimiter`, whose generator always returns a string, so it validated normally.

**Root cause proven locally, not just inferred:** an Express harness that shadows `req.ip` to `undefined` reproduced `TypeError: Cannot read properties of undefined (reading 'replace')` at `rateLimitStore.ts:10` and HTTP 500 on the committed sources, and returned 200 on the fixed sources.

**Regression tests added:** `apps/api/src/middleware/rateLimit.test.ts` and `apps/api/src/services/rateLimitStore.test.ts`. Full suite: 178/178 pass, typecheck clean.

**App Check is not the current blocker:** `AppCheckReadiness.requireReady` logs and continues on token failure, `YugmHttpClient` attaches `X-Firebase-AppCheck` only when a token exists, and the staging Worker does not enforce App Check (`APP_CHECK_ENFORCE` absent). Registering the release signing certificate (`README.md`: SHA-256 `f12c86...`) is still required before App Check enforcement is turned on.

**Still required:** deploy the API/Worker (`wrangler deploy` for `YugmStaging`) with these fixes, then run the device test in section 4.


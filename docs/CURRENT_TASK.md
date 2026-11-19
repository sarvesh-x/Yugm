# Current task

## YUGM-AUTH-RATELIMIT-002 -- Close the staging auth 500 that blocks release sign-in

- **Problem:** Release/device sign-in and sign-up failed while the base URL and connectivity were correct. Every credential exchange (email, Google, Facebook, phone) funnels through `POST /api/auth/google|facebook|phone`, and the deployed staging Worker answers all of them with HTTP 500 `{"ok":false,"error":{"message":"Cannot read properties of undefined (reading 'replace')","code":"INTERNAL"}}` before schema validation runs.
- **Root cause (confirmed, not inferred):** the Cloudflare node bridge does not populate `req.ip`, so `express-rate-limit`'s default `keyGenerator` returns `undefined`; `ResilientRedisRateLimitStore.increment` passed it to `safeKey()`, which called `.replace` on `undefined`. Shadowing `req.ip` with `undefined` in a local Express harness reproduces the exact staging message and HTTP 500 on the pre-fix source, and returns 200 on the fixed source.
- **Fix:** a `clientIp()` helper (`cf-connecting-ip` -> `x-forwarded-for` -> `req.ip` -> `"unknown"`) is now the key generator for the auth, identifier, refresh, and per-user limiters, and `safeKey()` returns `"unknown"` for non-string/empty keys instead of throwing. Store `get`/`decrement`/`resetKey` normalize keys the same way as `increment`.
- **Verification:** `npm --workspace @yugm/api run typecheck` clean; `npm --workspace @yugm/api test` 178/178 pass, including the new `src/middleware/rateLimit.test.ts` and `src/services/rateLimitStore.test.ts` regression tests.
- **Status:** Source fix and regression tests complete. The deployed staging Worker still returns HTTP 500 on `/api/auth/google|facebook|phone` (checked 2026-11-20), so a Worker deploy is required before release sign-in works. Not deployed here: no deployment authorization was given. Release App Check is client-side best-effort (`AppCheckReadiness` logs and continues; `YugmHttpClient` attaches `X-Firebase-AppCheck` only when a token exists), and the staging Worker does not enforce App Check, so the 500 is the whole blocker.

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

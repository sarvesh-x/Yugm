# Handoff: onboarding-to-authentication reliability

**Date:** 2026-11-19

**Task:** YUGM-AUTH-RELIABILITY-002
**Status:** Implementation complete; integration verification remains limited to documented gates.

## Delivered

- Unified provider credential, Firebase, and Yugm backend-exchange loading/error ownership in `AuthViewModel`, including phone credentials, duplicate-submit protection, and cancellation/error settlement.
- Added App Check readiness before all provider exchanges, fresh limited-use client tokens, and consumed-token rejection on the backend. App Check failures are distinguished from session revocation.
- Added bounded cold-start `/auth/me` validation and local profile reconciliation, stable root graph navigation after login/profile completion, and clean handling for revoked sessions.
- Gated profile setup completion on the server's explicit `profileCompleted=true` response. Shared server completion logic across auth and profile routes and aligned required fields and age bounds with the existing API contract.
- Preserved the user's clarified onboarding behavior: a signed-out launch replays onboarding if the user exits before authenticating.
- Kept Firebase identity after an ambiguous backend-exchange failure so the user can retry without risking loss of a server-side account/session commit.

## Verification evidence

- Focused rerun after the final phone auto-verification loading adjustment and `@param:ApplicationContext` annotation cleanup: `:feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed (5 auth unit tests; Kotlin compilation passed).
- Also completed: app and instrumentation Kotlin compilation, emulator tests (3), API tests (167), and API TypeScript typecheck. See [auth flow audit](../features/auth-flow-audit.md).
- `git diff --check` passed for repository changes; it reports only the existing line-ending conversion warning for `backend-server/apps/api/openapi.yaml`.

## Runtime gates not exercised

Real Firebase providers and phone OTP/autoverification/resend, Play Integrity/App Check token consumption, live Mongo persistence/session rotation/account linking, and interactive profile/login back-stack behavior still need device/emulator plus Firebase/backend integration coverage. Client guards do not make avatar upload or profile writes server-idempotent.

## Next maintainer actions

1. Add Firebase Auth Emulator and API/Mongo integration coverage for provider exchange, App Check replay, session rotation, account linking, profile persistence, and OTP retry paths.
2. Exercise real login and profile completion on an emulator/device and confirm root navigation and session-revocation messaging.

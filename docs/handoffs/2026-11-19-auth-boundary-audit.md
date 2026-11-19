# Handoff: auth boundary audit and remaining runtime proof

**Date:** 2026-11-19

**Task:** YUGM-AUTH-BOUNDARY-AUDIT-001
**Status:** Source audit and scoped repairs complete; do not mark the auth boundary fully closed until runtime integration gates below pass.

## Delivered

- Rechecked current provider-operation ownership and cleanup, root navigation reset, server-confirmed profile completion, App Check readiness/error mapping, bounded startup session validation, and server-revocation messaging against the source.
- Confirmed Socket.IO handshake/reconnect checks JWT, current user generation, and live session validity. Added server-side disconnection after logout, account deletion, admin ban, and report-driven ban; successful login already disconnects old device sockets.
- Account logout now clears local Firebase/session/socket/media state, app notification state, session-scoped caches, and all sync topics. The logout request carries the FCM token for server-side removal before session revocation.
- Updated auth audit, API contract notes/OpenAPI, known-issue evidence, current task, and development progress.

## Verification run

- `android-client/`: ` .\gradlew.bat :feature:auth:testDebugUnitTest :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin :app:connectedDebugAndroidTest --console=plain` — passed; 8 auth unit tests; Android/instrumentation Kotlin compile; 3 connected API 37 emulator tests.
- `backend-server/`: `npm --workspace @yugm/api test` — 167 passed; `npm --workspace @yugm/api run typecheck` — passed.
- These commands do not prove Firebase, Mongo persistence, remote navigation, or production configuration behavior.

## Still required to close

1. Exercise Firebase Auth email/Google/Facebook/phone sign-in, cancellation, ambiguous backend exchange retry, OTP auto-verification/resend/cooldown/errors, and App Check limited-use token issuance/replay on configured emulator/device and API.
2. Run isolated Mongo-backed auth/profile integration coverage for account linking/conflicts, logout device-token removal and socket disconnect, refresh rotation/single-device revocation, profile persistence/completion timestamp/XP, and concurrency races.
3. Manually/instrumentation trace navigation after real provider callbacks and profile completion; cold-launch expired/revoked/incomplete/legacy sessions; second-device login and prior-device messaging.
4. Check offline/revoked logout and FCM-token lifecycle, avatar-upload lost-response/retry semantics, phone callback/cooldown ownership, and authorization requirements for every ephemeral socket event.

Do not use production Firebase/Mongo credentials or production data for these checks; use configured emulator and isolated integration environments.

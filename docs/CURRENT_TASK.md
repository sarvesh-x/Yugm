# Current task

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

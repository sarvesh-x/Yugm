# Current task

## YUGM-AUTH-ERROR-001 — Match credential errors to the active provider

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

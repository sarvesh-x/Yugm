# First-launch splash and onboarding audit

**Date:** 2026-11-19

**Scope:** Android app launch through the Compose splash and four intro slides for a signed-out user.
**Method:** Source inspection plus focused unit and emulator instrumentation tests. Fresh light-theme Compose screen was captured; TalkBack and physical-device behavior remain unverified.

## Launch path traced

1. `MainActivity.onCreate` sets the Compose content and `YugmTheme`; the theme mode comes from `SessionManager` or follows the system setting.
2. `NavGraph` starts the `NavHost` at `Screen.Splash` and passes the restored session snapshot and validation callback to `authNavGraph`.
3. `SplashScreen` animates its logo for 250 ms when motion is enabled, then performs a bounded `/auth/me` check for a restored token before routing. Signed-out users route to onboarding; authenticated users route from the server-reconciled profile completion value.
4. `OnboardingScreen` renders four hard-coded slides in `HorizontalPager`. Users can swipe or press Next; the last CTA navigates to Login. Successful sign-in/profile completion resets to the root graph anchor. See the separate [auth-flow audit](auth-flow-audit.md) for login, session, App Check, and profile behavior.

Relevant implementation: [MainActivity](../../android-client/app/src/main/java/com/yugm/app/MainActivity.kt), [NavGraph](../../android-client/app/src/main/java/com/yugm/app/navigation/NavGraph.kt), [AuthNavGraph](../../android-client/feature/auth/src/main/java/com/yugm/app/feature/auth/navigation/AuthNavGraph.kt), [SplashScreen](../../android-client/feature/auth/src/main/java/com/yugm/app/feature/auth/screens/SplashScreen.kt), [OnboardingScreen](../../android-client/feature/auth/src/main/java/com/yugm/app/feature/auth/screens/OnboardingScreen.kt), and the shared [GlassComponents](../../android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/GlassComponents.kt).

## Findings

### Repaired — Light-theme first-run text contrast

`SplashScreen` now uses theme-aware wordmark and tagline colors. The onboarding root has an explicit theme background, and card title/body use the shared theme foreground colors. The inactive pager dots also use a palette-appropriate color. A fresh light-theme emulator capture showed readable brand and slide text.

Evidence: `SplashScreen.kt`, `OnboardingScreen.kt`, `Theme.kt`, `GlassComponents.kt`. The light capture is not a formal contrast measurement.

### Required behavior — Abandoned onboarding repeats

The user clarified that if someone finishes the slides but leaves without signing in or creating an account, the next cold launch must show onboarding again. The flow now does not save intro completion. The last CTA navigates to Login only in the current navigation session. On a later cold start, a blank auth token routes to onboarding; a persisted authenticated session bypasses it.

Evidence: `StartupDestination.kt`, `AuthNavGraph.kt`, `OnboardingScreen.kt`. Three route unit tests cover signed-out, incomplete-profile, and authenticated startup paths. The later startup-validation change is described in [auth-flow audit](auth-flow-audit.md).

This feature has no onboarding database/API/realtime write by design. Persisting completion would violate the abandon-and-replay rule.

### Repaired — Compact-height and large-font layout

Compact viewports use smaller artwork/gaps/padding; short or large-font slide content can scroll vertically. An emulator test constrains the screen to 360×480 dp at 1.5x font scale and confirms the first slide and Next action remain visible.

Evidence: `OnboardingScreen.kt`, `OnboardingFlowTest.compactLargeFontKeepsFirstSlideAndActionAvailable`. Other device sizes and landscape remain unverified.

### Repaired — Pager semantics and progress contrast

The pager exposes “Slide N of 4” as a state description, slide titles are semantic headings, and the artwork has a label. Decorative progress dots are hidden from duplicate screen-reader traversal; their inactive color is now visible in both palettes. Compose instrumentation confirms the current page state description and pager completion. TalkBack behavior has not been tested.

Evidence: `OnboardingScreen.kt`, `GlassComponents.kt`, `OnboardingFlowTest.pagerAnnouncesProgressAndCompletesAfterLastSlide`.

### Improved — Compose splash delay and reduced motion

The presentation-only scale animation is now 250 ms and calls `snapTo` without animation when the system motion preference is off. Routing remains based on locally restored session state rather than a network prerequisite.

Evidence: `SplashScreen.kt`, `AuthNavGraph.kt`. Cold/warm timing remains unmeasured; routing now waits for the bounded session-validation decision before choosing a destination.

### P2 — OS launch splash and Compose splash may not match

**Unverified device/rendering risk.** The app declares a general `Theme.Yugm` in `values/themes.xml`; no `windowSplashScreen*` theme attributes, `values-v31` splash theme, or explicit AndroidX splash-screen API use were found in the inspected app source. Android's system launch window and the subsequent Compose splash may therefore use different imagery/backgrounds on supported Android versions. Static inspection cannot establish whether users see a flash or an undesirable double transition.

Evidence: `app/src/main/AndroidManifest.xml:27-58`; `app/src/main/res/values/themes.xml`; no splash theme/API references found in app source.

**Follow-up:** capture launches on at least one Android 12+ device and the minimum supported API. Align the platform starting window with the Compose splash only if a mismatch is observed.

### Repaired — Unused looping animation removed

The unused `floatY` infinite transition has been removed. Shared entrance motion already respects system reduced-motion behavior.

Evidence: `OnboardingScreen.kt`; no `floatY` reference remains.

## Checks and limits

- The onboarding route test set passed three startup destination cases; the expanded auth unit suite has five passing cases including provider-operation state coverage.
- `:app:connectedDebugAndroidTest` passed three emulator tests, covering pager semantics/progression, compact large-font rendering, and the existing app example test.
- `:app:compileDebugKotlin` and `:app:compileDebugAndroidTestKotlin` passed.
- A fresh light-theme emulator screen capture showed readable wordmark, title, and body; inactive progress dots were adjusted after visual inspection.
- No full signup/sign-in, TalkBack, physical-device, cold-start timing, or separate platform system-splash verification was performed.
- Backend API, realtime, permissions, and server database persistence are not applicable to this client-only introductory flow. The intended signed-out replay behavior explicitly avoids persisting intro completion.
- Session validation, backend auth, App Check, account linking, profile persistence, and revoked-session behavior are covered separately in [auth-flow audit](auth-flow-audit.md); live Firebase/Mongo behavior remains unverified.

## Suggested order

1. Verify TalkBack behavior on a physical device.
2. Capture the platform OS splash and Compose transition on supported Android versions.
3. Measure cold/warm launch timing before further changing the 250 ms animation.

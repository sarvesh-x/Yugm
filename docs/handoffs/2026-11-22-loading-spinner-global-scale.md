# 2026-11-22 - Global Lottie loading-spinner scale

## Scope

Make the single app-wide Lottie spinner visibly larger everywhere without touching every call site.

## Changes

- `core/ui/.../YugmLoadingSpinner.kt`: added `YugmLoadingSpinnerDefaults` with `BaselineSize = 40.dp` and the global `SizeScale = 1.25f`. Every caller-supplied `size` is now a baseline and is multiplied once by `SizeScale` for both the Box and the LottieAnimation (e.g. 16dp renders as 20dp, 40dp as 50dp).
- Added `YugmLoadingSpinnerTest` (2 cases) guarding the global scale and default baseline.
- Docs updated: root `docs/DESIGN_SYSTEM.md`, `docs/COMPONENT_REGISTRY.md`, and `android-client/docs/DESIGN_SYSTEM.md` now describe the global knob and baseline semantics.

## Verification

- Android Studio JBR, `--console=plain --max-workers=2`: `:core:ui:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin` - BUILD SUCCESSFUL.
- `:core:ui:testDebugUnitTest` - BUILD SUCCESSFUL (8/8: `YugmLoadingSpinnerTest` 2/2, `BottomDockGeometryTest` 6/6).

## Not verified / risks

- No device/emulator visual review of the larger spinner in tight inline slots (message rows, list item actions) or at large font scale; if any slot clips, adjust that call-site baseline or the global scale after visual sign-off.
- Motion-off behavior and content description are unchanged; determinate progress bars remain untouched.
- No commit, push, or deploy was made.

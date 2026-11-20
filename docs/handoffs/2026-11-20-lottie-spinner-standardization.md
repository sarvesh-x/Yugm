# Handoff: Standardize loading spinners on approved Lottie animation

## Summary
- Imported `loading.lottie` from Desktop into `android-client/core/ui/src/main/res/raw/loading_spinner.json`.
- Added `lottie-compose` dependency and `YugmLoadingSpinner` in `:core:ui`.
- Replaced indeterminate `CircularProgressIndicator` spinner usages across app/feature modules with `YugmLoadingSpinner`.
- Retained determinate `LinearProgressIndicator` progress bars and non-spinner animations.

## Verification
- `:core:ui:compileDebugKotlin` BUILD SUCCESSFUL.
- App/feature compile: pending/see final session report.

## Notes
- Lottie animation is grayscale; callers no longer pass color/strokeWidth.
- Size extracted from original modifier where present; default 40dp.
- Motion preference respected (static first frame when disabled).
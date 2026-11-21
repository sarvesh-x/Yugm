# Handoff: Bottom navigation icon-first / premium curved-dock refinement

- Date: 2026-11-21
- Task: YUGM-NAV-DOCK-REFINE-012 (icon-first) then YUGM-NAV-DOCK-PREMIUM-013 (premium geometry/icons/motion/feedback).
- Builds on: [YUGM-NAV-AUDIT-011 handoff](2026-11-21-bottom-nav-insets-and-polish.md), [NAVIGATION_ARCHITECTURE.md](../NAVIGATION_ARCHITECTURE.md).

## Changes applied (source, uncommitted)

- **Premium pass (013):** added `core/ui/.../BottomDockIcons.kt` (rounded custom vector family: game controller, studio mic, compass, chat bubble, user silhouette; outlined inactive + filled active, consistent stroke/caps); reworked `YugmBottomDock` geometry so the active circle (50dp, 28dp icon, 2dp ring) is centered on the surface top boundary and embedded in a genuine 78×36dp concave cradle; selected-only label in reserved 20dp slot with fade+slide (no clipping/layout shift); inactive icons fixed baseline rising/fading into notch; shared controlled spring (~300ms)/snap motion for notch+circle+icons+label; circular touch feedback, badge, haptic; clamped shoulders/narrow-width tests.
- `android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/ReferenceComponents.kt` (`YugmBottomDock`):
  - Icon-first minimal layout: 26dp icons; inactive icons vertically centered in a fixed/stable slot (no layout shift on selection changes).
  - Labels: hidden for inactive destinations; only the selected destination label is rendered with a smooth fade-and-slide transition (reserved space/stable positioning so the icon row does not jump).
  - Active indicator: elevated 50dp circle, 26dp icon, 2dp ring; notch cradle tuned to 76dp × 34dp, synchronized with the animated destination index.
  - Interaction: subtle circular press feedback (no rectangular ripple/grey overlay), `selectable(..., indication = null, Role.Tab)` retained, chat unread badge retained, light haptic tick on tab interaction (`android.view.HapticFeedbackConstants.CLOCK_TICK`).
  - Preserved: theme tokens/light-dark compatibility, edge-to-bottom surface and navigation-bar inset handling, whitelist/visibility ownership, idempotent select/reselect behavior, accessibility semantics/content descriptions.
- `android-client/core/ui/src/test/java/com/yugm/app/core/ui/components/BottomDockGeometryTest.kt`: updated `activeCircleSitsInsideTheNotchCradle` for 50dp circle / 34dp notch depth.
- `docs/NAVIGATION_ARCHITECTURE.md`: updated dock visual/interaction conventions (dimensions, selected-only label behavior, circular feedback, haptic).
- `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`: recorded this refinement.

## Verification run

- `cd android-client; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat :core:ui:compileDebugKotlin :app:compileDebugKotlin :core:ui:testDebugUnitTest --console=plain --max-workers=2` → **BUILD SUCCESSFUL** (233 tasks; `:core:ui:testDebugUnitTest` passed, including `BottomDockGeometryTest`).
- `.\gradlew.bat :app:installDebug --console=plain --max-workers=2` → **BUILD SUCCESSFUL** (installed on `emulator-5554`).
- Runtime: app relaunched and screenshot captured to workspace as `refined_dock.png` (and device path `/sdcard/refined_dock.png`), but **the agent could not visually inspect the image** — human/Layout Inspector confirmation required.

## Not verified / remaining

- Human visual sign-off: inactive icon vertical centering, selected-only label fade/slide, no layout shift, 50dp circle/76×34dp notch proportions at all five tabs (including first/last), subtle circular touch feedback (no rectangular artifact), haptic feel, badge placement/contrast, light/dark/system, gesture + 3-button nav, keyboard/IME, font scaling, TalkBack, predictive back.
- `:app:lintDebug` not re-run after this refinement (previously passed before refinement; core lint passed earlier). Full navigation runtime regression still as documented in prior handoffs.

## Next steps

1. Visually verify the refined dock on device/emulator (all five roots, first/last tab, secondary-route hide/restore, light/dark, 3-button nav).
2. Re-run `:app:lintDebug` if a clean post-refinement lint record is required.
3. Continue open follow-ups only if requested: deep links (F6), dead-route cleanup (F8), notification/push mapper unification (F9). No commit/push/deploy without explicit authorization.

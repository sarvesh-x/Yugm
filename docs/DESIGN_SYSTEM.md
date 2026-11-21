# Yugm Android design system

## Existing source of truth

The Android shared UI foundation is `android-client/core/ui/src/main/java/com/yugm/app/core/ui/`.

- `theme/Theme.kt`: `YugmTheme`, Material 3 color schemes, `YugmColors`, composition local, and shape setup.
- `theme/Color.kt`: brand and semantic colors, theme-aware compatibility aliases, and named aurora gradients.
- `theme/Type.kt`: Inter typography, JetBrains Mono utility styles, and legacy `Typography` alias.
- `theme/MotionPreference.kt`: system motion preference used by animated UI.
- `components/`: shared Compose UI and feature-adjacent reusable visuals. See [component registry](COMPONENT_REGISTRY.md).

Use this foundation; do not define another app-level theme. The app defaults to the Android system light/dark setting from the platform launch theme through Compose. The platform starting window uses Android's light and night resource qualifiers; a user's explicit `LIGHT` or `DARK` preference still overrides `SYSTEM` after Compose starts. New installs default to `SYSTEM`. Dynamic Material color exists as an opt-in parameter and is disabled by default.

## Token usage

Use `MaterialTheme.colorScheme`, `MaterialTheme.typography`, `YugmColors`, `YugmShapes`, and existing semantic color aliases before adding raw color or shape values. Raw values remain appropriate for feature artwork, media overlays, and explicitly branded visuals; keep those local and explain the intent. Preserve contrast and touch-target accessibility.

Spacing is not yet a complete central token scale: screens and shared components still contain many direct `dp` values. New shared components should use a consistent spacing scale; a broad migration needs its own scoped task and visual review. Animation should respect `LocalMotionEnabled` where meaningful.

Loading spinners use the single approved Lottie animation via `core/ui`'s `YugmLoadingSpinner` (`res/raw/loading_spinner.json`). Do not introduce new `CircularProgressIndicator` spinners or alternate spinner animations; scale `YugmLoadingSpinner` with its `size`/`modifier` parameters. Determinate `LinearProgressIndicator` progress bars remain separate where they represent real progress.

## Main tab background architecture

The five primary main tabs (`Arcade`, `Party`, `Discover`, `Chat`, `Profile`) share one stationary ambient background rendered by `MainTabsScreen`.

- **One background:** `MainTabsScreen` renders a single full-screen `YugmBackground(style = YugmBackgroundStyle.Ambient)` as the first child of its root `Box`, behind the `HorizontalPager` and bottom dock. This background is stationary during horizontal swipes and animated tab switches.
- **Transparent tab containers:** Main-tab page roots must not draw independent full-screen backgrounds, opaque `Scaffold` container colors, or per-page gradients. Use `YugmBackgroundStyle.None` or a transparent root when a screen can be hosted inside `MainTabsScreen`; standalone/secondary routes may use an appropriate `YugmBackground` variant.
- **One persistent dock:** The bottom navigation dock is overlaid on the shared root layout and extends the shared background behind the transparent notch/cradle. Scrollable tab content applies shared bottom clearance via `LocalMainDockBottomClearance`/`mainDockBottomClearance()`; do not shrink the pager viewport or duplicate system insets.
- **Pastel mesh + grain:** Ambient uses `LocalYugmColors.current.background` as base and brand tokens (`BrandViolet`, `BrandPink`, `BrandOrange`) for low-contrast radial mesh glows positioned relative to the shared root viewport. A cached 128x128 monochrome grain BitmapShader is tiled at very low opacity (light ~2.5%, dark ~2%) and must not be regenerated per frame/recomposition.
- **Dock tokens:** Bottom dock uses centralized semantic tokens on `YugmColors`: `bottomDockSurface`, `bottomDockInactiveContent`, `bottomDockActiveContent`, `bottomDockOutline`, `bottomDockShadow`. Dock shadow must follow the curved dock shape (including notch) and must not fill the transparent notch or obscure the active indicator.
- **Performance:** One shared background layer, cached brushes/grain, no per-page background recomposition during pager scroll, no animated/decorative background blobs, no expensive real-time blur.

## Migration direction

Consolidate existing equivalents before adding components. Migrate frequently used screens incrementally and check light/dark, font scaling, accessibility, and loading/error/empty states. The login, phone/OTP, and profile-setup auth screens were made palette-aware in the 2026-11-19 auth theme repair; this does not establish system-theme readiness for the rest of the app. See [auth flow audit](features/auth-flow-audit.md).

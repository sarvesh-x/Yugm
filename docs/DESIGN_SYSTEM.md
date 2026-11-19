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

## Migration direction

Consolidate existing equivalents before adding components. Migrate frequently used screens incrementally and check light/dark, font scaling, accessibility, and loading/error/empty states. The login, phone/OTP, and profile-setup auth screens were made palette-aware in the 2026-11-19 auth theme repair; this does not establish system-theme readiness for the rest of the app. See [auth flow audit](features/auth-flow-audit.md).

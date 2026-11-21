# 2026-11-22 - Achievements shortcut in Your Yugm

## Scope and decisions

Replace the own-profile **Achievements & badges** card with a **Your Yugm** profile shortcut named **Achievements**. The existing `Screen.Achievements` destination and other users' public **Badges** showcase are preserved. No backend or API changes were needed.

## Changes

- **`feature/profile/.../ProfileDetailScreen.kt`:** removed the own-profile achievements/badges card and its self-profile badge fetch; the public-profile `Badges` card still loads and renders badges for other users. Added a trophy `Achievements` tile to `ProfileMenuCard`, wired to the existing `onOpenAchievements` callback already connected to `Screen.Achievements` in `MainTabsScreen` and `NavGraph`.
- **Docs:** updated `docs/DESIGN_SYSTEM.md`, `docs/CURRENT_TASK.md`, and `docs/DEVELOPMENT_PROGRESS.md`.

## Verification

- Android Studio JBR: `:feature:profile:compileDebugKotlin` — BUILD SUCCESSFUL. Only pre-existing deprecation warnings for `LocalClipboardManager` and `Icons.Filled.ArrowBack` were reported.

## Not verified / next session

- No device/emulator visual QA of the two-row `Your Yugm` grid, tile label truncation, light/dark themes, font scaling, TalkBack label, or touch target.
- Committed and pushed as `76dbfe8`; no deploy was performed.

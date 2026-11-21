# 2026-11-22 - Compact empty Clans card on the profile

## Scope and decisions

The user confirmed the target is the own-profile **Clan details** card, not the separate Clans screen tabs. When the user has no clan, it now uses the same compact horizontal glass-card pattern as the Bonds empty card: a **Clans** title, "Find a clan that feels like home." subtitle, and a small primary-themed **Explore clans** button on the right. The centered "User has not joined clan yet" text, outlined button, and tall stacked layout are removed.

The populated clan card, `onOpenClan`, `onOpenClanList`, and `viewModel.ownClan` loading are unchanged. No backend, API, persistence, or realtime changes were needed.

## Changes

- **`android-client/feature/profile/.../screens/ProfileDetailScreen.kt`:** the clan `item` now checks `viewModel.ownClan` before choosing the UI; `null` renders the new private `ClanEmptyCard`, otherwise the original populated `GlassCard` is rendered unchanged. Added the `Explore` icon import. `ClanEmptyCard` mirrors `BondsEmptyCard` exactly in structure and tokens: `GlassCard(cornerRadius = 18.dp, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp))`, a centered `Row(heightIn(min = 48.dp))`, theme-aware `LocalYugmColors` text, compact themed `Button`, and a ~76dp card height that expands with accessibility font scaling.
- **Docs:** `DESIGN_SYSTEM.md`, `CURRENT_TASK.md`, and `DEVELOPMENT_PROGRESS.md`.

## Verification

- Android Studio JBR, `.\gradlew.bat :feature:profile:compileDebugKotlin --console=plain --max-workers=2` — BUILD SUCCESSFUL. Only pre-existing `LocalClipboardManager` and `Icons.Filled.ArrowBack` deprecation warnings were reported.
- `git diff --check` — clean apart from pre-existing LF/CRLF notices.

## Not verified / next session

- No device/emulator visual QA of the empty card: exact height, spacing, light/dark/system themes, font scaling, narrow widths, TalkBack labels, and the **Explore clans** tap target.
- Full lint/assemble and compose/preview rendering were not run.
- Changes are uncommitted. Do not commit/push/deploy without explicit authorization.

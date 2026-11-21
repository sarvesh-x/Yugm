# 2026-11-21 - Main tab shared background and dock clearance

## Scope

Implement the unified main-tab background architecture and safe bottom content clearance for Yugm's five primary tabs (Arcade, Party, Discover, Chat, Profile).

## Changes

- `MainTabsScreen.kt`: renders one shared `YugmBackground(Ambient)` as first child of root `Box`, behind `HorizontalPager` and dock overlay. Provides `LocalMainDockBottomClearance` to tab pages.
- `YugmBackground.kt`: Ambient uses `LocalYugmColors.current.background` + restrained brand radial glows (violet upper-right, pink lower-left, subtle orange). Added `YugmBackgroundStyle.None` for shared-background hosts.
- Tab screens: removed per-tab `YugmBackground` wrappers from `DiscoverScreen`, `VoiceRoomsScreen`, `GamesScreen`, `ChatListScreen`. `ChatListScreen` PrimaryTabRow container made transparent. `ProfileDetailScreen` accepts `backgroundStyle` (MainTabs passes `None`), Scaffold container transparent.
- Dock clearance: `mainDockBottomClearance()` / `LocalMainDockBottomClearance` in `YugmBottomDock.kt`; tabs use it for scrollable content padding. Dock touch targets limited to bar area; active indicator clickable for reselect.
- Notch geometry: `CurvedDockShape` now a circular cradle derived from active indicator (50dp, 2dp border, 3.5dp clearance, 28.5dp radius, 22dp shoulders, 38° junction, symmetric edge scaling). `BottomDockGeometry`/tests updated.

## Verification

- Compile: `:core:ui:compileDebugKotlin :core:ui:compileDebugUnitTestKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin :app:compileDebugKotlin` — BUILD SUCCESSFUL.
- Unit test: `:core:ui:testDebugUnitTest --tests BottomDockGeometryTest` — BUILD SUCCESSFUL.
- Environment: Android Studio JBR, `--console=plain --max-workers=2`.
- Build-state note: a transient `Unresolved reference 'ClanChatScreen'` in `ChatListScreen.kt` came from an incomplete `feature:social` ASM transform/classes jar, not source. Recovered with `:feature:social:clean` + fresh `:feature:social:bundleLibCompileToJarDebug --no-build-cache`, then `:app:compileDebugKotlin --no-build-cache` BUILD SUCCESSFUL. No source changes were needed.

## Not verified / risks

- No device/emulator visual QA: seamless pager swipe (no vertical seam), stationary background, notch transparency over content, light/dark/system theme, 3-button/gesture nav insets, font scaling, keyboard/IME, TalkBack, rapid tab switching, edge-tab notch shape.
- `:app:lintDebug` and broader tests not run.
- Task changes are committed and pushed; local build-log `.txt` files were intentionally left untracked.
- Active indicator was set to spec 50dp (reverting earlier 55dp/10% scale-up) per notch-geometry request; confirm desired size.

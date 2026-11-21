# Handoff: Bottom navigation insets fix, geometry hardening, and architecture docs

- Date: 2026-11-21
- Task: YUGM-NAV-AUDIT-011 (continuation) — fix elevated dock above system gesture handle, harden curved dock/behavior, add regression tests, and deliver navigation architecture documentation.
- Related: [2026-11-21 navigation audit](2026-11-21-navigation-audit.md), [navigation audit](../features/navigation-audit.md), [NAVIGATION_ARCHITECTURE.md](../NAVIGATION_ARCHITECTURE.md), [NAVIGATION_MAP.md](../NAVIGATION_MAP.md).

## Problems and root causes

1. **Dock elevated above the system gesture handle (reported issue).** Root cause: `NavGraph` applied `Modifier.windowInsetsPadding(WindowInsets.safeDrawing)` to the whole root container, which consumed bottom insets. Inside `MainTabsScreen`, `YugmBottomDock` read `WindowInsets.navigationBars` as 0, so the in-flow dock height excluded the nav inset and the surface stopped above the system navigation area (transparent system bar revealed window background).  
   **Fix:** destination-derived root insets in `NavGraph.kt` — when `MainTabsRoutes.isMainTabs(currentRoute)` the root applies only `safeDrawing.only(Top + Horizontal)`; all other destinations keep full `safeDrawing`. The dock paints its surface through the nav inset and pads interactive content above it. When the main host hides the dock (Chat clan subtab), `MainTabsScreen` applies `navigationBarsPadding()` to the pager.
2. **Outer-tab notch/shoulder fragility.** First/last tabs could fold the concave path over corner arcs. **Fix:** `BottomDockGeometry` (pure, testable) + clamped shoulders and animated center in `CurvedDockShape`/`YugmBottomDock`.
3. **Visibility/mapping/testability gaps.** **Fix:** `MainTabsRoutes.isDockVisible(...)`, `TopLevelNavigationTargets` (pure route mapping, no prefix matching), `tabScrollTarget`, and regression tests across `core:navigation`, `core:ui`, and `app`.
4. **Pressed feedback consistency.** Tab items already used `selectable(indication = null)`; added subtle shape/content-aware press alpha and semantic ring color (no rectangular ripple/overlay).

## Files changed / added (this continuation, uncommitted)

- Modified: `app/navigation/NavGraph.kt`, `app/ui/screens/MainTabsScreen.kt`, `core/navigation/TopLevelNavigation.kt`, `core/ui/components/ReferenceComponents.kt`, `core/ui/build.gradle.kts`, `docs/NAVIGATION_MAP.md`, `docs/features/navigation-audit.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/INDEX.md`, `AGENTS.md` (plus earlier-audit modified files still in tree: `core/navigation/build.gradle.kts`, `feature/profile/ProfileDetailScreen.kt`, `feature/social/DatingDiscoveryScreen.kt`, `feature/social/MatchesScreen.kt`).
- Added: `core/navigation/MainTabsRoutes.kt`, `core/navigation/TopLevelNavigationTargets.kt`, `core/ui/components/BottomDockGeometry.kt`, `core/navigation/src/test/.../{MainTabsRoutesTest,TopLevelNavigationTargetsTest}.kt`, `core/ui/src/test/.../BottomDockGeometryTest.kt`, `app/src/test/.../MainTabsNavigationTest.kt`, `docs/NAVIGATION_ARCHITECTURE.md`, `docs/features/navigation-audit.md`, `docs/handoffs/2026-11-21-bottom-nav-insets-and-polish.md` (and prior `2026-11-21-navigation-audit.md`).

## Verification run

- Compile/tests (`android-client`, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`):  
  `.\gradlew.bat :core:navigation:testDebugUnitTest :core:ui:testDebugUnitTest :app:testDebugUnitTest :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin` → **BUILD SUCCESSFUL** (394 tasks, 8 executed). Unit results: 23 tests, 0 failures (`MainTabsRoutesTest` 8, `TopLevelNavigationTargetsTest` 4, `BottomDockGeometryTest` 6, `MainTabsNavigationTest` 4, `ExampleUnitTest` 1).
- Install: `:app:installDebug` → **BUILD SUCCESSFUL** on `emulator-5554`.
- Emulator runtime (gesture nav, 1080x2400, nav inset ~53px): app launch, root-tab taps (Arcade/Profile/Discover), Notifications opened (secondary, dock hidden) and back (dock restored), Chat clan subtab (dock hidden), dark mode capture. UIAutomator dump confirmed content-descs: `Yugm Arcade`, `Party`, `Discover`, `Chat`, `Profile`. Screenshots captured to local temp (`after_discover2.png`, `v_arcade.png`, `v_profile.png`, `profile_top.png`, plus earlier-session captures such as `tab_*`, `notifications.png`, `back_discover.png`, `dark_discover.png`, `chat_tab.png`, `chat_clan.png`), but **the agent environment could not render/visually inspect PNGs** — human visual/Layout Inspector confirmation is required.
- `git diff --check` → exit 0 (LF/CRLF warnings only). Lint not run. Backend untouched.

## Not verified / open gates

- Human visual sign-off: dock surface flush to physical bottom edge (no gap/strip), correct notch/shoulders at first and last tabs, no rectangular press overlay, contrast in light/dark/system, no clipping/overlap.
- 3-button navigation, keyboard/IME behavior, font scaling, TalkBack traversal/selected semantics in practice, predictive-back gesture, rapid/repeated tap stress on device.
- Deep links (none registered, F6), push-intent routing dedup/`launchSingleTop` and notification-mapper unification (F9), process-death restoration of selected tab on a real recreation flow, full secondary-flow regression pass.
- Lint (resource-intensive). Dead-route cleanup (F8): `Screen.OtpVerify`, `Screen.UserWishlist`, `Screen.Matches`.

## Next steps

1. On a device/emulator with Layout Inspector or screenshots, confirm the dock reaches the physical bottom edge and the gesture area is surface-colored (no gap) in gesture and 3-button modes, light/dark, and at first/last tabs.
2. Run TalkBack + font-scale + keyboard checks; confirm touch targets and badge announcements.
3. Unify `MainActivity.routeFromPushIntent` with `NotificationTarget` mapping and add `launchSingleTop`/dedup parity (F9); add deep links for `main_tabs?tab=…` (F6) if required.
4. Consider `MainTabViewModel` for explicit pager-state ownership (optional) and delete dead routes after reference verification (F8). Do not commit/push/deploy without explicit authorization.

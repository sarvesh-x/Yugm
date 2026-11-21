# Navigation map

## Android navigation sources

- App graph: `android-client/app/src/main/java/com/yugm/app/navigation/NavGraph.kt` (the single `NavHost`).
- Centralized navigation state: `android-client/core/navigation/src/main/java/com/yugm/app/core/navigation/` (`Screen.kt`, `TopLevelNavigation.kt`, `MainTabsRoutes.kt`, `TopLevelNavigationTargets.kt`, `NotificationTarget.kt`).
- Feature graphs: each module's `feature/<name>/.../navigation/` package.
- Main tab host: `android-client/app/src/main/java/com/yugm/app/ui/screens/MainTabsScreen.kt` (pager-backed host for `Screen.MainTabs`).
- Shared bottom navigation UI: `android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/ReferenceComponents.kt` (`YugmBottomDock`, `YugmBottomDockDefaults`, `YugmDockTab`, `CurvedDockShape`) and `BottomDockGeometry.kt`.
- App entry/session wiring: `android-client/app/src/main/java/com/yugm/app/MainActivity.kt`.

Durable contract and rules: [NAVIGATION_ARCHITECTURE.md](NAVIGATION_ARCHITECTURE.md). Full audit evidence: [features/navigation-audit.md](features/navigation-audit.md).

## Centralized navigation system (single source of truth)

- One `NavHost` (root `NavGraph`); no nested `navigation<>` graphs; every screen is a flat composable.
- `MainTabsRoutes` (`core/navigation`) — the **explicit destination whitelist**: `ALL` = {`game_zone`, `party`, `discover`, `chat`, `profile`}, plus `isMainTabs(route)` and `normalizeTab()`. The dock visibility rule is derived from the actual current destination: `MainTabsScreen.showDock = MainTabsRoutes.isMainTabs(currentBackStackEntry?.destination?.route) && !(currentPage == CHAT && isClanChatActive)`.
- `MainTabsScreen` — the **single dock owner**. Tab switching uses `navigateTopLevel` (idempotent: `alreadySelected` early-return, `launchSingleTop` on navigates). Selected tab = pager (`pageToDockTab(pagerState.currentPage)`); pager page is persisted to the MainTabs entry (`main_tab_page`) for process-death restoration.
- Legacy top-level stub routes `discover`/`chat_list`/`voice_rooms`/`games` remain for compatibility and redirect to `main_tabs?tab=…` with `popUpTo`+`launchSingleTop`.
- Screens never decide global dock visibility: standalone screens default `showBottomDock = false` (`ProfileDetailScreen`, `DatingDiscoveryScreen`), `MatchesScreen`'s dock is removed (dead route).

## Main tabs (current implementation)

- **Destinations:** Arcade (`game_zone`), Party (`party`), Discover (`discover`), Chat (`chat`), Profile (`profile`) hosted in `MainTabsScreen` via `HorizontalPager`.
- **Route/selection:** `Screen.MainTabs.createRoute(tab)` carries the initial tab arg; `TopLevelNavigation.navigateTopLevel` maps legacy top-level routes to `MainTabs` tab routes and uses `savedStateHandle["tab_request"]` to switch tabs when `MainTabs` is already on the back stack (explicit destination check: already MainTabs → set request; else pop to MainTabs entry if present; else `navigate(launchSingleTop)`).
- **Visibility:** dock visible on the five main roots only; hidden on chat clan subtab (`isClanChatActive`), and structurally so on every secondary/detail/immersive/auth route.
- **Unread badge:** chat tab badge sourced in `MainTabsScreen` from `ChatListViewModel` unread counts excluding muted partners, surfaced via dock semantics.
- **Bonds:** `Screen.Bonds` (`bonds?partner={partner}&center={center}`) is a secondary Profile destination in `profileNavGraph`; it hides the dock and back returns to the main-tabs Profile page. `partner` opens an existing bond or pending request (or the existing invite flow for an explicit invite target), and `center=true` opens Relationship Center (notification taps). Opening Bonds from the profile — including Add bond/empty slots — lands on Bonds home; no invite sheet is opened automatically. The former `Screen.CloseFriends` / `close_friends` route was removed.

## Visibility matrix

See the full audit: [navigation audit](features/navigation-audit.md) — route inventory (§1), user-specified visibility matrix (§2.1), findings (§3), behavior table (§4).

Summary: bottom bar visible = five main roots (Arcade, Party, Discover, Chat, My Profile). Hidden = all secondary/detail/editing/immersive screens, splash/onboarding/login/phone/profile-setup, chat clan subtab, and standalone dating discovery / dead-route screens.

## Behavior and inset notes

- Idempotency: `navigateTopLevel` never stacks duplicate MainTabs entries; dock taps are no-ops when the target page is active (`tabScrollTarget`).
- State restoration: selected tab persists to the MainTabs back-stack entry (`main_tab_page`) and is restored on recreation; tab content lists preserve their `LazyListState` via `rememberLazyListState()`.
- Back: secondary screens pop to MainTabs; return restores the originating tab (pager) and the dock.
- **Inset ownership (elevated-bar fix):** while `MainTabs` is current, `NavGraph` applies only top/horizontal safe-drawing insets so the dock can paint its surface to the physical bottom edge (including the system navigation inset) and pad interactive content above it. All other destinations keep full `safeDrawing` insets. When the main host hides the dock (Chat clan subtab), the pager applies `navigationBarsPadding()`.
- Push intents (`MainActivity.routeFromPushIntent`): direct secondary routes only (no `main_tabs`); dedup caveat documented in the audit (§3, F9).

This is a source map. When changing navigation, trace route definitions, graph registration, callers, deep links/push intents, auth/profile gates, back behavior, dock visibility, and lifecycle-owned subscriptions. Runtime/device verification is required for behavior claims. Regression tests: `core:navigation` (`MainTabsRoutesTest`, `TopLevelNavigationTargetsTest`), `core:ui` (`BottomDockGeometryTest`), and `app` (`MainTabsNavigationTest`).

# Navigation map

## Android navigation sources

- App graph: `android-client/app/src/main/java/com/yugm/app/navigation/NavGraph.kt`.
- Shared route definitions/helpers: `android-client/core/navigation/src/main/java/com/yugm/app/core/navigation/` (`Screen.kt`, `TopLevelNavigation.kt`, `NotificationTarget.kt`).
- Feature graphs: each module's `feature/<name>/.../navigation/` package.
- Main tab host: `android-client/app/src/main/java/com/yugm/app/ui/screens/MainTabsScreen.kt` (pager-backed host for `Screen.MainTabs`).
- Shared bottom navigation UI: `android-client/core/ui/src/main/java/com/yugm/app/core/ui/components/ReferenceComponents.kt` (`YugmBottomDock`, `YugmBottomDockDefaults`, `YugmDockTab`).
- App entry/session wiring: `android-client/app/src/main/java/com/yugm/app/MainActivity.kt`.

## Main tabs (current implementation)

- **Destinations:** Yugm Arcade (`game_zone`), Party (`party`), Discover (`discover`), Chat (`chat`), Profile (`profile`) hosted in `MainTabsScreen` via `HorizontalPager`.
- **Route/selection:** `Screen.MainTabs.createRoute(tab)` carries the initial tab arg; `TopLevelNavigation.navigateTopLevel` maps legacy top-level routes (`Discover/VoiceRooms/ChatList/Games`) to `MainTabs` tab routes and uses `savedStateHandle["tab_request"]` to switch tabs when `MainTabs` is already on the back stack. `MainTabsScreen` normalizes nav-provided `initialTab`/`requestedTab` and keeps pager selection synchronized; active-tab reselect is handled in-host (scroll-to-top/reselect signals for tab content).
- **Visibility/behavior (source):** dock is rendered by `MainTabsScreen` and hidden for the chat clan subtab state (`isClanChatActive`). Pushed destinations (chat detail, rooms/calls, auth/onboarding/profile setup, etc.) are separate NavHost routes and do not use the main-tabs dock host unless a screen explicitly embeds `YugmBottomDock`. Legacy redirect composables for `Screen.Discover/ChatList/VoiceRooms/Games` remain for compatibility.
- **Unread badge:** chat tab badge is sourced in `MainTabsScreen` from `ChatListViewModel` unread counts excluding muted partners and surfaced through dock semantics.

This is a source map, not a fully verified destination/behavior graph. When changing navigation, trace route definitions, graph registration, callers, deep links/push intents, auth/profile gates, back behavior, dock visibility, and lifecycle-owned subscriptions. Runtime/device verification is required for behavior claims. Update this document with a diagram only after a route inventory is reviewed end to end.

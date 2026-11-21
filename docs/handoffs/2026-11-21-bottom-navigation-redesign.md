# Handoff: Bottom navigation audit and redesign (2026-11-21)

**Date:** 2026-11-21  
**Task:** YUGM-NAV-BOTTOMDOCK-010 (bottom navigation bar audit + compact floating capsule redesign)  
**Branch/commit base:** `master` at `5ee1fe6` before this work (working tree modified/uncommitted at handoff time). Preserve unrelated user/worktree changes if any appear.

## Audit summary (existing implementation)

- **Main host:** `app/ui/screens/MainTabsScreen.kt` used a `HorizontalPager` (5 pages: Game Zone/Party/Discover/Chat/Profile) with `pagerState.currentPage` as effective selection, `initialTab` applied once, `requestedTab` handled via `savedStateHandle["tab_request"]`, and a single `YugmBottomDock` overlay (hidden when chat clan subtab active). `ChatListViewModel` provided unread badge data (muted excluded, capped to 9 in host).
- **Shared component:** `core/ui/components/ReferenceComponents.kt` `YugmBottomDock` rendered a 72dp inner bar in a 96/112dp container with labels always visible, no expanding active indicator, mixed theme tokens/hardcoded colors, `compactSet`/`WALLET`/`onCreate`/`onWallet` API branches, and inconsistent badge cap/description vs host.
- **Callers/duplication:** tab screens (`DiscoverScreen`, `VoiceRoomsScreen`, `ChatListScreen`, `ProfileDetailScreen`) embedded optional docks (`showBottomDock`) with fixed 120dp paddings; `DatingDiscoveryScreen` and `MatchesScreen` also rendered docks as standalone navigation affordances. Legacy route redirects for `Screen.Discover/VoiceRooms/ChatList/Games` and `TopLevelNavigation.navigateTopLevel` mapped to `MainTabs` tab routes and `tab_request` switching.
- **Issues addressed in source:** non-capsule/heavy dock styling, always-visible inactive labels, no active indicator/reselect handling, inconsistent badge semantics, ad-hoc reserved padding, and API coupling to wallet/compact variants for main navigation.

## Implemented (source)

- **Centralized dock (`core/ui/components/ReferenceComponents.kt`):** redesigned `YugmBottomDock` as a 60dp floating adaptive capsule (5 fixed destinations: Yugm Arcade, Party, Discover, Chat, Profile) with icon-only inactive items and active icon + compact label inside an expanding animated indicator/pill. Uses `LocalYugmColors`/theme-aware container, border, indicator, content, badge, and minimal elevation; respects `LocalMotionEnabled`; `selectableGroup` + `Role.Tab` semantics, merged content descriptions (chat unread count), selected-state semantics, and >=48dp touch areas. Added `YugmBottomDockDefaults` (`ReservedContentPaddingAboveNavBar`) for consistent content clearance. Removed `WALLET`/`compactSet` main-dock branches and switched to `onTabSelected`/`onTabReselected` + `chatUnreadCount` API.
- **Main tabs host (`app/ui/screens/MainTabsScreen.kt`):** centralized tab normalization/mapping helpers, derived selection from pager state synchronized with nav-provided `initialTab`/`requestedTab` (`tab_request`) flow, added active-tab reselect handling (scroll-to-top signals/states for Discover/Party; reselect signals for Games/Chat/Profile), consistent unread badge count sourcing, preserved clan-chat dock hiding and tab/page state behavior, and placed the dock in layout flow (`Column` with pager/content above and dock below) so tab content does not render behind it.
- **Tab/content screens:** updated `DiscoverScreen`, `VoiceRoomsScreen`, `ChatListScreen`, `GamesScreen`, and `ProfileDetailScreen` for new dock API, reselect/list-state hooks where applicable, and structural no-overlap layout: when `showBottomDock` is true these screens place content above the dock in a column (instead of overlaying), and content padding was simplified for the structural dock.
- **Standalone dock consumers/navigation:** updated `DatingDiscoveryScreen` (Column: weighted content above dock) and `MatchesScreen` (Scaffold `bottomBar`) to render dock structurally above content, and updated `feature/social/navigation/SocialNavGraph` to new dock API/callbacks (including Arcade navigation) while preserving existing navigation targets/behavior as much as possible.
- **Overlap fix follow-up:** adjusted `GamesScreen` spacing for main-tabs layout and fixed compile/structure issues introduced during the no-overlap refactor (`DiscoverScreen` brace/structure, `DatingDiscoveryScreen` column/brace structure).
- **Docs:** updated `docs/COMPONENT_REGISTRY.md` and `docs/NAVIGATION_MAP.md`.

## Verification run

- **Android compile (bounded, `android-client`, `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`):**
  - `.\gradlew.bat :core:ui:compileDebugKotlin :core:navigation:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin :app:compileDebugKotlin` — **BUILD SUCCESSFUL** (initial redesign).
  - Follow-up overlap-fix compile: `.\gradlew.bat :core:ui:compileDebugKotlin :app:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin` — **BUILD SUCCESSFUL**.
  - Existing warnings observed in unrelated/profile code (e.g. deprecated clipboard/arrow APIs) and Gradle deprecations; no new compile errors from this change set.

## Not run / remaining verification (required before closing)

- **Device/emulator runtime verification:** all 5 destinations and nested routes, swipe/tap tab switching, active-tab reselect behavior (scroll-to-top/refresh), scroll/state preservation, duplicate back-stack prevention, back navigation, deep links/notifications/push routing, dock visibility/hidden contexts (conversations, calls/voice/video, onboarding/splash/auth/profile setup, immersive screens, clan-chat subtab), unread badge correctness/clearing and TalkBack announcement.
- **Visual/a11y/responsiveness:** Light/Dark/System themes and contrast, non-color selection cues, TalkBack labels/roles/selected state/focus order, 48dp touch targets in practice, font scaling, small screens, keyboard/IME and system navigation/cutout insets, no content overlap, reduced-motion behavior, animation smoothness/performance.
- **Broader checks:** targeted tests/lint as appropriate, regression across room/chat/profile/discover flows and minimized-room bubble interactions.

## Notes

- No commits/pushes/deploys performed. Legacy tab-route redirect composables and existing `navigateTopLevel`/`tab_request` flow were preserved for compatibility; no obsolete implementations removed beyond replaced in-file dock branches.
- Task remains **in progress** pending runtime/device/a11y verification and any follow-up fixes.
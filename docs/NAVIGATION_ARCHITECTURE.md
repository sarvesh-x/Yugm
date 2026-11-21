# Navigation architecture (Android)

This document defines the production navigation contract for the Yugm Android app. It is the
source-of-truth guide for adding destinations, preserving bottom-navigation behavior, and
avoiding the regressions that previously caused inconsistent dock visibility, duplicate stacks,
and incorrect system-inset handling.

Source of truth for implementation: `android-client/` code. This document must stay consistent
with the code it references.

## Ownership

- **Single root graph:** `app/navigation/NavGraph.kt` owns the only `NavHost` and the only
  `NavController` (`rememberNavController()` in `MainActivity`). There are no nested
  `navigation<>` graphs; all screens are flat `composable()` destinations.
- **Single bottom-dock owner:** `app/ui/screens/MainTabsScreen.kt` renders `YugmBottomDock`
  (`core/ui/components/ReferenceComponents.kt`). Feature/detail screens must not create a global
  dock or independently control global dock visibility.
- **Single whitelist:** `core/navigation/MainTabsRoutes.kt` defines the eligible root
  destinations (`MainTabsRoutes.ALL`), `isMainTabs(route)`, `normalizeTab(...)`, and the dock
  visibility contract (`isDockVisible(...)`).
- **Single top-level mapping:** `core/navigation/TopLevelNavigationTargets.kt` maps legacy
  top-level routes to the main-tabs host; `core/navigation/TopLevelNavigation.kt` applies that
  mapping idempotently on the real `NavController`.

## Destination inventory and categories

| Category | Examples | Dock | Notes |
|---|---|---|---|
| A. Authentication / onboarding | `splash`, `onboarding`, `login`, `phone_login`, `profile_setup` | Hidden | Auth graph; never inside the main-tabs host. |
| B. Main application roots (whitelist) | `main_tabs?tab=game_zone|party|discover|chat|profile` | **Visible** | Exactly these five. Arcade = `game_zone`, Party = `party`, Discover = `discover`, Chat/Messages = `chat`, My Profile = `profile`. |
| C. Secondary / detail | profile detail/edit, chat detail, settings, wallet, inventory, gift, notifications, search, dating discovery, matches (dead), etc. | Hidden | Separate root-graph routes; must never render the global dock. |
| D. Immersive / active experiences | room lobby, voice/video rooms, room modes, watch-party/game-session surfaces reached as separate routes | Hidden | Separate routes; the dock never overlays active experiences. |

Complete route inventory and the user-specified visibility matrix: [navigation audit](features/navigation-audit.md).

Dead routes (no composable/callers as audited): `Screen.OtpVerify`, `Screen.UserWishlist`,
`Screen.Matches` — do not reintroduce; remove only as a dedicated cleanup with full reference checks.

## Bottom-navigation eligibility rules (strict)

1. The dock is visible **only** when the current back-stack destination is the main-tabs host
   route `Screen.MainTabs.route` **and** the Chat tab's clan-chat subtab is not active
   (`MainTabsRoutes.isDockVisible(currentRoute, chatTabActive, clanChatActive)`).
2. Eligibility is decided by the **actual current destination** (and the live in-host tab state),
   never by per-screen booleans, remembered flags, route-prefix matching, or broad parent-graph
   matching.
3. Secondary/detail/editing/immersive/auth destinations are not main roots, so they hide the dock
   by default.
4. **Default for new destinations: hidden.** A new screen is dock-ineligible unless it is
   explicitly added to `MainTabsRoutes` (whitelist), `MainTabDestination`, the pager host,
   `normalizeMainTab`/`pageToDockTab`/`dockTabToPage`, the dock item model, and the route/mapping
   tests — i.e. it becomes one of the five roots by deliberate change, not by accident.
5. Returning from any secondary screen restores the correct dock visibility and the originating
   selected tab because the dock state lives in the main-tabs host and the pager page is persisted
   on the `MainTabs` back-stack entry.

## Route naming and tab conventions

- Main-tabs host: `main_tabs?tab={id}` via `Screen.MainTabs.createRoute(tab)`.
- Canonical tab ids (stable): `game_zone`, `party`, `discover`, `chat`, `profile`.
- Legacy compatibility aliases normalized by `MainTabsRoutes.normalizeTab(...)`: `live`/`voice`
  → `party`, `arcade`/`yugm_arcade` → `game_zone`, `messages` → `chat`, `account`/`me` → `profile`.
- Unknown/blank tab input normalizes to `discover` (a whitelisted root) and never to an off-root
  destination.
- Legacy top-level stub routes (`discover`, `chat_list`, `voice_rooms`, `games`) redirect to the
  main-tabs host with `popUpTo` + `launchSingleTop`; they are not dock-eligible routes.

## Back-stack and navigation behavior

- **Tab selection:** `MainTabsScreen` owns the live selection via a `HorizontalPager`. External
  requests arrive on the `MainTabs` back-stack entry as `savedStateHandle["tab_request"]` and are
  applied by the host (idempotently). The route `tab` argument is the *initial* tab only and is
  applied once per destination instance so returning from pushed screens preserves the last tab.
- **Idempotency:** repeated selection of the active tab is a no-op for navigation/scrolling
  (`tabScrollTarget`); `navigateTopLevel` does not stack duplicate `main_tabs` entries and does
  not re-navigate to an already-current secondary destination.
- **Top-level switching:** when already on `MainTabs`, a root request sets `tab_request` on the
  existing entry. When `MainTabs` exists elsewhere in the stack, it is revealed with
  `popBackStack(MainTabs, inclusive = false)` rather than duplicated. Secondary destinations are
  revealed via `popBackStack(route, false)` when present, otherwise navigated with `launchSingleTop`.
- **Reselection:** selecting the active tab is handled by the host (e.g. scroll-to-top/reselect
  signals for Discover/Party and per-tab reselect signals) without recreating destinations or
  reloading data unnecessarily.
- **Back / predictive back:** secondary screens are normal root-graph destinations pushed above
  `MainTabs`; back pops to `MainTabs`, restoring the originating tab and dock. System/predictive
  back follows standard Compose Navigation behavior on this single graph.
- **Deep links:** not currently registered (see audit F6). When added, register them against the
  canonical routes and ensure they resolve to `main_tabs?tab=…` for root targets and to the
  exact secondary route otherwise, with `launchSingleTop`/`popUpTo` matching this contract.
- **Push/notification intents:** `MainActivity.routeFromPushIntent(...)` targets secondary routes
  directly (dock hidden). `NotificationTarget.kt` exists but is not yet the unified runtime
  mapper; unification/`launchSingleTop` parity is a documented follow-up.
- **Configuration/process recreation:** the settled pager page is persisted as `main_tab_page` on
  the `MainTabs` back-stack entry's `SavedStateHandle` and restored as the pager's initial page,
  so the selected tab and dock visibility survive recreation.

## State and system-inset ownership

- **Navigation state:** authoritative in the root `NavController` back stack; the live tab
  selection is authoritative in `MainTabsScreen`'s pager/saved state.
- **Root insets (`NavGraph.kt`):** the app is edge-to-edge. The root container consumes system
  insets exactly once, but *which* insets depend on the current destination:
  - `MainTabs` current → `WindowInsets.safeDrawing.only(Top + Horizontal)` so the bottom inset is
    **not** consumed globally; the dock surface paints to the physical bottom edge and the dock
    pads its own interactive content above `WindowInsets.navigationBars`.
  - Any other destination → full `WindowInsets.safeDrawing`, preserving existing screen behavior.
- **Dock insets (`YugmBottomDock`):** box height = `topPadding + barHeight + navigationBars bottom
  inset`; the curved surface spans the full box (including the inset) so the system-gesture area
  is filled by the dock surface color, while content rows sit above the inset. The area around the
  notch remains transparent so screen content shows through the cradle.
- **Hidden-dock case:** when the main host hides the dock (clan subtab), the pager takes the full
  height and applies `navigationBarsPadding()` so tab content stays above the system navigation bar.
- **No duplicate inset consumption:** do not add `navigationBarsPadding`/extra bottom padding to
  the main-tabs container while the dock is shown; do not add external bottom margins or background
  strips below the dock.

## Dock visual and animation conventions

- **Geometry:** full-width edge-to-edge surface with a genuine sculpted concave notch around the
  elevated active circle; only the active circle is elevated. Pure math in
  `core/ui/.../BottomDockGeometry.kt` (tab/notch centers, clamped shoulders, circle placement)
  keeps first/last-tab edges correct and unit-testable. Content bar height 50dp, top cradle padding
  20dp, active circle 50dp, notch cradle 78dp × 30dp, inactive/active icons 28dp/30dp, selected
  label 11sp (active destination only), minimum 48dp touch targets. Outer top-left/right corners are
  square (no rounded corners) for a continuous full-width surface. The circle's center sits on the
  surface top boundary so the lower half is embedded in the cradle rather than floating above it.
  Active indicator uses the signature brand gradient (purple→pink). Icon-to-label gap is 2dp.
- **Icon system:** rounded custom vector family in `core/ui/.../BottomDockIcons.kt` (game controller,
  studio mic, compass, chat bubble, user silhouette) with outlined inactive and filled active
  variants on a shared 24-unit grid, consistent stroke weight and rounded caps/joins. Theme tinting
  via Yugm tokens.
- **Layout/labels:** icon-first, minimal bar — inactive icons share a fixed baseline and rise/fade
  into the active circle (no layout shift); inactive labels are hidden and only the selected label
  fades/slides in within a reserved slot (stable surface height, no clipping; supports font scaling).
- **Theme tokens:** colors come from `YugmColors`/`LocalYugmColors.current` (surface, primary,
  primaryOn, secondary, textSecondary). No hardcoded independent theme; light/dark/system supported.
- **Animation:** notch horizontal position and active indicator/circle are driven by the same
  animated fractional index (`animateFloatAsState`; controlled spring ~300ms, snap when reduced
  motion via `LocalMotionEnabled`). Inactive→active icon fade/scale/lift, selected label fade/slide,
  and color changes derive from the same factor; animations are interruptible and synchronized and do
  not delay navigation.
- **Interaction:** tab selection uses `Modifier.selectable(..., indication = null)` with `Role.Tab`
  semantics; touch feedback is subtle and circular (no rectangular ripple/grey overlay or selection
  background). Chat unread badge is retained; a light haptic tick is performed on tab interaction.
  Repeated selection of the active tab is a reselect/no-op per host behavior. Active circle uses the
  signature brand gradient (purple→pink) via `Brush.linearGradient`.

### Component architecture (YugmBottomDock.kt)

The dock is now a single, self-contained composable in `YugmBottomDock.kt` with clearly separated
layers:

1. **DockBackground** — Canvas drawing the curved surface path (no Shape clipping, notch is transparent)
2. **ActiveIndicator** — elevated circle with gradient + icon (center on surface top boundary)
3. **TabRow** — icons, labels, badges per tab (inactive icons vertically centered in bar area)
4. **TouchTargets** — selectable modifiers on each tab Box (min 48dp touch target)
5. **InsetHandling** — bottomInset included in totalDockHeight for physical bottom edge

### Single coordinate system

All dimensions are defined once at the top of `YugmBottomDock`:
- `topPadding` (20dp): space above bar for elevated circle
- `barHeight` (50dp): bar content height (icons + labels)
- `activeCircleSize` (50dp): elevated active indicator
- `activeIconSize` (30dp): icon inside active circle
- `inactiveIconSize` (28dp): inactive tab icons
- `notchWidth` (78dp): horizontal span of concave cradle
- `notchDepth` (30dp): depth of concave cradle
- `labelSlotHeight` (14dp): reserved label space
- `iconLabelGap` (4dp): gap between icon and label

Regions:
- `[0, topPadding)`: cradle zone — active circle center at y=topPadding
- `[topPadding, topPadding+barHeight)`: bar content area (icons + labels)
- `[topPadding+barHeight, totalDockHeight)`: system nav inset (filled by surface color)

### Compose Previews

Previews are included for all 5 selected states in both light and dark themes:
- `PreviewDockLightDiscover`, `PreviewDockDarkChat`, `PreviewDockLightArcade`,
  `PreviewDockDarkParty`, `PreviewDockLightProfile`

### Notch geometry improvement suggestions (when active icon looks floating)

When the active icon appears to float rather than embed in the cradle, consider:

1. **Increase notch depth** (30dp → 34-36dp) so the cradle wraps more of the circle's lower half.
2. **Reduce circle elevation** (shadow 1.5dp/3dp → 1dp/2dp) to decrease floating perception.
3. **Adjust circle vertical offset** — center should sit on surface top boundary (`circleY = topPadding - circleSize/2`).
4. **Widen the notch** (78dp → 82-84dp) for more clearance around the 50dp circle.
5. **Add subtle inner shadow** on the concave curve for depth/recessed feel.
6. **Animate notch depth** during transitions (2-4dp extra) for a "breathing" cradle effect.
7. **Align circle bottom with cradle deepest point** for a "sitting in pocket" look.

## Accessibility

- Each destination is a tabbable item in a `selectableGroup` with `Role.Tab` and selected state.
- TalkBack labels use the destination label; the Chat tab includes unread-badge description when
  `chatUnreadCount > 0`.
- Interactive targets are at least 48dp; content remains readable under font scaling. Contrast for
  active/inactive icons, labels, badges, and the navigation surface must meet the design system.
- Motion honors reduced-motion preferences (`LocalMotionEnabled`).

## How to add a destination

### Adding a secondary/detail/immersive screen (default)

1. Add the route to `core/navigation/Screen.kt` and register a `composable(...)` in the
   appropriate feature/root graph.
2. Navigate to it with standard `NavController` calls (or `navigateTopLevel` only if it is a true
   top-level non-tab destination). Do **not** add a dock, do **not** add visibility flags, and do
   **not** touch `MainTabsRoutes`.
3. Rely on the whitelist: because the route is not `main_tabs`, the dock stays hidden and returns
   restore the originating tab automatically.
4. Add/update tests or audit entries if the screen is part of a documented flow.

### Promoting or adding a main root tab (rare, deliberate)

1. Update `MainTabsRoutes` (`ALL`, enum, `normalizeTab`, `isDockVisible` if needed) and add the
   route contract.
2. Update `TopLevelNavigationTargets`/`navigateTopLevel` if legacy mapping is required.
3. Add the pager page and mapping helpers in `MainTabsScreen` (`TAB_*`, `normalizeMainTab`,
   `pageToDockTab`, `dockTabToPage`, `TAB_PAGE_COUNT`) and the dock item in `YugmBottomDock`.
4. Keep geometry/tests in sync (`BottomDockGeometryTest`, `MainTabsRoutesTest`,
   `TopLevelNavigationTargetsTest`, app `MainTabsNavigationTest`).
5. Re-verify first/last notch positions, idempotent selection, reselection, state restoration,
   insets to the physical bottom edge, and all secondary flows that must still hide the dock.

## Verification expectations

- Run relevant module compiles and unit tests for changed navigation/UI modules.
- For visual/inset/animation changes, verify on device or emulator (gesture and 3-button
  navigation, light/dark, keyboard where relevant) and capture screenshots; do not claim runtime
  success from build results alone.
- Update `docs/NAVIGATION_MAP.md`, [navigation audit](features/navigation-audit.md),
  `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, and a dated handoff when work remains.

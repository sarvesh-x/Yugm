# Navigation architecture and UI/UX audit (Android)

Audit date: 2026-11-21. Scope: the entire Yugm Android app — `android-client/` — covering
navigation architecture, bottom navigation, navigation behavior, and layout/UI/UX.

Method: end-to-end static trace of `NavHost`s, `NavController`s, nested graphs, route
definitions, navigation actions, deep links, push-intent routes, notification routing,
dock render sites, and lifecycle-owned navigation state. Source is authoritative for behavior;
runtime claims (below) are marked unverified.

The November 24 follow-up reproduced a dropped explicit tab request and verified the repair, back-stack recreation and pending push behavior on an emulator. The entries below retain the dated audit. [Follow-up](../handoffs/2026-11-24-navigation-recreation.md)

## 1. Route inventory (complete)

Exactly one `NavHost` exists: the root graph in `app/navigation/NavGraph.kt` (the only
`rememberNavController()` in the app). There are no nested `navigation<>` graphs; every screen
is a flat `composable()` destination on that graph. All screen registrations below were found
by grepping every `NavGraphBuilder.composable(Screen.*)` in `android-client/`.

### 1.1 Authentication (no bottom dock — never visible here)

| Route | Screen | Notes |
|---|---|---|
| `splash` | SplashScreen (graph start) | Routes to startup destination after session validation |
| `onboarding` | OnboardingScreen | |
| `login` | LoginScreen | Google/Facebook/phone/email + Google fallback |
| `phone_login` | PhoneAuthScreen | |
| `profile_setup` | CreateProfileScreen | Also entered by `openOwnProfileOrSetup()` when no session |
| `otp_verify/{identifier}` | — | **Dead route**: no composable registered, no callers. Kept in `Screen.kt` only. |

### 1.2 Main tabs (bottom dock: **visible** — owned by `MainTabsScreen`)

Registered in `NavGraph.kt` (`composable(Screen.MainTabs.route)`) and hosted by
`app/ui/screens/MainTabsScreen.kt` (pager-backed, 5 pages).

| Route | Tab (dock) | Tab content |
|---|---|---|
| `main_tabs?tab=game_zone` | Arcade (`YugmDockTab.GAME_ZONE`) | GamesScreen |
| `main_tabs?tab=party` | Party (`LIVE`) | VoiceRoomsScreen |
| `main_tabs?tab=discover` | Discover | DiscoverScreen |
| `main_tabs?tab=chat` | Chat | ChatListScreen (clan subtab hides the dock) |
| `main_tabs?tab=profile` | Profile | ProfileDetailScreen (own profile) |

### 1.3 Legacy top-level redirect stubs (forward to main tabs — compatible duplicates)

| Route | Registered by | Forwards to |
|---|---|---|
| `discover` | DiscoverNavGraph | `MainTabs(discover)` |
| `chat_list` | ChatNavGraph | `MainTabs(chat)` |
| `voice_rooms` | RoomNavGraph | `MainTabs(party)` |
| `games` | SocialNavGraph | `MainTabs(game_zone)` |

All four stubs redirect with `launchSingleTop = true` (+ `popUpTo` to the stub), so they are
dedup-safe and no destination renders twice on the stack. These stubs exist only for
compatibility with old links/intents; all in-app top-level traffic now goes through
`navigateTopLevel` → `main_tabs?tab=…`.

### 1.4 Secondary, detail, editing, immersive, and other screens (dock: **hidden**)

Room/channels (RoomNavGraph): `room_lobby/{roomId}/{roomType}`, `voice_room/{roomId}`,
`video_room/{roomId}`, `create_room`, `edit_room/{roomId}`, `followed_rooms`,
`room_mode/{roomId}/{isHost}` (imersive PK mode screens), `theme_gallery/{roomId}`
(watch-party player).

Profile/social (ProfileNavGraph): `profile_detail/{userId}` (standalone; dock now hidden),
`profile_social/{userId}/{list}`, `bonds`, `public_profile_preview/{userId}`,
`customize_profile`, `user_wishlist` (**not registered**, see §1.5).

Discover (DiscoverNavGraph): `search` — push-on-discover, dock hidden.

Chat (ChatNavGraph): `chat/{partnerId}` (and `?call=VOICE|VIDEO`), `chat_detail` is the same
route; push-on-chat, dock hidden.

Wallet/finance (WalletNavGraph): `wallet`, `vip`, `vip_privacy`, `creator_payout_kyc_intro`,
`creator_payout_kyc_form`, `creator_payout_kyc_status`, `trust_verification_intro`,
`trust_verification_consent`, `face_verification`, `voice_verification`, `trust_verification_status`,
`withdrawal_eligibility`.

Missions (MissionsNavGraph): `missions`, `battle_pass`.

Growth/achievements (SocialNavGraph): `growth`, `achievements`, `level_leaderboard`.

Events (EventsNavGraph): `events`, `event_create`.

Creator/AI (CreatorNavGraph): `creator_dashboard`, `vibe_graph`.

Social misc (SocialNavGraph): `dating_discovery` (**dock hidden after audit fix**),
`gift_catalog`, `gift_leaderboard`, `clan_list`, `clan_create`, `clan_detail`, `clan_chat`,
`referral`, `recordings`, `recording_player/{id}`,
`story_viewer/{userId}`, `highlights_management/{userId}`, `watch_party_player/{roomId}`,
`user_wishlist` (dead), `notifications`, `friends`, `matches` (dead), `subscriptions`,
`mood_activity`, `wave_inbox`, `daily_question`, `voice_polls`, `voice_poll_detail/{id}`,
`countdowns`, `wishlist`, `scheduled_calendar`, `hosts`, `language_picker`.

Settings/moderation/safety (SettingsNavGraph, ModerationNavGraph): `settings`, `safety`,
`blocked_users`, `support`, `moderation_status`, `moderation_report`, `moderation_appeal`,
`ticket_detail/{id}`.

### 1.5 Dead / unreachable routes

- `Screen.UserWishlist` (`user_wishlist/{userId}`) — **no composable registered, no callers.**
- `Screen.OtpVerify` (`otp_verify/{identifier}`) — **no composable registered, no callers.**
- `Screen.Matches` (`matches`) — registered in SocialNavGraph; **nothing navigates to it.**

Any navigation to these would silently land on no destination or the wrong one. They are
dead weight in the route model.

### 1.6 External/push-intent routes (MainActivity)

`routeFromPushIntent` accepts intents with extras `roomId`/`callType`, `clanId`, `chatPartnerId`
or `partnerId`, and `type=BONDS`. It navigates directly to secondary routes
(`voice_room`, `video_room`, `room_lobby`, `clan_detail`, `chat/{partnerId}`, `profile_detail/{id}`,
`bonds`). It **never uses `navigateTopLevel` or `main_tabs`** — fine: secondary detail screens
should not render the dock anyway. Note: push intents do not route to the *tab* hosting the
conversation (e.g., a chat push lands on the chat detail without restoring Chat tab state);
consistent with "hide dock on secondary screens", but it means returning to the Chat tab
loses nothing because the dock never shows mid-push.

## 2. Visibility matrix (dock render sites)

The dock is owned by `MainTabsScreen` — `showDock = MainTabsRoutes.isMainTabs(route) && !(currentPage == CHAT && isClanChatActive)`:

| Context | Dock rendered? |
|---|---|
| Main tabs: Arcade, Party, Discover, Chat, Profile | **Yes** (Chat hides while clan subtab active) |
| Legacy stub routes (`discover`, `chat_list`, `voice_rooms`, `games`) | No — they redirect to main tabs; stubs render no screen |
| All secondary/detail/editing/immersive (profile detail, rooms, chat detail, wallet, settings, …) | **No** — separate routes; dock lives only in MainTabsScreen |
| Splash/onboarding/login/phone/profile_setup | No — auth graph, dock never owned |
| Standalone dating_discovery | **No after audit fix** (was visible — root cause: screen rendered its own dock; now gated by `showBottomDock`, default false) |
| Standalone matches, user_wishlist | No (dead routes) |

Every other screen that *can* render a dock standalone (DiscoverScreen, VoiceRoomsScreen,
ChatListScreen, ProfileDetailScreen, MatchesScreen) now defaults `showBottomDock = false`,
and `MainTabsScreen` passes `showBottomDock = false` to tab screens — so no global-dock
controllers are in play outside the whitelist.

### 2.1 User-specified visibility matrix (audit spec)

| Context | Bottom navigation |
|---|---|
| Arcade | Visible |
| Party (voice) tab | Visible |
| Discover | Visible |
| Chat list | Visible |
| My Profile | Visible |
| Edit Profile | Hidden |
| Other user's profile | Hidden |
| Private conversation (chat detail) | Hidden |
| Voice room | Hidden |
| Settings, Wallet, Inventory | Hidden |
| Game screens | Hidden (see note) |
| Authentication and onboarding | Hidden |

Notes on interpretation:
- The five "visible" rows are the five pager roots: Arcade = `main_tabs?tab=game_zone`,
  Party = `main_tabs?tab=party`, Discover = `main_tabs?tab=discover`, Chat list =
  `main_tabs?tab=chat`, My Profile = `main_tabs?tab=profile`. The implementation whitelist is
  exactly these five routes (`MainTabsRoutes.ALL`).
- "Game screens" listed Hidden next to Arcade — the Arcade tab is the whitelisted root; other
  game surfaces (battles/modes) are secondary screens and are hidden, matching the "no prefix
  matching such as `route.startsWith("profile")`" style of the spec: visibility is decided by
  the actual current destination, not by screen family.
- "Private conversation" = the `chat/{partnerId}` detail route — separate route, dock hidden.
- "Voice room" here covers room detail routes (`room_lobby`, `voice_room`, `video_room`,
  `room_mode`, `theme_gallery`) — separate routes, dock hidden.

### 2.2 Derivation note (idiomatic Compose pattern)

The spec's example (`val currentRoute = currentBackStackEntry?.destination?.route;
val showBottomBar = currentRoute in bottomBarRoutes`) is the pattern implemented: the main-tabs
host derives `showDock` from `navController.currentBackStackEntry?.destination?.route` (the
actual current destination), never from per-screen local flags. Exact-set membership is used
(no `startsWith` prefix matching), and unknown routes default to the Discover whitelist member
only at tab normalization (never off-root).

## 3. Findings (root causes)

- **F1 — No single whitelist for "main tabs are the dock owners".** Two structures:
  `showDock` logic in `MainTabsScreen` (pager + clan state) and `showBottomDock` booleans on
  six standalone screens. Root cause: nothing in `core/navigation` declared the five root
  destinations. → Fixed with `core/navigation/MainTabsRoutes.kt` (enum `MainTabDestination`
  + `MainTabsRoutes.ALL` + `isMainTabs()` + `normalizeTab()`); `MainTabsScreen` now derives
  visibility from `MainTabsRoutes.isMainTabs(currentBackStackEntry?.destination?.route)`.
- **F2 — Visibility depended on pager state and a derived local flag.** Tab selection now comes
  from the pager (`pageToDockTab(pagerState.currentPage)`) — the actual current tab — while
  visibility = `isMainTabs(destination) && !(chat && isClanChatActive)`. The clan rule is still
  driven by `ChatListScreen`'s `mainTab` local state synced via `onClanTabActiveChanged`; two
  sources of truth for the same UI question. Acceptable given preserved behavior (previous task
  explicitly wanted clan-chat dock hiding kept); the main decision is whitelisted centrally.
- **F3 — Standalone docks on secondary screens.** `DatingDiscoveryScreen` (reached via
  `navigateTopLevel` from Discover) rendered its own dock (`selected = DISCOVER`) — violates
  the audit rule "hide on secondary screens". Fixed: `showBottomDock` default false, gated.
  `ProfileDetailScreen` standalone (other users) also showed a PROFILE dock — fixed: default
  false. `MatchesScreen` dock removed (dead route). Standalone docks in Discover/VoiceRooms/
  ChatList are preserved for structural placement; their routes are legacy redirects and
  unreachable, so no live behavior changed there.
- **F4 — `TopLevelNavigation` had dead branches and a potential duplicate-stack path.**
  Root causes: (a) dead `isProfileDestination` branch, (b) for the `main_tabs` case, when the
  current entry was already MainTabs, `popBackStack(MainTabs, inclusive = false)` then
  unconditional tab_request — semantics relied on an unverified return value; now the
  destination-based check is explicit: if already MainTabs → set `tab_request`; else pop to an
  existing MainTabs entry or `navigate(..., launchSingleTop = true)`.
- **F5 — No process-death restoration of the selected tab.** Root cause: `pagerState` was not
  persisted. Fixed: selected page persisted to the MainTabs back-stack entry's saved state
  (`main_tab_page`) and restored on recreation; the initial-tab effect no longer scrolls away
  when a restored page exists.
- **F6 — Content rendered beneath the dock.** MainTabsScreen used `Box { pager(fillMaxSize) +
  dock(align BottomCenter) }` — tab content drew under the floating capsule. Fixed:
  `Column { pager(weight(1f)); dock }` — structural no-overlap, dock flush to screen bottom,
  pager expands fully when dock hidden.
- **F7 — `goTo` not idempotent.** Added early return when `pagerState.currentPage == page`.
  Dock taps while pager is mid-animation to the same page now never queue extra scroll.
- **F8 — Dead routes/destinations in the model:** `UserWishlist`, `OtpVerify`, `Matches`.
  Documented; not removed (no navigation calls them today — removal is behaviorally safe; recommend deletion in a follow-up).
- **F9 — Notification routing inconsistency.** Two parallel systems:
  `core/navigation/NotificationTarget.kt` (`notificationTarget()`) has **zero callers** (dead);
  `MainActivity.routeFromPushIntent` handles push intents (BONDS, rooms, clan, chat partner,
  profile, else→Notifications) **without** `launchSingleTop` and without considering
  `actionType == "LEVEL_UP" | "ACHIEVEMENT_UNLOCKED"` (SocialNavGraph.Notifications.onOpenTarget
  handles those); push path maps a Gift without roomId to "Notifications" while the in-app
  mapper maps it to "Wallet". Root cause: duplicated, unshared mappers. Recommend: single
  `navigateFromNotification(intent extras)` helper shared by MainActivity/MainViewModel,
  deduped via `launchSingleTop`, alignment with `NotificationTarget` (which has no Wallet
  mapping on the push path — add `type == "GIFT" && no roomId → Wallet`). Not changed in this
  audit (behavior preserved, documented).
- **F10 — Insets (original audit):** Root `NavGraph` Box applied `windowInsetsPadding(safeDrawing)`
  once. Dock reads `WindowInsets.navigationBars` bottom directly (edge-to-edge aware). No per-screen
  bottom inset duplication found in MainTabsScreen (fixed via flow layout).
- **F11 — Elevated dock above the system gesture handle (root cause, fixed 2026-11-21 follow-up):**
  Because `windowInsetsPadding` *consumes* applied insets, the root `safeDrawing` padding on
  `NavGraph` meant `WindowInsets.navigationBars` resolved to 0 inside the main-tabs host. The dock's
  in-flow height became `topPadding + barHeight + 0`, so its surface stopped above the system
  navigation area and the (transparent) system-navigation scrim revealed the window background as a
  visible gap/strip. **Fix:** when `MainTabsRoutes.isMainTabs(currentRoute)` is true, the root
  container applies only `WindowInsets.safeDrawing.only(Top + Horizontal)` (destination-derived,
  not a per-screen flag); all other destinations keep full `safeDrawing`. The dock continues to
  size/paint its surface through `navigationBars` bottom inset and pads interactive content above it;
  when the main host hides the dock (Chat clan subtab) the pager applies `navigationBarsPadding()`.
  This preserves a single authoritative inset owner per concern and keeps the gesture area filled by
  the dock surface color. Runtime visual confirmation requires device/emulator inspection.

## 4. Navigation behavior audit (before/after)

| Behavior | Status | Notes |
|---|---|---|
| Duplicate back-stack entries | ✓ Handled | `navigateTopLevel`: `alreadySelected` return; `launchSingleTop` on navigates; legacy stubs `popUpTo`+`launchSingleTop`; push routes use `launchSingleTop` where reachable. |
| Repeated tab selections | ✓ Handled | Dock reselect → scroll-to-top/reselect signals (preserved); `goTo` early-return. |
| Scroll position & screen state | ✓ Preserved | `rememberLazyListState()` per tab, pager state. (Runtime-verified? No — device tests not run.) |
| Predictable Android back | ~ Preserved | Back pops secondary screens (dock returns via restored page); no-op at root. Intercepted-back semantics unchanged. |
| Back restores origin tab + dock | ~ Preserved | Pops MainTabs entry; `pagerState` restored (incl. now persistence F5). |
| Rapid taps | ✓ Handled | `goTo` no-ops when page already active. |
| Process recreation/config change | ✓ Improved | Selected tab now persisted/restored (F5). Other view-model-owned states untouched. |
| Deep links | ✗ None exist | No `deepLink` registrations anywhere; any URI falls to default behavior. Documented as gap. |
| External/push navigation | ~ Audited | MainActivity route map audited (F9 note); uses distinct routes per target. |
| Rapid duplicate navigation | ✓ Mostly handled | `alreadySelected` + `launchSingleTop`. One residual: MainActivity push handler navigates without `launchSingleTop` — add it for extra safety (recommendation, low risk). |

## 5. Standardized navigation decisions

1. **One whitelist** — `MainTabsRoutes.ALL` is the source of truth for "the five main roots".
2. **Deterministic visibility** — dock renders only inside MainTabsScreen, derived from
   `destination.route` + clan-chat condition; every new screen is dock-free by default.
3. **Idempotency** — tab switches never push duplicate MainTabs entries.
4. **State restoration** — pager page persisted on the MainTabs back-stack entry.
5. **Separation of concerns** — feature screens receive `showBottomDock`/`onClanTabActiveChanged`
   only for structural placement/preserved clan behavior; they do not decide for the main host.
6. **Route normalization** — `MainTabsRoutes.normalizeTab()` maps legacy/spelling variants;
   unknown → Discover (never off-root).

## 6. Verification summary (run)

### Audit pass (initial, 2026-11-21)
- `:core:navigation:compileDebugKotlin`, `:app:compileDebugKotlin`, `:feature:profile:compileDebugKotlin`,
  `:feature:social:compileDebugKotlin` — BUILD SUCCESSFUL
- `:core:navigation:testDebugUnitTest` — 6/6 passed (`MainTabsRoutesTest`)
- `:app:testDebugUnitTest` — BUILD SUCCESSFUL

### Follow-up: inset fix, geometry hardening, and regression tests (2026-11-21)
- `:core:navigation:testDebugUnitTest :core:ui:testDebugUnitTest :app:testDebugUnitTest :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin` — **BUILD SUCCESSFUL** (394 tasks, 8 executed). XML results: `core:navigation` 12 tests/0 failures (`MainTabsRoutesTest`, `TopLevelNavigationTargetsTest`), `core:ui` 6 tests/0 failures (`BottomDockGeometryTest`), `app` 5 tests/0 failures (`MainTabsNavigationTest` + existing).
- `:app:compileDebugKotlin`/`installDebug` — **BUILD SUCCESSFUL** (installed on `emulator-5554`).
- Emulator exercised (gesture nav, `emulator-5554`, 1080x2400, system nav inset reported 53px): launched debug app and captured screenshots/log states for main-tabs roots and secondary transitions (`after_discover2`, arcade/profile tab taps via UIAutomator coordinates, notifications push via top bar → no dock, back to Discover → dock visible, dark mode Discover, Chat tab and Chat clan subtab). UIAutomator dump confirmed content-descs for all five destinations. Captured artifacts in local temp (`C:\Users\longl\AppData\Local\Temp\...`) during the session; **this environment could not render/visually inspect the PNGs in-chat**, so pixel-perfect visual acceptance (notch curvature, exact gap removal, contrast, a11y focus order, font scaling, 3-button nav, predictive back gesture, deep links, process-death restore) remains **not independently verified by the agent** and must be confirmed by a human on device/emulator.
- `git diff --check` — exit 0 (LF/CRLF warnings only). Lint not run. Backend untouched.

## 7. Not run / remaining limits

- Human visual sign-off on captured emulator screenshots (agent environment cannot display image
  attachments): confirm dock surface reaches the physical bottom edge in light/dark, notch/shoulder
  shape at first and last tabs, no rectangular press overlay, contrast, and no content overlap.
- Runtime scenarios not fully exercised or not human-verified here: 3-button navigation, keyboard/IME,
  font scaling, TalkBack traversal/focus order, rapid repeated taps stress, predictive-back gesture,
  deep-link behavior (no deep links registered), push-intent dedup/`launchSingleTop` parity (F9),
  process-death restoration on a real recreation flow, and all secondary flows across the full app.
- Lint not run (resource-intensive per repo guidance). Backend untouched.
- Follow-ups still open: F6 deep links, F8 dead-route deletion, F9 unified notification mapper.

## 8. Follow-ups (not implemented, per "smallest coherent change")

1. Delete dead routes: `Screen.OtpVerify`, `Screen.UserWishlist`, `Screen.Matches`,
   `Screen.RatingDetail` if present in models.
2. Share one `navigateFromNotification` mapper; add `launchSingleTop` to MainActivity pushes.
3. Implement deep-link definitions for main tabs (`main_tabs?tab=…`) and secondary screens,
   delegating to `navigateTopLevel`.
4. Consider a `NavigationState`/`MainTabViewModel` for the pager: state currently lives in
   `MainTabsScreen`; process restoration works via saved handles today, but a small state
   holder would make it explicit.

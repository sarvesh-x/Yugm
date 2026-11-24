package com.yugm.app.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.lifecycle.SavedStateHandle
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.navigation.MainTabDestination
import com.yugm.app.core.navigation.MainTabsRoutes
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.core.ui.components.LocalMainDockBottomClearance
import com.yugm.app.core.ui.components.YugmBackground
import com.yugm.app.core.ui.components.YugmBackgroundStyle
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.core.ui.components.mainDockBottomClearance
import com.yugm.app.feature.chat.screens.ChatListScreen
import com.yugm.app.feature.chat.viewmodel.ChatListViewModel
import com.yugm.app.feature.discover.screens.DiscoverScreen
import com.yugm.app.feature.profile.screens.ProfileDetailScreen
import com.yugm.app.feature.room.screens.VoiceRoomsScreen
import com.yugm.app.feature.social.screens.GamesScreen
import kotlinx.coroutines.launch

internal const val TAB_GAME_ZONE = 0
internal const val TAB_PARTY = 1
internal const val TAB_DISCOVER = 2
internal const val TAB_CHAT = 3
internal const val TAB_PROFILE = 4
internal const val TAB_PAGE_COUNT = 5

internal fun normalizeMainTab(tab: String): Int = when (MainTabsRoutes.normalizeTab(tab)) {
    MainTabDestination.GAME_ZONE -> TAB_GAME_ZONE
    MainTabDestination.PARTY -> TAB_PARTY
    MainTabDestination.CHAT -> TAB_CHAT
    MainTabDestination.PROFILE -> TAB_PROFILE
    MainTabDestination.DISCOVER -> TAB_DISCOVER
}

internal fun pageToDockTab(page: Int): YugmDockTab = when (page) {
    TAB_GAME_ZONE -> YugmDockTab.GAME_ZONE
    TAB_PARTY -> YugmDockTab.LIVE
    TAB_CHAT -> YugmDockTab.CHAT
    TAB_PROFILE -> YugmDockTab.PROFILE
    else -> YugmDockTab.DISCOVER
}

internal fun dockTabToPage(tab: YugmDockTab): Int = when (tab) {
    YugmDockTab.GAME_ZONE -> TAB_GAME_ZONE
    YugmDockTab.LIVE -> TAB_PARTY
    YugmDockTab.CHAT -> TAB_CHAT
    YugmDockTab.PROFILE -> TAB_PROFILE
    YugmDockTab.DISCOVER -> TAB_DISCOVER
}

/** Target page to animate to, or null when the requested page is already active (idempotent). */
internal fun tabScrollTarget(currentPage: Int, requestedPage: Int): Int? =
    requestedPage.takeIf { it != currentPage && it in 0 until TAB_PAGE_COUNT }

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MainTabsScreen(
    navController: NavHostController,
    mainTabsState: SavedStateHandle,
    token: String,
    currentUserId: String,
    initialTab: String = "discover",
    requestedTab: String? = null,
    onRequestedTabConsumed: () -> Unit = {},
    onProfileUpdated: (com.yugm.app.core.model.YugmUser) -> Unit = {},
    userAvatar: String? = null,
    userAvatarType: String? = null,
    userAvatarParts: com.yugm.app.core.model.AvatarPartsPayload? = null,
) {
    val requestedPage = normalizeMainTab(initialTab)
    val backStackEntry by navController.currentBackStackEntryAsState()
    // Process-death/configuration restoration: the last selected page is persisted on the
    // main-tabs back stack entry so the pager resumes on the tab the user was on.
    val restoredTabPage = remember(mainTabsState) { MainTabsRoutes.restoredPage(mainTabsState) }
    var appliedInitialTab by rememberSaveable { mutableStateOf<String?>(null) }
    val pagerState = rememberPagerState(
        initialPage = restoredTabPage ?: requestedPage,
        pageCount = { TAB_PAGE_COUNT }
    )
    val scope = rememberCoroutineScope()
    LaunchedEffect(mainTabsState, pagerState.settledPage) {
        mainTabsState[MainTabsRoutes.SAVED_PAGE_KEY] = pagerState.settledPage
    }
    val chatListViewModel: ChatListViewModel = hiltViewModel()
    val chatUnreadBadge = remember(chatListViewModel.unreadCounts, chatListViewModel.mutedPartnerIds) {
        chatListViewModel.unreadCounts.filterKeys { it !in chatListViewModel.mutedPartnerIds }.values.sum()
    }
    var isClanChatActive by remember { mutableStateOf(false) }
    var discoverReselect by remember { mutableIntStateOf(0) }
    var partyReselect by remember { mutableIntStateOf(0) }
    var chatReselect by remember { mutableIntStateOf(0) }
    var profileReselect by remember { mutableIntStateOf(0) }
    var gamesReselect by remember { mutableIntStateOf(0) }
    val discoverListState = rememberLazyListState()
    val partyListState = rememberLazyListState()

    LaunchedEffect(initialTab) {
        // Apply the route's initial tab only once for this destination instance so returning
        // from pushed screens preserves the user's last selected tab. On recreation the
        // restored saved page is already the pager's initial page, so do not scroll away from it.
        if (appliedInitialTab == initialTab) return@LaunchedEffect
        val target = normalizeMainTab(initialTab)
        if (restoredTabPage != null) {
            appliedInitialTab = initialTab
            return@LaunchedEffect
        }
        if (pagerState.currentPage != target) {
            pagerState.scrollToPage(target)
        }
        appliedInitialTab = initialTab
    }

    LaunchedEffect(requestedTab) {
        val tab = requestedTab ?: return@LaunchedEffect
        val target = normalizeMainTab(tab)
        if (pagerState.currentPage != target) {
            pagerState.animateScrollToPage(target)
        }
        appliedInitialTab = tab
        onRequestedTabConsumed()
    }

    fun goTo(page: Int) {
        // Idempotent: repeated taps on an already-active tab never stack or animate extra pages.
        val target = tabScrollTarget(pagerState.currentPage, page) ?: return
        scope.launch { pagerState.animateScrollToPage(target) }
    }

    fun handleTabSelect(tab: YugmDockTab) {
        goTo(dockTabToPage(tab))
    }

    fun handleTabReselect(tab: YugmDockTab) {
        scope.launch {
            when (tab) {
                YugmDockTab.GAME_ZONE -> gamesReselect++
                YugmDockTab.LIVE -> {
                    partyReselect++
                    if (partyListState.firstVisibleItemIndex != 0 || partyListState.firstVisibleItemScrollOffset != 0) {
                        partyListState.animateScrollToItem(0)
                    }
                }
                YugmDockTab.DISCOVER -> {
                    discoverReselect++
                    if (discoverListState.firstVisibleItemIndex != 0 || discoverListState.firstVisibleItemScrollOffset != 0) {
                        discoverListState.animateScrollToItem(0)
                    }
                }
                YugmDockTab.CHAT -> chatReselect++
                YugmDockTab.PROFILE -> profileReselect++
            }
        }
    }

    fun openRoom(room: Room) {
        navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
    }

    fun joinPartyRoom(room: Room) {
        val route = if (room.type == RoomType.Video) {
            Screen.VideoRoom.createRoute(room.id)
        } else {
            Screen.VoiceRoom.createRoute(room.id)
        }
        navController.navigate(route)
    }

    fun openOwnProfileOrSetup() {
        if (currentUserId.isNotBlank()) {
            goTo(TAB_PROFILE)
        } else {
            navController.navigate(Screen.ProfileSetup.route)
        }
    }

    val selectedTab = pageToDockTab(pagerState.currentPage)
    // Centralized visibility: the dock renders only while this screen hosts the five main
    // tabs (explicit destination whitelist from MainTabsRoutes). The Chat tab additionally
    // hides the dock while the clan-chat subtab is active; secondary/detail/immersive
    // screens are separate routes and never render this dock.
    val showDock = MainTabsRoutes.isDockVisible(
        currentRoute = backStackEntry?.destination?.route,
        chatTabActive = pagerState.currentPage == TAB_CHAT,
        clanChatActive = isClanChatActive,
    )

    // Overlay layout: content fills the full viewport and extends behind the dock,
    // including the transparent notch/cradle. The dock is overlaid at BottomCenter.
    // Scrollable tab content reads LocalMainDockBottomClearance for bottom contentPadding.
    val dockBottomClearance = if (showDock) mainDockBottomClearance() else 0.dp
    Box(Modifier.fillMaxSize()) {
        // Single shared background for all five main tabs — stationary behind the pager.
        YugmBackground(style = YugmBackgroundStyle.Ambient)

        val pagerModifier = if (showDock) {
            Modifier.fillMaxSize()
        } else {
            Modifier.fillMaxSize().navigationBarsPadding()
        }
        HorizontalPager(
            state = pagerState,
            modifier = pagerModifier,
            beyondViewportPageCount = 1,
            userScrollEnabled = true
        ) { page ->
            androidx.compose.runtime.CompositionLocalProvider(
                com.yugm.app.core.ui.components.LocalAutomaticSyncEnabled provides (pagerState.currentPage == page),
                LocalMainDockBottomClearance provides dockBottomClearance
            ) {
                when (page) {
                    TAB_GAME_ZONE -> GamesScreen(reselectSignal = gamesReselect)

                    TAB_PARTY -> VoiceRoomsScreen(
                        token = token,
                        onOpenRoom = ::openRoom,
                        onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                        onDiscover = { goTo(TAB_DISCOVER) },
                        onChat = { goTo(TAB_CHAT) },
                        onProfile = { openOwnProfileOrSetup() },
                        onSearch = { navController.navigate(Screen.Search.route) },
                        onEvents = { navController.navigate(Screen.Events.route) },
                        onFollowedRooms = { navController.navigate(Screen.FollowedRooms.route) },
                        onGameZone = { goTo(TAB_GAME_ZONE) },
                        showBottomDock = false,
                        listState = partyListState,
                        reselectSignal = partyReselect
                    )

                    TAB_DISCOVER -> DiscoverScreen(
                        token = token,
                        onOpenRoom = ::openRoom,
                        onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
                        onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                        onNotifications = { navController.navigate(Screen.Notifications.route) },
                        onSearch = { navController.navigate(Screen.Search.route) },
                        onGames = { goTo(TAB_GAME_ZONE) },
                        onEvents = { navController.navigate(Screen.Events.route) },
                        onDating = { navController.navigateTopLevel(Screen.DatingDiscovery.route) },
                        onChat = { goTo(TAB_CHAT) },
                        onSelfProfile = { openOwnProfileOrSetup() },
                        onVoiceRooms = { goTo(TAB_PARTY) },
                        onJoinParty = ::joinPartyRoom,
                        onOpenMatchedCall = { room -> navController.navigate(Screen.VoiceRoom.createRoute(room.id)) },
                        onVibeGraph = { navController.navigate(Screen.VibeGraph.route) },
                        onCreatorDashboard = { navController.navigate(Screen.CreatorDashboard.route) },
                        onLeaderboards = { navController.navigate(Screen.GiftLeaderboard.route) },
                        onClans = { navController.navigate(Screen.ClanList.route) },
                        showBottomDock = false,
                        listState = discoverListState,
                        reselectSignal = discoverReselect
                    )

                    TAB_CHAT -> ChatListScreen(
                        token = token,
                        currentUserId = currentUserId,
                        onOpenChat = { partnerId -> navController.navigate(Screen.Chat.createRoute(partnerId)) },
                        onDiscover = { goTo(TAB_DISCOVER) },
                        onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                        onLive = { goTo(TAB_PARTY) },
                        onProfile = { openOwnProfileOrSetup() },
                        onJoinClan = { navController.navigate(Screen.ClanList.route) },
                        onOpenClanDetail = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
                        onGameZone = { goTo(TAB_GAME_ZONE) },
                        showBottomDock = false,
                        onClanTabActiveChanged = { isClanChatActive = it },
                        viewModel = chatListViewModel,
                        reselectSignal = chatReselect
                    )

                    TAB_PROFILE -> {
                        val profileUserId = currentUserId
                        if (profileUserId.isBlank()) {
                            LaunchedEffect(Unit) {
                                navController.navigate(Screen.ProfileSetup.route) { launchSingleTop = true }
                            }
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("Complete your profile to continue")
                            }
                        } else {
                            ProfileDetailScreen(
                                token = token,
                                userId = profileUserId,
                                onBack = { goTo(TAB_DISCOVER) },
                                onMessage = { partnerId -> navController.navigate(Screen.Chat.createRoute(partnerId)) },
                                onInviteToRoom = { /* handled in screen/nav elsewhere; tab context best-effort */ },
                                onOpenRoom = ::openRoom,
                                isOwnProfile = true,
                                autoEdit = false,
                                onOpenSocialList = { list -> navController.navigate(Screen.ProfileSocial.createRoute(profileUserId, list)) },
                                onProfileUpdated = onProfileUpdated,
                                onSettings = { navController.navigate(Screen.Settings.route) },
                                onDiscover = { goTo(TAB_DISCOVER) },
                                onParty = { goTo(TAB_PARTY) },
                                onChatTab = { goTo(TAB_CHAT) },
                                onOpenStore = { navController.navigate(Screen.Cosmetics.route) },
                                onOpenCustomize = { navController.navigate(Screen.CustomizeProfile.route) },
                                onOpenPublicProfile = { navController.navigate(Screen.PublicProfilePreview.createRoute(profileUserId)) },
                                onOpenVip = { navController.navigate(Screen.Vip.route) },
                                onOpenTasks = { navController.navigate(Screen.Growth.route) },
                                onOpenAchievements = { navController.navigate(Screen.Achievements.route) },
                                onOpenBonds = { id -> navController.navigate(Screen.Bonds.createRoute(id)) },
                                onBondPartnerProfile = { id -> navController.navigate(Screen.ProfileDetail.createRoute(id)) },
                                onOpenLevel = { navController.navigate(Screen.BattlePass.route) },
                                onOpenWallet = { navController.navigate(Screen.Wallet.route) },
                                onOpenPayments = { navController.navigate(Screen.WithdrawalEligibility.route) },
                                onOpenInventory = { navController.navigate(Screen.Inventory.route) },
                                onOpenClan = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
                                onOpenClanList = { navController.navigate(Screen.ClanList.route) },
                                onGameZone = { goTo(TAB_GAME_ZONE) },
                                showBottomDock = false,
                                backgroundStyle = YugmBackgroundStyle.None
                            )
                        }
                    }
                }
            }
        }

        if (showDock) {
            YugmBottomDock(
                selected = selectedTab,
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
                onTabSelected = ::handleTabSelect,
                onTabReselected = ::handleTabReselect,
                chatUnreadCount = chatUnreadBadge,
                userAvatar = userAvatar,
                userAvatarType = userAvatarType,
                userAvatarParts = userAvatarParts
            )
        }
    }
}

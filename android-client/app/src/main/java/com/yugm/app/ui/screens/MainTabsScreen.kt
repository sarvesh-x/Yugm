package com.yugm.app.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.feature.chat.screens.ChatListScreen
import com.yugm.app.feature.chat.viewmodel.ChatListViewModel
import com.yugm.app.feature.discover.screens.DiscoverScreen
import com.yugm.app.feature.profile.screens.ProfileDetailScreen
import com.yugm.app.feature.room.screens.VoiceRoomsScreen
import com.yugm.app.feature.social.screens.GamesScreen
import kotlinx.coroutines.launch

private const val TAB_GAME_ZONE = 0
private const val TAB_PARTY = 1
private const val TAB_DISCOVER = 2
private const val TAB_CHAT = 3
private const val TAB_PROFILE = 4

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MainTabsScreen(
    navController: NavHostController,
    token: String,
    currentUserId: String,
    initialTab: String = "discover",
    requestedTab: String? = null,
    onRequestedTabConsumed: () -> Unit = {},
    onProfileUpdated: (com.yugm.app.core.model.YugmUser) -> Unit = {},
) {
    val requestedPage = when (initialTab.lowercase()) {
        "game", "games", "game_zone", "gamezone" -> TAB_GAME_ZONE
        "party", "live", "voice_rooms", "voicerooms" -> TAB_PARTY
        "chat", "chats", "chat_list", "chatlist" -> TAB_CHAT
        "profile", "mine" -> TAB_PROFILE
        else -> TAB_DISCOVER
    }
    var appliedInitialTab by rememberSaveable { mutableStateOf<String?>(null) }
    val pagerState = rememberPagerState(initialPage = requestedPage, pageCount = { 5 })
    val scope = rememberCoroutineScope()
    val chatListViewModel: ChatListViewModel = hiltViewModel()
    val chatUnreadBadge = remember(chatListViewModel.unreadCounts, chatListViewModel.mutedPartnerIds) {
        chatListViewModel.unreadCounts.filterKeys { it !in chatListViewModel.mutedPartnerIds }.values.sum().coerceAtMost(9)
    }
    var isClanChatActive by remember { mutableStateOf(false) }

    LaunchedEffect(pagerState.currentPage) {
        if (pagerState.currentPage != TAB_CHAT) {
            isClanChatActive = false
        }
    }

    LaunchedEffect(initialTab) {
        // Apply the route's initial tab only once for this destination instance so returning
        // from pushed screens preserves the user's last selected tab.
        if (appliedInitialTab == initialTab) return@LaunchedEffect
        if (pagerState.currentPage != requestedPage) {
            pagerState.scrollToPage(requestedPage)
        }
        appliedInitialTab = initialTab
    }

    LaunchedEffect(requestedTab) {
        val tab = requestedTab ?: return@LaunchedEffect
        val target = when (tab.lowercase()) {
            "game", "games", "game_zone", "gamezone" -> TAB_GAME_ZONE
            "party", "live", "voice_rooms", "voicerooms" -> TAB_PARTY
            "chat", "chats", "chat_list", "chatlist" -> TAB_CHAT
            "profile", "mine" -> TAB_PROFILE
            else -> TAB_DISCOVER
        }
        if (pagerState.currentPage != target) {
            pagerState.animateScrollToPage(target)
        }
        appliedInitialTab = tab
        onRequestedTabConsumed()
    }

    fun goTo(page: Int) {
        scope.launch { pagerState.animateScrollToPage(page) }
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

    Box(Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            beyondViewportPageCount = 1,
            userScrollEnabled = true
        ) { page ->
            when (page) {
                TAB_GAME_ZONE -> GamesScreen()

                TAB_PARTY -> VoiceRoomsScreen(
                    token = token,
                    onOpenRoom = ::openRoom,
                    onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                    onDiscover = { goTo(TAB_DISCOVER) },
                    onChat = { goTo(TAB_CHAT) },
                    onWallet = { navController.navigate(Screen.Wallet.route) },
                    onProfile = { openOwnProfileOrSetup() },
                    onSearch = { navController.navigate(Screen.Search.route) },
                    onEvents = { navController.navigate(Screen.Events.route) },
                    onGameZone = { goTo(TAB_GAME_ZONE) },
                    showBottomDock = false
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
                    onWallet = { navController.navigate(Screen.Wallet.route) },
                    onSelfProfile = { openOwnProfileOrSetup() },
                    onVoiceRooms = { goTo(TAB_PARTY) },
                    onJoinParty = ::joinPartyRoom,
                    onOpenMatchedCall = { room -> navController.navigate(Screen.VoiceRoom.createRoute(room.id)) },
                    onVibeGraph = { navController.navigate(Screen.VibeGraph.route) },
                    onCreatorDashboard = { navController.navigate(Screen.CreatorDashboard.route) },
                    onLeaderboards = { navController.navigate(Screen.GiftLeaderboard.route) },
                    onClans = { navController.navigate(Screen.ClanList.route) },
                    showBottomDock = false
                )

                TAB_CHAT -> ChatListScreen(
                    token = token,
                    currentUserId = currentUserId,
                    onOpenChat = { partnerId -> navController.navigate(Screen.Chat.createRoute(partnerId)) },
                    onDiscover = { goTo(TAB_DISCOVER) },
                    onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                    onLive = { goTo(TAB_PARTY) },
                    onWallet = { navController.navigate(Screen.Wallet.route) },
                    onProfile = { openOwnProfileOrSetup() },
                    onOpenClan = { clanId, clanName -> navController.navigate(Screen.ClanChat.createRoute(clanId, clanName)) },
                    onJoinClan = { navController.navigate(Screen.ClanList.route) },
                    onOpenClanDetail = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
                    onGameZone = { goTo(TAB_GAME_ZONE) },
                    showBottomDock = false,
                    onClanTabActiveChanged = { isClanChatActive = it },
                    viewModel = chatListViewModel
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
                            onOpenLevel = { navController.navigate(Screen.BattlePass.route) },
                            onOpenWallet = { navController.navigate(Screen.Wallet.route) },
                            onOpenInventory = { navController.navigate(Screen.Inventory.route) },
                            onOpenClan = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
                            onOpenClanList = { navController.navigate(Screen.ClanList.route) },
                            onGameZone = { goTo(TAB_GAME_ZONE) },
                            showBottomDock = false
                        )
                    }
                }
            }
        }

        val selectedTab = when (pagerState.currentPage) {
            TAB_GAME_ZONE -> YugmDockTab.GAME_ZONE
            TAB_PARTY -> YugmDockTab.LIVE
            TAB_CHAT -> YugmDockTab.CHAT
            TAB_PROFILE -> YugmDockTab.PROFILE
            else -> YugmDockTab.DISCOVER
        }
        if (!(pagerState.currentPage == TAB_CHAT && isClanChatActive)) {
            YugmBottomDock(
                selected = selectedTab,
                modifier = Modifier.align(Alignment.BottomCenter),
                onDiscover = { goTo(TAB_DISCOVER) },
                onCreate = { navController.navigate(Screen.CreateRoom.route) },
                onLive = { goTo(TAB_PARTY) },
                onChat = { goTo(TAB_CHAT) },
                onWallet = { navController.navigate(Screen.Wallet.route) },
                onProfile = { openOwnProfileOrSetup() },
                onGameZone = { goTo(TAB_GAME_ZONE) },
                chatBadge = chatUnreadBadge
            )
        }
    }
}

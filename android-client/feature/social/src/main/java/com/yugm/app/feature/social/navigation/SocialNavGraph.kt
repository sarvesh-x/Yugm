package com.yugm.app.feature.social.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.feature.social.screens.CountdownScreen
import com.yugm.app.feature.social.screens.DatingDiscoveryScreen
import com.yugm.app.feature.social.screens.FriendsScreen
import com.yugm.app.feature.social.screens.GiftLeaderboardScreen
import com.yugm.app.feature.social.screens.VoicePollDetailScreen
import com.yugm.app.feature.social.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.socialNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String,
) {
    composable(Screen.DatingDiscovery.route) {
        DatingDiscoveryScreen(
            token = authTokenProvider(),
            onNavigateToChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onNavigateToProfile = { userId ->
                navController.navigate(Screen.ProfileDetail.createRoute(userId))
            },
            onMatches = { navController.navigateTopLevel(Screen.ChatList.route) },
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onLive = { navController.navigateTopLevel(Screen.VoiceRooms.route) },
            onWallet = { navController.navigate(Screen.Wallet.route) },
            onSelfProfile = {
                if (currentUserIdProvider().isNotBlank()) navController.navigate(Screen.MainTabs.createRoute("profile")) { launchSingleTop = true }
                else navController.navigate(Screen.ProfileSetup.route)
            }
        )
    }

    composable(Screen.GiftLeaderboard.route) {
        GiftLeaderboardScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.ClanList.route) {
        ClanListScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onCreateClan = { navController.navigate(Screen.ClanCreate.route) },
            onClanClick = { navController.navigate(Screen.ClanDetail.createRoute(it)) },
            onMyClanClick = { navController.navigate(Screen.ClanDetail.createRoute(it)) }
        )
    }
    composable(Screen.ClanCreate.route) {
        ClanCreateScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onClanCreated = { clanId ->
                navController.popBackStack()
                navController.navigate(Screen.ClanDetail.createRoute(clanId))
            }
        )
    }
    composable(
        route = Screen.ClanDetail.route,
        arguments = listOf(navArgument("clanId") { type = NavType.StringType })
    ) { entry ->
        val clanId = entry.arguments?.getString("clanId").orEmpty()
        ClanDetailScreen(
            token = authTokenProvider(),
            clanId = clanId,
            currentUserId = currentUserIdProvider(),
            onBack = { navController.popBackStack() },
            onChat = { id, name -> navController.navigate(Screen.ClanChat.createRoute(id, name)) },
            onMemberClick = { id -> navController.navigate(Screen.ProfileDetail.createRoute(id)) }
        )
    }
    composable(
        route = Screen.ClanChat.route,
        arguments = listOf(
            navArgument("clanId") { type = NavType.StringType },
            navArgument("clanName") { type = NavType.StringType; defaultValue = ""; nullable = true }
        )
    ) { entry ->
        ClanChatScreen(
            token = authTokenProvider(),
            clanId = entry.arguments?.getString("clanId").orEmpty(),
            currentUserId = currentUserIdProvider(),
            clanName = entry.arguments?.getString("clanName").orEmpty(),
            onBack = { navController.popBackStack() },
            onClanDetails = { navController.navigate(Screen.ClanDetail.createRoute(entry.arguments?.getString("clanId").orEmpty())) }
        )
    }

    composable(Screen.Wishlist.route) {
        WishlistScreen(
            token = authTokenProvider(),
            userId = null,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Referral.route) {
        ReferralScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.GroupChats.route) {
        GroupChatScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenGroup = { groupId ->
                navController.navigate(Screen.GroupChatDetail.createRoute(groupId))
            }
        )
    }

    composable(
        route = Screen.GroupChatDetail.route,
        arguments = listOf(navArgument("groupId") { type = NavType.StringType })
    ) { backStackEntry ->
        val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
        val viewModel: com.yugm.app.feature.social.viewmodel.GroupChatDetailViewModel = hiltViewModel(backStackEntry)
        LaunchedEffect(groupId) {
            viewModel.connect(authTokenProvider(), groupId)
            viewModel.load()
        }
        GroupChatDetailScreen(
            messages = viewModel.messages,
            messageText = viewModel.messageText,
            onMessageChange = viewModel::updateText,
            onBack = { navController.popBackStack() },
            onSend = viewModel::send
        )
    }

    composable(
        route = Screen.StoryViewer.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        StoryViewerScreen(
            token = authTokenProvider(),
            userId = userId,
            onBack = { navController.popBackStack() }
        )
    }

    composable(
        route = Screen.WatchPartyPlayer.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        WatchPartyPlayerScreen(
            token = authTokenProvider(),
            roomId = roomId,
            onBack = { navController.popBackStack() },
            onStop = { navController.popBackStack() }
        )
    }

    composable(Screen.ScheduledCalendar.route) {
        ScheduledCalendarScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenRoom = { roomId -> navController.navigate(Screen.RoomLobby.createRoute(roomId)) }
        )
    }

    composable(Screen.LanguagePicker.route) {
        LanguagePickerScreen(
            currentLanguage = "en",
            onLanguageSelected = { navController.popBackStack() },
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Recordings.route) {
        RecordingsScreen(
            token = authTokenProvider(),
            roomId = null,
            onBack = { navController.popBackStack() },
            onPlayRecording = { recordingId ->
                navController.navigate(Screen.RecordingPlayer.createRoute(recordingId))
            }
        )
    }

    composable(
        route = Screen.RecordingPlayer.route,
        arguments = listOf(navArgument("recordingId") { type = NavType.StringType })
    ) { backStackEntry ->
        val recordingId = backStackEntry.arguments?.getString("recordingId") ?: ""
        val recordingContext = androidx.compose.ui.platform.LocalContext.current
        var recording by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.yugm.app.core.model.RoomRecording?>(null) }
        var recordingError by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
        LaunchedEffect(recordingId) {
            runCatching { com.yugm.app.core.api.YugmApi.recordingDetail(authTokenProvider(), recordingId) }
                .onSuccess { recording = it }
                .onFailure { recordingError = true; android.widget.Toast.makeText(recordingContext, it.message ?: "Failed to load recording", android.widget.Toast.LENGTH_SHORT).show() }
        }
        when {
            recordingError -> androidx.compose.material3.Text("Failed to load recording", color = com.yugm.app.core.ui.theme.Danger)
            recording != null -> RecordingPlayerScreen(
                recording = recording!!,
                onBack = { navController.popBackStack() }
            )
            else -> com.yugm.app.core.ui.components.LoadingState("Loading recording...")
        }
    }

    composable(Screen.Hosts.route) {
        HostsScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.MoodActivity.route) {
        MoodActivityScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.WaveInbox.route) {
        WaveInboxScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.DailyQuestion.route) {
        DailyQuestionScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.VoicePolls.route) {
        VoicePollScreen(
            token = authTokenProvider(),
            userId = currentUserIdProvider(),
            onBack = { navController.popBackStack() },
            onPollDetail = { pollId -> navController.navigate(Screen.VoicePollDetail.createRoute(pollId)) }
        )
    }

    composable(
        route = Screen.VoicePollDetail.route,
        arguments = listOf(navArgument("pollId") { type = NavType.StringType })
    ) { backStackEntry ->
        val pollId = backStackEntry.arguments?.getString("pollId") ?: ""
        VoicePollDetailScreen(
            token = authTokenProvider(),
            userId = currentUserIdProvider(),
            pollId = pollId,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Countdowns.route) {
        CountdownScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Games.route) {
        androidx.compose.runtime.LaunchedEffect(Unit) {
            navController.navigate(Screen.MainTabs.createRoute("game_zone")) {
                popUpTo(Screen.Games.route) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    composable(Screen.Friends.route) {
        FriendsScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.Notifications.route) {
        NotificationsScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenTarget = { notification ->
                when {
                    notification.roomId.isNotBlank() -> navController.navigate(Screen.RoomLobby.createRoute(notification.roomId))
                    notification.partnerId.isNotBlank() -> navController.navigate(Screen.Chat.createRoute(notification.partnerId))
                    notification.actorId.isNotBlank() -> navController.navigate(Screen.ProfileDetail.createRoute(notification.actorId))
                    else -> navController.navigate(Screen.MainTabs.createRoute("discover")) { launchSingleTop = true }
                }
            }
        )
    }

    composable(Screen.Growth.route) {
        GrowthScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onPayoutVerification = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
            onWithdraw = { navController.navigate(Screen.WithdrawalEligibility.route) },
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) }
        )
    }

    composable(Screen.Matches.route) {
        MatchesScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenChat = { partnerId -> navController.navigate(Screen.Chat.createRoute(partnerId)) },
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onDating = { navController.navigateTopLevel(Screen.DatingDiscovery.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onWallet = { navController.navigateTopLevel(Screen.Wallet.route) },
            onLive = { navController.navigateTopLevel(Screen.VoiceRooms.route) },
            onProfile = {
                if (currentUserIdProvider().isNotBlank()) navController.navigateTopLevel(Screen.ProfileDetail.createRoute(currentUserIdProvider()))
                else navController.navigate(Screen.ProfileSetup.route)
            }
        )
    }

    composable(Screen.Subscriptions.route) {
        SubscriptionsScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }
}
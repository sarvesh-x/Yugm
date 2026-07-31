package com.example.yugm.feature.social.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.social.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.socialNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
) {
    composable(Screen.DatingDiscovery.route) {
        DatingDiscoveryScreen(
            token = authToken,
            onNavigateToChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onNavigateToProfile = { userId ->
                navController.navigate(Screen.ProfileDetail.createRoute(userId))
            },
            onMatches = { navController.navigate(Screen.ChatList.route) },
            onDiscover = { navController.navigate(Screen.Discover.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onLive = { navController.navigate(Screen.VoiceRooms.route) },
            onWallet = { navController.navigate(Screen.Wallet.route) },
            onSelfProfile = {
                if (currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(currentUserId))
                else navController.navigate(Screen.ProfileSetup.route)
            }
        )
    }

    composable(Screen.GiftLeaderboard.route) {
        GiftLeaderboardScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Wishlist.route) {
        WishlistScreen(
            token = authToken,
            userId = null,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Referral.route) {
        ReferralScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.GroupChats.route) {
        GroupChatScreen(
            token = authToken,
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
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        val messages = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.core.model.GroupMessage>() }
        var messageText by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }

        fun loadMessages() {
            scope.launch {
                runCatching { com.example.yugm.core.api.YugmApi.groupMessages(authToken, groupId) }
                    .onSuccess {
                        messages.clear()
                        messages.addAll(it)
                    }
                    .onFailure { android.widget.Toast.makeText(context, it.message ?: "Failed to load messages", android.widget.Toast.LENGTH_SHORT).show() }
            }
        }

        LaunchedEffect(groupId) { loadMessages() }

        GroupChatDetailScreen(
            messages = messages,
            messageText = messageText,
            onMessageChange = { messageText = it },
            onBack = { navController.popBackStack() },
            onSend = {
                scope.launch {
                    runCatching {
                        com.example.yugm.core.api.YugmApi.sendGroupMessage(
                            token = authToken,
                            groupId = groupId,
                            message = messageText
                        )
                    }.onSuccess {
                        messageText = ""
                        loadMessages()
                    }.onFailure {
                        android.widget.Toast.makeText(context, it.message ?: "Failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    composable(
        route = Screen.StoryViewer.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        StoryViewerScreen(
            token = authToken,
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
            token = authToken,
            roomId = roomId,
            onBack = { navController.popBackStack() },
            onStop = { navController.popBackStack() }
        )
    }

    composable(Screen.ScheduledCalendar.route) {
        ScheduledCalendarScreen(
            token = authToken,
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
            token = authToken,
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
        var recording by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.core.model.RoomRecording?>(null) }
        var recordingError by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
        LaunchedEffect(recordingId) {
            runCatching { com.example.yugm.core.api.YugmApi.recordingDetail(authToken, recordingId) }
                .onSuccess { recording = it }
                .onFailure { recordingError = true; android.widget.Toast.makeText(recordingContext, it.message ?: "Failed to load recording", android.widget.Toast.LENGTH_SHORT).show() }
        }
        when {
            recordingError -> androidx.compose.material3.Text("Failed to load recording", color = com.example.yugm.core.ui.theme.Danger)
            recording != null -> RecordingPlayerScreen(
                recording = recording!!,
                onBack = { navController.popBackStack() }
            )
            else -> com.example.yugm.core.ui.components.LoadingState("Loading recording...")
        }
    }

    composable(Screen.Hosts.route) {
        HostsScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.MoodActivity.route) {
        MoodActivityScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.WaveInbox.route) {
        WaveInboxScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.DailyQuestion.route) {
        DailyQuestionScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.VoicePolls.route) {
        VoicePollScreen(
            token = authToken,
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
            token = authToken,
            userId = currentUserId,
            pollId = pollId,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Countdowns.route) {
        CountdownScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }
}

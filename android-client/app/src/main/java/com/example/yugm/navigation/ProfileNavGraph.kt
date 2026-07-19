package com.example.yugm.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.api.VibeApi
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.MainViewModel
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import kotlinx.coroutines.launch

fun NavGraphBuilder.profileNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
) {
    composable(
        route = Screen.ProfileDetail.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        val profileScope = rememberCoroutineScope()
        val profileContext = androidx.compose.ui.platform.LocalContext.current
        ProfileDetailScreen(
            token = mainViewModel.authToken,
            userId = userId,
            onBack = { navController.popBackStack() },
            onMessage = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onInviteToRoom = { inviteeId ->
                profileScope.launch {
                    val ownLiveRoom = runCatching { com.example.yugm.api.YugmApi.rooms() }.getOrDefault(emptyList())
                        .firstOrNull { it.status.equals("LIVE", ignoreCase = true) && it.host?.id == mainViewModel.currentUserId }
                    if (ownLiveRoom == null) {
                        android.widget.Toast.makeText(profileContext, "Start a room first, then invite ${userId.take(6)}", android.widget.Toast.LENGTH_SHORT).show()
                        navController.navigate(Screen.CreateRoom.route)
                    } else {
                        runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, ownLiveRoom.id, inviteeId) }
                            .onSuccess { android.widget.Toast.makeText(profileContext, "Room invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                            .onFailure { android.widget.Toast.makeText(profileContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            },
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) }
        )
    }

    composable(Screen.ChatList.route) {
        ChatListScreen(
            token = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId,
            onOpenChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onDiscover = { navController.navigate(Screen.Discover.route) },
            onDating = { navController.navigate(Screen.DatingDiscovery.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onWallet = { navController.navigate(Screen.Wallet.route) },
            onProfile = {
                if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                else navController.navigate(Screen.ProfileSetup.route)
            }
        )
    }

    composable(Screen.Matches.route) {
        MatchesScreen(
            token = mainViewModel.authToken,
            onOpenChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onDiscover = { navController.navigate(Screen.Discover.route) },
            onDating = { navController.navigate(Screen.DatingDiscovery.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onWallet = { navController.navigate(Screen.Wallet.route) },
            onProfile = {
                if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                else navController.navigate(Screen.ProfileSetup.route)
            },
            onBack = { navController.popBackStack() }
        )
    }

    composable(
        route = Screen.Chat.route,
        arguments = listOf(navArgument("partnerId") { type = NavType.StringType })
    ) { backStackEntry ->
        val partnerId = backStackEntry.arguments?.getString("partnerId") ?: ""
        val chatViewModel: com.example.yugm.ui.viewmodel.ChatViewModel = hiltViewModel()
        val directGifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
        val chatContext = androidx.compose.ui.platform.LocalContext.current
        val chatScope = androidx.compose.runtime.rememberCoroutineScope()

        LaunchedEffect(partnerId, mainViewModel.authToken, mainViewModel.currentUserId) {
            chatViewModel.connect(
                token = mainViewModel.authToken,
                userId = mainViewModel.currentUserId,
                partnerId = partnerId
            )
            runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                .onSuccess { directGifts.apply { clear(); addAll(it) } }
        }

        ChatScreen(
            partner = chatViewModel.partner,
            currentUserId = mainViewModel.currentUserId,
            messages = chatViewModel.messages,
            relationship = chatViewModel.relationship,
            gifts = directGifts,
            balance = mainViewModel.balance,
            loading = chatViewModel.isLoading,
            isPartnerTyping = chatViewModel.isPartnerTyping,
            error = chatViewModel.error,
            onBack = { navController.popBackStack() },
            onRetry = chatViewModel::refresh,
            onSend = { text ->
                chatScope.launch {
                    chatViewModel.sendMessage(text)
                    runCatching {
                        VibeApi.update(mainViewModel.authToken, "message", partnerId)
                    }.onSuccess { response ->
                        if (response.improved && response.message != null) {
                            android.widget.Toast.makeText(chatContext, response.message, android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            },
            onTyping = { typing -> chatViewModel.sendTypingStatus(typing) },
            onGift = { gift ->
                chatScope.launch {
                    runCatching { com.example.yugm.api.YugmApi.sendDirectGift(mainViewModel.authToken, gift.id, partnerId) }
                        .onSuccess {
                            mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                            chatViewModel.refresh()
                        }
                        .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onReactMessage = { message ->
                chatScope.launch {
                    runCatching { com.example.yugm.api.YugmApi.reactToDirectMessage(mainViewModel.authToken, partnerId, message.id, "heart") }
                        .onSuccess { chatViewModel.refresh() }
                        .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onAudioCall = {
                chatScope.launch {
                    runCatching { com.example.yugm.api.YugmApi.startPrivateCall(mainViewModel.authToken, partnerId, com.example.yugm.model.RoomType.Voice) }
                        .onSuccess { room -> navController.navigate(Screen.VoiceRoom.createRoute(room.id)) }
                        .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onVideoCall = {
                chatScope.launch {
                    runCatching { com.example.yugm.api.YugmApi.startPrivateCall(mainViewModel.authToken, partnerId, com.example.yugm.model.RoomType.Video) }
                        .onSuccess { room -> navController.navigate(Screen.VideoRoom.createRoute(room.id)) }
                        .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onAttachmentSelected = { bytes, mimeType, fileName ->
                chatScope.launch {
                    runCatching {
                        val (url, type) = com.example.yugm.api.YugmApi.uploadMessageMedia(mainViewModel.authToken, bytes, mimeType, fileName)
                        com.example.yugm.api.YugmApi.sendDirectMediaMessage(mainViewModel.authToken, partnerId, url, type)
                    }.onSuccess { chatViewModel.refresh() }
                        .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onReport = { chatScope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, "", partnerId, "Inappropriate private conversation") } } },
            onBlock = { chatScope.launch { runCatching { com.example.yugm.api.YugmApi.blockUser(partnerId, mainViewModel.authToken) }.onSuccess { navController.popBackStack() } } }
        )
    }

    composable(Screen.Friends.route) {
        FriendsScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.Subscriptions.route) {
        SubscriptionsScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.Feed.route) {
        FeedScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenRoom = { roomId -> navController.navigate(Screen.RoomLobby.createRoute(roomId)) },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
            onOpenStory = { userId -> navController.navigate(Screen.StoryViewer.createRoute(userId)) }
        )
    }

    composable(Screen.CreateStory.route) {
        CreateStoryScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(
        route = Screen.HighlightsManagement.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        HighlightsManagementScreen(
            token = mainViewModel.authToken,
            userId = userId,
            onBack = { navController.popBackStack() }
        )
    }

    composable(
        route = Screen.UserWishlist.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        val wishlistContext = androidx.compose.ui.platform.LocalContext.current
        UserWishlistScreen(
            token = mainViewModel.authToken,
            userId = userId,
            onBack = { navController.popBackStack() },
            onSendGift = { itemId ->
                android.widget.Toast.makeText(wishlistContext, "Gift sent!", android.widget.Toast.LENGTH_SHORT).show()
            }
        )
    }
}

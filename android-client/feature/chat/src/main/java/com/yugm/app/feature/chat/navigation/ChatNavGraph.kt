package com.yugm.app.feature.chat.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.compose.ui.platform.LocalContext
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.core.model.RoomType
import com.yugm.app.feature.chat.screens.ChatListScreen
import com.yugm.app.feature.chat.screens.ChatScreen
import com.yugm.app.feature.chat.viewmodel.ChatViewModel

fun NavGraphBuilder.chatNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String
) {
    composable(Screen.ChatList.route) {
        ChatListScreen(
            token = authTokenProvider(),
            currentUserId = currentUserIdProvider(),
            onOpenChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onLive = { navController.navigateTopLevel(Screen.VoiceRooms.route) },
            onWallet = { navController.navigateTopLevel(Screen.Wallet.route) },
            onProfile = {
                if (currentUserIdProvider().isNotBlank()) {
                    navController.navigateTopLevel(Screen.ProfileDetail.createRoute(currentUserIdProvider()))
                } else {
                    navController.navigate(Screen.ProfileSetup.route)
                }
            },
            onOpenClan = { clanId, clanName ->
                navController.navigate(Screen.ClanChat.createRoute(clanId, clanName))
            },
            onJoinClan = { navController.navigate(Screen.ClanList.route) },
            onOpenClanDetail = { clanId ->
                navController.navigate(Screen.ClanDetail.createRoute(clanId))
            }
        )
    }

    composable(
        route = Screen.Chat.route,
        arguments = listOf(navArgument("partnerId") { type = NavType.StringType })
    ) { backStackEntry ->
        val partnerId = backStackEntry.arguments?.getString("partnerId") ?: ""
        val chatViewModel: ChatViewModel = hiltViewModel(backStackEntry)
        val context = LocalContext.current
        LaunchedEffect(authTokenProvider(), currentUserIdProvider(), partnerId) {
            chatViewModel.connect(authTokenProvider(), currentUserIdProvider(), partnerId)
        }
        ChatScreen(
            partner = chatViewModel.partner,
            currentUserId = currentUserIdProvider(),
            myActiveCosmetics = chatViewModel.myActiveCosmetics,
            messages = chatViewModel.messages,
            gifts = chatViewModel.gifts,
            balance = chatViewModel.walletBalance,
            relationship = chatViewModel.relationship,
            loading = chatViewModel.isLoading,
            isPartnerTyping = chatViewModel.isPartnerTyping,
            error = chatViewModel.error,
            isMuted = chatViewModel.isMuted,
            forwardTargets = chatViewModel.forwardTargets,
            searchResults = chatViewModel.searchResults,
            hasMoreHistory = chatViewModel.hasMoreHistory,
            isLoadingMore = chatViewModel.isLoadingMore,
            onLoadOlder = chatViewModel::loadOlderMessages,
            onBack = { navController.popBackStack() },
            onRetry = chatViewModel::refresh,
            onDeleteConversation = { chatViewModel.deleteConversation(onDone = { navController.popBackStack() }) },
            onDeleteSelected = chatViewModel::deleteSelectedMessages,
            onReactMessage = chatViewModel::reactToMessage,
            onReply = chatViewModel::replyMessage,
            onEdit = chatViewModel::editMessage,
            onForward = { message, targetId -> chatViewModel.forwardMessage(message, targetId) },
            onSearch = chatViewModel::search,
            onMute = chatViewModel::mute,
            onSend = chatViewModel::sendMessage,
            onGift = chatViewModel::sendGift,
            onAttachmentSelected = chatViewModel::sendAttachment,
            onTyping = chatViewModel::sendTypingStatus,
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
            onAudioCall = {
                chatViewModel.startPrivateCall(RoomType.Voice, onSuccess = { room ->
                    navController.navigate(Screen.VoiceRoom.createRoute(room.id))
                }, onFailure = { message ->
                    android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                })
            },
            onVideoCall = {
                chatViewModel.startPrivateCall(RoomType.Video, onSuccess = { room ->
                    navController.navigate(Screen.VideoRoom.createRoute(room.id))
                }, onFailure = { message ->
                    android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                })
            },
        )
    }
}

package com.yugm.app.feature.chat.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.compose.ui.platform.LocalContext
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.model.RoomType
import com.yugm.app.feature.chat.screens.ChatScreen
import com.yugm.app.feature.chat.viewmodel.ChatViewModel

fun NavGraphBuilder.chatNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String
) {
    composable(Screen.ChatList.route) {
        LaunchedEffect(Unit) {
            navController.navigate(Screen.MainTabs.createRoute("chat")) {
                popUpTo(Screen.ChatList.route) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    composable(
        route = Screen.Chat.route,
        arguments = listOf(navArgument("partnerId") { type = NavType.StringType }, navArgument("call") { type = NavType.StringType; defaultValue = "" })
    ) { backStackEntry ->
        val partnerId = backStackEntry.arguments?.getString("partnerId") ?: ""
        val chatViewModel: ChatViewModel = hiltViewModel(backStackEntry)
        val context = LocalContext.current
        var callOpened by rememberSaveable { mutableStateOf(false) }
        val call = backStackEntry.arguments?.getString("call").orEmpty()
        val isReady = chatViewModel.partner?.id == partnerId && !chatViewModel.isLoading
        LaunchedEffect(call, isReady) {
            if (!callOpened && call in listOf("VOICE", "VIDEO") && isReady) {
                callOpened = true
                val type = if (call == "VIDEO") RoomType.Video else RoomType.Voice
                chatViewModel.startPrivateCall(type, onSuccess = { room ->
                    navController.navigate(if (type == RoomType.Video) Screen.VideoRoom.createRoute(room.id) else Screen.VoiceRoom.createRoute(room.id))
                }, onFailure = { message ->
                    android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                })
            }
        }
        LaunchedEffect(authTokenProvider(), currentUserIdProvider(), partnerId) {
            chatViewModel.connect(authTokenProvider(), currentUserIdProvider(), partnerId)
        }
        com.yugm.app.core.ui.components.AutomaticSyncEffect(authTokenProvider(), currentUserIdProvider(), partnerId,
            topics = setOf(com.yugm.app.core.api.SyncTopic.CHAT), enabled = authTokenProvider().isNotBlank(), isBusy = { chatViewModel.isLoading }) {
            chatViewModel.refresh()
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
            isSending = chatViewModel.isSending,
            isUploadingAttachment = chatViewModel.isUploadingAttachment,
            sendingMessageIds = chatViewModel.sendingMessageIds.toSet(),
            failedMessageIds = chatViewModel.failedMessageIds.toSet(),
            isPartnerTyping = chatViewModel.isPartnerTyping,
            startingCallType = chatViewModel.startingCallType,
            error = chatViewModel.error,
            isMuted = chatViewModel.isMuted,
            isBlockedByMe = chatViewModel.isBlockedByMe,
            isMatched = chatViewModel.isMatched,
            onReport = { category ->
                chatViewModel.reportConversation(
                    category = category,
                    onSuccess = {
                        android.widget.Toast.makeText(
                            context,
                            "Report submitted. Thanks for helping keep Yugm safe.",
                            android.widget.Toast.LENGTH_LONG
                        ).show()
                    },
                    onFailure = { message ->
                        android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                    }
                )
            },
            forwardTargets = chatViewModel.forwardTargets,
            searchResults = chatViewModel.searchResults,
            hasMoreHistory = chatViewModel.hasMoreHistory,
            isLoadingMore = chatViewModel.isLoadingMore,
            hasMoreSearchResults = chatViewModel.hasMoreSearchResults,
            isLoadingMoreSearch = chatViewModel.isLoadingMoreSearch,
            reactionCatalog = chatViewModel.reactionCatalog,
            isReactionCatalogLoading = chatViewModel.isReactionCatalogLoading,
            reactionCatalogError = chatViewModel.reactionCatalogError,
            onReloadReactions = chatViewModel::reloadReactionCatalog,
            onLoadOlder = chatViewModel::loadOlderMessages,
            onBack = { navController.popBackStack() },
            onRetry = chatViewModel::refresh,
            onDeleteConversation = { chatViewModel.deleteConversation(onDone = { navController.popBackStack() }) },
            onDeleteSelected = chatViewModel::deleteSelectedMessages,
            onReactMessage = { message, type -> chatViewModel.reactToMessage(message, type) },
            onReply = { text, message, onSuccess, onFailure -> chatViewModel.replyMessage(text, message, onSuccess, onFailure) },
            onEdit = { message, text, onSuccess, onFailure -> chatViewModel.editMessage(message, text, onSuccess, onFailure) },
            onForward = { message, targetIds, onSuccess, onFailure -> chatViewModel.forwardMessage(message, targetIds, onSuccess, onFailure) },
            onSearch = chatViewModel::search,
            onLoadMoreSearch = chatViewModel::loadMoreSearchResults,
            onEnsureForwardTargets = chatViewModel::ensureForwardTargetsLoaded,
            onMute = chatViewModel::mute,
            onToggleBlock = chatViewModel::toggleBlock,
            onSend = { text, onSuccess, onFailure -> chatViewModel.sendMessage(text, onSuccess, onFailure) },
            onRetrySend = chatViewModel::retrySend,
            onGift = chatViewModel::sendGift,
            onAttachmentSelected = chatViewModel::sendAttachment,
            onTyping = chatViewModel::sendTypingStatus,
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
            onOpenBonds = { userId -> navController.navigate(Screen.Bonds.createRoute(userId)) },
            isCurrentUserVip = chatViewModel.isCurrentUserVip,
            onOpenVip = { navController.navigate(Screen.Vip.route) },
            onOpenRoom = { roomId -> navController.navigate(Screen.RoomLobby.createRoute(roomId)) },
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

package com.yugm.app.feature.chat.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.feature.chat.screens.ChatListScreen
import com.yugm.app.feature.chat.screens.ChatScreen
import com.yugm.app.feature.chat.viewmodel.ChatViewModel

fun NavGraphBuilder.chatNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String
) {
    composable(Screen.ChatList.route) {
        ChatListScreen(
            token = authToken,
            currentUserId = currentUserId,
            onOpenChat = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onLive = { navController.navigateTopLevel(Screen.VoiceRooms.route) },
            onWallet = { navController.navigateTopLevel(Screen.Wallet.route) },
            onProfile = {
                if (currentUserId.isNotBlank()) {
                    navController.navigateTopLevel(Screen.ProfileDetail.createRoute(currentUserId))
                } else {
                    navController.navigate(Screen.ProfileSetup.route)
                }
            }
        )
    }

    composable(
        route = Screen.Chat.route,
        arguments = listOf(navArgument("partnerId") { type = NavType.StringType })
    ) { backStackEntry ->
        val partnerId = backStackEntry.arguments?.getString("partnerId") ?: ""
        val chatViewModel: ChatViewModel = hiltViewModel(backStackEntry)
        LaunchedEffect(authToken, currentUserId, partnerId) {
            chatViewModel.connect(authToken, currentUserId, partnerId)
        }
        ChatScreen(
            partner = chatViewModel.partner,
            currentUserId = currentUserId,
            myActiveCosmetics = chatViewModel.myActiveCosmetics,
            messages = chatViewModel.messages,
            relationship = chatViewModel.relationship,
            loading = chatViewModel.isLoading,
            isPartnerTyping = chatViewModel.isPartnerTyping,
            error = chatViewModel.error,
            onBack = { navController.popBackStack() },
            onRetry = chatViewModel::refresh,
            onSend = chatViewModel::sendMessage,
            onTyping = chatViewModel::sendTypingStatus,
        )
    }
}

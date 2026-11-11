package com.example.yugm.feature.chat.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.core.navigation.Screen
import com.example.yugm.core.navigation.navigateTopLevel
import com.example.yugm.feature.chat.screens.ChatListScreen
import com.example.yugm.feature.chat.screens.ChatScreen

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
            onDating = { navController.navigateTopLevel(Screen.DatingDiscovery.route) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onLive = { navController.navigateTopLevel(Screen.Discover.route) },
            onWallet = { navController.navigateTopLevel(Screen.Wallet.route) },
            onProfile = {
                if (currentUserId.isNotBlank()) {
                    navController.navigate(Screen.ProfileDetail.createRoute(currentUserId))
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
        ChatScreen(
            partner = com.example.yugm.core.model.Host(id = partnerId, name = "Match Partner"),
            currentUserId = currentUserId,
            messages = emptyList(),
            relationship = null,
            onBack = { navController.popBackStack() }
        )
    }
}

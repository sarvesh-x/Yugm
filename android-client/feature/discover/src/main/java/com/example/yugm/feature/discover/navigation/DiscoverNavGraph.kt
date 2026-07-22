package com.example.yugm.feature.discover.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.discover.screens.DiscoverScreen
import com.example.yugm.feature.discover.screens.SearchScreen

fun NavGraphBuilder.discoverNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
) {
    composable(Screen.Discover.route) {
        DiscoverScreen(
            token = authToken,
            onOpenRoom = { room ->
                navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
            },
            onOpenProfile = { userId ->
                navController.navigate(Screen.ProfileDetail.createRoute(userId))
            },
            onCreateRoom = {
                navController.navigate(Screen.CreateRoom.route)
            },
            onNotifications = {
                navController.navigate(Screen.Notifications.route)
            },
            onGrowth = {
                navController.navigate(Screen.Growth.route)
            },
            onSearch = {
                navController.navigate(Screen.Search.route)
            },
            onGames = {
                navController.navigate(Screen.Games.route)
            },
            onDating = {
                navController.navigate(Screen.DatingDiscovery.route)
            },
            onChat = {
                navController.navigate(Screen.ChatList.route)
            },
            onWallet = {
                navController.navigate(Screen.Wallet.route)
            },
            onSelfProfile = {
                if (currentUserId.isNotBlank()) {
                    navController.navigate(Screen.ProfileDetail.createRoute(currentUserId))
                } else {
                    navController.navigate(Screen.ProfileSetup.route)
                }
            },
            onVoiceRooms = {
                navController.navigate(Screen.VoiceRooms.route)
            }
        )
    }

    composable(Screen.Search.route) {
        SearchScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onOpenRoom = { room ->
                navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
            },
            onOpenProfile = { userId ->
                navController.navigate(Screen.ProfileDetail.createRoute(userId))
            }
        )
    }


}

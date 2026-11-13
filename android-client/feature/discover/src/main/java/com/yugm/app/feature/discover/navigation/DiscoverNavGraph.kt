package com.yugm.app.feature.discover.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.feature.discover.screens.DiscoverScreen
import com.yugm.app.feature.discover.screens.SearchScreen

fun NavGraphBuilder.discoverNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String,
) {
    composable(Screen.Discover.route) {
        DiscoverScreen(
            token = authTokenProvider(),
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
            onEvents = {
                navController.navigate(Screen.Events.route)
            },
            onDating = {
                navController.navigateTopLevel(Screen.DatingDiscovery.route)
            },
            onChat = {
                navController.navigateTopLevel(Screen.ChatList.route)
            },
            onWallet = {
                navController.navigateTopLevel(Screen.Wallet.route)
            },
            onSelfProfile = {
                if (currentUserIdProvider().isNotBlank()) {
                    navController.navigateTopLevel(Screen.ProfileDetail.createRoute(currentUserIdProvider()))
                } else {
                    navController.navigate(Screen.ProfileSetup.route)
                }
            },
            onVoiceRooms = {
                navController.navigateTopLevel(Screen.VoiceRooms.route)
            },
            onJoinParty = { room ->
                val route = if (room.type == com.yugm.app.core.model.RoomType.Video) {
                    Screen.VideoRoom.createRoute(room.id)
                } else {
                    Screen.VoiceRoom.createRoute(room.id)
                }
                navController.navigate(route)
            },
            onOpenMatchedCall = { room ->
                navController.navigate(Screen.VoiceRoom.createRoute(room.id))
            },
            onVibeGraph = {
                navController.navigate(Screen.VibeGraph.route)
            },
            onCreatorDashboard = {
                navController.navigate(Screen.CreatorDashboard.route)
            }
        )
    }

    composable(Screen.Search.route) {
        SearchScreen(
            token = authTokenProvider(),
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

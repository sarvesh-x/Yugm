package com.example.yugm.navigation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.MainViewModel
import kotlinx.coroutines.launch

fun NavGraphBuilder.discoverNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
) {
    composable(Screen.Discover.route) {
        DiscoverScreen(
            token = mainViewModel.authToken,
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
                if (mainViewModel.currentUserId.isNotBlank()) {
                    navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                } else {
                    navController.navigate(Screen.ProfileSetup.route)
                }
            },
            onVoiceRooms = {
                navController.navigate(Screen.VoiceRooms.route)
            }
        )
    }

    composable(Screen.VoiceRooms.route) {
        VoiceRoomsScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onSearch = { navController.navigate(Screen.Search.route) },
            onNotifications = { navController.navigate(Screen.Notifications.route) },
            onDiscover = { navController.navigate(Screen.Discover.route) },
            onDating = { navController.navigate(Screen.DatingDiscovery.route) },
            onChat = { navController.navigate(Screen.ChatList.route) },
            onWallet = { navController.navigate(Screen.Wallet.route) },
            onProfile = {
                if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                else navController.navigate(Screen.ProfileSetup.route)
            }
        )
    }

    composable(Screen.Search.route) {
        SearchScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenRoom = { room ->
                navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
            },
            onOpenProfile = { userId ->
                navController.navigate(Screen.ProfileDetail.createRoute(userId))
            }
        )
    }

    composable(Screen.Notifications.route) {
        NotificationsScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenTarget = { item ->
                when (val target = notificationTarget(item)) {
                    is NotificationTarget.Room -> navController.navigate(Screen.RoomLobby.createRoute(target.roomId))
                    is NotificationTarget.Chat -> navController.navigate(Screen.Chat.createRoute(target.partnerId))
                    is NotificationTarget.Profile -> navController.navigate(Screen.ProfileDetail.createRoute(target.userId))
                    NotificationTarget.Wallet -> navController.navigate(Screen.Wallet.route)
                    NotificationTarget.Safety -> navController.navigate(Screen.Safety.route)
                    NotificationTarget.Growth -> navController.navigate(Screen.Growth.route)
                    NotificationTarget.Home -> navController.navigate(Screen.Discover.route)
                }
            }
        )
    }

    composable(Screen.Growth.route) {
        GrowthScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onPayoutVerification = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
            onWithdraw = { navController.navigate(Screen.WithdrawalEligibility.route) },
            onOpenRoom = { room ->
                navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
            }
        )
    }

    composable(Screen.Games.route) {
        GamesScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onOpenChat = { userId -> navController.navigate(Screen.Chat.createRoute(userId)) }
        )
    }
}

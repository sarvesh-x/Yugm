package com.example.yugm.feature.roommodes.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.roommodes.screens.RoomModeHostScreen

fun NavGraphBuilder.roomModesNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
) {
    composable(
        route = Screen.RoomMode.route,
        arguments = listOf(
            navArgument("roomId") { type = NavType.StringType },
            navArgument("isHost") { type = NavType.BoolType; defaultValue = false }
        )
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val isHost = backStackEntry.arguments?.getBoolean("isHost") ?: false
        RoomModeHostScreen(
            token = authToken,
            roomId = roomId,
            currentUserId = currentUserId,
            isHost = isHost,
            onBack = { navController.popBackStack() },
            onJoinRoom = {
                navController.navigate(Screen.RoomLobby.createRoute(roomId)) {
                    popUpTo(Screen.RoomMode.route) { inclusive = true }
                }
            }
        )
    }
}

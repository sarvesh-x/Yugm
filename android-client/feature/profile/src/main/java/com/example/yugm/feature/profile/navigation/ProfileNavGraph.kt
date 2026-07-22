package com.example.yugm.feature.profile.navigation

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
import com.example.yugm.feature.profile.screens.CosmeticsStoreScreen
import com.example.yugm.feature.profile.screens.HighlightsManagementScreen
import com.example.yugm.feature.profile.screens.ProfileDetailScreen
import kotlinx.coroutines.launch

fun NavGraphBuilder.profileNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
) {
    composable(
        route = Screen.ProfileDetail.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        val profileScope = rememberCoroutineScope()
        val profileContext = androidx.compose.ui.platform.LocalContext.current
        ProfileDetailScreen(
            token = authToken,
            userId = userId,
            onBack = { navController.popBackStack() },
            onMessage = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onInviteToRoom = { inviteeId ->
                profileScope.launch {
                    val ownLiveRoom = runCatching { com.example.yugm.core.api.YugmApi.rooms() }.getOrDefault(emptyList())
                        .firstOrNull { it.status.equals("LIVE", ignoreCase = true) && it.host?.id == currentUserId }
                    if (ownLiveRoom == null) {
                        android.widget.Toast.makeText(profileContext, "Start a room first, then invite ${userId.take(6)}", android.widget.Toast.LENGTH_SHORT).show()
                        navController.navigate(Screen.CreateRoom.route)
                    } else {
                        runCatching { com.example.yugm.core.api.YugmApi.inviteToRoom(authToken, ownLiveRoom.id, inviteeId) }
                            .onSuccess { android.widget.Toast.makeText(profileContext, "Room invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                            .onFailure { android.widget.Toast.makeText(profileContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            },
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) }
        )
    }

    composable(Screen.Cosmetics.route) {
        CosmeticsStoreScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(
        route = Screen.HighlightsManagement.route,
        arguments = listOf(navArgument("userId") { type = NavType.StringType })
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId") ?: ""
        HighlightsManagementScreen(
            token = authToken,
            userId = userId,
            onBack = { navController.popBackStack() }
        )
    }

}

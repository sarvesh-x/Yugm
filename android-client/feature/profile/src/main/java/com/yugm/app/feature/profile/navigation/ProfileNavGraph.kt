package com.yugm.app.feature.profile.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.feature.profile.screens.CosmeticsStoreScreen
import com.yugm.app.feature.profile.screens.HighlightsManagementScreen
import com.yugm.app.feature.profile.screens.ProfileDetailScreen
import com.yugm.app.feature.profile.screens.ProfileSocialListScreen
import kotlinx.coroutines.launch

fun NavGraphBuilder.profileNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
    onProfileUpdated: (com.yugm.app.core.model.YugmUser) -> Unit,
    onLogout: () -> Unit,
    onSettings: () -> Unit = {},
) {
    val onProfileBack: () -> Unit = {
        if (!navController.popBackStack()) {
            navController.navigateTopLevel(Screen.Discover.route)
        }
    }
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
            onBack = onProfileBack,
            onMessage = { partnerId ->
                navController.navigate(Screen.Chat.createRoute(partnerId))
            },
            onInviteToRoom = { inviteeId ->
                profileScope.launch {
                    val ownLiveRoom = runCatching { com.yugm.app.core.api.YugmApi.rooms() }.getOrDefault(emptyList())
                        .firstOrNull { it.status.equals("LIVE", ignoreCase = true) && it.host?.id == currentUserId }
                    if (ownLiveRoom == null) {
                        android.widget.Toast.makeText(profileContext, "Start a room first, then invite ${userId.take(6)}", android.widget.Toast.LENGTH_SHORT).show()
                        navController.navigate(Screen.CreateRoom.route)
                    } else {
                        runCatching { com.yugm.app.core.api.YugmApi.inviteToRoom(authToken, ownLiveRoom.id, inviteeId) }
                            .onSuccess { android.widget.Toast.makeText(profileContext, "Room invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                            .onFailure { android.widget.Toast.makeText(profileContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            },
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) },
            isOwnProfile = userId == currentUserId,
            onOpenSocialList = { list -> navController.navigate(Screen.ProfileSocial.createRoute(userId, list)) },
            onProfileUpdated = onProfileUpdated,
            onLogout = onLogout,
            onSettings = onSettings,
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onParty = { navController.navigateTopLevel(Screen.VoiceRooms.route) },
            onChatTab = { navController.navigateTopLevel(Screen.ChatList.route) }
        )
    }

    composable(
        route = Screen.ProfileSocial.route,
        arguments = listOf(
            navArgument("userId") { type = NavType.StringType },
            navArgument("list") { type = NavType.StringType }
        )
    ) { backStackEntry ->
        val userId = backStackEntry.arguments?.getString("userId").orEmpty()
        val list = backStackEntry.arguments?.getString("list").orEmpty()
        ProfileSocialListScreen(
            token = authToken,
            userId = userId,
            initialList = list,
            isOwnProfile = userId == currentUserId,
            onBack = onProfileBack,
            onOpenProfile = { targetId -> navController.navigate(Screen.ProfileDetail.createRoute(targetId)) }
        )
    }

    composable(Screen.Cosmetics.route) {
        CosmeticsStoreScreen(
            token = authToken,
            onBack = onProfileBack
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
            onBack = onProfileBack
        )
    }

}

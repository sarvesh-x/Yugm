package com.yugm.app.feature.discover.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.discover.screens.SearchScreen

fun NavGraphBuilder.discoverNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String,
) {
    composable(Screen.Discover.route) {
        LaunchedEffect(Unit) {
            navController.navigate(Screen.MainTabs.createRoute("discover")) {
                popUpTo(Screen.Discover.route) { inclusive = true }
                launchSingleTop = true
            }
        }
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

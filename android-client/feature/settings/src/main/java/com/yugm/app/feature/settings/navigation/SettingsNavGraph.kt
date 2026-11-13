package com.yugm.app.feature.settings.navigation

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
import com.yugm.app.feature.settings.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.settingsNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String,
    userNameProvider: () -> String,
    usernameProvider: () -> String,
    onLogout: () -> Unit,
) {
    composable(Screen.Safety.route) {
        SafetyScreen(
            token = authTokenProvider(),
            onNavigateToBlocked = { navController.navigate(Screen.BlockedUsers.route) },
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.BlockedUsers.route) {
        BlockedUsersScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Settings.route) {
        SettingsScreen(
            token = authTokenProvider(),
            userName = userNameProvider(),
            username = usernameProvider(),
            onLogout = {
                onLogout()
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            },
            onBack = { navController.popBackStack() },
            onNavigateToSafety = { navController.navigate(Screen.Safety.route) },
            onNavigateToSupport = { navController.navigate(Screen.Support.route) },
            onNavigateToProfileSetup = { navController.navigate(Screen.ProfileDetail.createRoute(currentUserIdProvider())) },
            onNavigateToGames = { navController.navigate(Screen.Games.route) },
            onNavigateToClans = { navController.navigate(Screen.ClanList.route) },
            onNavigateToTrustVerification = { navController.navigate(Screen.TrustVerificationIntro.route) }
        )
    }

    composable(Screen.Support.route) {
        SupportScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onTicketClick = { ticketId -> navController.navigate(Screen.TicketDetail.createRoute(ticketId)) }
        )
    }

    composable(
        route = Screen.TicketDetail.route,
        arguments = listOf(navArgument("ticketId") { type = NavType.StringType })
    ) { backStackEntry ->
        val ticketId = backStackEntry.arguments?.getString("ticketId") ?: ""
        TicketDetailScreen(
            token = authTokenProvider(),
            ticketId = ticketId,
            onBack = { navController.popBackStack() }
        )
    }


}

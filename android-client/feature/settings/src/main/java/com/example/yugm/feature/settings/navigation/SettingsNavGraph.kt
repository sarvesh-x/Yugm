package com.example.yugm.feature.settings.navigation

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
import com.example.yugm.feature.settings.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.settingsNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
    userName: String,
    username: String,
    onLogout: () -> Unit,
) {
    composable(Screen.Safety.route) {
        SafetyScreen(
            token = authToken,
            onNavigateToBlocked = { navController.navigate(Screen.BlockedUsers.route) },
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.BlockedUsers.route) {
        BlockedUsersScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Settings.route) {
        SettingsScreen(
            token = authToken,
            userName = userName,
            username = username,
            onLogout = {
                onLogout()
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            },
            onBack = { navController.popBackStack() },
            onNavigateToSafety = { navController.navigate(Screen.Safety.route) },
            onNavigateToSupport = { navController.navigate(Screen.Support.route) },
            onNavigateToProfileSetup = { navController.navigate(Screen.ProfileSetup.route) },
            onNavigateToGames = { navController.navigate(Screen.Games.route) },
            onNavigateToClans = { navController.navigate(Screen.ClanList.route) },
            onNavigateToTrustVerification = { navController.navigate(Screen.TrustVerificationIntro.route) }
        )
    }

    composable(Screen.Support.route) {
        SupportScreen(
            token = authToken,
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
            token = authToken,
            ticketId = ticketId,
            onBack = { navController.popBackStack() }
        )
    }


}

package com.example.yugm.feature.moderation.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.moderation.screens.AppealScreen
import com.example.yugm.feature.moderation.screens.ModerationStatusScreen
import com.example.yugm.feature.moderation.screens.ReportScreen

fun NavGraphBuilder.moderationNavGraph(
    navController: NavHostController,
    authToken: String,
) {
    composable(route = Screen.ModerationStatus.route) {
        ModerationStatusScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onNavigateToReport = { navController.navigate(Screen.ModerationReport.route) },
            onNavigateToAppeal = { navController.navigate(Screen.ModerationAppeal.route) },
        )
    }

    composable(route = Screen.ModerationReport.route) {
        ReportScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
        )
    }

    composable(route = Screen.ModerationAppeal.route) {
        AppealScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
        )
    }
}

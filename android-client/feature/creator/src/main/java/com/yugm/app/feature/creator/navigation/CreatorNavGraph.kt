package com.yugm.app.feature.creator.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.creator.screens.CreatorDashboardScreen

fun NavGraphBuilder.creatorNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String
) {
    composable(Screen.CreatorDashboard.route) {
        CreatorDashboardScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onWithdrawal = { navController.navigate(Screen.WithdrawalEligibility.route) },
            onKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) }
        )
    }
}

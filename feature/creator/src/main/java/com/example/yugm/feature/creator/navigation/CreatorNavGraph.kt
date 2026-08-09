package com.example.yugm.feature.creator.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.creator.screens.CreatorDashboardScreen

fun NavGraphBuilder.creatorNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String
) {
    composable(Screen.CreatorDashboard.route) {
        CreatorDashboardScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onWithdrawal = { navController.navigate(Screen.WithdrawalEligibility.route) },
            onKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) }
        )
    }
}

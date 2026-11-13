package com.yugm.app.feature.missions.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.missions.screens.BattlePassScreen
import com.yugm.app.feature.missions.screens.MissionsScreen

fun NavGraphBuilder.missionsNavGraph(
    navController: NavHostController,
    authToken: String
) {
    composable(route = Screen.Missions.route) {
        MissionsScreen(
            token = authToken,
            onBack = { navController.popBackStack() },
            onBattlePass = { navController.navigate(Screen.BattlePass.route) }
        )
    }

    composable(route = Screen.BattlePass.route) {
        BattlePassScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }
}

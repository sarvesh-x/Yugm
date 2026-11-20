package com.yugm.app.feature.gift.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.gift.screens.GiftCatalogScreen
import com.yugm.app.feature.gift.screens.InventoryScreen

fun NavGraphBuilder.giftNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String
) {
    composable(route = Screen.GiftCatalog.route) {
        GiftCatalogScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }

    composable(route = Screen.Inventory.route) {
        InventoryScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() }
        )
    }
}

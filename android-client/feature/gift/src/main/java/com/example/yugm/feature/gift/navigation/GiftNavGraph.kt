package com.example.yugm.feature.gift.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.gift.screens.GiftCatalogScreen
import com.example.yugm.feature.gift.screens.InventoryScreen

fun NavGraphBuilder.giftNavGraph(
    navController: NavHostController,
    authToken: String
) {
    composable(route = Screen.GiftCatalog.route) {
        GiftCatalogScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(route = Screen.Inventory.route) {
        InventoryScreen(
            token = authToken,
            onBack = { navController.popBackStack() }
        )
    }
}

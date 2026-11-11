package com.example.yugm.core.navigation

import androidx.navigation.NavHostController

/** Keeps bottom navigation on a single back stack instead of adding a copy on every tap. */
fun NavHostController.navigateTopLevel(route: String) {
    if (currentDestination?.route == route) return

    navigate(route) {
        popUpTo(Screen.Discover.route) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

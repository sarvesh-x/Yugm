package com.yugm.app.core.navigation

import androidx.navigation.NavHostController

/** Keeps tab switches in one ordered back stack so Back follows the user's tab sequence. */
fun NavHostController.navigateTopLevel(route: String) {
    val currentEntry = currentBackStackEntry
    val destinationRoute = currentEntry?.destination?.route
    val isProfileDestination = destinationRoute == Screen.ProfileDetail.route && route.startsWith("profile_detail/")
    val alreadySelected = if (isProfileDestination) {
        currentEntry?.arguments?.getString("userId") == route.substringAfter("profile_detail/")
    } else {
        destinationRoute == route
    }
    if (alreadySelected) return

    // Return to an existing tab in the current history when possible; otherwise add
    // it after the current screen. This gives Back a predictable tab-by-tab order.
    if (popBackStack(route, inclusive = false)) return
    navigate(route) { launchSingleTop = true }
}

package com.yugm.app.core.navigation

import androidx.navigation.NavHostController

/** Keeps tab switches in one ordered back stack so Back follows the user's tab sequence. */
fun NavHostController.navigateTopLevel(route: String) {
    val requestedTab = TopLevelNavigationTargets.mainTabFor(route)
    val targetRoute = TopLevelNavigationTargets.targetRoute(route)
    val currentEntry = currentBackStackEntry
    val destinationRoute = currentEntry?.destination?.route

    if (requestedTab != null) {
        if (destinationRoute == Screen.MainTabs.route) {
            // The route argument is only the *initial* tab; the pager owns the live selection.
            // Always request the tab and let the host no-op when it is already selected, so a
            // stale route argument can never swallow a tab switch.
            currentEntry?.savedStateHandle?.set("tab_request", requestedTab)
            return
        }
        // Return to the existing main-tabs entry instead of stacking a duplicate one.
        if (popBackStack(Screen.MainTabs.route, inclusive = false)) return
        navigate(targetRoute) { launchSingleTop = true }
        return
    }

    // Secondary destinations: no-op when already current, else reveal the existing entry.
    if (destinationRoute == targetRoute) return
    if (popBackStack(targetRoute, inclusive = false)) return
    navigate(targetRoute) { launchSingleTop = true }
}

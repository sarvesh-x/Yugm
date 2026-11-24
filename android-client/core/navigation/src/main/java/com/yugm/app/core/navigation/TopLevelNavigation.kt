package com.yugm.app.core.navigation

import androidx.navigation.NavHostController

/** Reuses the main-tabs entry for explicit root navigation. */
fun NavHostController.navigateTopLevel(route: String) {
    val requestedTab = TopLevelNavigationTargets.mainTabFor(route)
    val targetRoute = TopLevelNavigationTargets.targetRoute(route)
    val currentEntry = currentBackStackEntry
    val destinationRoute = currentEntry?.destination?.route

    if (requestedTab != null) {
        if (destinationRoute == Screen.MainTabs.route || popBackStack(Screen.MainTabs.route, inclusive = false)) {
            // The route argument is only the *initial* tab; the pager owns the live selection.
            // Always request the tab and let the host no-op when it is already selected, so a
            // stale route argument can never swallow a tab switch.
            currentBackStackEntry?.savedStateHandle?.set(MainTabsRoutes.TAB_REQUEST_KEY, requestedTab)
            return
        }
        navigate(targetRoute) { launchSingleTop = true }
        return
    }

    // Secondary destinations: no-op when already current, else reveal the existing entry.
    if (destinationRoute == targetRoute) return
    if (popBackStack(targetRoute, inclusive = false)) return
    navigate(targetRoute) { launchSingleTop = true }
}

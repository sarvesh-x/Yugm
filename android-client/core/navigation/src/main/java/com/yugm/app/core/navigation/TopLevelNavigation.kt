package com.yugm.app.core.navigation

import androidx.navigation.NavHostController

/** Keeps tab switches in one ordered back stack so Back follows the user's tab sequence. */
fun NavHostController.navigateTopLevel(route: String) {
    val targetRoute = when {
        route == Screen.Discover.route -> Screen.MainTabs.createRoute("discover")
        route == Screen.VoiceRooms.route -> Screen.MainTabs.createRoute("party")
        route == Screen.ChatList.route -> Screen.MainTabs.createRoute("chat")
        route == Screen.Games.route -> Screen.MainTabs.createRoute("game_zone")
        route.startsWith("profile_detail/") -> {
            val userId = route.substringAfter("profile_detail/").substringBefore("?")
            val currentUserId = currentBackStackEntry?.arguments?.getString("currentUserId")
            // If caller encoded a self-profile tab route via special marker, handle below; otherwise keep as-is.
            route
        }
        else -> route
    }

    // Self-profile tab convenience: callers can navigate to profile_detail/<id>?tab=self (or plain id match handled by caller)
    // but to avoid guessing current user here, only explicit main tab routes are remapped above.

    val currentEntry = currentBackStackEntry
    val destinationRoute = currentEntry?.destination?.route
    val isMainTabs = destinationRoute == Screen.MainTabs.route && targetRoute.startsWith("main_tabs")
    val isProfileDestination = destinationRoute == Screen.ProfileDetail.route && targetRoute.startsWith("profile_detail/")
    val alreadySelected = when {
        isMainTabs -> currentEntry?.arguments?.getString("tab") == targetRoute.substringAfter("tab=", "discover")
        isProfileDestination -> currentEntry?.arguments?.getString("userId") == targetRoute.substringAfter("profile_detail/").substringBefore("?")
        else -> destinationRoute == targetRoute
    }
    if (alreadySelected) return

    // Return to an existing destination in the current history when possible; otherwise add it.
    if (popBackStack(targetRoute, inclusive = false)) return
    navigate(targetRoute) { launchSingleTop = true }
}

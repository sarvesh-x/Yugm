package com.yugm.app.core.navigation

/**
 * Pure mapping used by [navigateTopLevel], kept separate so the route conventions can be
 * regression-tested without a live `NavController`.
 *
 * Only the four legacy top-level routes are remapped to the main tabs host. Everything else
 * (secondary, detail, editing, immersive and auth destinations) is passed through unchanged;
 * there is deliberately no prefix matching, so a route such as `profile_detail/{userId}` can
 * never be treated as the Profile root.
 */
object TopLevelNavigationTargets {
    /** The main-tabs tab id for a legacy top-level route, or null when [route] is not a root. */
    fun mainTabFor(route: String): String? = when (route) {
        Screen.Discover.route -> MainTabsRoutes.DISCOVER
        Screen.VoiceRooms.route -> MainTabsRoutes.PARTY
        Screen.ChatList.route -> MainTabsRoutes.CHAT
        Screen.Games.route -> MainTabsRoutes.GAME_ZONE
        else -> null
    }

    /** The destination to navigate to for a top-level request. */
    fun targetRoute(route: String): String =
        mainTabFor(route)?.let { Screen.MainTabs.createRoute(it) } ?: route
}

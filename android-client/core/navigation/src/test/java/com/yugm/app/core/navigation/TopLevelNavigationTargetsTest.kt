package com.yugm.app.core.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression coverage for the top-level route conventions: only the four legacy root routes
 * are remapped to [Screen.MainTabs], and no secondary route is ever matched by prefix.
 */
class TopLevelNavigationTargetsTest {
    @Test
    fun legacyRootsMapToTheirMainTabsDestination() {
        assertEquals(MainTabsRoutes.DISCOVER, TopLevelNavigationTargets.mainTabFor(Screen.Discover.route))
        assertEquals(MainTabsRoutes.PARTY, TopLevelNavigationTargets.mainTabFor(Screen.VoiceRooms.route))
        assertEquals(MainTabsRoutes.CHAT, TopLevelNavigationTargets.mainTabFor(Screen.ChatList.route))
        assertEquals(MainTabsRoutes.GAME_ZONE, TopLevelNavigationTargets.mainTabFor(Screen.Games.route))
    }

    @Test
    fun legacyRootsResolveToMainTabsRoutes() {
        assertEquals(Screen.MainTabs.createRoute(MainTabsRoutes.DISCOVER), TopLevelNavigationTargets.targetRoute("discover"))
        assertEquals(Screen.MainTabs.createRoute(MainTabsRoutes.PARTY), TopLevelNavigationTargets.targetRoute("voice_rooms"))
        assertEquals(Screen.MainTabs.createRoute(MainTabsRoutes.CHAT), TopLevelNavigationTargets.targetRoute("chat_list"))
        assertEquals(Screen.MainTabs.createRoute(MainTabsRoutes.GAME_ZONE), TopLevelNavigationTargets.targetRoute("games"))
    }

    @Test
    fun secondaryRoutesPassThroughUnchanged() {
        val secondary = listOf(
            Screen.ProfileDetail.route,
            Screen.CustomizeProfile.route,
            Screen.Chat.route,
            Screen.Settings.route,
            Screen.Wallet.route,
            Screen.Inventory.route,
            Screen.RoomLobby.route,
            Screen.VoiceRoom.route,
            Screen.VideoRoom.route,
            Screen.Search.route,
            Screen.Notifications.route,
            Screen.DatingDiscovery.route,
            Screen.MainTabs.createRoute(MainTabsRoutes.PROFILE),
        )
        secondary.forEach { route ->
            assertNull("$route must not be remapped to a root", TopLevelNavigationTargets.mainTabFor(route))
            assertEquals(route, TopLevelNavigationTargets.targetRoute(route))
        }
    }

    @Test
    fun noPrefixMatchingForProfileOrChatFamilies() {
        // The legacy implementation used startsWith("profile_detail/"); a real route with
        // arguments must still be treated as a secondary destination.
        assertNull(TopLevelNavigationTargets.mainTabFor("profile_detail/user-1"))
        assertNull(TopLevelNavigationTargets.mainTabFor("chat/partner-9?call=VOICE"))
        assertNull(TopLevelNavigationTargets.mainTabFor("profile"))
        assertNull(TopLevelNavigationTargets.mainTabFor("main_tabs?tab=chat"))
    }
}

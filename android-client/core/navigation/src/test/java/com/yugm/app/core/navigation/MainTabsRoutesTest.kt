package com.yugm.app.core.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression coverage for the centralized navigation whitelist: the five main root
 * destinations, destination normalization from legacy/user inputs, and the visit-recording
 * key the main-tabs host persists for process-death restoration.
 */
class MainTabsRoutesTest {
    @Test
    fun whitelistContainsExactlyTheFiveMainRoots() {
        assertEquals(
            setOf(MainTabsRoutes.GAME_ZONE, MainTabsRoutes.PARTY, MainTabsRoutes.DISCOVER, MainTabsRoutes.CHAT, MainTabsRoutes.PROFILE),
            MainTabsRoutes.ALL
        )
        assertEquals(setOf("game_zone", "party", "discover", "chat", "profile"), MainTabsRoutes.ALL)
    }

    @Test
    fun isMainTabsMatchesOnlyTheMainTabsHostRoute() {
        assertTrue(MainTabsRoutes.isMainTabs(Screen.MainTabs.route))
        // Legacy top-level routes are NOT the whitelisted main-tabs host destinations.
        assertFalse(MainTabsRoutes.isMainTabs("discover"))
        assertFalse(MainTabsRoutes.isMainTabs("chat_list"))
        assertFalse(MainTabsRoutes.isMainTabs("voice_rooms"))
        assertFalse(MainTabsRoutes.isMainTabs("games"))
        assertFalse(MainTabsRoutes.isMainTabs("profile_detail/u1"))
        assertFalse(MainTabsRoutes.isMainTabs(null))
    }

    @Test
    fun normalizeTabMapsTheFiveMains() {
        assertEquals(MainTabDestination.GAME_ZONE, MainTabsRoutes.normalizeTab("game_zone"))
        assertEquals(MainTabDestination.PARTY, MainTabsRoutes.normalizeTab("party"))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("discover"))
        assertEquals(MainTabDestination.CHAT, MainTabsRoutes.normalizeTab("chat"))
        assertEquals(MainTabDestination.PROFILE, MainTabsRoutes.normalizeTab("profile"))
    }

    @Test
    fun normalizeTabAcceptsLegacyAndSpellingVariants() {
        assertEquals(MainTabDestination.GAME_ZONE, MainTabsRoutes.normalizeTab("game"))
        assertEquals(MainTabDestination.GAME_ZONE, MainTabsRoutes.normalizeTab("gamezone"))
        assertEquals(MainTabDestination.PARTY, MainTabsRoutes.normalizeTab("live"))
        assertEquals(MainTabDestination.PARTY, MainTabsRoutes.normalizeTab("voice_rooms"))
        assertEquals(MainTabDestination.PARTY, MainTabsRoutes.normalizeTab("voicerooms"))
        assertEquals(MainTabDestination.CHAT, MainTabsRoutes.normalizeTab("chats"))
        assertEquals(MainTabDestination.CHAT, MainTabsRoutes.normalizeTab("chat_list"))
        assertEquals(MainTabDestination.CHAT, MainTabsRoutes.normalizeTab("chatlist"))
        assertEquals(MainTabDestination.PROFILE, MainTabsRoutes.normalizeTab("mine"))
        // Case-insensitive like the main-tabs screen it replaces.
        assertEquals(MainTabDestination.GAME_ZONE, MainTabsRoutes.normalizeTab("Game_Zone"))
        assertEquals(MainTabDestination.CHAT, MainTabsRoutes.normalizeTab("CHAT"))
    }

    @Test
    fun normalizeTabDefaultsUnknownToDiscover() {
        // The default must never strand the user off the authenticated root.
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab(""))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("   "))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("junk_route"))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("search"))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("profile_setup"))
        assertEquals(MainTabDestination.DISCOVER, MainTabsRoutes.normalizeTab("settings"))
    }

    @Test
    fun everyWhitelistedTabRoundTripsThroughCreateRoute() {
        // Screen.MainTabs.createRoute always encodes the tab arg used by MainTabsScreen.
        assertEquals(MainTabsRoutes.GAME_ZONE, Screen.MainTabs.createRoute("game_zone").substringAfter("tab="))
        assertEquals(MainTabsRoutes.PARTY, Screen.MainTabs.createRoute("party").substringAfter("tab="))
        assertEquals(MainTabsRoutes.DISCOVER, Screen.MainTabs.createRoute("discover").substringAfter("tab="))
        assertEquals(MainTabsRoutes.CHAT, Screen.MainTabs.createRoute("chat").substringAfter("tab="))
        assertEquals(MainTabsRoutes.PROFILE, Screen.MainTabs.createRoute("profile").substringAfter("tab="))
    }

    @Test
    fun dockIsVisibleOnlyOnTheMainTabsHost() {
        assertTrue(MainTabsRoutes.isDockVisible(Screen.MainTabs.route, chatTabActive = false, clanChatActive = false))
        assertTrue(MainTabsRoutes.isDockVisible(Screen.MainTabs.route, chatTabActive = true, clanChatActive = false))
        // Clan chat is the only subtab that hides the dock within the main host.
        assertFalse(MainTabsRoutes.isDockVisible(Screen.MainTabs.route, chatTabActive = true, clanChatActive = true))
        // A stale clan flag can never hide the dock on another main tab.
        assertTrue(MainTabsRoutes.isDockVisible(Screen.MainTabs.route, chatTabActive = false, clanChatActive = true))
    }

    @Test
    fun dockIsHiddenOnEverySecondaryDestination() {
        // Representative destinations from every non-root category in the visibility contract.
        val hidden = listOf(
            Screen.Login.route,
            Screen.ProfileSetup.route,
            Screen.ProfileDetail.route,
            Screen.CustomizeProfile.route,
            Screen.Search.route,
            Screen.Chat.route,
            Screen.ClanChat.route,
            Screen.Notifications.route,
            Screen.Settings.route,
            Screen.Wallet.route,
            Screen.Inventory.route,
            Screen.RoomLobby.route,
            Screen.VoiceRoom.route,
            Screen.VideoRoom.route,
            // Legacy stubs are not the whitelisted host either; they redirect to it.
            Screen.Discover.route,
            Screen.ChatList.route,
            Screen.VoiceRooms.route,
            Screen.Games.route,
        )
        hidden.forEach { route ->
            assertFalse("Dock must be hidden on $route", MainTabsRoutes.isDockVisible(route, chatTabActive = false, clanChatActive = false))
        }
        assertFalse(MainTabsRoutes.isDockVisible(null, chatTabActive = false, clanChatActive = false))
    }
}

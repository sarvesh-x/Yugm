package com.yugm.app.ui.screens

import com.yugm.app.core.ui.components.YugmDockTab
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression coverage for the main-tabs host mapping and idempotency: the five destinations
 * round-trip between pager pages and dock tabs, tab arguments normalize deterministically, and
 * repeated selection never produces an extra scroll/navigation target.
 */
class MainTabsNavigationTest {
    @Test
    fun everyPageRoundTripsToItsDockTab() {
        for (page in 0 until TAB_PAGE_COUNT) {
            assertEquals(page, dockTabToPage(pageToDockTab(page)))
        }
    }

    @Test
    fun dockTabOrderMatchesTheFiveRoots() {
        assertEquals(YugmDockTab.GAME_ZONE, pageToDockTab(TAB_GAME_ZONE))
        assertEquals(YugmDockTab.LIVE, pageToDockTab(TAB_PARTY))
        assertEquals(YugmDockTab.DISCOVER, pageToDockTab(TAB_DISCOVER))
        assertEquals(YugmDockTab.CHAT, pageToDockTab(TAB_CHAT))
        assertEquals(YugmDockTab.PROFILE, pageToDockTab(TAB_PROFILE))
    }

    @Test
    fun tabArgumentsNormalizeToTheSamePagesAsTheRoutes() {
        assertEquals(TAB_GAME_ZONE, normalizeMainTab("game_zone"))
        assertEquals(TAB_PARTY, normalizeMainTab("party"))
        assertEquals(TAB_DISCOVER, normalizeMainTab("discover"))
        assertEquals(TAB_CHAT, normalizeMainTab("chat"))
        assertEquals(TAB_PROFILE, normalizeMainTab("profile"))
        assertEquals(TAB_PARTY, normalizeMainTab("live"))
        assertEquals(TAB_DISCOVER, normalizeMainTab("unknown"))
    }

    @Test
    fun repeatedSelectionIsIdempotent() {
        assertNull(tabScrollTarget(currentPage = TAB_DISCOVER, requestedPage = TAB_DISCOVER))
        assertEquals(TAB_CHAT, tabScrollTarget(currentPage = TAB_DISCOVER, requestedPage = TAB_CHAT))
        assertNull(tabScrollTarget(currentPage = TAB_CHAT, requestedPage = TAB_PAGE_COUNT))
    }
}

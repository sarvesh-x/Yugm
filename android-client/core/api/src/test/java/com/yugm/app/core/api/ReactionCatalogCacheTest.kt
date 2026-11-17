package com.yugm.app.core.api

import com.yugm.app.core.model.RoomReaction
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class ReactionCatalogCacheTest {
    @After fun clear() { ReactionCatalogCache.clear() }
    @Test fun vipResultsCannotLeakIntoAnotherSession() {
        ReactionCatalogCache.put("vip-session", listOf(RoomReaction(id = "vip", usable = true)), now = 1000)
        assertNull(ReactionCatalogCache.getIfFresh("other-session", now = 1001))
        assertTrue(ReactionCatalogCache.getAny("other-session").isEmpty())
        assertEquals("vip", ReactionCatalogCache.getIfFresh("vip-session", now = 1001)?.single()?.id)
    }
    @Test fun emptyResultIsCachedAndExpires() {
        ReactionCatalogCache.put("session", emptyList(), now = 1000)
        assertEquals(emptyList<RoomReaction>(), ReactionCatalogCache.getIfFresh("session", now = 1001))
        assertNull(ReactionCatalogCache.getIfFresh("session", now = 121000))
        assertNull(ReactionCatalogCache.getIfFresh("session", now = 999))
        ReactionCatalogCache.clear()
        assertNull(ReactionCatalogCache.getIfFresh("session", now = 1001))
    }
}

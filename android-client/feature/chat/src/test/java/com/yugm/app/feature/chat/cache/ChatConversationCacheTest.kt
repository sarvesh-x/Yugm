package com.yugm.app.feature.chat.cache

import com.yugm.app.core.model.DirectMessage
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class ChatConversationCacheTest {
    @After fun clear() { ChatConversationCache.clear() }
    @Test fun samePartnerHasSeparateAccountAndSessionSnapshots() {
        ChatConversationCache.put("account-a|session-1", "partner", CachedConversation(isCurrentUserVip = true, updatedAt = 1000))
        assertNull(ChatConversationCache.get("account-b|session-2", "partner", now = 1001))
        assertNull(ChatConversationCache.get("account-a|new-session", "partner", now = 1001))
        assertTrue(ChatConversationCache.get("account-a|session-1", "partner", now = 1001)!!.isCurrentUserVip)
    }
    @Test fun snapshotsExpireAndClear() {
        ChatConversationCache.put("account", "partner", CachedConversation(updatedAt = 1000))
        assertNull(ChatConversationCache.get("account", "partner", now = 121000))
        ChatConversationCache.put("account", "partner", CachedConversation(updatedAt = 1000))
        ChatConversationCache.clear()
        assertNull(ChatConversationCache.get("account", "partner", now = 1001))
    }
    @Test fun snapshotSizeAndConversationCountAreBounded() {
        val messages = (1..300).map { DirectMessage(id = "$it") }.toMutableList()
        ChatConversationCache.put("account", "partner", CachedConversation(messages = messages, updatedAt = 1000))
        messages.clear()
        assertEquals(200, ChatConversationCache.get("account", "partner", now = 1001)!!.messages.size)
        for (index in 1..20) ChatConversationCache.put("account", "$index", CachedConversation(updatedAt = 1000))
        assertNull(ChatConversationCache.get("account", "partner", now = 1001))
    }
}

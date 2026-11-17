package com.yugm.app.feature.chat.cache

import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.RelationshipStatus

data class CachedConversation(
    val messages: List<DirectMessage> = emptyList(),
    val partner: Host? = null,
    val relationship: RelationshipStatus? = null,
    val isMuted: Boolean = false,
    val isBlockedByMe: Boolean = false,
    val isMatched: Boolean = false,
    val hasMoreHistory: Boolean = false,
    val nextBefore: String? = null,
    val myActiveCosmetics: ActiveCosmetics = ActiveCosmetics(),
    val isCurrentUserVip: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

object ChatConversationCache {
    private val lock = Any()
    private val map = LinkedHashMap<Pair<String, String>, CachedConversation>(32, 0.75f, true)

    fun get(scope: String, partnerId: String, now: Long = System.currentTimeMillis()): CachedConversation? = synchronized(lock) {
        val key = scope to partnerId
        val entry = map[key] ?: return@synchronized null
        if (now - entry.updatedAt !in 0 until 120_000L) { map.remove(key); null } else entry
    }

    fun put(scope: String, partnerId: String, snapshot: CachedConversation) {
        if (scope.isBlank() || partnerId.isBlank()) return
        synchronized(lock) {
            map[scope to partnerId] = snapshot.copy(messages = snapshot.messages.takeLast(200).toList())
            while (map.size > 20) {
                val eldest = map.entries.iterator().next().key
                map.remove(eldest)
            }
        }
    }

    fun clear() = synchronized(lock) { map.clear() }
}

package com.yugm.app.core.api

import com.yugm.app.core.model.RoomReaction

/**
 * Bounded session-scoped memory cache shared by rooms and DMs. Catalog entries
 * contain user-specific access flags, so they must never cross session scopes.
 */
object ReactionCatalogCache {
    private const val DEFAULT_TTL_MS = 2 * 60 * 1000L

    private data class Entry(val items: List<RoomReaction>, val at: Long)
    private val entries = LinkedHashMap<String, Entry>(4, 0.75f, true)

    @Synchronized
    fun getIfFresh(scope: String, now: Long = System.currentTimeMillis(), ttlMs: Long = DEFAULT_TTL_MS): List<RoomReaction>? {
        val entry = entries[scope] ?: return null
        return entry.items.takeIf { now - entry.at in 0 until ttlMs }
    }

    @Synchronized
    fun getAny(scope: String): List<RoomReaction> = entries[scope]?.items ?: emptyList()

    @Synchronized
    fun put(scope: String, reactions: List<RoomReaction>, now: Long = System.currentTimeMillis()) {
        entries[scope] = Entry(reactions.toList(), now)
        while (entries.size > 4) entries.remove(entries.keys.first())
    }

    @Synchronized
    fun loadedAt(scope: String): Long = entries[scope]?.at ?: 0L

    @Synchronized fun clear() = entries.clear()
}

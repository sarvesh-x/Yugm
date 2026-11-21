package com.yugm.app.core.api

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class SyncTopic { ALL, ROOMS, CHAT, CLANS, PROFILE, WALLET, GIFTS, TASKS, NOTIFICATIONS, EVENTS, SOCIAL, SETTINGS, BONDS }

/** Invalidations contain no user data. Screens re-read the authorized API. */
object AppSync {
    private data class Snapshot(val revision: Long = 0, val topics: Map<SyncTopic, Long> = emptyMap())
    private val state = MutableStateFlow(Snapshot())

    @Synchronized fun invalidate(vararg topics: SyncTopic) {
        val next = state.value.revision + 1
        state.value = Snapshot(next, state.value.topics + topics.associateWith { next })
    }

    fun changes(topics: Set<SyncTopic>): Flow<Long> = state.map { snapshot ->
        if (SyncTopic.ALL in topics) snapshot.revision
        else (topics + SyncTopic.ALL).maxOfOrNull { snapshot.topics[it] ?: 0 } ?: 0
    }.distinctUntilChanged()

    fun onMutation(method: String, path: String) {
        if (method == "GET" || path.startsWith("/auth/") || path.startsWith("/livekit/") ||
            (!path.startsWith("/notifications") && (path.endsWith("/read") || path.endsWith("/read-all"))) || path.contains("/typing") || path.contains("device-token")) return
        val topic = if (path.startsWith("/users/messages")) SyncTopic.CHAT else when (path.substringBefore('?').split('/').getOrNull(1)) {
            "rooms", "pk", "watch-party" -> SyncTopic.ROOMS
            "users", "profile", "cosmetics", "highlights", "vibe" -> SyncTopic.PROFILE
            "clans", "groups" -> SyncTopic.CLANS
            "wallet", "diamonds", "subscriptions", "creator", "withdrawals", "payouts" -> SyncTopic.WALLET
            "gifts", "inventory", "mystery-box" -> SyncTopic.GIFTS
            "missions", "battle-pass", "achievements", "experience", "referrals" -> SyncTopic.TASKS
            "events" -> SyncTopic.EVENTS
            "notifications" -> SyncTopic.NOTIFICATIONS
            "bonds" -> SyncTopic.BONDS
            "support", "settings", "moderation", "safety", "trust-verification" -> SyncTopic.SETTINGS
            else -> SyncTopic.SOCIAL
        }
        invalidate(topic)
        if (topic == SyncTopic.GIFTS || topic == SyncTopic.BONDS) invalidate(SyncTopic.WALLET)
        // Progress side effects (XP from messages/gifts/reactions) do change the
        // profile and tasks, but refetching them after every single interaction
        // created a request storm. Refresh them immediately for profile/task
        // mutations and coalesce the side-effect refreshes otherwise.
        val direct = topic == SyncTopic.PROFILE || topic == SyncTopic.TASKS ||
            topic == SyncTopic.WALLET || topic == SyncTopic.SETTINGS
        val now = System.currentTimeMillis()
        if (direct || now - lastProgressInvalidation >= PROGRESS_INVALIDATION_GAP_MS) {
            lastProgressInvalidation = now
            invalidate(SyncTopic.PROFILE, SyncTopic.TASKS)
        }
    }

    private var lastProgressInvalidation = 0L
    private const val PROGRESS_INVALIDATION_GAP_MS = 30_000L
}

/** Conflates bursts without cancelling reads; an event during a read gets a trailing read. */
suspend fun runAutomaticSync(
    signals: Flow<Long>,
    intervalMs: Long,
    isOnline: () -> Boolean,
    isBusy: () -> Boolean,
    minimumGapMs: Long = 1_000,
    sync: suspend () -> Unit
) = coroutineScope {
    require(intervalMs > 0)
    val pending = Channel<Unit>(Channel.CONFLATED)
    launch(start = CoroutineStart.UNDISPATCHED) { signals.collect { pending.trySend(Unit) } }
    launch { while (isActive) { delay(intervalMs); pending.trySend(Unit) } }
    pending.trySend(Unit)
    var first = true
    try {
        for (ignored in pending) {
            while (!isOnline() || (!first && isBusy())) delay(250)
            try { sync() } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) {
                // Periodic recovery retries reads while the screen retains its last snapshot.
            }
            first = false
            delay(minimumGapMs)
        }
    } finally { pending.close() }
}

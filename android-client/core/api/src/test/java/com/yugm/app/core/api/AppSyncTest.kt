package com.yugm.app.core.api

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppSyncTest {
    @Test fun burstDuringReadIsConflatedAndDoesNotCancelTheRead() = runBlocking {
        val signals = MutableStateFlow(0L)
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val recovered = CompletableDeferred<Unit>()
        var reads = 0
        val job = launch {
            runAutomaticSync(signals, 60_000, { true }, { false }, 5) {
                reads++
                if (reads == 1) { started.complete(Unit); release.await() }
                else recovered.complete(Unit)
            }
        }
        withTimeout(2_000) { started.await() }
        repeat(100) { signals.value++ }
        delay(20)
        assertEquals(1, reads)
        release.complete(Unit)
        withTimeout(2_000) { recovered.await() }
        delay(30)
        assertEquals(2, reads)
        job.cancelAndJoin()
        signals.value++
        delay(20)
        assertEquals(2, reads)
    }

    @Test fun offlineWorkRecoversAutomaticallyWhenNetworkReturns() = runBlocking {
        var online = false
        val completed = CompletableDeferred<Unit>()
        val job = launch { runAutomaticSync(MutableStateFlow(0L), 60_000, { online }, { false }, 5) { completed.complete(Unit) } }
        delay(30)
        assertTrue(!completed.isCompleted)
        online = true
        withTimeout(2_000) { completed.await() }
        job.cancelAndJoin()
    }

    @Test fun failedReadRetriesWithoutAUserAction() = runBlocking {
        var attempts = 0
        val completed = CompletableDeferred<Unit>()
        val job = launch {
            runAutomaticSync(MutableStateFlow(0L), 30, { true }, { false }, 5) {
                attempts++
                if (attempts == 1) error("temporary network failure")
                completed.complete(Unit)
            }
        }
        withTimeout(2_000) { completed.await() }
        assertTrue(attempts >= 2)
        job.cancelAndJoin()
    }

    @Test fun domainInvalidationsDoNotWakeUnrelatedReaders() = runBlocking {
        val values = mutableListOf<Long>()
        val job = launch(start = CoroutineStart.UNDISPATCHED) { AppSync.changes(setOf(SyncTopic.CHAT)).collect { values.add(it) } }
        AppSync.invalidate(SyncTopic.ROOMS)
        delay(10)
        assertEquals(1, values.size)
        AppSync.invalidate(SyncTopic.CHAT)
        delay(10)
        assertEquals(2, values.size)
        AppSync.invalidate(SyncTopic.ALL)
        delay(10)
        assertEquals(3, values.size)
        job.cancelAndJoin()
    }

    @Test fun readsAndPassiveAcknowledgementsCannotCreateRefreshLoops() = runBlocking {
        val before = AppSync.changes(setOf(SyncTopic.ALL)).first()
        AppSync.onMutation("GET", "/users/messages/partner")
        AppSync.onMutation("POST", "/users/messages/partner/read")
        AppSync.onMutation("POST", "/notifications/device-token")
        AppSync.onMutation("POST", "/livekit/token")
        assertEquals(before, AppSync.changes(setOf(SyncTopic.ALL)).first())
        AppSync.onMutation("POST", "/users/messages/partner")
        assertTrue(AppSync.changes(setOf(SyncTopic.CHAT)).first() > before)
    }

    @Test fun badgeShowcaseMutationsRefreshProfileAndTasks() = runBlocking {
        val profileBefore = AppSync.changes(setOf(SyncTopic.PROFILE)).first()
        val tasksBefore = AppSync.changes(setOf(SyncTopic.TASKS)).first()
        AppSync.onMutation("PUT", "/experience/badges/showcase")
        assertTrue(AppSync.changes(setOf(SyncTopic.PROFILE)).first() > profileBefore)
        assertTrue(AppSync.changes(setOf(SyncTopic.TASKS)).first() > tasksBefore)
    }
}

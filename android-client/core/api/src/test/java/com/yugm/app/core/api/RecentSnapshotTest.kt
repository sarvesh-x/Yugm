package com.yugm.app.core.api

import org.junit.Assert.assertEquals
import org.junit.Test

class RecentSnapshotTest {
    private data class Message(val id: String, val time: String, val text: String = "")
    private fun reconcile(current: List<Message>, incoming: List<Message>, start: Set<String> = current.map { it.id }.toSet()) =
        reconcileRecentSnapshot(current, incoming, start, { it.id }, { it.time }, { it.id.startsWith("local:") })

    @Test fun serverDeletionAndEditsReconcileWithoutLosingOlderPages() {
        val current = listOf(Message("old", "01"), Message("first", "02"), Message("deleted", "03"), Message("edited", "04", "before"))
        val result = reconcile(current, listOf(Message("first", "02"), Message("edited", "04", "after")))
        assertEquals(listOf("old", "first", "edited"), result.map { it.id })
        assertEquals("after", result.last().text)
    }

    @Test fun pendingAndSocketArrivalsDuringTheReadSurviveAnEmptyServerSnapshot() {
        val current = listOf(Message("old", "01"), Message("local:pending", "02"), Message("arrived", "03"))
        val result = reconcile(current, emptyList(), setOf("old", "local:pending"))
        assertEquals(listOf("local:pending", "arrived"), result.map { it.id })
    }

    @Test fun acknowledgedSocketMessageIsNotDuplicatedByTheNextSnapshot() {
        val message = Message("new", "02")
        assertEquals(listOf(message), reconcile(listOf(message), listOf(message), emptySet()))
    }
}

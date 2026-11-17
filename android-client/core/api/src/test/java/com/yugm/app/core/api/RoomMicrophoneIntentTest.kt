package com.yugm.app.core.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomMicrophoneIntentTest {
    @Test fun delayedUnmuteCannotUndoNewerMute() {
        val intent = RoomMicrophoneIntent()
        val delayedUnmute = intent.request(true)
        val mute = intent.request(false)
        val applied = mutableListOf<Boolean>()
        // Deliberately execute callbacks in the opposite order to the clicks.
        listOf(mute, delayedUnmute).forEach { request ->
            if (intent.snapshot() == request) applied.add(request.enabled)
        }
        assertEquals(listOf(false), applied)
        assertFalse(intent.snapshot().enabled)
    }

    @Test fun reconnectDefaultsDoNotOverwriteExplicitMicChoice() {
        val intent = RoomMicrophoneIntent()
        assertTrue(intent.initialize(true).enabled)
        intent.request(false)
        assertFalse(intent.initialize(true).enabled)
        intent.request(true)
        assertTrue(intent.initialize(false).enabled)
    }

    @Test fun newRoomCanInitializeWhileOldRoomCallbacksRemainObsolete() {
        val intent = RoomMicrophoneIntent()
        val oldRoomUnmute = intent.request(true)
        intent.reset()
        assertFalse(intent.snapshot().enabled)
        assertNotEquals(oldRoomUnmute, intent.snapshot())
        assertTrue(intent.initialize(true).enabled)
        assertNotEquals(oldRoomUnmute, intent.snapshot())
    }

    @Test fun repeatedIdenticalClicksStillInvalidateOlderPendingWork() {
        val intent = RoomMicrophoneIntent()
        val first = intent.request(true)
        val last = intent.request(true)
        assertTrue(last.enabled)
        assertNotEquals(first, last)
        assertEquals(last, intent.snapshot())
    }
}

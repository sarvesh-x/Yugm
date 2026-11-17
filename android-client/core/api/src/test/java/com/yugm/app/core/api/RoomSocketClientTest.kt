package com.yugm.app.core.api

import io.socket.client.IO
import io.socket.client.Manager
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomSocketClientTest {
    // Runs the real registration/cleanup code with a transport that never opens
    // a network connection. Events are delivered through the registered callbacks.
    private class LocalSocket : Socket(Manager(), "/", IO.Options()) {
        private val callbacks = mutableMapOf<String, MutableList<Emitter.Listener>>()
        var starts = 0
        var stops = 0
        override fun connect(): Socket { starts++; return this }
        override fun disconnect(): Socket { stops++; return this }
        override fun on(event: String, fn: Emitter.Listener): Emitter {
            callbacks.getOrPut(event) { mutableListOf() }.add(fn)
            return this
        }
        override fun off(): Emitter { callbacks.clear(); return this }
        fun receive(event: String) { callbacks[event]?.toList()?.forEach { it.call() } }
    }

    @Test fun closingModesPreservesActiveRoomUpdates() {
        val roomTransport = LocalSocket()
        val modeTransport = LocalSocket()
        var forcedIsolation = false
        val room = RoomSocketClient { _, _ -> roomTransport }
        val modes = RoomSocketClient { _, options -> forcedIsolation = options.forceNew; modeTransport }
        var roomEvents = 0
        var modeEvents = 0
        room.connect("token", "room", {}, onRoomDataChanged = { roomEvents++ })
        modes.connect("token", "room", {}, onRoomDataChanged = { modeEvents++ })
        modeTransport.receive("room:mode:state")
        modes.disconnect()
        modeTransport.receive("room:mode:state")
        roomTransport.receive("room:poll:new")
        roomTransport.receive("room:mode:state")
        assertEquals(1, modeEvents)
        assertEquals(2, roomEvents)
        assertEquals(0, roomTransport.stops)
        assertEquals(1, modeTransport.stops)
        assertTrue(forcedIsolation)
        room.disconnect()
    }

    @Test fun replacingOneOwnerRemovesOldCallbacksOnly() {
        val old = LocalSocket()
        val replacement = LocalSocket()
        var created = 0
        var events = 0
        val client = RoomSocketClient { _, _ -> if (created++ == 0) old else replacement }
        client.connect("old-token", "room", {}, onRoomDataChanged = { events++ })
        client.connect("new-token", "room", {}, onRoomDataChanged = { events++ })
        old.receive("room:mode:state")
        replacement.receive("room:mode:state")
        assertEquals(1, events)
        assertEquals(1, old.stops)
        assertEquals(0, replacement.stops)
        client.disconnect()
        client.disconnect()
        assertEquals(1, replacement.stops)
    }
}

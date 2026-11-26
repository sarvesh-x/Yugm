package com.yugm.app.core.api

import org.junit.Assert.assertEquals
import org.junit.Test

class RoomSocketClientTest {
    // Runs the real registration/cleanup code with a transport that never opens
    // a network connection. Events are delivered through the registered callbacks.
    private class LocalSocket : RealtimeSocket {
        private val callbacks = mutableMapOf<String, MutableList<(Array<Any>) -> Unit>>()
        var starts = 0
        var stops = 0
        override fun connect() { starts++ }
        override fun disconnect() { stops++ }
        override fun on(event: String, listener: (Array<Any>) -> Unit) {
            callbacks.getOrPut(event) { mutableListOf() }.add(listener)
        }
        override fun off() { callbacks.clear() }
        override fun emit(event: String, data: Map<String, String>) = Unit
        fun receive(event: String) { callbacks[event]?.toList()?.forEach { it(emptyArray()) } }
    }

    @Test fun closingModesPreservesActiveRoomUpdates() {
        val roomTransport = LocalSocket()
        val modeTransport = LocalSocket()
        val room = RoomSocketClient { _, _, _ -> roomTransport }
        val modes = RoomSocketClient { _, _, _ -> modeTransport }
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
        assertEquals(1, roomTransport.starts)
        assertEquals(1, modeTransport.starts)
        room.disconnect()
    }

    @Test fun replacingOneOwnerRemovesOldCallbacksOnly() {
        val old = LocalSocket()
        val replacement = LocalSocket()
        var created = 0
        var events = 0
        val client = RoomSocketClient { _, _, _ -> if (created++ == 0) old else replacement }
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

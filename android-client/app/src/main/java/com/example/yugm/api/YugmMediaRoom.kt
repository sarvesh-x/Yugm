package com.example.yugm.api

import android.util.Log

object YugmMediaRoom {
    private const val TAG = "YugmMediaRoom"
    private var connected = false
    private var opponentRoomName: String? = null

    fun connect(token: String, url: String) {
        connected = true
        Log.d(TAG, "Connected to media room")
    }

    fun setMicEnabled(enabled: Boolean) {}

    fun connectOpponent(token: String, url: String, roomName: String) {
        if (token.isBlank() || url.isBlank()) return
        opponentRoomName = roomName
        Log.d(TAG, "Prepared opponent media subscription: $roomName")
    }

    fun disconnectOpponent() {
        opponentRoomName = null
    }

    fun disconnect() {
        connected = false
        disconnectOpponent()
        Log.d(TAG, "Disconnected from media room")
    }

    fun isConnected(): Boolean = connected
    fun opponentRoomName(): String? = opponentRoomName
}

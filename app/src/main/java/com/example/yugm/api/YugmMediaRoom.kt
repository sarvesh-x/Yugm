package com.example.yugm.api

import android.util.Log

object YugmMediaRoom {
    private const val TAG = "YugmMediaRoom"
    private var connected = false

    fun connect(token: String, url: String) {
        connected = true
        Log.d(TAG, "Connected to media room")
    }

    fun setMicEnabled(enabled: Boolean) {}

    fun disconnect() {
        connected = false
        Log.d(TAG, "Disconnected from media room")
    }

    fun isConnected(): Boolean = connected
}

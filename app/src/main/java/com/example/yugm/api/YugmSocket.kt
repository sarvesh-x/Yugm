package com.example.yugm.api

import android.util.Log

object YugmSocket {
    private const val TAG = "YugmSocket"
    private var socket: io.socket.client.Socket? = null

    fun connect(token: String, roomId: String, onMessage: (String, String) -> Unit) {
        disconnect()
        try {
            val serverUrl = "http://10.0.2.2:4000"
            // TODO: Use HTTPS in production
            socket = io.socket.client.IO.socket(serverUrl, io.socket.client.IO.Options().apply {
                this.auth = mapOf("token" to token)
                transports = arrayOf("websocket")
            })
            socket?.on(io.socket.client.Socket.EVENT_CONNECT) {
                socket?.emit("room:join", org.json.JSONObject().put("roomId", roomId))
            }
            socket?.on("room:chat:message") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as org.json.JSONObject
                        val msg = data.getJSONObject("message")
                        val sender = msg.optJSONObject("senderId") ?: org.json.JSONObject()
                        val name = sender.optString("name", "User")
                        val text = msg.optString("message", "")
                        onMessage(name, text)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing chat message", e)
                    }
                }
            }
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting socket", e)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}

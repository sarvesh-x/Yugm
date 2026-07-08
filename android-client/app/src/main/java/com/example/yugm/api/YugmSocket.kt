package com.example.yugm.api

import android.util.Log
import com.example.yugm.BuildConfig

object YugmSocket {
    private const val TAG = "YugmSocket"
    private var socket: io.socket.client.Socket? = null

    fun connect(token: String, roomId: String, onMessage: (String, String) -> Unit) {
        disconnect()
        try {
            val serverUrl = BuildConfig.SOCKET_BASE_URL.trim().trimEnd('/')
            val candidates = buildList {
                if (serverUrl.isNotBlank()) add(serverUrl)
                if (BuildConfig.DEBUG) {
                    add("http://10.0.2.2:4000")
                    add("http://10.0.3.2:4000")
                    if (BuildConfig.LAN_SOCKET_BASE_URL.isNotBlank()) add(BuildConfig.LAN_SOCKET_BASE_URL.trim().trimEnd('/'))
                    add("http://127.0.0.1:4000")
                }
            }.distinct()
            val targetUrl = candidates.firstOrNull() ?: throw IllegalStateException("SOCKET_BASE_URL is not configured for this build")
            socket = io.socket.client.IO.socket(targetUrl, io.socket.client.IO.Options().apply {
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

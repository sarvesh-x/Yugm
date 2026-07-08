package com.example.yugm.socket

import android.util.Log
import com.example.yugm.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

sealed class SocketEvent {
    data class ChatMessage(val senderName: String, val message: String) : SocketEvent()
    object Connected : SocketEvent()
    object Disconnected : SocketEvent()
}

@Singleton
class SocketManager @Inject constructor() {
    private var socket: Socket? = null
    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 10)
    val events = _events.asSharedFlow()

    fun connect(token: String, roomId: String) {
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
            
            val targetUrl = candidates.firstOrNull() ?: throw IllegalStateException("SOCKET_BASE_URL is not configured")
            
            val options = IO.Options().apply {
                this.auth = mapOf("token" to token)
                transports = arrayOf("websocket")
            }
            
            socket = IO.socket(targetUrl, options)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("SocketManager", "Connected")
                socket?.emit("room:join", JSONObject().put("roomId", roomId))
                _events.tryEmit(SocketEvent.Connected)
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("SocketManager", "Disconnected")
                _events.tryEmit(SocketEvent.Disconnected)
            }
            
            socket?.on("room:chat:message") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val msg = data.getJSONObject("message")
                        val sender = msg.optJSONObject("senderId") ?: JSONObject()
                        val name = sender.optString("name", "User")
                        val text = msg.optString("message", "")
                        _events.tryEmit(SocketEvent.ChatMessage(name, text))
                    } catch (e: Exception) {
                        Log.e("SocketManager", "Error parsing chat message", e)
                    }
                }
            }
            
            socket?.connect()
        } catch (e: Exception) {
            Log.e("SocketManager", "Error connecting socket", e)
        }
    }

    fun sendMessage(roomId: String, message: String) {
        socket?.emit("room:chat:send", JSONObject().apply {
            put("roomId", roomId)
            put("message", message)
        })
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}

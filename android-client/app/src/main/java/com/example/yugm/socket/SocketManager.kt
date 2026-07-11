package com.example.yugm.socket

import android.util.Log
import com.example.yugm.BuildConfig
import com.example.yugm.api.toDirectMessage
import com.example.yugm.model.DirectMessage
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

sealed class SocketEvent {
    data class DirectMessageReceived(val message: DirectMessage) : SocketEvent()
    data class TypingUpdate(val userId: String, val typing: Boolean) : SocketEvent()
    data class UserOnline(val userId: String) : SocketEvent()
    data class UserOffline(val userId: String) : SocketEvent()
    object Connected : SocketEvent()
    object Disconnected : SocketEvent()
}

@Singleton
class SocketManager @Inject constructor() {
    private var socket: Socket? = null
    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 20)
    val events = _events.asSharedFlow()

    fun connect(token: String) {
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
                _events.tryEmit(SocketEvent.Connected)
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("SocketManager", "Disconnected")
                _events.tryEmit(SocketEvent.Disconnected)
            }
            
            socket?.on("direct:message:new") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val msgJson = data.getJSONObject("message")
                        val msg = msgJson.toDirectMessage()
                        _events.tryEmit(SocketEvent.DirectMessageReceived(msg))
                    } catch (e: Exception) {
                        Log.e("SocketManager", "Error parsing direct message", e)
                    }
                }
            }

            socket?.on("direct:typing:update") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val typingUserId = data.getString("userId")
                        val typing = data.getBoolean("typing")
                        _events.tryEmit(SocketEvent.TypingUpdate(typingUserId, typing))
                    } catch (e: Exception) {
                        Log.e("SocketManager", "Error parsing typing update", e)
                    }
                }
            }

            socket?.on("user:online") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val onlineUserId = data.getString("userId")
                        _events.tryEmit(SocketEvent.UserOnline(onlineUserId))
                    } catch (e: Exception) {
                        Log.e("SocketManager", "Error parsing user:online", e)
                    }
                }
            }

            socket?.on("user:offline") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val offlineUserId = data.getString("userId")
                        _events.tryEmit(SocketEvent.UserOffline(offlineUserId))
                    } catch (e: Exception) {
                        Log.e("SocketManager", "Error parsing user:offline", e)
                    }
                }
            }
            
            socket?.connect()
        } catch (e: Exception) {
            Log.e("SocketManager", "Error connecting socket", e)
        }
    }

    fun sendTypingStatus(targetUserId: String, typing: Boolean) {
        val event = if (typing) "direct:typing:start" else "direct:typing:stop"
        socket?.emit(event, JSONObject().put("userId", targetUserId))
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}

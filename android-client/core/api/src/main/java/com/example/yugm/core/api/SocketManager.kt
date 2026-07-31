package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.toDirectMessage
import com.example.yugm.core.model.DirectMessage
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject
import timber.log.Timber
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

    private var baseUrl: String = ""

    fun configure(url: String) {
        baseUrl = url.trim().trimEnd('/')
    }

    private fun getBaseUrl(): String = baseUrl

    fun connect(token: String) {
        disconnect()
        try {
            val targetUrl = getBaseUrl().ifBlank { "http://10.0.2.2:4000" }

            val options = IO.Options().apply {
                this.auth = mapOf("token" to token)
                transports = arrayOf("websocket")
            }

            socket = IO.socket(targetUrl, options)
            socket?.on(Socket.EVENT_CONNECT) {
                Timber.tag("SocketManager").d("Connected to $targetUrl")
                _events.tryEmit(SocketEvent.Connected)
            }
            socket?.on("direct_message") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val json = args[0] as JSONObject
                    try {
                        val message = json.toDirectMessage()
                        _events.tryEmit(SocketEvent.DirectMessageReceived(message))
                    } catch (e: Exception) {
                        Timber.tag("SocketManager").e(e, "Failed to parse direct_message")
                    }
                }
            }
            socket?.on("user_typing") { args ->
                if (args.size >= 2) {
                    _events.tryEmit(SocketEvent.TypingUpdate(args[0].toString(), args[1].toString().toBooleanStrictOrNull() ?: false))
                }
            }
            socket?.on("user_online") { args ->
                if (args.isNotEmpty()) _events.tryEmit(SocketEvent.UserOnline(args[0].toString()))
            }
            socket?.on("user_offline") { args ->
                if (args.isNotEmpty()) _events.tryEmit(SocketEvent.UserOffline(args[0].toString()))
            }
            socket?.on(Socket.EVENT_DISCONNECT) {
                Timber.tag("SocketManager").d("Disconnected")
                _events.tryEmit(SocketEvent.Disconnected)
            }
            socket?.connect()
        } catch (e: Exception) {
            Timber.tag("SocketManager").e(e, "Socket connection failed")
        }
    }

    fun sendTypingStatus(userId: String, isTyping: Boolean) {
        socket?.emit("typing", userId, isTyping)
    }

    fun disconnect() {
        try {
            socket?.off()
            socket?.disconnect()
            socket = null
        } catch (_: Exception) {
            Timber.tag("SocketManager").d("Error during disconnect (ignored)")
        }
    }
}

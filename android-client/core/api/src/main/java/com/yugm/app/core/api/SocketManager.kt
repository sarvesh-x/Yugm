package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toDirectMessage
import com.yugm.app.core.model.DirectMessage
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
    data class DirectMessageDeleted(val messageId: String, val partnerId: String) : SocketEvent()
    data class DirectConversationDeleted(val partnerId: String) : SocketEvent()
    data class DirectMessagesRead(val partnerId: String, val readThrough: String) : SocketEvent()
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
            socket?.on("direct:message:new") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val json = args[0] as JSONObject
                    try {
                        val message = json.toDirectMessage()
                        _events.tryEmit(SocketEvent.DirectMessageReceived(message))
                    } catch (e: Exception) {
                        Timber.tag("SocketManager").e(e, "Failed to parse direct message")
                    }
                }
            }
            socket?.on("direct:reaction:new") { args ->
                (args.firstOrNull() as? JSONObject)?.optJSONObject("message")?.let { message ->
                    runCatching { _events.tryEmit(SocketEvent.DirectMessageReceived(message.toDirectMessage())) }
                        .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse direct message reaction") }
                }
            }
            socket?.on("direct:message:deleted") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectMessageDeleted(payload.optString("messageId"), payload.optString("partnerId")))
                }
            }
            socket?.on("direct:conversation:deleted") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectConversationDeleted(payload.optString("partnerId")))
                }
            }
            socket?.on("direct:message:read") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectMessagesRead(payload.optString("partnerId"), payload.optString("readThrough")))
                }
            }
            socket?.on("direct:typing:update") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.TypingUpdate(payload.optString("userId"), payload.optBoolean("typing")))
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
        socket?.emit(if (isTyping) "direct:typing:start" else "direct:typing:stop", mapOf("userId" to userId))
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

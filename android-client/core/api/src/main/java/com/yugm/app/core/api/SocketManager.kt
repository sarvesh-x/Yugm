package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toClan
import com.yugm.app.core.api.parsers.toClanMessage
import com.yugm.app.core.api.parsers.toDirectMessage
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
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
    data class ClanMessageReceived(val clanId: String, val message: ClanMessage) : SocketEvent()
    data class ClanMessageDeleted(val clanId: String, val messageId: String) : SocketEvent()
    data class ClanMessageUpdated(val clanId: String, val message: ClanMessage) : SocketEvent()
    data class ClanChatCleaned(val clanId: String) : SocketEvent()
    data class ClanUpdated(val clanId: String, val clan: Clan?) : SocketEvent()
    data class ClanDeleted(val clanId: String) : SocketEvent()
    data class ClanMembershipChanged(val clanId: String, val type: String, val userId: String, val clan: Clan?) : SocketEvent()
    data class ClanTypingUpdate(val clanId: String, val userId: String, val typing: Boolean) : SocketEvent()
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

    private fun getBaseUrl(): String = baseUrl.ifBlank { ApiConfig.socketBaseUrl }.trim().trimEnd('/')

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
            socket?.on("clan:message:new") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    payload.optJSONObject("message")?.let { messageJson ->
                        runCatching { _events.tryEmit(SocketEvent.ClanMessageReceived(clanId, messageJson.toClanMessage())) }
                            .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse clan message") }
                    }
                }
            }
            socket?.on("clan:message:deleted") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanMessageDeleted(payload.optString("clanId"), payload.optString("messageId")))
                }
            }
            socket?.on("clan:message:updated") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    payload.optJSONObject("message")?.let { messageJson ->
                        runCatching { _events.tryEmit(SocketEvent.ClanMessageUpdated(clanId, messageJson.toClanMessage())) }
                            .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse clan message update") }
                    }
                }
            }
            socket?.on("clan:chat:cleaned") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanChatCleaned(payload.optString("clanId")))
                }
            }
            socket?.on("clan:updated") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanUpdated(clanId, clan))
                }
            }
            socket?.on("clan:deleted") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanDeleted(payload.optString("clanId")))
                }
            }
            socket?.on("clan:member:joined") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "joined", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:left") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = if (payload.isNull("clan")) null else payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "left", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:removed") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = if (payload.isNull("clan")) null else payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "removed", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:role_updated") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "role", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:ownership:transferred") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "ownership", payload.optString("toUserId", payload.optString("userId")), clan))
                }
            }
            socket?.on("clan:typing:update") { args ->
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanTypingUpdate(payload.optString("clanId"), payload.optString("userId"), payload.optBoolean("typing")))
                }
            }
            socket?.on("user:online") { args ->
                val userId = when (val first = args.firstOrNull()) {
                    is JSONObject -> first.optString("userId")
                    else -> first?.toString().orEmpty()
                }
                if (userId.isNotBlank()) _events.tryEmit(SocketEvent.UserOnline(userId))
            }
            socket?.on("user:offline") { args ->
                val userId = when (val first = args.firstOrNull()) {
                    is JSONObject -> first.optString("userId")
                    else -> first?.toString().orEmpty()
                }
                if (userId.isNotBlank()) _events.tryEmit(SocketEvent.UserOffline(userId))
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

    fun sendClanTypingStatus(clanId: String, isTyping: Boolean) {
        if (clanId.isBlank()) return
        socket?.emit(if (isTyping) "clan:typing:start" else "clan:typing:stop", mapOf("clanId" to clanId))
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

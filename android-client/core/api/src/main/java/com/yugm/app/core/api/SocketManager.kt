package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toClan
import com.yugm.app.core.api.parsers.toClanMessage
import com.yugm.app.core.api.parsers.toDirectMessage
import com.yugm.app.core.api.parsers.toNotificationItem
import com.yugm.app.core.api.parsers.toVoiceRoomPresence
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.NotificationItem
import com.yugm.app.core.model.VoiceRoomPresence
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
    data class NotificationReceived(val notification: NotificationItem) : SocketEvent()
    data class DirectMessageReactionUpdated(val message: DirectMessage, val partnerId: String = "") : SocketEvent()
    data class DirectMessageDeleted(val messageId: String, val partnerId: String) : SocketEvent()
    data class DirectConversationDeleted(val partnerId: String) : SocketEvent()
    data class DirectMessagesRead(val partnerId: String, val readThrough: String) : SocketEvent()
    data class DirectConversationRead(val partnerId: String, val readThrough: String) : SocketEvent()
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
    data class VoiceRoomPresenceUpdated(val userId: String, val presence: VoiceRoomPresence) : SocketEvent()
    data class VoiceRoomPresenceEnded(val userId: String) : SocketEvent()
    object Connected : SocketEvent()
    object Disconnected : SocketEvent()
}

@Singleton
class SocketManager @Inject constructor() {
    private var socket: Socket? = null
    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 20)
    val events = _events.asSharedFlow()

    private var baseUrl: String = ""
    private var connectedToken: String? = null

    fun configure(url: String) {
        baseUrl = url.trim().trimEnd('/')
    }

    private fun getBaseUrl(): String = baseUrl.ifBlank { ApiConfig.socketBaseUrl }.trim().trimEnd('/')

    fun connect(token: String) {
        if (token.isBlank()) return
        val targetUrl = getBaseUrl().ifBlank { "http://10.0.2.2:4000" }
        val existing = socket
        if (existing != null && connectedToken == token) {
            if (!existing.connected()) existing.connect()
            return
        }
        disconnect()
        try {
            val options = IO.Options().apply {
                this.auth = mapOf("token" to token)
                transports = arrayOf("websocket")
            }

            val connection = IO.socket(targetUrl, options)
            socket = connection
            connectedToken = token
            socket?.on(Socket.EVENT_CONNECT) {
                if (socket !== connection) return@on
                Timber.tag("SocketManager").d("Connected to $targetUrl")
                _events.tryEmit(SocketEvent.Connected)
                AppSync.invalidate(SyncTopic.ALL)
            }
            socket?.on("sync:invalidate") { args ->
                if (socket !== connection) return@on
                val topics = (args.firstOrNull() as? JSONObject)?.optJSONArray("topics") ?: return@on
                val parsed = (0 until topics.length()).mapNotNull { index ->
                    runCatching { SyncTopic.valueOf(topics.getString(index)) }.getOrNull()
                }
                if (parsed.isNotEmpty()) AppSync.invalidate(*parsed.toTypedArray())
            }
            mapOf(
                SyncTopic.CHAT to listOf("direct:message:new", "direct:reaction:new", "direct:message:deleted", "direct:conversation:deleted"),
                SyncTopic.CLANS to listOf("clan:message:new", "clan:message:updated", "clan:message:deleted", "clan:chat:cleaned", "clan:updated", "clan:deleted", "clan:member:joined", "clan:member:left", "clan:member:removed", "clan:member:role_updated", "clan:ownership:transferred"),
                SyncTopic.ROOMS to listOf("voice:room:presence:started", "voice:room:presence:updated", "voice:room:presence:ended"),
                SyncTopic.NOTIFICATIONS to listOf("notification:new")
            ).forEach { (topic, events) ->
                events.forEach { event ->
                    socket?.on(event) {
                        if (socket !== connection) return@on
                        AppSync.invalidate(topic)
                        if (topic == SyncTopic.NOTIFICATIONS) AppSync.invalidate(SyncTopic.PROFILE, SyncTopic.WALLET, SyncTopic.GIFTS, SyncTopic.TASKS, SyncTopic.SOCIAL)
                    }
                }
            }
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                if (socket !== connection) return@on
                val message = (args.firstOrNull() as? Exception)?.message ?: args.firstOrNull()?.toString().orEmpty()
                Timber.tag("SocketManager").w("Socket connect error: $message")
                if (message.contains("Invalid token", ignoreCase = true) ||
                    message.contains("Authentication", ignoreCase = true) ||
                    message.contains("signed in on another device", ignoreCase = true)
                ) {
                    connectedToken = null
                }
            }
            socket?.on("direct:message:new") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val messageJson = payload.optJSONObject("message") ?: payload
                try {
                    val message = messageJson.toDirectMessage()
                    if (message.id.isNotBlank() || message.senderId.isNotBlank() || message.receiverId.isNotBlank()) {
                        _events.tryEmit(SocketEvent.DirectMessageReceived(message))
                    }
                } catch (e: Exception) {
                    Timber.tag("SocketManager").e(e, "Failed to parse direct message")
                }
            }
            socket?.on("notification:new") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val item = payload.optJSONObject("notification") ?: payload
                runCatching { item.toNotificationItem() }
                    .onSuccess { _events.tryEmit(SocketEvent.NotificationReceived(it)) }
                    .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse notification") }
            }
            socket?.on("voice:room:presence:started") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val userId = payload.optString("userId", payload.optString("user_id", ""))
                val presenceObj = payload.optJSONObject("presence") ?: payload.optJSONObject("voiceRoomPresence") ?: payload
                val presence = presenceObj.toVoiceRoomPresence()
                if (userId.isNotBlank()) {
                    _events.tryEmit(SocketEvent.VoiceRoomPresenceUpdated(userId, presence))
                }
            }
            socket?.on("voice:room:presence:updated") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val userId = payload.optString("userId", payload.optString("user_id", ""))
                val presenceObj = payload.optJSONObject("presence") ?: payload.optJSONObject("voiceRoomPresence") ?: payload
                val presence = presenceObj.toVoiceRoomPresence()
                if (userId.isNotBlank()) {
                    _events.tryEmit(SocketEvent.VoiceRoomPresenceUpdated(userId, presence))
                }
            }
            socket?.on("voice:room:presence:ended") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val userId = payload.optString("userId", payload.optString("user_id", ""))
                if (userId.isNotBlank()) {
                    _events.tryEmit(SocketEvent.VoiceRoomPresenceEnded(userId))
                }
            }
            socket?.on("direct:reaction:new") { args ->
                if (socket !== connection) return@on
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                val messageJson = payload.optJSONObject("message") ?: payload
                val partnerId = payload.optString("partnerId", "")
                runCatching { messageJson.toDirectMessage() }
                    .onSuccess { _events.tryEmit(SocketEvent.DirectMessageReactionUpdated(it, partnerId)) }
                    .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse direct message reaction") }
            }
            socket?.on("direct:message:deleted") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectMessageDeleted(payload.optString("messageId"), payload.optString("partnerId")))
                }
            }
            socket?.on("direct:conversation:deleted") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectConversationDeleted(payload.optString("partnerId")))
                }
            }
            socket?.on("direct:message:read") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectMessagesRead(payload.optString("partnerId"), payload.optString("readThrough")))
                }
            }
            socket?.on("direct:conversation:read") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.DirectConversationRead(payload.optString("partnerId"), payload.optString("readThrough")))
                }
            }
            socket?.on("direct:typing:update") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.TypingUpdate(payload.optString("userId"), payload.optBoolean("typing")))
                }
            }
            socket?.on("clan:message:new") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    payload.optJSONObject("message")?.let { messageJson ->
                        runCatching { _events.tryEmit(SocketEvent.ClanMessageReceived(clanId, messageJson.toClanMessage())) }
                            .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse clan message") }
                    }
                }
            }
            socket?.on("clan:message:deleted") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanMessageDeleted(payload.optString("clanId"), payload.optString("messageId")))
                }
            }
            socket?.on("clan:message:updated") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    payload.optJSONObject("message")?.let { messageJson ->
                        runCatching { _events.tryEmit(SocketEvent.ClanMessageUpdated(clanId, messageJson.toClanMessage())) }
                            .onFailure { Timber.tag("SocketManager").e(it, "Failed to parse clan message update") }
                    }
                }
            }
            socket?.on("clan:chat:cleaned") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanChatCleaned(payload.optString("clanId")))
                }
            }
            socket?.on("clan:updated") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clanId = payload.optString("clanId")
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanUpdated(clanId, clan))
                }
            }
            socket?.on("clan:deleted") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanDeleted(payload.optString("clanId")))
                }
            }
            socket?.on("clan:member:joined") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "joined", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:left") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = if (payload.isNull("clan")) null else payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "left", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:removed") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = if (payload.isNull("clan")) null else payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "removed", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:member:role_updated") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "role", payload.optString("userId"), clan))
                }
            }
            socket?.on("clan:ownership:transferred") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    val clan = payload.optJSONObject("clan")?.let { runCatching { it.toClan() }.getOrNull() }
                    _events.tryEmit(SocketEvent.ClanMembershipChanged(payload.optString("clanId"), "ownership", payload.optString("toUserId", payload.optString("userId")), clan))
                }
            }
            socket?.on("clan:typing:update") { args ->
                if (socket !== connection) return@on
                (args.firstOrNull() as? JSONObject)?.let { payload ->
                    _events.tryEmit(SocketEvent.ClanTypingUpdate(payload.optString("clanId"), payload.optString("userId"), payload.optBoolean("typing")))
                }
            }
            socket?.on("user:online") { args ->
                if (socket !== connection) return@on
                val userId = when (val first = args.firstOrNull()) {
                    is JSONObject -> first.optString("userId")
                    else -> first?.toString().orEmpty()
                }
                if (userId.isNotBlank()) _events.tryEmit(SocketEvent.UserOnline(userId))
            }
            socket?.on("user:offline") { args ->
                if (socket !== connection) return@on
                val userId = when (val first = args.firstOrNull()) {
                    is JSONObject -> first.optString("userId")
                    else -> first?.toString().orEmpty()
                }
                if (userId.isNotBlank()) _events.tryEmit(SocketEvent.UserOffline(userId))
            }
            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                if (socket !== connection) return@on
                val reason = args.firstOrNull()?.toString().orEmpty()
                Timber.tag("SocketManager").d("Disconnected: $reason")
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
            connectedToken = null
        } catch (_: Exception) {
            Timber.tag("SocketManager").d("Error during disconnect (ignored)")
        }
    }
}

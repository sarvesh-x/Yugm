package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.*
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkInvite
import com.example.yugm.core.model.PkLiveEffect
import com.example.yugm.core.model.PkSideType
import org.json.JSONObject
import timber.log.Timber

object YugmSocket {
    private const val TAG = "YugmSocket"
    private var socket: io.socket.client.Socket? = null
    private val lock = Any()

    fun connect(
        token: String,
        roomId: String,
        onMessage: (String, String) -> Unit,
        onPkState: (PkBattle) -> Unit = {},
        onPkInvite: (PkBattle, PkInvite) -> Unit = { _, _ -> },
        onPkEffect: (PkLiveEffect) -> Unit = {},
        onPkRefresh: () -> Unit = {},
        onPkLeadChanged: ((leader: String, leftScore: Int, rightScore: Int) -> Unit)? = null,
        onPkRematchRequested: ((previousBattleId: String) -> Unit)? = null,
        onRoomReaction: ((emoji: String, userId: String, userName: String) -> Unit)? = null,
        onSpeakerApproved: ((userId: String) -> Unit)? = null,
        onUserMuted: ((userId: String) -> Unit)? = null,
        onUserRemoved: ((userId: String) -> Unit)? = null,
        onRoomParticipantChanged: ((action: String, userId: String) -> Unit)? = null
    ) {
        synchronized(lock) {
        disconnect()
        try {
            val serverUrl = ApiConfig.socketBaseUrl.trim().trimEnd('/')
            val candidates = buildList {
                if (serverUrl.isNotBlank()) add(serverUrl)
                if (ApiConfig.isDebug) {
                    add("http://10.0.2.2:4000")
                    if (ApiConfig.lanSocketBaseUrl.isNotBlank()) add(ApiConfig.lanSocketBaseUrl.trim().trimEnd('/'))
                }
            }.distinct()
            val targetUrl = candidates.firstOrNull() ?: throw IllegalStateException("SOCKET_BASE_URL is not configured for this build")
            socket = io.socket.client.IO.socket(targetUrl, io.socket.client.IO.Options().apply {
                this.auth = mapOf("token" to token)
                transports = arrayOf("websocket")
            })
            socket?.on(io.socket.client.Socket.EVENT_CONNECT) {
                socket?.emit("room:join", JSONObject().put("roomId", roomId))
            }
            socket?.on("room:chat:message") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val msg = data.getJSONObject("message")
                        val sender = msg.optJSONObject("senderId") ?: JSONObject()
                        val name = sender.optString("name", "User")
                        val text = msg.optString("message", "")
                        onMessage(name, text)
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Error parsing chat message")
                    }
                }
            }
            listOf("pk:started", "pk:state", "pk:score:update", "pk:timer:tick", "pk:ended", "pk:force_ended", "pk:invite:accepted").forEach { event ->
                socket?.on(event) { args ->
                    parsePkState(args, onPkState)
                }
            }
            socket?.on("pk:invite:received") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val data = args[0] as JSONObject
                        val battle = (data.optJSONObject("battle") ?: data).toPkBattle()
                        val invite = data.optJSONObject("invite")?.toPkInvite() ?: return@on
                        onPkInvite(battle, invite)
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Error parsing PK invite")
                    }
                }
            }
            socket?.on("pk:gift:received") { args ->
                parsePkEffect(args, "Gift", onPkEffect)
            }
            socket?.on("pk:reaction:received") { args ->
                parsePkEffect(args, "Reaction", onPkEffect)
            }
            listOf("pk:invite:sent", "pk:invite:rejected", "pk:invite:expired").forEach { event ->
                socket?.on(event) { args ->
                    if (!parsePkState(args, onPkState)) onPkRefresh()
                }
            }
            socket?.on("pk:lead:changed") { args ->
                if (args.isNotEmpty() && onPkLeadChanged != null) {
                    try {
                        val data = args[0] as JSONObject
                        onPkLeadChanged(
                            data.optString("leader", "DRAW"),
                            data.optInt("leftScore", 0),
                            data.optInt("rightScore", 0)
                        )
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Error parsing lead changed")
                    }
                }
            }
            socket?.on("pk:rematch:requested") { args ->
                if (args.isNotEmpty() && onPkRematchRequested != null) {
                    try {
                        val data = args[0] as JSONObject
                        onPkRematchRequested(data.optString("previousBattleId", ""))
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Error parsing rematch requested")
                    }
                }
            }
            socket?.on("room:reaction:send") { args ->
                if (args.isNotEmpty() && onRoomReaction != null) {
                    try {
                        val data = args[0] as JSONObject
                        onRoomReaction(
                            data.optString("type", ""),
                            data.optString("userId", ""),
                            data.optString("name", "Someone")
                        )
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Error parsing room reaction")
                    }
                }
            }
            socket?.on("room:speaker:approve") { args ->
                if (args.isNotEmpty() && onSpeakerApproved != null) {
                    val userId = runCatching {
                        (args[0] as JSONObject).optString("userId")
                    }.getOrDefault("")
                    if (userId.isNotBlank()) onSpeakerApproved(userId)
                }
            }
            socket?.on("room:user:mute") { args ->
                if (args.isNotEmpty() && onUserMuted != null) {
                    val userId = runCatching { (args[0] as JSONObject).optString("userId") }.getOrDefault("")
                    if (userId.isNotBlank()) onUserMuted(userId)
                }
            }
            socket?.on("room:user:remove") { args ->
                if (args.isNotEmpty() && onUserRemoved != null) {
                    val userId = runCatching { (args[0] as JSONObject).optString("userId") }.getOrDefault("")
                    if (userId.isNotBlank()) onUserRemoved(userId)
                }
            }
            socket?.on("room:participant:update") { args ->
                if (args.isNotEmpty() && onRoomParticipantChanged != null) {
                    runCatching {
                        val data = args[0] as JSONObject
                        onRoomParticipantChanged(data.optString("action"), data.optString("userId"))
                    }
                }
            }
            socket?.connect()
        } catch (e: Exception) {
            Timber.tag(TAG).e(e, "Error connecting socket")
        }
        }
    }

    private fun parsePkState(args: Array<Any>, onPkState: (PkBattle) -> Unit): Boolean {
        if (args.isEmpty()) return false
        return try {
            val data = args[0] as JSONObject
            val battle = (data.optJSONObject("battle") ?: data).toPkBattle()
            if (battle.id.isBlank()) return false
            onPkState(battle)
            true
        } catch (e: Exception) {
            Timber.tag(TAG).e(e, "Error parsing PK state")
            false
        }
    }

    private fun parsePkEffect(args: Array<Any>, fallbackLabel: String, onPkEffect: (PkLiveEffect) -> Unit) {
        if (args.isEmpty()) return
        try {
            val data = args[0] as JSONObject
            val side = runCatching { PkSideType.valueOf(data.optString("side", "LEFT")) }.getOrDefault(PkSideType.LEFT)
            val label = data.optString("giftName", data.optString("type", fallbackLabel)).replaceFirstChar { it.uppercase() }
            onPkEffect(
                PkLiveEffect(
                    label = label,
                    side = side,
                    points = data.optInt("pointsAdded", data.optInt("coinAmount", 0)),
                    combo = data.optInt("combo", 0)
                )
            )
        } catch (e: Exception) {
            Timber.tag(TAG).e(e, "Error parsing PK effect")
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}

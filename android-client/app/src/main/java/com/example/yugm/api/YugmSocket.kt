package com.example.yugm.api

import android.util.Log
import com.example.yugm.BuildConfig
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkInvite
import com.example.yugm.model.PkLiveEffect
import com.example.yugm.model.PkSideType
import org.json.JSONObject

object YugmSocket {
    private const val TAG = "YugmSocket"
    private var socket: io.socket.client.Socket? = null

    fun connect(
        token: String,
        roomId: String,
        onMessage: (String, String) -> Unit,
        onPkState: (PkBattle) -> Unit = {},
        onPkInvite: (PkBattle, PkInvite) -> Unit = { _, _ -> },
        onPkEffect: (PkLiveEffect) -> Unit = {},
        onPkRefresh: () -> Unit = {}
    ) {
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
                        Log.e(TAG, "Error parsing chat message", e)
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
                        Log.e(TAG, "Error parsing PK invite", e)
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
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting socket", e)
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
            Log.e(TAG, "Error parsing PK state", e)
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
            Log.e(TAG, "Error parsing PK effect", e)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}

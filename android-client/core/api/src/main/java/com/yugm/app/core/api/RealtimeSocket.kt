package com.yugm.app.core.api

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

interface RealtimeSocket {
    fun on(event: String, listener: (Array<Any>) -> Unit)
    fun off()
    fun connect()
    fun disconnect()
    fun emit(event: String, data: Map<String, String>)

    companion object {
        const val CONNECT = "connect"
        const val CONNECT_ERROR = "connect_error"
        const val DISCONNECT = "disconnect"
    }
}

internal class WorkerRealtimeSocket(origin: String, token: String, roomId: String? = null) : RealtimeSocket {
    private val request = Request.Builder().url(origin.toHttpUrl().newBuilder().addPathSegment("realtime").apply {
        if (roomId != null) addQueryParameter("roomId", roomId)
    }.build()).header("Authorization", "Bearer $token").build()
    private val lock = Any()
    private val callbacks = mutableMapOf<String, MutableList<(Array<Any>) -> Unit>>()
    private var connection: WebSocket? = null
    private var reconnect: Job? = null
    private var heartbeat: Job? = null
    private var retryDelay = 1_000L
    private var scope: String? = null
    private var sequence = 0L
    private val seenEvents = LinkedHashSet<String>()
    private var stopped = false

    override fun on(event: String, listener: (Array<Any>) -> Unit) {
        synchronized(lock) { callbacks.getOrPut(event) { mutableListOf() }.add(listener) }
    }

    override fun off() { synchronized(lock) { callbacks.clear() } }

    override fun connect() {
        synchronized(lock) {
            if (stopped || connection != null) return
            reconnect?.cancel()
            connection = client.newWebSocket(request, listener)
        }
    }

    override fun disconnect() {
        synchronized(lock) {
            stopped = true
            reconnect?.cancel()
            heartbeat?.cancel()
            connection?.close(1000, null)
            connection = null
        }
    }

    override fun emit(event: String, data: Map<String, String>) {
        synchronized(lock) {
            if (scope == null) return
            val channel = event.substringBefore(':')
            val target = data[if (channel == "clan") "clanId" else "userId"] ?: return
            connection?.send(JSONObject().put("v", 1).put("type", "typing").put("channel", channel)
                .put("target", target).put("typing", event.endsWith(":start")).toString())
        }
    }

    private fun deliver(socket: WebSocket, event: String, vararg values: Any) {
        val listeners = synchronized(lock) {
            if (connection !== socket || stopped) return
            callbacks[event]?.toList().orEmpty()
        }
        val args = Array<Any>(values.size) { values[it] }
        for (callback in listeners) callback(args)
    }

    private fun lost(socket: WebSocket, retry: Boolean) {
        synchronized(lock) {
            if (connection !== socket || stopped) return
            connection = null
            heartbeat?.cancel()
            if (!retry) return
            val wait = retryDelay
            retryDelay = (retryDelay * 2).coerceAtMost(30_000L)
            reconnect = background.launch {
                delay(wait)
                connect()
            }
        }
    }

    private val listener = object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            val frame = runCatching { JSONObject(text) }.getOrNull() ?: return
            if (frame.optInt("v") != 1) return
            if (frame.optString("type") == "access-revoked") {
                deliver(webSocket, RealtimeSocket.DISCONNECT, "Realtime access expired")
                lost(webSocket, retry = false)
                webSocket.close(1000, null)
                return
            }
            if (frame.optString("type") == "ready") {
                val nextScope = frame.optString("scope").takeIf { it.isNotBlank() } ?: return
                synchronized(lock) {
                    if (connection !== webSocket || stopped) return
                    if (scope != nextScope) {
                        sequence = 0
                        seenEvents.clear()
                    }
                    scope = nextScope
                    retryDelay = 1_000L
                    heartbeat?.cancel()
                    heartbeat = background.launch {
                        while (true) {
                            delay(60_000L)
                            if (!webSocket.send("""{"v":1,"type":"heartbeat"}""")) break
                        }
                    }
                    if (sequence > 0) webSocket.send(JSONObject().put("v", 1).put("type", "resume")
                        .put("scope", nextScope).put("afterSeq", sequence).toString())
                }
                deliver(webSocket, RealtimeSocket.CONNECT)
                return
            }
            val event = frame.optString("event").takeIf { it.isNotBlank() } ?: return
            val id = frame.optString("id").takeIf { it.isNotBlank() } ?: return
            synchronized(lock) {
                if (connection !== webSocket || frame.optString("scope") != scope) return
                if (!seenEvents.add(id)) return
                if (seenEvents.size > 256) seenEvents.remove(seenEvents.first())
                sequence = maxOf(sequence, frame.optLong("seq"))
            }
            deliver(webSocket, event, frame.opt("data") ?: JSONObject())
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            deliver(webSocket, RealtimeSocket.DISCONNECT, reason)
            lost(webSocket, retry = code != 1008)
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            val code = response?.code
            val message = if (code == 401) "Authentication required" else code?.let { "HTTP $it" } ?: "Connection unavailable"
            deliver(webSocket, RealtimeSocket.CONNECT_ERROR, message)
            lost(webSocket, retry = code == null || code == 403 || code >= 500)
        }
    }

    companion object {
        private val client = OkHttpClient.Builder().pingInterval(30, TimeUnit.SECONDS).build()
        private val background = CoroutineScope(Dispatchers.IO)
    }
}

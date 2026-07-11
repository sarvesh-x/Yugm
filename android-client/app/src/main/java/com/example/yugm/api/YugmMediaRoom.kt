package com.example.yugm.api

import android.content.Context
import android.util.Log
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

object YugmMediaRoom {
    private const val TAG = "YugmMediaRoom"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var appContext: Context? = null
    private var room: Room? = null
    private var opponentRoom: Room? = null
    private var connected = false
    private var opponentRoomName: String? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    fun connect(token: String, url: String) {
        val context = appContext ?: run {
            Log.e(TAG, "Media room was not initialized")
            return
        }
        if (token.isBlank() || url.isBlank()) return
        scope.launch {
            runCatching {
                room?.disconnect()
                room = LiveKit.create(context).also { it.connect(url, token) }
                connected = true
                Log.d(TAG, "Connected to LiveKit media room")
            }.onFailure {
                connected = false
                Log.e(TAG, "LiveKit connection failed", it)
            }
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        scope.launch {
            runCatching { room?.localParticipant?.setMicrophoneEnabled(enabled) }
                .onFailure { Log.e(TAG, "Unable to update microphone", it) }
        }
    }

    fun setCameraEnabled(enabled: Boolean) {
        scope.launch {
            runCatching { room?.localParticipant?.setCameraEnabled(enabled) }
                .onFailure { Log.e(TAG, "Unable to update camera", it) }
        }
    }

    data class VideoFeed(val label: String, val track: VideoTrack)

    fun videoFeeds(): List<VideoFeed> {
        val currentRoom = room ?: return emptyList()
        val local = currentRoom.localParticipant.videoTrackPublications.mapNotNull { (_, track) ->
            (track as? VideoTrack)?.let { VideoFeed(currentRoom.localParticipant.name ?: "You", it) }
        }
        val remote = currentRoom.remoteParticipants.values.flatMap { participant ->
            participant.videoTrackPublications.mapNotNull { (_, track) ->
                (track as? VideoTrack)?.let { VideoFeed(participant.name ?: participant.identity?.value ?: "Guest", it) }
            }
        }
        return local + remote
    }

    fun initializeVideoRenderer(renderer: SurfaceViewRenderer) {
        room?.initVideoRenderer(renderer)
    }

    fun connectOpponent(token: String, url: String, roomName: String) {
        val context = appContext ?: return
        if (token.isBlank() || url.isBlank()) return
        opponentRoomName = roomName
        scope.launch {
            runCatching {
                opponentRoom?.disconnect()
                opponentRoom = LiveKit.create(context).also { it.connect(url, token) }
                Log.d(TAG, "Connected to opponent media room: $roomName")
            }.onFailure { Log.e(TAG, "Opponent media connection failed", it) }
        }
    }

    fun disconnectOpponent() {
        opponentRoom?.disconnect()
        opponentRoom = null
        opponentRoomName = null
    }

    fun disconnect() {
        room?.disconnect()
        room = null
        connected = false
        disconnectOpponent()
        Log.d(TAG, "Disconnected from media room")
    }

    fun isConnected(): Boolean = connected
    fun opponentRoomName(): String? = opponentRoomName
}

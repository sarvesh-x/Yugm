package com.example.yugm.api

import android.annotation.SuppressLint
import android.content.Context
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber

@SuppressLint("StaticFieldLeak")
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
            Timber.tag(TAG).e("Media room was not initialized")
            return
        }
        if (token.isBlank() || url.isBlank()) return
        scope.launch {
            runCatching {
                room?.disconnect()
                room = LiveKit.create(context).also { it.connect(url, token) }
                connected = true
                Timber.tag(TAG).d("Connected to LiveKit media room")
            }.onFailure {
                connected = false
                Timber.tag(TAG).e(it, "LiveKit connection failed")
            }
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        scope.launch {
            runCatching { room?.localParticipant?.setMicrophoneEnabled(enabled) }
                .onFailure { Timber.tag(TAG).e(it, "Unable to update microphone") }
        }
    }

    fun setCameraEnabled(enabled: Boolean) {
        scope.launch {
            runCatching { room?.localParticipant?.setCameraEnabled(enabled) }
                .onFailure { Timber.tag(TAG).e(it, "Unable to update camera") }
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
                Timber.tag(TAG).d("Connected to opponent media room: $roomName")
            }.onFailure { Timber.tag(TAG).e(it, "Opponent media connection failed") }
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
        Timber.tag(TAG).d("Disconnected from media room")
    }

    fun isConnected(): Boolean = connected
    fun opponentRoomName(): String? = opponentRoomName
}

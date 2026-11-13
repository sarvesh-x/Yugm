package com.yugm.app.core.api

import android.annotation.SuppressLint
import android.content.Context
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.VideoTrack
import io.livekit.android.util.flow
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import timber.log.Timber

@SuppressLint("StaticFieldLeak")
object YugmMediaRoom {
    private const val TAG = "YugmMediaRoom"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var appContext: Context? = null
    private var room: Room? = null
    private var opponentRoom: Room? = null
    private var speakingObserver: Job? = null
    private var connected = false
    @Volatile private var desiredMicEnabled = false
    private var opponentRoomName: String? = null
    private val mutableSpeakingIdentities = MutableStateFlow<Set<String>>(emptySet())
    val speakingIdentities = mutableSpeakingIdentities.asStateFlow()

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
                speakingObserver?.cancel()
                mutableSpeakingIdentities.value = emptySet()
                room?.disconnect()
                val nextRoom = LiveKit.create(context)
                nextRoom.connect(url, token)
                room = nextRoom
                nextRoom.localParticipant.setMicrophoneEnabled(desiredMicEnabled)
                speakingObserver = scope.launch {
                    nextRoom::activeSpeakers.flow.collect { speakers ->
                        mutableSpeakingIdentities.value = speakers.mapNotNull { it.identity?.value }.toSet()
                    }
                }
                connected = true
                Timber.tag(TAG).d("Connected to LiveKit media room")
            }.onFailure {
                connected = false
                Timber.tag(TAG).e(it, "LiveKit connection failed")
            }
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        desiredMicEnabled = enabled
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
        desiredMicEnabled = false
        speakingObserver?.cancel()
        speakingObserver = null
        mutableSpeakingIdentities.value = emptySet()
        room?.disconnect()
        room = null
        connected = false
        disconnectOpponent()
        Timber.tag(TAG).d("Disconnected from media room")
    }

    fun isConnected(): Boolean = connected
    fun opponentRoomName(): String? = opponentRoomName
}

package com.yugm.app.core.api

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.RemoteAudioTrack
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalAudioTrackOptions
import io.livekit.android.room.track.Track
import io.livekit.android.room.participant.AudioTrackPublishOptions
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import timber.log.Timber

enum class RoomMusicPlaybackState { IDLE, PLAYING, PAUSED, COMPLETED, ERROR }

data class RoomMusicPlaybackStatus(
    val generation: Long = 0,
    val state: RoomMusicPlaybackState = RoomMusicPlaybackState.IDLE,
    val error: String = ""
)

@SuppressLint("StaticFieldLeak")
object YugmMediaRoom {
    private const val TAG = "YugmMediaRoom"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val roomMutex = Mutex()
    private var appContext: Context? = null
    private var room: Room? = null
    private var roomMusicTrack: LocalAudioTrack? = null
    private var roomMusicDecoder: RoomMusicPcmDecoder? = null
    private var roomMusicPreview: MediaPlayer? = null
    @Volatile private var roomMusicVolume = 0.8f
    private var roomMusicGeneration = 0L
    private val mutableRoomMusicStatus = MutableStateFlow(RoomMusicPlaybackStatus())
    val roomMusicStatus = mutableRoomMusicStatus.asStateFlow()
    private var opponentRoom: Room? = null
    private var speakingObserver: Job? = null
    @Volatile private var connected = false
    @Volatile private var desiredMicEnabled = false
    @Volatile private var micPreferenceVersion = 0L
    @Volatile private var microphonePublishAllowed = false
    @Volatile private var desiredCameraEnabled = false
    @Volatile private var roomAudioMuted = false
    private var opponentRoomName: String? = null
    private val mutableSpeakingIdentities = MutableStateFlow<Set<String>>(emptySet())
    val speakingIdentities = mutableSpeakingIdentities.asStateFlow()

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    suspend fun connect(
        token: String,
        url: String,
        publishCamera: Boolean = false,
        publishMicrophone: Boolean = desiredMicEnabled,
        canPublishMicrophone: Boolean = publishMicrophone
    ) {
        val context = appContext ?: run {
            throw IllegalStateException("Media room was not initialized")
        }
        require(token.isNotBlank() && url.isNotBlank()) { "Live audio credentials are missing" }
        roomMutex.withLock {
            desiredCameraEnabled = publishCamera
            if (micPreferenceVersion == 0L) desiredMicEnabled = publishMicrophone
            microphonePublishAllowed = canPublishMicrophone
            connected = false
            RoomAudioForegroundService.start(context, desiredMicEnabled && microphonePublishAllowed)
            var connectingRoom: Room? = null
            try {
                speakingObserver?.cancel()
                speakingObserver = null
                mutableSpeakingIdentities.value = emptySet()
                room?.let { stopRoomMusicLocked(it) }
                room?.disconnect()
                val nextRoom = LiveKit.create(context)
                connectingRoom = nextRoom
                nextRoom.connect(url, token)
                room = nextRoom
                if (desiredMicEnabled && microphonePublishAllowed && !nextRoom.localParticipant.setMicrophoneEnabled(true)) {
                    throw IllegalStateException("LiveKit could not publish your microphone")
                }
                if (desiredCameraEnabled && !nextRoom.localParticipant.setCameraEnabled(true)) {
                    throw IllegalStateException("LiveKit could not publish your camera")
                }
                speakingObserver = scope.launch {
                    nextRoom::activeSpeakers.flow.collect { speakers ->
                        mutableSpeakingIdentities.value = speakers.mapNotNull { it.identity?.value }.toSet()
                        if (roomAudioMuted) muteRemoteParticipants(nextRoom, true)
                    }
                }
                connected = true
                Timber.tag(TAG).d("Connected to LiveKit media room")
            } catch (error: Throwable) {
                speakingObserver?.cancel()
                speakingObserver = null
                (connectingRoom ?: room)?.disconnect()
                room = null
                connected = false
                RoomAudioForegroundService.stop(context)
                Timber.tag(TAG).e(error, "LiveKit connection failed")
                throw error
            }
        }
    }

    fun setMicEnabled(enabled: Boolean) {
        micPreferenceVersion++
        desiredMicEnabled = enabled
        scope.launch {
            roomMutex.withLock {
                if (enabled && !microphonePublishAllowed) {
                    Timber.tag(TAG).d("Microphone enable is waiting for an authorized room token")
                    return@withLock
                }
                if (connected) appContext?.let { RoomAudioForegroundService.setMicrophoneEnabled(it, enabled) }
                runCatching {
                    val currentRoom = room
                    if (currentRoom == null) {
                        Timber.tag(TAG).d("Microphone state saved until the room connects")
                    } else if (!currentRoom.localParticipant.setMicrophoneEnabled(enabled) && enabled) {
                        throw IllegalStateException("LiveKit could not publish your microphone")
                    }
                }
                .onFailure { Timber.tag(TAG).e(it, "Unable to update microphone") }
            }
        }
    }

    fun setCameraEnabled(enabled: Boolean) {
        desiredCameraEnabled = enabled
        scope.launch {
            roomMutex.withLock {
                runCatching {
                    val currentRoom = room
                    if (currentRoom != null && !currentRoom.localParticipant.setCameraEnabled(enabled) && enabled) {
                        throw IllegalStateException("LiveKit could not publish your camera")
                    }
                }
                .onFailure { Timber.tag(TAG).e(it, "Unable to update camera") }
            }
        }
    }

    fun setRoomAudioMuted(muted: Boolean) {
        roomAudioMuted = muted
        scope.launch {
            roomMutex.withLock { room?.let { muteRemoteParticipants(it, muted) } }
        }
    }

    suspend fun startRoomMusic(uri: Uri): Boolean = roomMutex.withLock {
        val activeRoom = room ?: return@withLock false
        stopRoomMusicLocked(activeRoom)
        val context = appContext ?: return@withLock false
        try {
            val generation = ++roomMusicGeneration
            mutableRoomMusicStatus.value = RoomMusicPlaybackStatus(generation, RoomMusicPlaybackState.PLAYING)
            val decoder = RoomMusicPcmDecoder(
                context,
                uri,
                onCompleted = {
                    scope.launch {
                        if (mutableRoomMusicStatus.value.generation == generation && mutableRoomMusicStatus.value.state == RoomMusicPlaybackState.PLAYING) {
                            mutableRoomMusicStatus.value = RoomMusicPlaybackStatus(generation, RoomMusicPlaybackState.COMPLETED)
                        }
                    }
                },
                onError = { message ->
                    scope.launch {
                        if (mutableRoomMusicStatus.value.generation == generation) {
                            mutableRoomMusicStatus.value = RoomMusicPlaybackStatus(generation, RoomMusicPlaybackState.ERROR, message)
                        }
                    }
                }
            )
            val track = activeRoom.localParticipant.createAudioTrack(
                "room-music",
                LocalAudioTrackOptions(
                    noiseSuppression = false,
                    echoCancellation = false,
                    autoGainControl = false,
                    highPassFilter = false,
                    typingNoiseDetection = false
                )
            )
            track.setAudioBufferCallback(decoder)
            decoder.setVolume(roomMusicVolume)
            roomMusicDecoder = decoder
            roomMusicTrack = track
            roomMusicPreview = runCatching {
                MediaPlayer().apply {
                    setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    setVolume(roomMusicVolume, roomMusicVolume)
                    setDataSource(context, uri)
                    setOnPreparedListener { player -> runCatching { player.setVolume(roomMusicVolume, roomMusicVolume); player.start() } }
                    prepareAsync()
                }
            }.getOrNull()
            val published = activeRoom.localParticipant.publishAudioTrack(
                track,
                AudioTrackPublishOptions(name = "room-music", audioBitrate = 96_000, source = Track.Source.SCREEN_SHARE_AUDIO)
            )
            if (!published) {
                stopRoomMusicLocked(activeRoom)
                Timber.tag(TAG).e("LiveKit refused to publish the room music track")
            }
            published
        } catch (error: Throwable) {
            stopRoomMusicLocked(activeRoom)
            Timber.tag(TAG).e(error, "Could not start room music")
            false
        }
    }

    fun pauseRoomMusic(paused: Boolean) {
        roomMusicDecoder?.pause(paused)
        val currentStatus = mutableRoomMusicStatus.value
        if (currentStatus.state == RoomMusicPlaybackState.PLAYING || currentStatus.state == RoomMusicPlaybackState.PAUSED) {
            mutableRoomMusicStatus.value = currentStatus.copy(
                state = if (paused) RoomMusicPlaybackState.PAUSED else RoomMusicPlaybackState.PLAYING
            )
        }
        runCatching {
            roomMusicPreview?.let { preview ->
                if (paused && preview.isPlaying) preview.pause()
                else if (!paused && preview.isPlaying.not()) preview.start()
            }
        }
    }

    fun setRoomMusicVolume(volume: Float) {
        roomMusicVolume = volume.coerceIn(0f, 1f)
        roomMusicDecoder?.setVolume(roomMusicVolume)
        runCatching { roomMusicPreview?.setVolume(roomMusicVolume, roomMusicVolume) }
    }

    suspend fun stopRoomMusic() = roomMutex.withLock {
        room?.let { stopRoomMusicLocked(it) } ?: run {
            roomMusicGeneration++
            mutableRoomMusicStatus.value = RoomMusicPlaybackStatus(roomMusicGeneration, RoomMusicPlaybackState.IDLE)
            roomMusicDecoder?.stop()
            roomMusicDecoder = null
            roomMusicPreview?.let { player -> runCatching { player.release() } }
            roomMusicPreview = null
            roomMusicTrack = null
        }
    }

    private fun stopRoomMusicLocked(activeRoom: Room) {
        roomMusicGeneration++
        mutableRoomMusicStatus.value = RoomMusicPlaybackStatus(roomMusicGeneration, RoomMusicPlaybackState.IDLE)
        roomMusicDecoder?.stop()
        roomMusicPreview?.let { player ->
            runCatching { if (player.isPlaying) player.stop() }
            runCatching { player.release() }
        }
        roomMusicPreview = null
        roomMusicTrack?.let { track ->
            runCatching { track.setAudioBufferCallback(null) }
            runCatching { activeRoom.localParticipant.unpublishTrack(track) }
        }
        roomMusicDecoder = null
        roomMusicTrack = null
    }

    private fun muteRemoteParticipants(currentRoom: Room, muted: Boolean) {
        currentRoom.remoteParticipants.values.forEach { participant ->
            participant.audioTrackPublications.forEach { (_, track) ->
                (track as? RemoteAudioTrack)?.setVolume(if (muted) 0.0 else 1.0)
            }
        }
    }

    data class VideoFeed(val label: String, val track: VideoTrack, val identity: String, val isLocal: Boolean)

    fun videoFeeds(): List<VideoFeed> {
        return videoFeeds(room)
    }

    fun opponentVideoFeeds(): List<VideoFeed> = videoFeeds(opponentRoom)

    private fun videoFeeds(currentRoom: Room?): List<VideoFeed> {
        currentRoom ?: return emptyList()
        val local = currentRoom.localParticipant.videoTrackPublications.mapNotNull { (_, track) ->
            (track as? VideoTrack)?.let { VideoFeed(currentRoom.localParticipant.name ?: "You", it, currentRoom.localParticipant.identity?.value.orEmpty(), true) }
        }
        val remote = currentRoom.remoteParticipants.values.flatMap { participant ->
            participant.videoTrackPublications.mapNotNull { (_, track) ->
                (track as? VideoTrack)?.let { VideoFeed(participant.name ?: participant.identity?.value ?: "Guest", it, participant.identity?.value.orEmpty(), false) }
            }
        }
        return local + remote
    }

    fun initializeVideoRenderer(renderer: SurfaceViewRenderer) {
        room?.initVideoRenderer(renderer)
    }

    fun initializeOpponentVideoRenderer(renderer: SurfaceViewRenderer) {
        opponentRoom?.initVideoRenderer(renderer)
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

    suspend fun disconnect() {
        roomMutex.withLock {
            desiredMicEnabled = false
            micPreferenceVersion = 0L
            desiredCameraEnabled = false
            microphonePublishAllowed = false
            roomAudioMuted = false
            speakingObserver?.cancel()
            speakingObserver = null
            mutableSpeakingIdentities.value = emptySet()
            room?.let { stopRoomMusicLocked(it) }
            room?.disconnect()
            room = null
            connected = false
            disconnectOpponent()
            appContext?.let { RoomAudioForegroundService.stop(it) }
            Timber.tag(TAG).d("Disconnected from media room")
        }
    }

    fun disconnectAsync() {
        scope.launch { disconnect() }
    }

    fun isConnected(): Boolean = connected
    fun isMicEnabled(): Boolean = desiredMicEnabled
    fun canPublishMicrophone(): Boolean = microphonePublishAllowed
    fun opponentRoomName(): String? = opponentRoomName

    fun syncForegroundAudioType() {
        scope.launch {
            roomMutex.withLock {
                if (connected) {
                    appContext?.let { RoomAudioForegroundService.setMicrophoneEnabled(it, desiredMicEnabled && microphonePublishAllowed) }
                }
            }
        }
    }
}
package com.example.yugm.media

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import timber.log.Timber

sealed class MediaStatus {
    object Idle : MediaStatus()
    object Connecting : MediaStatus()
    object Connected : MediaStatus()
    data class Error(val message: String) : MediaStatus()
}

@Singleton
class LiveKitManager @Inject constructor(
    @param:ApplicationContext private val context: Context
) {
    private var room: Room? = null
    private val _status = MutableStateFlow<MediaStatus>(MediaStatus.Idle)
    val status = _status.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.IO)

    fun connect(url: String, token: String) {
        scope.launch {
            _status.value = MediaStatus.Connecting
            try {
                room = LiveKit.create(context).apply {
                    connect(url, token)
                }
                _status.value = MediaStatus.Connected
                Timber.tag("LiveKitManager").d("Connected to room: $url")
            } catch (e: Exception) {
                _status.value = MediaStatus.Error(e.message ?: "Unknown error")
                Timber.tag("LiveKitManager").e(e, "Failed to connect")
            }
        }
    }

    fun setMicrophoneEnabled(enabled: Boolean) {
        scope.launch {
            room?.localParticipant?.setMicrophoneEnabled(enabled)
        }
    }

    fun setCameraEnabled(enabled: Boolean) {
        scope.launch {
            room?.localParticipant?.setCameraEnabled(enabled)
        }
    }

    fun disconnect() {
        room?.disconnect()
        room = null
        _status.value = MediaStatus.Idle
    }
}

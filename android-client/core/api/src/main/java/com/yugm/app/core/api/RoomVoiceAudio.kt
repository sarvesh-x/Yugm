package com.yugm.app.core.api

import io.livekit.android.AudioOptions
import io.livekit.android.LiveKitOverrides
import io.livekit.android.RoomOptions
import io.livekit.android.room.participant.AudioTrackPublishDefaults
import io.livekit.android.room.track.LocalAudioTrackOptions

/** Shared by initial room entry and every authorized media reconnect. */
internal object RoomVoiceAudio {
    fun roomOptions() = RoomOptions(
        audioTrackCaptureDefaults = LocalAudioTrackOptions(
            // Avoid classifying soft syllables and word endings as noise.
            noiseSuppression = false,
            typingNoiseDetection = false,
            echoCancellation = true,
            autoGainControl = true,
            highPassFilter = true
        ),
        audioTrackPublishDefaults = AudioTrackPublishDefaults(
            audioBitrate = 48_000,
            // Keep sending while unmuted, including pauses between words.
            dtx = false,
            red = true
        )
    )

    fun overrides() = LiveKitOverrides(
        audioOptions = AudioOptions(
            javaAudioDeviceModuleCustomizer = { builder ->
                // Android hardware suppression is a separate layer from the
                // capture option above and can gate quiet speech on some phones.
                builder.setUseHardwareNoiseSuppressor(false)
            }
        )
    )
}

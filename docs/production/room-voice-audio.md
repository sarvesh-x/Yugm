# Room microphone speech continuity

Implemented on 2026-11-17 using the pinned LiveKit Android 2.20.3 SDK.

## Findings and changes

Room audio used SDK defaults: discontinuous transmission (DTX), noise suppression and typing-noise detection enabled. The app does not gate microphone audio using the active-speaker indicator. Suppression and DTX are plausible contributors to the reported soft-speech onset/tail loss; no device recording was available to identify the exact cause.

`RoomVoiceAudio` now configures every main room media connection, including role/permission reconnects:

- Disable DTX so unmuted audio continues through pauses rather than relying on speech detection to resume transmission.
- Request capture with noise suppression and typing-noise detection disabled. Disable Android hardware noise suppression separately through the SDK audio-device customizer.
- Retain echo cancellation, automatic gain control, high-pass filtering, communication audio routing and redundant audio packets. Target 48 kbit/s audio.
- Preserve explicit mute and server publishing permission checks. No audio is buffered for later replay or published while the user is an unauthorized listener.

`RoomMicrophoneIntent` orders asynchronous microphone requests. A callback queued before a newer mute/unmute cannot later apply an obsolete choice. Reconnect defaults preserve the user's explicit choice; disconnect invalidates old work and allows the next room to initialize normally.

Continuous encoding uses more bandwidth during silence; disabling noise suppression can make background sounds more audible. The SDK version was not changed in this patch.

## Verification and limits

- `:core:api:testDebugUnitTest :app:compileDebugKotlin` passed.
- All 12 core API tests passed, including four new intent-ordering regressions: late unmute after mute, explicit preference across reconnect, stale work across disconnect/new room, and repeated requests.
- No hardware microphone, native DSP, packet-level or remote-listener test was performed. These results do not establish an acoustic latency measurement or prove the reported loss is eliminated on every device. Newer SDK releases include audio-option fixes; the pinned SDK's actual processing behavior still needs device validation before considering a separate SDK upgrade.

On two supported devices with a configured LiveKit room, verify normal and quiet sentences after 1/5/15 seconds of silence, soft first consonants and word endings, rapid mute/unmute, speakerphone echo, wired/Bluetooth routing, host mute, background/resume and weak-network recovery. Compare the remote listener's recording with the local spoken phrase, rather than judging onset from the speaking ring alone. Never transmit speech recorded while muted.

SDK references: [DTX and redundant audio options](https://docs.livekit.io/reference/client-sdk-android/livekit-android-sdk/io.livekit.android.room.participant/-audio-track-publish-options/index.html), [pinned audio-device setup](https://github.com/livekit/client-sdk-android/blob/v2.20.3/livekit-android-sdk/src/main/java/io/livekit/android/dagger/RTCModule.kt), [pinned capture options](https://github.com/livekit/client-sdk-android/blob/v2.20.3/livekit-android-sdk/src/main/java/io/livekit/android/room/track/LocalAudioTrackOptions.kt).

No backend deployment or APK release was performed. The change takes effect in a new Android build.

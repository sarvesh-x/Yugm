package com.yugm.app.core.api

/** Orders UI and permission callbacks before their asynchronous media work. */
internal class RoomMicrophoneIntent {
    data class Snapshot(val enabled: Boolean, val revision: Long)

    private var current = Snapshot(false, 0)
    private var hasExplicitRequest = false

    @Synchronized fun request(enabled: Boolean): Snapshot {
        hasExplicitRequest = true
        current = Snapshot(enabled, current.revision + 1)
        return current
    }

    @Synchronized fun initialize(defaultEnabled: Boolean): Snapshot {
        if (!hasExplicitRequest) current = current.copy(enabled = defaultEnabled)
        return current
    }

    @Synchronized fun snapshot(): Snapshot = current

    @Synchronized fun reset() {
        // Advance the revision so work queued by an old room stays obsolete.
        current = Snapshot(false, current.revision + 1)
        hasExplicitRequest = false
    }
}

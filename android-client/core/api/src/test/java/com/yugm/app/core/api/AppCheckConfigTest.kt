package com.yugm.app.core.api

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppCheckConfigTest {
    @Test fun debugEmulatorLoopbackCanSkipDebugTokenRegistration() {
        assertFalse(shouldRequireAppCheck("http://10.0.2.2:4000/api", isDebugBuild = true))
        assertFalse(shouldRequireAppCheck("http://localhost:4000/api", isDebugBuild = true))
    }

    @Test fun releaseAndRemoteDebugTargetsStillRequireAppCheck() {
        assertTrue(shouldRequireAppCheck("http://10.0.2.2:4000/api", isDebugBuild = false))
        assertTrue(shouldRequireAppCheck("https://api.yugm.example/api", isDebugBuild = true))
        assertTrue(shouldRequireAppCheck("http://192.168.1.12:4000/api", isDebugBuild = true))
    }
}

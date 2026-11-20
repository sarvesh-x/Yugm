package com.yugm.app.feature.auth.navigation

import com.yugm.app.core.navigation.Screen
import org.junit.Assert.assertEquals
import org.junit.Test

class StartupDestinationTest {
    @Test
    fun signedOutColdLaunchAlwaysStartsAtOnboarding() {
        assertEquals(
            Screen.Onboarding.route,
            startupDestination(isLoggedIn = false, isProfileCompleted = false, isOnboardingCompleted = false),
        )
    }

    @Test
    fun signedOutCompletedOnboardingStartsAtLogin() {
        assertEquals(
            Screen.Login.route,
            startupDestination(isLoggedIn = false, isProfileCompleted = false, isOnboardingCompleted = true),
        )
    }

    @Test
    fun incompleteAuthenticatedProfileStartsAtProfileSetup() {
        assertEquals(
            Screen.ProfileSetup.route,
            startupDestination(isLoggedIn = true, isProfileCompleted = false),
        )
    }

    @Test
    fun completeAuthenticatedSessionStartsAtDiscovery() {
        assertEquals(
            Screen.MainTabs.createRoute("discover"),
            startupDestination(isLoggedIn = true, isProfileCompleted = true),
        )
    }
}

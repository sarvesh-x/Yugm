package com.yugm.app.feature.auth.navigation

import com.yugm.app.core.navigation.Screen

/** Resolves the first destination from the validated session snapshot; signed-out installs replay intro until completed/skipped. */
fun startupDestination(
    isLoggedIn: Boolean,
    isProfileCompleted: Boolean,
    isOnboardingCompleted: Boolean = false,
): String = when {
    !isLoggedIn && !isOnboardingCompleted -> Screen.Onboarding.route
    !isLoggedIn -> Screen.Login.route
    !isProfileCompleted -> Screen.ProfileSetup.route
    else -> Screen.MainTabs.createRoute("discover")
}

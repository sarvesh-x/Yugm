package com.yugm.app.feature.auth.navigation

import com.yugm.app.core.navigation.Screen

/** Resolves the first destination from the validated session snapshot; signed-out installs replay intro. */
fun startupDestination(
    isLoggedIn: Boolean,
    isProfileCompleted: Boolean,
): String = when {
    !isLoggedIn -> Screen.Onboarding.route
    !isProfileCompleted -> Screen.ProfileSetup.route
    else -> Screen.MainTabs.createRoute("discover")
}

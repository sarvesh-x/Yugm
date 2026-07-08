package com.example.yugm.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Onboarding : Screen("onboarding")
    object Login : Screen("login")
    object Otp : Screen("otp/{username}") {
        fun createRoute(username: String) = "otp/$username"
    }
    object PhoneAuth : Screen("phone_auth")
    object CreateProfile : Screen("create_profile")
    object Discover : Screen("discover")
    object Search : Screen("search")
    object Notifications : Screen("notifications")
    object Wallet : Screen("wallet")
    object Profile : Screen("profile")
    object Settings : Screen("settings")
    object CreateRoom : Screen("create_room")
    object Chat : Screen("chat/{roomId}") {
        fun createRoute(roomId: String) = "chat/$roomId"
    }
}

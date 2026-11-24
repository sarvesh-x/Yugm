package com.yugm.app.core.navigation

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.navigation.NavHostController

object PushNavigation {
    private const val PENDING_ROUTE = "yugm.pending_push_route"
    private val startupRoutes = setOf(
        Screen.Splash.route, Screen.Onboarding.route, Screen.Login.route,
        Screen.PhoneLogin.route, Screen.OtpVerify.route, Screen.ProfileSetup.route,
    )

    fun routeFromIntent(intent: Intent?): String? {
        if (intent == null) return null
        if (intent.getStringExtra("type") == "BONDS") return Screen.Bonds.createRoute(center = true)

        val room = intent.getStringExtra("roomId")?.takeIf(String::isNotBlank)?.let(Uri::encode)
        val callType = intent.getStringExtra("callType")
        val clan = intent.getStringExtra("clanId")?.takeIf(String::isNotBlank)
        val partner = intent.getStringExtra("chatPartnerId")?.takeIf(String::isNotBlank)
            ?: intent.getStringExtra("partnerId")?.takeIf(String::isNotBlank)
        return when {
            room != null && callType.equals("VIDEO", ignoreCase = true) -> Screen.VideoRoom.createRoute(room)
            room != null && callType.equals("VOICE", ignoreCase = true) -> Screen.VoiceRoom.createRoute(room)
            room != null -> Screen.RoomLobby.createRoute(room)
            clan != null -> Screen.ClanDetail.createRoute(Uri.encode(clan))
            partner != null -> Screen.Chat.createRoute(Uri.encode(partner))
            else -> null
        }
    }

    fun restorePendingRoute(savedState: Bundle?, intent: Intent?): String? =
        if (savedState?.containsKey(PENDING_ROUTE) == true) savedState.getString(PENDING_ROUTE) else routeFromIntent(intent)

    fun savePendingRoute(outState: Bundle, route: String?) {
        outState.putString(PENDING_ROUTE, route)
    }

    fun openWhenReady(
        navController: NavHostController,
        route: String?,
        signedIn: Boolean,
        startupChecked: Boolean,
        profileCompleted: Boolean,
    ): Boolean {
        val currentRoute = navController.currentDestination?.route ?: return false
        if (route.isNullOrBlank() || !signedIn || !startupChecked || !profileCompleted || currentRoute in startupRoutes) return false
        navController.navigate(route) { launchSingleTop = true }
        return true
    }
}

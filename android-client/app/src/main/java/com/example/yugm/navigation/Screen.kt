package com.example.yugm.navigation

import android.net.Uri

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Onboarding : Screen("onboarding")
    object Login : Screen("login")
    object PhoneLogin : Screen("phone_login")
    object OtpVerify : Screen("otp_verify/{username}?devOtp={devOtp}") {
        fun createRoute(username: String, devOtp: String? = null): String {
            val encodedUsername = Uri.encode(username)
            return if (devOtp.isNullOrBlank()) {
                "otp_verify/$encodedUsername"
            } else {
                "otp_verify/$encodedUsername?devOtp=${Uri.encode(devOtp)}"
            }
        }
    }
    object ProfileSetup : Screen("profile_setup")
    object Discover : Screen("discover")
    object Search : Screen("search")
    object DatingDiscovery : Screen("dating_discovery")
    object ProfileDetail : Screen("profile_detail/{userId}") {
        fun createRoute(userId: String) = "profile_detail/$userId"
    }
    object Matches : Screen("matches")
    object ChatList : Screen("chat_list")
    object Chat : Screen("chat/{conversationId}") {
        fun createRoute(conversationId: String) = "chat/$conversationId"
    }
    object LiveHome : Screen("live_home")
    object VoiceRooms : Screen("voice_rooms")
    object VideoRooms : Screen("video_rooms")
    object RoomLobby : Screen("room_lobby/{roomId}/{roomType}") {
        fun createRoute(roomId: String, roomType: String = "VOICE") = "room_lobby/$roomId/$roomType"
    }
    object VoiceRoom : Screen("voice_room/{roomId}") {
        fun createRoute(roomId: String) = "voice_room/$roomId"
    }
    object VideoRoom : Screen("video_room/{roomId}") {
        fun createRoute(roomId: String) = "video_room/$roomId"
    }
    object CreateRoom : Screen("create_room")
    object Wallet : Screen("wallet")
    object Growth : Screen("growth")
    object TrustVerificationIntro : Screen("trust_verification_intro")
    object VerificationConsent : Screen("verification_consent")
    object FaceVerification : Screen("face_verification")
    object VoiceVerification : Screen("voice_verification")
    object TrustVerificationStatus : Screen("trust_verification_status")
    object CreatorPayoutKycIntro : Screen("creator_payout_kyc_intro")
    object CreatorPayoutKycForm : Screen("creator_payout_kyc_form")
    object CreatorPayoutKycStatus : Screen("creator_payout_kyc_status")
    object WithdrawalEligibility : Screen("withdrawal_eligibility")
    object Games : Screen("games")
    object GiftCatalog : Screen("gift_catalog")
    object Vip : Screen("vip")
    object Cosmetics : Screen("cosmetics")
    object Notifications : Screen("notifications")
    object Settings : Screen("settings")
    object Safety : Screen("safety")
    object BlockedUsers : Screen("blocked_users")
    object Support : Screen("support")
    object ClanList : Screen("clan_list")
    object ClanCreate : Screen("clan_create")
    object ClanDetail : Screen("clan_detail/{clanId}") {
        fun createRoute(clanId: String) = "clan_detail/$clanId"
    }
    object ClanChat : Screen("clan_chat/{clanId}?clanName={clanName}") {
        fun createRoute(clanId: String, clanName: String = "") = "clan_chat/$clanId?clanName=${android.net.Uri.encode(clanName)}"
    }
}

package com.example.yugm.core.navigation

import android.net.Uri

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Onboarding : Screen("onboarding")
    object Login : Screen("login")
    object PhoneLogin : Screen("phone_login")
    object OtpVerify : Screen("otp_verify/{identifier}") {
        fun createRoute(identifier: String): String {
            return "otp_verify/${Uri.encode(identifier)}"
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
    object Chat : Screen("chat/{partnerId}") {
        fun createRoute(partnerId: String) = "chat/$partnerId"
    }
    object VoiceRooms : Screen("voice_rooms")
    object RoomLobby : Screen("room_lobby/{roomId}/{roomType}") {
        fun createRoute(roomId: String, roomType: String = "VOICE") = "room_lobby/$roomId/$roomType"
    }
    object VoiceRoom : Screen("voice_room/{roomId}") {
        fun createRoute(roomId: String) = "voice_room/$roomId"
    }
    object VideoRoom : Screen("video_room/{roomId}") {
        fun createRoute(roomId: String) = "video_room/$roomId"
    }
    object RoomMode : Screen("room_mode/{roomId}/{isHost}") {
        fun createRoute(roomId: String, isHost: Boolean = false) = "room_mode/$roomId/$isHost"
    }
    object CreateRoom : Screen("create_room")
    object EditRoom : Screen("edit_room/{roomId}") {
        fun createRoute(roomId: String) = "edit_room/$roomId"
    }
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
    object TicketDetail : Screen("ticket_detail/{ticketId}") {
        fun createRoute(ticketId: String) = "ticket_detail/$ticketId"
    }
    object ClanList : Screen("clan_list")
    object ClanCreate : Screen("clan_create")
    object ClanDetail : Screen("clan_detail/{clanId}") {
        fun createRoute(clanId: String) = "clan_detail/$clanId"
    }
    object ClanChat : Screen("clan_chat/{clanId}?clanName={clanName}") {
        fun createRoute(clanId: String, clanName: String = "") = "clan_chat/$clanId?clanName=${android.net.Uri.encode(clanName)}"
    }

    // New parity feature routes
    object GiftLeaderboard : Screen("gift_leaderboard")
    object Wishlist : Screen("wishlist")
    object Referral : Screen("referral")
    object Recordings : Screen("recordings")
    object RecordingPlayer : Screen("recording_player/{recordingId}") {
        fun createRoute(recordingId: String) = "recording_player/$recordingId"
    }
    object LanguagePicker : Screen("language_picker")
    object Events : Screen("events")
    object EventCreate : Screen("event_create")
    object EventDetail : Screen("event_detail/{eventId}") {
        fun createRoute(eventId: String) = "event_detail/$eventId"
    }
    object GroupChats : Screen("group_chats")
    object GroupChatDetail : Screen("group_chat_detail/{groupId}") {
        fun createRoute(groupId: String) = "group_chat_detail/$groupId"
    }
    object StoryViewer : Screen("story_viewer/{userId}") {
        fun createRoute(userId: String) = "story_viewer/$userId"
    }

    // Missing parity feature routes
    object WatchPartyPlayer : Screen("watch_party_player/{roomId}") {
        fun createRoute(roomId: String) = "watch_party_player/$roomId"
    }
    object Friends : Screen("friends")
    object Subscriptions : Screen("subscriptions")
    object Feed : Screen("feed")
    object CreateStory : Screen("create_story")
    object HighlightsManagement : Screen("highlights_management/{userId}") {
        fun createRoute(userId: String) = "highlights_management/$userId"
    }
    object ThemeGallery : Screen("theme_gallery/{roomId}") {
        fun createRoute(roomId: String) = "theme_gallery/$roomId"
    }
    object ScheduledCalendar : Screen("scheduled_calendar")
    object Hosts : Screen("hosts")
    object UserWishlist : Screen("user_wishlist/{userId}") {
        fun createRoute(userId: String) = "user_wishlist/$userId"
    }
    object Missions : Screen("missions")
    object BattlePass : Screen("battle_pass")
}

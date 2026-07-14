package com.example.yugm.api

import com.example.yugm.model.ChatMessage
import com.example.yugm.model.Clan
import com.example.yugm.model.ClanMessage
import com.example.yugm.model.ClanSummary
import com.example.yugm.model.CoinPack
import com.example.yugm.model.Conversation
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.CreatorPayoutKycStatus
import com.example.yugm.model.DailyCheckInResult
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.GameCatalog
import com.example.yugm.model.GameChallenges
import com.example.yugm.model.GameLeaderboard
import com.example.yugm.model.GameMissions
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.MediaSession
import com.example.yugm.model.MiniGameChallenge
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.NotificationPreferences
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkBattleType
import com.example.yugm.model.PkInvite
import com.example.yugm.model.PkLeaderboardEntry
import com.example.yugm.model.PkMediaSession
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStats
import com.example.yugm.model.RazorpayCheckoutData
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomDetail
import com.example.yugm.model.RoomLeaderboard
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.RoomType
import com.example.yugm.model.SavedGameScoreResult
import com.example.yugm.model.Session
import com.example.yugm.model.TrustVerificationStatus
import com.example.yugm.model.VipPlan
import com.example.yugm.model.WalletProgressResult
import com.example.yugm.model.VipStatus
import com.example.yugm.model.WalletOverview
import com.example.yugm.model.WalletTransaction
import com.example.yugm.model.WithdrawalEligibility
import com.example.yugm.model.WithdrawalRequestResult
import com.example.yugm.model.YugmUser
import org.json.JSONObject

object YugmApi {
    var isOnline
        get() = YugmHttpClient.isOnline
        set(value) { YugmHttpClient.isOnline = value }

    var onUnauthorized: (() -> Unit)?
        get() = YugmHttpClient.onUnauthorized
        set(value) { YugmHttpClient.onUnauthorized = value }

    fun endpoint(path: String): String = YugmHttpClient.endpoint(path)

    // Auth
    suspend fun requestOtp(identifier: String): String? = AuthApi.requestOtp(identifier)
    suspend fun verifyOtp(identifier: String, otp: String): Session = AuthApi.verifyOtp(identifier, otp)
    suspend fun googleAuth(idToken: String): Session = AuthApi.googleAuth(idToken)
    suspend fun phoneAuth(idToken: String): Session = AuthApi.phoneAuth(idToken)

    // Rooms
    suspend fun rooms(type: RoomType? = null): List<Room> = RoomApi.rooms(type)
    suspend fun roomMessages(roomId: String, token: String? = null): List<ChatMessage> = RoomApi.roomMessages(roomId, token)
    suspend fun createRoom(token: String, room: Room, visibility: String = "PUBLIC", allowAudienceMicRequests: Boolean = true, scheduledFor: String? = null, coverImage: String? = null): Room = RoomApi.createRoom(token, room, visibility, allowAudienceMicRequests, scheduledFor, coverImage)
    suspend fun roomDetail(token: String, roomId: String): RoomDetail = RoomApi.roomDetail(token, roomId)
    suspend fun trendingRooms(): List<Room> = RoomApi.trendingRooms()
    suspend fun recommendedRooms(token: String): List<Room> = RoomApi.recommendedRooms(token)
    suspend fun scheduledRooms(): List<Room> = RoomApi.scheduledRooms()
    suspend fun leaderboard(): RoomLeaderboard = RoomApi.leaderboard()
    suspend fun joinRoom(token: String, roomId: String) = RoomApi.joinRoom(token, roomId)
    suspend fun leaveRoom(token: String, roomId: String) = RoomApi.leaveRoom(token, roomId)
    suspend fun liveKitToken(token: String, roomId: String): MediaSession = RoomApi.liveKitToken(token, roomId)
    suspend fun sendMessage(token: String, roomId: String, message: String) = RoomApi.sendMessage(token, roomId, message)
    suspend fun requestSpeaker(token: String, roomId: String) = RoomApi.requestSpeaker(token, roomId)
    suspend fun approveSpeaker(token: String, roomId: String, userId: String) = RoomApi.approveSpeaker(token, roomId, userId)
    suspend fun rejectSpeaker(token: String, roomId: String, userId: String) = RoomApi.rejectSpeaker(token, roomId, userId)
    suspend fun roomActivity(roomId: String): List<RoomActivityItem> = RoomApi.roomActivity(roomId)
    suspend fun roomPolls(roomId: String): List<RoomPoll> = RoomApi.roomPolls(roomId)
    suspend fun createPoll(token: String, roomId: String, question: String, options: List<String>) = RoomApi.createPoll(token, roomId, question, options)
    suspend fun votePoll(token: String, roomId: String, pollId: String, optionIndex: Int) = RoomApi.votePoll(token, roomId, pollId, optionIndex)
    suspend fun roomMissions(token: String, roomId: String): List<RoomMission> = RoomApi.roomMissions(token, roomId)
    suspend fun reactToRoom(token: String, roomId: String, type: String) = RoomApi.reactToRoom(token, roomId, type)
    suspend fun inviteToRoom(token: String, roomId: String, userId: String) = RoomApi.inviteToRoom(token, roomId, userId)
    suspend fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String? = null) = RoomApi.roomDirectMessage(token, roomId, message, receiverId)
    suspend fun endRoom(roomId: String, token: String) = RoomApi.endRoom(roomId, token)
    suspend fun muteUser(roomId: String, userId: String, token: String) = RoomApi.muteUser(roomId, userId, token)
    suspend fun removeUser(roomId: String, userId: String, token: String) = RoomApi.removeUser(roomId, userId, token)
    suspend fun searchRooms(query: String): List<Room> = RoomApi.searchRooms(query)
    suspend fun uploadCover(token: String, bytes: ByteArray, mimeType: String, fileName: String): String = RoomApi.uploadCover(token, bytes, mimeType, fileName)
    suspend fun uploadMessageMedia(token: String, bytes: ByteArray, mimeType: String, fileName: String): Pair<String, String> = RoomApi.uploadMessageMedia(token, bytes, mimeType, fileName)

    // Wallet
    suspend fun wallet(token: String): Int = WalletApi.balance(token)
    suspend fun walletOverview(token: String): WalletOverview = WalletApi.walletOverview(token)
    suspend fun coinPacks(token: String): List<CoinPack> = WalletApi.coinPacks(token)
    suspend fun vipPlans(token: String): Pair<List<VipPlan>, VipStatus> = WalletApi.vipPlans(token)
    suspend fun activateVip(token: String, planId: String): WalletProgressResult = WalletApi.activateVip(token, planId)
    suspend fun verifyGooglePlayPurchase(token: String, packId: String, productId: String, purchaseToken: String, orderId: String? = null): Int = WalletApi.verifyGooglePlayPurchase(token, packId, productId, purchaseToken, orderId)
    suspend fun createRazorpayOrder(token: String, packId: String): RazorpayCheckoutData = WalletApi.createRazorpayOrder(token, packId)
    suspend fun verifyRazorpayPurchase(token: String, purchaseId: String, orderId: String, paymentId: String, signature: String): Int = WalletApi.verifyRazorpayPurchase(token, purchaseId, orderId, paymentId, signature)
    suspend fun gifts(token: String): List<GiftItem> = WalletApi.gifts(token)
    suspend fun cosmetics(token: String): CosmeticCatalog = WalletApi.cosmetics(token)
    suspend fun purchaseCosmetic(token: String, cosmeticId: String): CosmeticCatalog = WalletApi.purchaseCosmetic(token, cosmeticId)
    suspend fun equipCosmetic(token: String, cosmeticId: String, type: String): CosmeticCatalog = WalletApi.equipCosmetic(token, cosmeticId, type)
    suspend fun sendGift(token: String, roomId: String, gift: GiftItem, receiverId: String) = WalletApi.sendGift(token, roomId, gift, receiverId)
    suspend fun devRecharge(token: String, amount: Int) = WalletApi.devRecharge(token, amount)
    suspend fun walletTransactions(token: String): List<WalletTransaction> = WalletApi.transactions(token)
    suspend fun sendDirectGift(token: String, giftId: String, receiverId: String): Conversation = WalletApi.sendDirectGift(token, giftId, receiverId)

    // Dating
    suspend fun datingExplore(token: String, filters: Set<String> = emptySet()): List<Host> = DatingApi.datingExplore(token, filters)
    suspend fun datingLike(token: String, likedId: String, type: String): Pair<Boolean, String?> = DatingApi.datingLike(token, likedId, type)
    suspend fun datingPass(token: String, likedId: String) = DatingApi.datingPass(token, likedId)
    suspend fun datingMatches(token: String): List<Host> = DatingApi.datingMatches(token)

    // PK
    suspend fun activePk(token: String, roomId: String): PkBattle? = PkApi.activePk(token, roomId)
    suspend fun activePkWithInvite(token: String, roomId: String): Pair<PkBattle?, PkInvite?> = PkApi.activePkWithInvite(token, roomId)
    suspend fun availablePkOpponents(token: String, battleType: PkBattleType, search: String = ""): List<PkOpponent> = PkApi.availablePkOpponents(token, battleType, search)
    suspend fun invitePk(token: String, roomId: String, opponentRoomId: String, opponentHostId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?> = PkApi.invitePk(token, roomId, opponentRoomId, opponentHostId, battleType, mode, durationSeconds, title)
    suspend fun autoMatchPk(token: String, roomId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?> = PkApi.autoMatchPk(token, roomId, battleType, mode, durationSeconds, title)
    suspend fun acceptPk(token: String, inviteId: String): PkBattle = PkApi.acceptPk(token, inviteId)
    suspend fun rejectPk(token: String, inviteId: String) = PkApi.rejectPk(token, inviteId)
    suspend fun endPk(token: String, battleId: String): PkBattle = PkApi.endPk(token, battleId)
    suspend fun cancelPk(token: String, battleId: String) = PkApi.cancelPk(token, battleId)
    suspend fun requestRematch(token: String, battleId: String): Pair<PkBattle, Any?> = PkApi.requestRematch(token, battleId)
    suspend fun sendPkGift(token: String, battleId: String, giftId: String, side: PkSideType): PkBattle = PkApi.sendPkGift(token, battleId, giftId, side)
    suspend fun sendPkReaction(token: String, battleId: String, side: PkSideType, type: String): PkBattle = PkApi.sendPkReaction(token, battleId, side, type)
    suspend fun pkLeaderboard(token: String, battleId: String): List<PkLeaderboardEntry> = PkApi.pkLeaderboard(token, battleId)
    suspend fun pkMediaSession(token: String, battleId: String, roomId: String): PkMediaSession? = PkApi.pkMediaSession(token, battleId, roomId)
    suspend fun pkStats(token: String, userId: String): PkStats = PkApi.pkStats(token, userId)
    suspend fun pkHistory(token: String, userId: String): List<PkBattle> = PkApi.pkHistory(token, userId)

    // Clans
    suspend fun myClan(token: String): Clan? = ClanApi.myClan(token)
    suspend fun listClans(token: String, query: String = ""): List<ClanSummary> = ClanApi.listClans(token, query)
    suspend fun getClanDetail(token: String, clanId: String): Clan = ClanApi.getClanDetail(token, clanId)
    suspend fun createClan(token: String, name: String, description: String = "", privacy: String = "PUBLIC", familyLabel: String = "Family"): Clan = ClanApi.createClan(token, name, description, privacy, familyLabel)
    suspend fun joinClan(token: String, clanId: String): Clan = ClanApi.joinClan(token, clanId)
    suspend fun leaveClan(token: String, clanId: String) = ClanApi.leaveClan(token, clanId)
    suspend fun getClanMessages(token: String, clanId: String): List<ClanMessage> = ClanApi.getClanMessages(token, clanId)
    suspend fun sendClanMessage(token: String, clanId: String, message: String): ClanMessage = ClanApi.sendClanMessage(token, clanId, message)
    suspend fun reactToClanMessage(token: String, clanId: String, messageId: String, type: String): JSONObject = ClanApi.reactToClanMessage(token, clanId, messageId, type)
    suspend fun deleteClanMessage(token: String, clanId: String, messageId: String) = ClanApi.deleteClanMessage(token, clanId, messageId)
    suspend fun reportClanMessage(token: String, clanId: String, messageId: String, reason: String = "", description: String = "") = ClanApi.reportClanMessage(token, clanId, messageId, reason, description)

    // Games
    suspend fun gameCatalog(token: String): GameCatalog = GameApi.gameCatalog(token)
    suspend fun gameMissions(token: String): GameMissions = GameApi.gameMissions(token)
    suspend fun gameLeaderboard(token: String, gameId: String): GameLeaderboard = GameApi.gameLeaderboard(token, gameId)
    suspend fun gameChallenges(token: String): GameChallenges = GameApi.gameChallenges(token)
    suspend fun submitGameScore(token: String, gameId: String, score: Int, durationMs: Int? = null, rounds: Int? = null): SavedGameScoreResult = GameApi.submitGameScore(token, gameId, score, durationMs, rounds)
    suspend fun sendGameChallenge(token: String, gameId: String, score: Int, scoreId: String, targetUserId: String? = null, clanId: String? = null, message: String? = null): MiniGameChallenge = GameApi.sendGameChallenge(token, gameId, score, scoreId, targetUserId, clanId, message)
    suspend fun shareGameScore(token: String, scoreId: String, targetUserId: String) = GameApi.shareGameScore(token, scoreId, targetUserId)

    // User profile, search, follow, block, notifications, messaging
    suspend fun updateProfile(token: String, name: String, username: String, bio: String? = null, city: String? = null, interests: List<String>? = null, languages: List<String>? = null, gender: String? = null, age: Int? = null, lookingFor: String? = null, avatar: String? = null): YugmUser = UserApi.updateProfile(token, name, username, bio, city, interests, languages, gender, age, lookingFor, avatar)
    suspend fun searchUsers(query: String, token: String? = null): List<Host> = UserApi.searchUsers(query, token)
    suspend fun getUser(userId: String, token: String? = null): Host = UserApi.getUser(userId, token)
    suspend fun getUserRooms(userId: String, token: String? = null): List<Room> = UserApi.getUserRooms(userId, token)
    suspend fun getFollowers(userId: String, token: String? = null): List<Host> = UserApi.getFollowers(userId, token)
    suspend fun getFollowing(userId: String, token: String? = null): List<Host> = UserApi.getFollowing(userId, token)
    suspend fun followUser(token: String, userId: String) = UserApi.followUser(token, userId)
    suspend fun unfollowUser(token: String, userId: String) = UserApi.unfollowUser(token, userId)
    suspend fun blockUser(userId: String, token: String) = UserApi.blockUser(userId, token)
    suspend fun unblockUser(userId: String, token: String) = UserApi.unblockUser(userId, token)
    suspend fun getBlockedUsers(token: String): List<Host> = UserApi.getBlockedUsers(token)
    suspend fun closeFriends(token: String): List<Host> = UserApi.closeFriends(token)
    suspend fun getNotifications(token: String): Pair<List<NotificationItem>, Int> = UserApi.getNotifications(token)
    suspend fun markNotificationRead(token: String, notificationId: String) = UserApi.markNotificationRead(token, notificationId)
    suspend fun markAllNotificationsRead(token: String) = UserApi.markAllNotificationsRead(token)
    suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String) = UserApi.reportUser(token, roomId, targetUserId, reason)
    suspend fun sendFeedback(token: String, subject: String, message: String, category: String = "OTHER") = UserApi.sendFeedback(token, subject, message, category)
    suspend fun registerFcmToken(token: String, fcmToken: String) = UserApi.registerFcmToken(token, fcmToken)
    suspend fun level(token: String): LevelStatus = UserApi.level(token)
    suspend fun checkIn(token: String): DailyCheckInResult = UserApi.checkIn(token)
    suspend fun notificationPreferences(token: String): NotificationPreferences = UserApi.notificationPreferences(token)
    suspend fun updateNotificationPreferences(token: String, preferences: Map<String, Boolean>): NotificationPreferences = UserApi.updateNotificationPreferences(token, preferences)
    suspend fun conversation(token: String, userId: String): Conversation = UserApi.conversation(token, userId)
    suspend fun sendDirectMessage(token: String, userId: String, message: String): Conversation = UserApi.sendDirectMessage(token, userId, message)
    suspend fun sendDirectMediaMessage(token: String, userId: String, mediaUrl: String, mediaType: String, caption: String = ""): Conversation = UserApi.sendDirectMediaMessage(token, userId, mediaUrl, mediaType, caption)
    suspend fun startPrivateCall(token: String, userId: String, type: RoomType): Room = UserApi.startPrivateCall(token, userId, type)
    suspend fun reactToDirectMessage(token: String, userId: String, messageId: String, type: String = "heart"): DirectMessage = UserApi.reactToDirectMessage(token, userId, messageId, type)
    suspend fun markAllMessagesRead(token: String) = UserApi.markAllMessagesRead(token)
    suspend fun getRecentMessages(token: String): List<DirectMessage> = UserApi.getRecentMessages(token)

    // Creator / Trust / Payout / Withdrawal / Experience
    suspend fun experienceHome(token: String): com.example.yugm.model.ExperienceHome = CreatorApi.experienceHome(token)
    suspend fun creatorDashboard(token: String): com.example.yugm.model.CreatorDashboard = CreatorApi.creatorDashboard(token)
    suspend fun trustVerificationStatus(token: String): TrustVerificationStatus = CreatorApi.trustVerificationStatus(token)
    suspend fun startTrustVerification(token: String): TrustVerificationStatus = CreatorApi.startTrustVerification(token)
    suspend fun acceptTrustVerificationConsent(token: String): TrustVerificationStatus = CreatorApi.acceptTrustVerificationConsent(token)
    suspend fun trustVoicePrompt(token: String): String = CreatorApi.trustVoicePrompt(token)
    suspend fun submitTrustFace(token: String, selfieImageUrl: String? = null, selfieVideoUrl: String? = null, livenessVideoUrl: String? = null): TrustVerificationStatus = CreatorApi.submitTrustFace(token, selfieImageUrl, selfieVideoUrl, livenessVideoUrl)
    suspend fun submitTrustVoice(token: String, audioUrl: String, promptText: String, transcriptText: String? = null): TrustVerificationStatus = CreatorApi.submitTrustVoice(token, audioUrl, promptText, transcriptText)
    suspend fun submitTrustReview(token: String): TrustVerificationStatus = CreatorApi.submitTrustReview(token)
    suspend fun creatorPayoutKycStatus(token: String): CreatorPayoutKycStatus = CreatorApi.creatorPayoutKycStatus(token)
    suspend fun submitCreatorPayoutKyc(token: String, legalFullName: String, panNumber: String, upiId: String? = null, bankAccount: String? = null, bankIfsc: String? = null, bankHolderName: String? = null, dateOfBirth: String? = null): CreatorPayoutKycStatus = CreatorApi.submitCreatorPayoutKyc(token, legalFullName, panNumber, upiId, bankAccount, bankIfsc, bankHolderName, dateOfBirth)
    suspend fun withdrawalEligibility(token: String): WithdrawalEligibility = CreatorApi.withdrawalEligibility(token)
    suspend fun requestWithdrawal(token: String, amountCoins: Int): WithdrawalRequestResult = CreatorApi.requestWithdrawal(token, amountCoins)
}

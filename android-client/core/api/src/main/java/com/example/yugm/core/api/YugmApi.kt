package com.example.yugm.core.api

import com.example.yugm.core.model.ClaimAchievementResult
import com.example.yugm.core.model.GiftLeaderboardResponse
import com.example.yugm.core.model.WishlistItem
import com.example.yugm.core.model.ReferralStatsResponse
import com.example.yugm.core.model.RoomRecording
import com.example.yugm.core.model.VibeDimensionListResponse
import com.example.yugm.core.model.VibeGraphResponse
import com.example.yugm.core.model.VibeInitResponse
import com.example.yugm.core.model.VibeMatchesResponse
import com.example.yugm.core.model.VibeMatchResponse
import com.example.yugm.core.model.VibeTrendResponse
import com.example.yugm.core.model.VibeUpdateResponse
import com.example.yugm.core.model.YugmEvent
import com.example.yugm.core.model.EventPagination
import com.example.yugm.core.model.MyEvents
import com.example.yugm.core.model.GroupChat
import com.example.yugm.core.model.GroupMessage
import com.example.yugm.core.model.StoryGroup
import com.example.yugm.core.model.StoryItem
import com.example.yugm.core.model.StoryCommentItem
import com.example.yugm.core.model.StoryHighlight
import com.example.yugm.core.model.StoryUser
import com.example.yugm.core.model.WatchParty
import com.example.yugm.core.model.FriendUser
import com.example.yugm.core.model.FriendRequest
import com.example.yugm.core.model.FriendStatusResponse
import com.example.yugm.core.model.MutualFriendsResponse
import com.example.yugm.core.model.Subscription
import com.example.yugm.core.model.SubscriptionCheckResponse
import com.example.yugm.core.model.SubscribersResponse
import com.example.yugm.core.model.EquippedThemes
import com.example.yugm.core.model.FeedResponse
import com.example.yugm.core.model.Achievement
import com.example.yugm.core.model.ActiveMissionsResponse
import com.example.yugm.core.model.BattlePassLevelUpResult
import com.example.yugm.core.model.BattlePassPurchaseResult
import com.example.yugm.core.model.BattlePassResponse
import com.example.yugm.core.model.MissionClaimResult
import com.example.yugm.core.model.MissionProgressResult
import com.example.yugm.core.model.ChatMessage
import com.example.yugm.core.model.Clan
import com.example.yugm.core.model.ClanMessage
import com.example.yugm.core.model.ClanSummary
import com.example.yugm.core.model.CoinPack
import com.example.yugm.core.model.Conversation
import com.example.yugm.core.model.CosmeticCatalog
import com.example.yugm.core.model.CreatorPayoutKycStatus
import com.example.yugm.core.model.DailyCheckInResult
import com.example.yugm.core.model.DirectMessage
import com.example.yugm.core.model.GameCatalog
import com.example.yugm.core.model.GameChallenges
import com.example.yugm.core.model.GameLeaderboard
import com.example.yugm.core.model.GameMissions
import com.example.yugm.core.model.GiftCollection
import com.example.yugm.core.model.GiftItem
import com.example.yugm.core.model.GiftV2
import com.example.yugm.core.model.ComboResult
import com.example.yugm.core.model.RoomWideGiftResult
import com.example.yugm.core.model.SurpriseBoxResult
import com.example.yugm.core.model.UpgradeResult
import com.example.yugm.core.model.InventoryResponse
import com.example.yugm.core.model.TradeResult
import com.example.yugm.core.model.UserMood
import com.example.yugm.core.model.WaveNudge
import com.example.yugm.core.model.DailyQuestion
import com.example.yugm.core.model.DailyQuestionAnswer
import com.example.yugm.core.model.VoicePoll
import com.example.yugm.core.model.VoicePollListResponse
import com.example.yugm.core.model.CountdownEvent
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.ImmersiveTheme
import com.example.yugm.core.model.ModerationCheckTextRequest
import com.example.yugm.core.model.ModerationCheckTextResponse
import com.example.yugm.core.model.ModerationReportRequest
import com.example.yugm.core.model.ModerationReportResponse
import com.example.yugm.core.model.ModerationAppealRequest
import com.example.yugm.core.model.ModerationAppealResponse
import com.example.yugm.core.model.ModerationStatusResponse
import com.example.yugm.core.model.LevelStatus
import com.example.yugm.core.model.MediaSession
import com.example.yugm.core.model.MiniGameChallenge
import com.example.yugm.core.model.NotificationItem
import com.example.yugm.core.model.NotificationPreferences
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkBattleType
import com.example.yugm.core.model.PkInvite
import com.example.yugm.core.model.PkLeaderboardEntry
import com.example.yugm.core.model.PkMediaSession
import com.example.yugm.core.model.PkMode
import com.example.yugm.core.model.PkOpponent
import com.example.yugm.core.model.PkSideType
import com.example.yugm.core.model.PkStats
import com.example.yugm.core.model.RazorpayCheckoutData
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.model.RoomModeInfo
import com.example.yugm.core.model.RoomModeState
import com.example.yugm.core.model.RoomDetail
import com.example.yugm.core.model.RoomLeaderboard
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.model.RoomType
import com.example.yugm.core.model.SavedGameScoreResult
import com.example.yugm.core.model.SupportTicket
import com.example.yugm.core.model.Session
import com.example.yugm.core.model.TrustVerificationStatus
import com.example.yugm.core.model.UserThemesResponse
import com.example.yugm.core.model.VipPlan
import com.example.yugm.core.model.WalletProgressResult
import com.example.yugm.core.model.VipStatus
import com.example.yugm.core.model.WalletOverview
import com.example.yugm.core.model.WalletTransaction
import com.example.yugm.core.model.WithdrawalEligibility
import com.example.yugm.core.model.WithdrawalRequestResult
import com.example.yugm.core.model.YugmUser
import com.example.yugm.core.model.WingmanBioGenerateRequest
import com.example.yugm.core.model.WingmanBioRateRequest
import com.example.yugm.core.model.WingmanOpenerRequest
import com.example.yugm.core.model.WingmanReplyRequest
import com.example.yugm.core.model.WingmanCoachRequest
import com.example.yugm.core.model.WingmanGhostDetectRequest
import com.example.yugm.core.model.WingmanDatePlanRequest
import com.example.yugm.core.model.WingmanGiftRecommendRequest
import com.example.yugm.core.model.WingmanBioGenerateResponse
import com.example.yugm.core.model.WingmanBioRateResponse
import com.example.yugm.core.model.WingmanOpenerResponse
import com.example.yugm.core.model.WingmanReplyResponse
import com.example.yugm.core.model.WingmanCoachResponse
import com.example.yugm.core.model.WingmanGhostDetectResponse
import com.example.yugm.core.model.WingmanDatePlanResponse
import com.example.yugm.core.model.WingmanGiftRecommendResponse
import com.example.yugm.core.model.WingmanAnalyticsResponse
import org.json.JSONObject

object YugmApi : IYugmApi {
    var isOnline
        get() = YugmHttpClient.isOnline
        set(value) { YugmHttpClient.isOnline = value }

    var onUnauthorized: (() -> Unit)?
        get() = YugmHttpClient.onUnauthorized
        set(value) { YugmHttpClient.onUnauthorized = value }

    fun endpoint(path: String): String = YugmHttpClient.endpoint(path)

    // Auth
    override suspend fun requestOtp(identifier: String) = AuthApi.requestOtp(identifier)
    override suspend fun verifyOtp(identifier: String, otp: String): Session = AuthApi.verifyOtp(identifier, otp)
    override suspend fun googleAuth(idToken: String): Session = AuthApi.googleAuth(idToken)
    override suspend fun phoneAuth(idToken: String): Session = AuthApi.phoneAuth(idToken)

    // Rooms
    override suspend fun rooms(type: RoomType?): List<Room> = RoomApi.rooms(type)
    override suspend fun updateRoom(token: String, roomId: String, room: Room, coverImage: String?): Room = RoomApi.updateRoom(token, roomId, room, coverImage)
    override suspend fun roomPkHistory(token: String, roomId: String): List<PkBattle> = RoomApi.roomPkHistory(roomId, token)
    override suspend fun roomMessages(roomId: String, token: String?): List<ChatMessage> = RoomApi.roomMessages(roomId, token)
    override suspend fun createRoom(token: String, room: Room, visibility: String, allowAudienceMicRequests: Boolean, scheduledFor: String?, coverImage: String?): Room = RoomApi.createRoom(token, room, visibility, allowAudienceMicRequests, scheduledFor, coverImage)
    override suspend fun roomDetail(token: String, roomId: String): RoomDetail = RoomApi.roomDetail(token, roomId)
    override suspend fun trendingRooms(): List<Room> = RoomApi.trendingRooms()
    override suspend fun recommendedRooms(token: String): List<Room> = RoomApi.recommendedRooms(token)
    override suspend fun scheduledRooms(): List<Room> = RoomApi.scheduledRooms()
    override suspend fun leaderboard(): RoomLeaderboard = RoomApi.leaderboard()
    override suspend fun joinRoom(token: String, roomId: String) = RoomApi.joinRoom(token, roomId)
    override suspend fun leaveRoom(token: String, roomId: String) = RoomApi.leaveRoom(token, roomId)
    override suspend fun liveKitToken(token: String, roomId: String): MediaSession = RoomApi.liveKitToken(token, roomId)
    override suspend fun sendMessage(token: String, roomId: String, message: String) = RoomApi.sendMessage(token, roomId, message)
    override suspend fun requestSpeaker(token: String, roomId: String) = RoomApi.requestSpeaker(token, roomId)
    override suspend fun approveSpeaker(token: String, roomId: String, userId: String) = RoomApi.approveSpeaker(token, roomId, userId)
    override suspend fun rejectSpeaker(token: String, roomId: String, userId: String) = RoomApi.rejectSpeaker(token, roomId, userId)
    override suspend fun roomActivity(roomId: String): List<RoomActivityItem> = RoomApi.roomActivity(roomId)
    override suspend fun roomPolls(roomId: String): List<RoomPoll> = RoomApi.roomPolls(roomId)
    override suspend fun createPoll(token: String, roomId: String, question: String, options: List<String>) = RoomApi.createPoll(token, roomId, question, options)
    override suspend fun votePoll(token: String, roomId: String, pollId: String, optionIndex: Int) = RoomApi.votePoll(token, roomId, pollId, optionIndex)
    override suspend fun roomMissions(token: String, roomId: String): List<RoomMission> = RoomApi.roomMissions(token, roomId)
    override suspend fun reactToRoom(token: String, roomId: String, type: String) = RoomApi.reactToRoom(token, roomId, type)
    override suspend fun inviteToRoom(token: String, roomId: String, userId: String) = RoomApi.inviteToRoom(token, roomId, userId)
    override suspend fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String?) = RoomApi.roomDirectMessage(token, roomId, message, receiverId)
    override suspend fun endRoom(roomId: String, token: String) = RoomApi.endRoom(roomId, token)
    override suspend fun muteUser(roomId: String, userId: String, token: String) = RoomApi.muteUser(roomId, userId, token)
    override suspend fun removeUser(roomId: String, userId: String, token: String) = RoomApi.removeUser(roomId, userId, token)
    override suspend fun searchRooms(query: String): List<Room> = RoomApi.searchRooms(query)
    override suspend fun uploadCover(token: String, bytes: ByteArray, mimeType: String, fileName: String): String = RoomApi.uploadCover(token, bytes, mimeType, fileName)
    override suspend fun uploadAvatar(token: String, bytes: ByteArray, mimeType: String): String = RoomApi.uploadAvatar(token, bytes, mimeType)
    override suspend fun uploadMessageMedia(token: String, bytes: ByteArray, mimeType: String, fileName: String): Pair<String, String> = RoomApi.uploadMessageMedia(token, bytes, mimeType, fileName)
    override suspend fun uploadTrustVerificationMedia(token: String, bytes: ByteArray, mimeType: String, purpose: String): String = RoomApi.uploadTrustVerificationMedia(token, bytes, mimeType, purpose)

    // Wallet
    override suspend fun wallet(token: String): Int = WalletApi.balance(token)
    override suspend fun walletOverview(token: String): WalletOverview = WalletApi.walletOverview(token)
    override suspend fun coinPacks(token: String): List<CoinPack> = WalletApi.coinPacks(token)
    override suspend fun vipPlans(token: String): Pair<List<VipPlan>, VipStatus> = WalletApi.vipPlans(token)
    override suspend fun activateVip(token: String, planId: String): WalletProgressResult = WalletApi.activateVip(token, planId)
    override suspend fun verifyGooglePlayPurchase(token: String, packId: String, productId: String, purchaseToken: String, orderId: String?): Int = WalletApi.verifyGooglePlayPurchase(token, packId, productId, purchaseToken, orderId)
    override suspend fun createRazorpayOrder(token: String, packId: String): RazorpayCheckoutData = WalletApi.createRazorpayOrder(token, packId)
    override suspend fun verifyRazorpayPurchase(token: String, purchaseId: String, orderId: String, paymentId: String, signature: String): Int = WalletApi.verifyRazorpayPurchase(token, purchaseId, orderId, paymentId, signature)
    override suspend fun gifts(token: String): List<GiftItem> = WalletApi.gifts(token)
    override suspend fun cosmetics(token: String): CosmeticCatalog = WalletApi.cosmetics(token)
    override suspend fun purchaseCosmetic(token: String, cosmeticId: String): CosmeticCatalog = WalletApi.purchaseCosmetic(token, cosmeticId)
    override suspend fun purchaseCosmeticBundle(token: String, bundleId: String): CosmeticCatalog = WalletApi.purchaseCosmeticBundle(token, bundleId)
    override suspend fun equipCosmetic(token: String, cosmeticId: String, type: String): CosmeticCatalog = WalletApi.equipCosmetic(token, cosmeticId, type)
    override suspend fun sendGift(token: String, roomId: String, gift: GiftItem, receiverId: String) = WalletApi.sendGift(token, roomId, gift, receiverId)
    override suspend fun devRecharge(token: String, amount: Int) = WalletApi.devRecharge(token, amount)
    override suspend fun walletTransactions(token: String): List<WalletTransaction> = WalletApi.transactions(token)
    override suspend fun transferCosmetic(token: String, cosmeticId: String, receiverId: String) = WalletApi.transferCosmetic(token, cosmeticId, receiverId)
    override suspend fun purchaseHistory(token: String): List<WalletTransaction> = WalletApi.purchaseHistory(token)
    override suspend fun sendDirectGift(token: String, giftId: String, receiverId: String): Conversation = WalletApi.sendDirectGift(token, giftId, receiverId)

    // Dating
    override suspend fun datingExplore(token: String, filters: Set<String>): List<Host> = DatingApi.datingExplore(token, filters)
    override suspend fun datingLike(token: String, likedId: String, type: String): Pair<Boolean, String?> = DatingApi.datingLike(token, likedId, type)
    override suspend fun datingPass(token: String, likedId: String) = DatingApi.datingPass(token, likedId)
    override suspend fun datingMatches(token: String): List<Host> = DatingApi.datingMatches(token)
    override suspend fun datingPreferences(token: String): JSONObject = DatingApi.datingPreferences(token)
    override suspend fun updateDatingPreferences(token: String, preferences: JSONObject) = DatingApi.updateDatingPreferences(token, preferences)

    // PK
    override suspend fun activePk(token: String, roomId: String): PkBattle? = PkApi.activePk(token, roomId)
    override suspend fun activePkWithInvite(token: String, roomId: String): Pair<PkBattle?, PkInvite?> = PkApi.activePkWithInvite(token, roomId)
    override suspend fun availablePkOpponents(token: String, battleType: PkBattleType, search: String): List<PkOpponent> = PkApi.availablePkOpponents(token, battleType, search)
    override suspend fun invitePk(token: String, roomId: String, opponentRoomId: String, opponentHostId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?> = PkApi.invitePk(token, roomId, opponentRoomId, opponentHostId, battleType, mode, durationSeconds, title)
    override suspend fun autoMatchPk(token: String, roomId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?> = PkApi.autoMatchPk(token, roomId, battleType, mode, durationSeconds, title)
    override suspend fun acceptPk(token: String, inviteId: String): PkBattle = PkApi.acceptPk(token, inviteId)
    override suspend fun rejectPk(token: String, inviteId: String) = PkApi.rejectPk(token, inviteId)
    override suspend fun endPk(token: String, battleId: String): PkBattle = PkApi.endPk(token, battleId)
    override suspend fun cancelPk(token: String, battleId: String) = PkApi.cancelPk(token, battleId)
    override suspend fun requestRematch(token: String, battleId: String): Pair<PkBattle, Any?> = PkApi.requestRematch(token, battleId)
    override suspend fun sendPkGift(token: String, battleId: String, giftId: String, side: PkSideType): PkBattle = PkApi.sendPkGift(token, battleId, giftId, side)
    override suspend fun sendPkReaction(token: String, battleId: String, side: PkSideType, type: String): PkBattle = PkApi.sendPkReaction(token, battleId, side, type)
    override suspend fun pkLeaderboard(token: String, battleId: String): List<PkLeaderboardEntry> = PkApi.pkLeaderboard(token, battleId)
    override suspend fun pkMediaSession(token: String, battleId: String, roomId: String): PkMediaSession? = PkApi.pkMediaSession(token, battleId, roomId)
    override suspend fun pkStats(token: String, userId: String): PkStats = PkApi.pkStats(token, userId)
    override suspend fun pkHistory(token: String, userId: String): List<PkBattle> = PkApi.pkHistory(token, userId)

    // Clans
    override suspend fun myClan(token: String): Clan? = ClanApi.myClan(token)
    override suspend fun listClans(token: String, query: String): List<ClanSummary> = ClanApi.listClans(token, query)
    override suspend fun getClanDetail(token: String, clanId: String): Clan = ClanApi.getClanDetail(token, clanId)
    override suspend fun createClan(token: String, name: String, description: String, privacy: String, familyLabel: String): Clan = ClanApi.createClan(token, name, description, privacy, familyLabel)
    override suspend fun joinClan(token: String, clanId: String): Clan = ClanApi.joinClan(token, clanId)
    override suspend fun leaveClan(token: String, clanId: String) = ClanApi.leaveClan(token, clanId)
    override suspend fun getClanMessages(token: String, clanId: String): List<ClanMessage> = ClanApi.getClanMessages(token, clanId)
    override suspend fun sendClanMessage(token: String, clanId: String, message: String): ClanMessage = ClanApi.sendClanMessage(token, clanId, message)
    override suspend fun reactToClanMessage(token: String, clanId: String, messageId: String, type: String): JSONObject = ClanApi.reactToClanMessage(token, clanId, messageId, type)
    override suspend fun deleteClanMessage(token: String, clanId: String, messageId: String) = ClanApi.deleteClanMessage(token, clanId, messageId)
    override suspend fun reportClanMessage(token: String, clanId: String, messageId: String, reason: String, description: String) = ClanApi.reportClanMessage(token, clanId, messageId, reason, description)

    // Games
    override suspend fun gameCatalog(token: String): GameCatalog = GameApi.gameCatalog(token)
    override suspend fun gameMissions(token: String): GameMissions = GameApi.gameMissions(token)
    override suspend fun gameLeaderboard(token: String, gameId: String): GameLeaderboard = GameApi.gameLeaderboard(token, gameId)
    override suspend fun gameChallenges(token: String): GameChallenges = GameApi.gameChallenges(token)
    override suspend fun submitGameScore(token: String, gameId: String, score: Int, durationMs: Int?, rounds: Int?): SavedGameScoreResult = GameApi.submitGameScore(token, gameId, score, durationMs, rounds)
    override suspend fun sendGameChallenge(token: String, gameId: String, score: Int, scoreId: String, targetUserId: String?, clanId: String?, message: String?): MiniGameChallenge = GameApi.sendGameChallenge(token, gameId, score, scoreId, targetUserId, clanId, message)
    override suspend fun shareGameScore(token: String, scoreId: String, targetUserId: String) = GameApi.shareGameScore(token, scoreId, targetUserId)

    // User profile, search, follow, block, notifications, messaging
    override suspend fun updateProfile(token: String, name: String, username: String, bio: String?, city: String?, interests: List<String>?, languages: List<String>?, gender: String?, age: Int?, lookingFor: String?, avatar: String?): YugmUser = UserApi.updateProfile(token, name, username, bio, city, interests, languages, gender, age, lookingFor, avatar)
    override suspend fun searchUsers(query: String, token: String?): List<Host> = UserApi.searchUsers(query, token)
    override suspend fun getUser(userId: String, token: String?): Host = UserApi.getUser(userId, token)
    override suspend fun getUserRooms(userId: String, token: String?): List<Room> = UserApi.getUserRooms(userId, token)
    override suspend fun getFollowers(userId: String, token: String?): List<Host> = UserApi.getFollowers(userId, token)
    override suspend fun getFollowing(userId: String, token: String?): List<Host> = UserApi.getFollowing(userId, token)
    override suspend fun followUser(token: String, userId: String) = UserApi.followUser(token, userId)
    override suspend fun unfollowUser(token: String, userId: String) = UserApi.unfollowUser(token, userId)
    override suspend fun blockUser(userId: String, token: String) = UserApi.blockUser(userId, token)
    override suspend fun unblockUser(userId: String, token: String) = UserApi.unblockUser(userId, token)
    override suspend fun getBlockedUsers(token: String): List<Host> = UserApi.getBlockedUsers(token)
    override suspend fun closeFriends(token: String): List<Host> = UserApi.closeFriends(token)
    override suspend fun addCloseFriend(token: String, userId: String) = UserApi.addCloseFriend(token, userId)
    override suspend fun removeCloseFriend(token: String, userId: String) = UserApi.removeCloseFriend(token, userId)
    override suspend fun addProfileMedia(token: String, mediaUrl: String, mediaType: String) = UserApi.addProfileMedia(token, mediaUrl, mediaType)
    override suspend fun deleteProfileMedia(token: String, mediaId: String) = UserApi.deleteProfileMedia(token, mediaId)
    override suspend fun suggestedHosts(token: String): List<Host> = UserApi.suggestedHosts(token)
    override suspend fun levelLeaderboard(token: String): List<Host> = UserApi.levelLeaderboard(token)
    override suspend fun getNotifications(token: String): Pair<List<NotificationItem>, Int> = UserApi.getNotifications(token)
    override suspend fun markNotificationRead(token: String, notificationId: String) = UserApi.markNotificationRead(token, notificationId)
    override suspend fun markAllNotificationsRead(token: String) = UserApi.markAllNotificationsRead(token)
    override suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String) = UserApi.reportUser(token, roomId, targetUserId, reason)
    override suspend fun sendFeedback(token: String, subject: String, message: String, category: String) = UserApi.sendFeedback(token, subject, message, category)
    override suspend fun registerFcmToken(token: String, fcmToken: String) = UserApi.registerFcmToken(token, fcmToken)
    override suspend fun level(token: String): LevelStatus = UserApi.level(token)
    override suspend fun checkIn(token: String): DailyCheckInResult = UserApi.checkIn(token)
    override suspend fun claimAchievement(token: String, achievementId: String): ClaimAchievementResult = CreatorApi.claimAchievement(token, achievementId)
    override suspend fun notificationPreferences(token: String): NotificationPreferences = UserApi.notificationPreferences(token)
    override suspend fun updateNotificationPreferences(token: String, preferences: Map<String, Boolean>): NotificationPreferences = UserApi.updateNotificationPreferences(token, preferences)
    override suspend fun conversation(token: String, userId: String): Conversation = UserApi.conversation(token, userId)
    override suspend fun sendDirectMessage(token: String, userId: String, message: String): Conversation = UserApi.sendDirectMessage(token, userId, message)
    override suspend fun sendDirectMediaMessage(token: String, userId: String, mediaUrl: String, mediaType: String, caption: String): Conversation = UserApi.sendDirectMediaMessage(token, userId, mediaUrl, mediaType, caption)
    override suspend fun startPrivateCall(token: String, userId: String, type: RoomType): Room = UserApi.startPrivateCall(token, userId, type)
    override suspend fun reactToDirectMessage(token: String, userId: String, messageId: String, type: String): DirectMessage = UserApi.reactToDirectMessage(token, userId, messageId, type)
    override suspend fun markAllMessagesRead(token: String) = UserApi.markAllMessagesRead(token)
    override suspend fun getRecentMessages(token: String): List<DirectMessage> = UserApi.getRecentMessages(token)

    // Creator / Trust / Payout / Withdrawal / Experience
    override suspend fun experienceHome(token: String): com.example.yugm.core.model.ExperienceHome = CreatorApi.experienceHome(token)
    override suspend fun creatorDashboard(token: String): com.example.yugm.core.model.CreatorDashboard = CreatorApi.creatorDashboard(token)
    override suspend fun trustVerificationStatus(token: String): TrustVerificationStatus = CreatorApi.trustVerificationStatus(token)
    override suspend fun startTrustVerification(token: String): TrustVerificationStatus = CreatorApi.startTrustVerification(token)
    override suspend fun acceptTrustVerificationConsent(token: String): TrustVerificationStatus = CreatorApi.acceptTrustVerificationConsent(token)
    override suspend fun trustVoicePrompt(token: String): String = CreatorApi.trustVoicePrompt(token)
    override suspend fun submitTrustFace(token: String, selfieImageUrl: String?, selfieVideoUrl: String?, livenessVideoUrl: String?): TrustVerificationStatus = CreatorApi.submitTrustFace(token, selfieImageUrl, selfieVideoUrl, livenessVideoUrl)
    override suspend fun submitTrustVoice(token: String, audioUrl: String, promptText: String, transcriptText: String?): TrustVerificationStatus = CreatorApi.submitTrustVoice(token, audioUrl, promptText, transcriptText)
    override suspend fun submitTrustReview(token: String): TrustVerificationStatus = CreatorApi.submitTrustReview(token)
    override suspend fun creatorPayoutKycStatus(token: String): CreatorPayoutKycStatus = CreatorApi.creatorPayoutKycStatus(token)
    override suspend fun submitCreatorPayoutKyc(token: String, legalFullName: String, panNumber: String, upiId: String?, bankAccount: String?, bankIfsc: String?, bankHolderName: String?, dateOfBirth: String?): CreatorPayoutKycStatus = CreatorApi.submitCreatorPayoutKyc(token, legalFullName, panNumber, upiId, bankAccount, bankIfsc, bankHolderName, dateOfBirth)
    override suspend fun withdrawalEligibility(token: String): WithdrawalEligibility = CreatorApi.withdrawalEligibility(token)
    override suspend fun requestWithdrawal(token: String, amountCoins: Int): WithdrawalRequestResult = CreatorApi.requestWithdrawal(token, amountCoins)

    // Support Tickets
    override suspend fun createSupportTicket(token: String, subject: String, message: String, category: String, priority: String): SupportTicket = SupportApi.createTicket(token, subject, message, category, priority)
    override suspend fun listSupportTickets(token: String, status: String?, page: Int, limit: Int): Triple<List<SupportTicket>, Int, Int> = SupportApi.listTickets(token, status, page, limit)
    override suspend fun getSupportTicket(token: String, ticketId: String): SupportTicket = SupportApi.getTicket(token, ticketId)
    override suspend fun addSupportMessage(token: String, ticketId: String, message: String): SupportTicket = SupportApi.addMessage(token, ticketId, message)
    override suspend fun closeSupportTicket(token: String, ticketId: String): SupportTicket = SupportApi.closeTicket(token, ticketId)

    // Gift Leaderboard
    override suspend fun giftLeaderboard(token: String, period: String, skip: Int, limit: Int): GiftLeaderboardResponse = GiftLeaderboardApi.leaderboard(token, period, skip, limit)

    // Wishlist
    override suspend fun myWishlist(token: String): List<WishlistItem> = WishlistApi.myWishlist(token)
    override suspend fun userWishlist(token: String, userId: String): List<WishlistItem> = WishlistApi.userWishlist(token, userId)
    override suspend fun addWishlistItem(token: String, giftId: String, message: String?, isPublic: Boolean): WishlistItem = WishlistApi.addItem(token, giftId, message, isPublic)
    override suspend fun deleteWishlistItem(token: String, itemId: String) = WishlistApi.deleteItem(token, itemId)
    override suspend fun sendWishlistGift(token: String, itemId: String) = WishlistApi.sendGiftFromWishlist(token, itemId)

    // Referral
    override suspend fun getReferralCode(token: String): String = ReferralApi.getCode(token)
    override suspend fun generateReferralCode(token: String): String = ReferralApi.generateCode(token)
    override suspend fun claimReferral(token: String, code: String): Pair<Int, String> = ReferralApi.claim(token, code)
    override suspend fun referralStats(token: String): ReferralStatsResponse = ReferralApi.stats(token)

    // Recordings
    override suspend fun startRecording(token: String, roomId: String, title: String?): RoomRecording = RecordingsApi.start(token, roomId, title)
    override suspend fun stopRecording(token: String, recordingId: String, recordingUrl: String, duration: Int): RoomRecording = RecordingsApi.stop(token, recordingId, recordingUrl, duration)
    override suspend fun roomRecordings(token: String, roomId: String, page: Int, limit: Int): Pair<List<RoomRecording>, Int> = RecordingsApi.listByRoom(token, roomId, page, limit)
    override suspend fun recordingDetail(token: String, recordingId: String): RoomRecording = RecordingsApi.detail(token, recordingId)
    override suspend fun updateRecording(token: String, recordingId: String, title: String): RoomRecording = RecordingsApi.update(token, recordingId, title)
    override suspend fun deleteRecording(token: String, recordingId: String) = RecordingsApi.delete(token, recordingId)
    override suspend fun viewRecording(token: String, recordingId: String): Int = RecordingsApi.view(token, recordingId)

    // Events
    override suspend fun listEvents(token: String?, page: Int, limit: Int, status: String?, type: String?, category: String?, upcoming: Boolean?, festival: String?, featured: Boolean?): Pair<List<YugmEvent>, EventPagination> = EventsApi.list(token, page, limit, status, type, category, upcoming, festival, featured)
    override suspend fun eventDetail(eventId: String, token: String?): YugmEvent = EventsApi.detail(eventId, token)
    override suspend fun createEvent(token: String, title: String, description: String?, coverImage: String?, category: String, type: String, eventDate: String, eventEndDate: String?, timezone: String?, roomId: String?, maxParticipants: Int?, tags: List<String>?, festival: String?): YugmEvent = EventsApi.create(token, title, description, coverImage, category, type, eventDate, eventEndDate, timezone, roomId, maxParticipants, tags, festival)
    override suspend fun joinEvent(token: String, eventId: String): YugmEvent = EventsApi.join(token, eventId)
    override suspend fun leaveEvent(token: String, eventId: String): YugmEvent = EventsApi.leave(token, eventId)
    override suspend fun cancelEvent(token: String, eventId: String): YugmEvent = EventsApi.cancel(token, eventId)
    override suspend fun myEvents(token: String): MyEvents = EventsApi.myEvents(token)

    // Group Chats
    override suspend fun listGroups(token: String): List<GroupChat> = GroupsApi.list(token)
    override suspend fun groupDetail(token: String, groupId: String): Pair<GroupChat, Int> = GroupsApi.detail(token, groupId)
    override suspend fun createGroup(token: String, name: String, participantIds: List<String>): GroupChat = GroupsApi.create(token, name, participantIds)
    override suspend fun addGroupParticipants(token: String, groupId: String, participantIds: List<String>): GroupChat = GroupsApi.addParticipants(token, groupId, participantIds)
    override suspend fun removeGroupParticipant(token: String, groupId: String, userId: String): GroupChat = GroupsApi.removeParticipant(token, groupId, userId)
    override suspend fun leaveGroup(token: String, groupId: String) = GroupsApi.leave(token, groupId)
    override suspend fun groupMessages(token: String, groupId: String, skip: Int, limit: Int): List<GroupMessage> = GroupsApi.messages(token, groupId, skip, limit)
    override suspend fun sendGroupMessage(token: String, groupId: String, message: String, mediaUrl: String?, mediaType: String?, duration: Int?): GroupMessage = GroupsApi.sendMessage(token, groupId, message, mediaUrl, mediaType, duration)

    // Stories
    override suspend fun storyFeed(token: String): List<StoryGroup> = StoryApi.feed(token)
    override suspend fun userStories(token: String, userId: String): List<StoryItem> = StoryApi.userStories(token, userId)
    override suspend fun createStory(token: String, mediaUrl: String, mediaType: String, caption: String?, backgroundColor: String?, textColor: String?, font: String?, sticker: String?, linkUrl: String?): StoryItem = StoryApi.create(token, mediaUrl, mediaType, caption, backgroundColor, textColor, font, sticker, linkUrl)
    override suspend fun viewStory(token: String, storyId: String) = StoryApi.view(token, storyId)
    override suspend fun likeStory(token: String, storyId: String) = StoryApi.like(token, storyId)
    override suspend fun hideStory(token: String, storyId: String) = StoryApi.hide(token, storyId)
    override suspend fun deleteStory(token: String, storyId: String) = StoryApi.delete(token, storyId)
    override suspend fun storyViewers(token: String, storyId: String): List<StoryUser> = StoryApi.viewers(token, storyId)
    override suspend fun storyComments(token: String, storyId: String, skip: Int, limit: Int): List<StoryCommentItem> = StoryApi.comments(token, storyId, skip, limit)
    override suspend fun addStoryComment(token: String, storyId: String, text: String): StoryCommentItem = StoryApi.addComment(token, storyId, text)
    override suspend fun replyToStoryComment(token: String, storyId: String, commentId: String, text: String): StoryCommentItem = StoryApi.replyToComment(token, storyId, commentId, text)
    override suspend fun deleteStoryComment(token: String, commentId: String) = StoryApi.deleteComment(token, commentId)

    // Highlights
    override suspend fun userHighlights(token: String, userId: String): List<StoryHighlight> = HighlightsApi.getUserHighlights(token, userId)
    override suspend fun createHighlight(token: String, title: String, storyIds: List<String>): StoryHighlight = HighlightsApi.create(token, title, storyIds)
    override suspend fun deleteHighlight(token: String, highlightId: String) = HighlightsApi.delete(token, highlightId)

    // Watch Party
    override suspend fun watchPartyStart(token: String, roomId: String, title: String, mediaUrl: String): WatchParty = WatchPartyApi.start(token, roomId, title, mediaUrl)
    override suspend fun watchPartyGet(token: String, roomId: String): WatchParty = WatchPartyApi.get(token, roomId)
    override suspend fun watchPartySync(token: String, roomId: String, position: Double, isPlaying: Boolean): WatchParty = WatchPartyApi.sync(token, roomId, position, isPlaying)
    override suspend fun watchPartyStop(token: String, roomId: String) = WatchPartyApi.stop(token, roomId)

    // Friends
    override suspend fun friendRequest(token: String, userId: String) = FriendsApi.request(token, userId)
    override suspend fun friendAccept(token: String, userId: String) = FriendsApi.accept(token, userId)
    override suspend fun friendDecline(token: String, userId: String) = FriendsApi.decline(token, userId)
    override suspend fun friendUnfriend(token: String, userId: String) = FriendsApi.unfriend(token, userId)
    override suspend fun friendList(token: String): List<FriendUser> = FriendsApi.list(token)
    override suspend fun friendRequests(token: String): List<FriendRequest> = FriendsApi.requests(token)
    override suspend fun friendSent(token: String): List<FriendRequest> = FriendsApi.sent(token)
    override suspend fun friendStatus(token: String, userId: String): FriendStatusResponse = FriendsApi.status(token, userId)
    override suspend fun friendMutual(token: String, userId: String): MutualFriendsResponse = FriendsApi.mutual(token, userId)
    override suspend fun friendCount(token: String, userId: String): Int = FriendsApi.count(token, userId)

    // Subscriptions
    override suspend fun subscribeCreator(token: String, creatorId: String, plan: String): Subscription = SubscriptionsApi.subscribe(token, creatorId, plan)
    override suspend fun cancelSubscription(token: String, creatorId: String) = SubscriptionsApi.cancel(token, creatorId)
    override suspend fun mySubscriptions(token: String): List<Subscription> = SubscriptionsApi.list(token)
    override suspend fun mySubscribers(token: String): SubscribersResponse = SubscriptionsApi.subscribers(token)
    override suspend fun checkSubscription(token: String, creatorId: String): SubscriptionCheckResponse = SubscriptionsApi.check(token, creatorId)

    // Feed
    override suspend fun feed(token: String): FeedResponse = FeedApi.get(token)

    // AI Wingman
    override suspend fun wingmanBioGenerate(token: String, request: WingmanBioGenerateRequest) = WingmanApi.bioGenerate(token, request)
    override suspend fun wingmanBioRate(token: String, bio: String) = WingmanApi.bioRate(token, bio)
    override suspend fun wingmanOpeners(token: String, request: WingmanOpenerRequest) = WingmanApi.openers(token, request)
    override suspend fun wingmanReplies(token: String, request: WingmanReplyRequest) = WingmanApi.replies(token, request)
    override suspend fun wingmanCoach(token: String, request: WingmanCoachRequest) = WingmanApi.coach(token, request)
    override suspend fun wingmanGhostDetect(token: String, request: WingmanGhostDetectRequest) = WingmanApi.ghostDetect(token, request)
    override suspend fun wingmanDatePlan(token: String, request: WingmanDatePlanRequest) = WingmanApi.datePlan(token, request)
    override suspend fun wingmanGiftRecommend(token: String, request: WingmanGiftRecommendRequest) = WingmanApi.giftRecommend(token, request)
    override suspend fun wingmanAnalytics(token: String) = WingmanApi.analytics(token)

    // Vibe Graph
    override suspend fun vibeInit(token: String): VibeInitResponse = VibeApi.init(token)
    override suspend fun vibeUpdate(token: String, interactionType: String, targetUserId: String?): VibeUpdateResponse = VibeApi.update(token, interactionType, targetUserId)
    override suspend fun vibeMatch(token: String, userId: String): VibeMatchResponse = VibeApi.match(token, userId)
    override suspend fun vibeMatches(token: String, page: Int, limit: Int): VibeMatchesResponse = VibeApi.matches(token, page, limit)
    override suspend fun vibeGraph(token: String): VibeGraphResponse = VibeApi.graph(token)
    override suspend fun vibeTrend(token: String): VibeTrendResponse = VibeApi.trend(token)
    override suspend fun vibeDimensions(token: String): VibeDimensionListResponse = VibeApi.dimensions(token)
    override suspend fun vibePreferences(token: String, dimensions: List<String>): VibeGraphResponse = VibeApi.preferences(token, dimensions)

    // Room Modes
    override suspend fun roomModes(): List<RoomModeInfo> = RoomModesApi.modes()
    override suspend fun roomSetMode(token: String, roomId: String, mode: String): Pair<Room, RoomModeState> = RoomModesApi.setMode(token, roomId, mode)
    override suspend fun roomModeState(token: String, roomId: String): Pair<String?, RoomModeState?> = RoomModesApi.modeState(token, roomId)
    override suspend fun roomModeAction(token: String, roomId: String, action: String, data: Map<String, Any>?): RoomModeState = RoomModesApi.modeAction(token, roomId, action, data)
    override suspend fun roomModeRandom(token: String): Triple<String, Room?, List<Room>> = RoomModesApi.randomModeRoom(token)

    // Co-Host Management (added to RoomApi)
    override suspend fun roomCoHosts(token: String, roomId: String): List<Host> = RoomApi.coHosts(token, roomId)
    override suspend fun addCoHost(token: String, roomId: String, userId: String): Host = RoomApi.addCoHost(token, roomId, userId)
    override suspend fun removeCoHost(token: String, roomId: String, userId: String) = RoomApi.removeCoHost(token, roomId, userId)

    // Badge Showcase
    override suspend fun updateBadgeShowcase(token: String, badgeIds: List<String>) = CreatorApi.updateBadgeShowcase(token, badgeIds)
    override suspend fun getUserBadges(token: String, userId: String): List<Achievement> = CreatorApi.getUserBadges(token, userId)

    // Achievement Sharing
    override suspend fun shareAchievement(token: String, achievementId: String): String = CreatorApi.shareAchievement(token, achievementId)

    // Themes
    override suspend fun themes(token: String): List<ImmersiveTheme> = ThemesApi.themes(token)
    override suspend fun purchaseTheme(token: String, themeKey: String): ImmersiveTheme = ThemesApi.purchaseTheme(token, themeKey)
    override suspend fun setRoomTheme(token: String, roomId: String, themeKey: String): Room = ThemesApi.setRoomTheme(token, roomId, themeKey)
    override suspend fun userThemes(token: String): UserThemesResponse = ThemesApi.userThemes(token)
    override suspend fun equipTheme(token: String, slot: String, themeKey: String?): EquippedThemes = ThemesApi.equipTheme(token, slot, themeKey)

    // Missions
    override suspend fun activeMissions(token: String): ActiveMissionsResponse = MissionsApi.activeMissions(token)
    override suspend fun updateMissionProgress(token: String, action: String, delta: Int): List<MissionProgressResult> = MissionsApi.updateProgress(token, action, delta)
    override suspend fun claimMission(token: String, missionId: String): MissionClaimResult = MissionsApi.claim(token, missionId)

    // Battle Pass
    override suspend fun battlePass(token: String): BattlePassResponse = BattlePassApi.get(token)
    override suspend fun purchaseBattlePass(token: String): BattlePassPurchaseResult = BattlePassApi.purchase(token)
    override suspend fun battlePassLevelUp(token: String, xp: Int): BattlePassLevelUpResult = BattlePassApi.levelUp(token, xp)

    // Social features (Week 9)
    override suspend fun getMood(token: String): UserMood = SocialApi.getMood(token)
    override suspend fun setMood(token: String, mood: String, emoji: String?): UserMood = SocialApi.setMood(token, mood, emoji)
    override suspend fun setActivity(token: String, activity: String, roomId: String?): UserMood = SocialApi.setActivity(token, activity, roomId)
    override suspend fun clearMood(token: String) = SocialApi.clearMood(token)
    override suspend fun sendWave(token: String, receiverId: String, type: String, roomId: String?): WaveNudge = SocialApi.sendWave(token, receiverId, type, roomId)
    override suspend fun getWaves(token: String, unreadOnly: Boolean): List<WaveNudge> = SocialApi.getWaves(token, unreadOnly)
    override suspend fun getUnreadWaveCount(token: String): Int = SocialApi.getUnreadWaveCount(token)
    override suspend fun markWaveRead(token: String, waveId: String) = SocialApi.markWaveRead(token, waveId)
    override suspend fun getDailyQuestion(token: String): DailyQuestion = SocialApi.getDailyQuestion(token)
    override suspend fun answerDailyQuestion(token: String, questionId: String, answer: String, isPublic: Boolean): DailyQuestionAnswer = SocialApi.answerDailyQuestion(token, questionId, answer, isPublic)
    override suspend fun getQuestionAnswers(token: String, questionId: String): List<DailyQuestionAnswer> = SocialApi.getQuestionAnswers(token, questionId)
    override suspend fun getMyAnswer(token: String, questionId: String): DailyQuestionAnswer? = SocialApi.getMyAnswer(token, questionId)
    override suspend fun createVoicePoll(token: String, question: String, options: List<Pair<String, String?>>, audioUrl: String?, duration: Int?, expiresInHours: Int?): VoicePoll = SocialApi.createVoicePoll(token, question, options, audioUrl, duration, expiresInHours)
    override suspend fun getActiveVoicePolls(token: String, page: Int, limit: Int): VoicePollListResponse = SocialApi.getActiveVoicePolls(token, page, limit)
    override suspend fun voteVoicePoll(token: String, pollId: String, optionIndex: Int): VoicePoll = SocialApi.voteVoicePoll(token, pollId, optionIndex)
    override suspend fun getMyVoicePolls(token: String): List<VoicePoll> = SocialApi.getMyVoicePolls(token)
    override suspend fun getCountdowns(token: String): List<CountdownEvent> = SocialApi.getCountdowns(token)

    // Gifts v2
    override suspend fun giftsV2(token: String, category: String?, rarity: String?, page: Int, limit: Int): Pair<List<GiftV2>, Int> = GiftsApi.giftsV2(token, category, rarity, page, limit)
    override suspend fun giftCollections(token: String): List<GiftCollection> = GiftsApi.collections(token)
    override suspend fun comboGift(token: String, roomId: String, giftId: String, participants: List<String>): ComboResult = GiftsApi.comboGift(token, roomId, giftId, participants)
    override suspend fun roomWideGift(token: String, roomId: String, giftId: String, receiverIds: List<String>): RoomWideGiftResult = GiftsApi.roomWideGift(token, roomId, giftId, receiverIds)
    override suspend fun surpriseBox(token: String, tier: String): SurpriseBoxResult = GiftsApi.surpriseBox(token, tier)
    override suspend fun upgradeGift(token: String, inventoryId: String): UpgradeResult = GiftsApi.upgradeGift(token, inventoryId)
    override suspend fun inventory(token: String): InventoryResponse = GiftsApi.inventory(token)
    override suspend fun tradeGift(token: String, targetUserId: String, offerItems: List<String>, requestItems: List<String>): TradeResult = GiftsApi.tradeGift(token, targetUserId, offerItems, requestItems)

    // Moderation
    override suspend fun moderationCheckText(token: String, request: ModerationCheckTextRequest): ModerationCheckTextResponse = ModerationApi.checkText(token, request)
    override suspend fun moderationReport(token: String, request: ModerationReportRequest): ModerationReportResponse = ModerationApi.report(token, request)
    override suspend fun moderationAppeal(token: String, request: ModerationAppealRequest): ModerationAppealResponse = ModerationApi.appeal(token, request)
    override suspend fun moderationStatus(token: String): ModerationStatusResponse = ModerationApi.getStatus(token)
}

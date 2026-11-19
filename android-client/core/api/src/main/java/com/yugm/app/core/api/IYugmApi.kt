package com.yugm.app.core.api

import com.yugm.app.core.model.Achievement
import com.yugm.app.core.model.PagedDirectMessages
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.ClaimAchievementResult
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.ClanInvitation
import com.yugm.app.core.model.ClanSentInvitation
import com.yugm.app.core.model.ClanRankingEntry
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.Conversation
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.CreatorDashboard
import com.yugm.app.core.model.CreatorPayoutKycStatus
import com.yugm.app.core.model.DailyCheckInResult
import com.yugm.app.core.model.DailyRewardClaimResult
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.EventPagination
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.FeedResponse
import com.yugm.app.core.model.FriendRequest
import com.yugm.app.core.model.FriendStatusResponse
import com.yugm.app.core.model.FriendUser
import com.yugm.app.core.model.GameCatalog
import com.yugm.app.core.model.GameChallenges
import com.yugm.app.core.model.GameLeaderboard
import com.yugm.app.core.model.GameMissions
import com.yugm.app.core.model.EquippedThemes
import com.yugm.app.core.model.GiftCollection
import com.yugm.app.core.model.GiftPurchaseResult
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.GiftLeaderboardResponse
import com.yugm.app.core.model.GiftV2
import com.yugm.app.core.model.UserFullInventory
import com.yugm.app.core.model.LevelOverview
import com.yugm.app.core.model.ComboResult
import com.yugm.app.core.model.RoomWideGiftResult
import com.yugm.app.core.model.SurpriseBoxResult
import com.yugm.app.core.model.UpgradeResult
import com.yugm.app.core.model.InventoryResponse
import com.yugm.app.core.model.TradeResult
import com.yugm.app.core.model.UserMood
import com.yugm.app.core.model.WaveNudge
import com.yugm.app.core.model.DailyQuestion
import com.yugm.app.core.model.DailyQuestionAnswer
import com.yugm.app.core.model.VoicePoll
import com.yugm.app.core.model.VoicePollListResponse
import com.yugm.app.core.model.CountdownEvent
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.ImmersiveTheme
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.MediaSession
import com.yugm.app.core.model.MiniGameChallenge
import com.yugm.app.core.model.MyEvents
import com.yugm.app.core.model.MutualFriendsResponse
import com.yugm.app.core.model.NotificationItem
import com.yugm.app.core.model.NotificationPreferences
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkBattleType
import com.yugm.app.core.model.PkInvite
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkMediaSession
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkFormat
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStats
import com.yugm.app.core.model.PurchaseRecord
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomModeInfo
import com.yugm.app.core.model.RoomModeState
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomDetail
import com.yugm.app.core.model.RoomLeaderboard
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.BattlePassPurchaseResult
import com.yugm.app.core.model.BattlePassResponse
import com.yugm.app.core.model.MissionClaimResult
import com.yugm.app.core.model.ModerationCheckTextRequest
import com.yugm.app.core.model.ModerationCheckTextResponse
import com.yugm.app.core.model.ModerationReportRequest
import com.yugm.app.core.model.ModerationReportResponse
import com.yugm.app.core.model.ModerationAppealRequest
import com.yugm.app.core.model.ModerationAppealResponse
import com.yugm.app.core.model.ModerationStatusResponse
import com.yugm.app.core.model.MissionProgressResult
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.SavedGameScoreResult
import com.yugm.app.core.model.SupportTicket
import com.yugm.app.core.model.Session
import com.yugm.app.core.model.RefreshedSession
import com.yugm.app.core.model.TrustVerificationStatus
import com.yugm.app.core.model.UserThemesResponse
import com.yugm.app.core.model.VibeDimensionListResponse
import com.yugm.app.core.model.VibeGraphResponse
import com.yugm.app.core.model.VibeInitResponse
import com.yugm.app.core.model.VibeMatchesResponse
import com.yugm.app.core.model.VibeMatchResponse
import com.yugm.app.core.model.VibeTrendResponse
import com.yugm.app.core.model.VibeUpdateResponse
import com.yugm.app.core.model.VipPlan
import com.yugm.app.core.model.VipPrivacySettings
import com.yugm.app.core.model.WalletOverview
import com.yugm.app.core.model.WalletProgressResult
import com.yugm.app.core.model.VipStatus
import com.yugm.app.core.model.WalletTransaction
import com.yugm.app.core.model.WithdrawalEligibility
import com.yugm.app.core.model.WithdrawalRequestResult
import com.yugm.app.core.model.YugmEvent
import com.yugm.app.core.model.YugmUser
import com.yugm.app.core.model.ReferralStatsResponse
import com.yugm.app.core.model.RoomRecording
import com.yugm.app.core.model.StoryCommentItem
import com.yugm.app.core.model.StoryGroup
import com.yugm.app.core.model.StoryHighlight
import com.yugm.app.core.model.StoryItem
import com.yugm.app.core.model.StoryUser
import com.yugm.app.core.model.SubscribersResponse
import com.yugm.app.core.model.Subscription
import com.yugm.app.core.model.SubscriptionCheckResponse
import com.yugm.app.core.model.WatchParty
import com.yugm.app.core.model.WishlistItem
import com.yugm.app.core.model.WingmanBioGenerateRequest
import com.yugm.app.core.model.WingmanBioGenerateResponse
import com.yugm.app.core.model.WingmanBioRateResponse
import com.yugm.app.core.model.WingmanOpenerRequest
import com.yugm.app.core.model.WingmanOpenerResponse
import com.yugm.app.core.model.WingmanReplyRequest
import com.yugm.app.core.model.WingmanReplyResponse
import com.yugm.app.core.model.WingmanCoachRequest
import com.yugm.app.core.model.WingmanCoachResponse
import com.yugm.app.core.model.WingmanGhostDetectRequest
import com.yugm.app.core.model.WingmanGhostDetectResponse
import com.yugm.app.core.model.WingmanDatePlanRequest
import com.yugm.app.core.model.WingmanDatePlanResponse
import com.yugm.app.core.model.WingmanGiftRecommendRequest
import com.yugm.app.core.model.WingmanGiftRecommendResponse
import com.yugm.app.core.model.WingmanAnalyticsResponse
import org.json.JSONObject

interface IYugmApi {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google", name: String? = null, mode: String? = null): Session
    suspend fun facebookAuth(idToken: String, acceptTerms: Boolean, name: String? = null): Session
    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Session
    suspend fun refreshAuth(refreshToken: String): RefreshedSession
    suspend fun logoutAuth(token: String, refreshToken: String, deviceToken: String? = null)
    suspend fun authMe(token: String): YugmUser

    suspend fun rooms(type: RoomType? = null): List<Room>
    suspend fun updateRoom(token: String, roomId: String, room: Room, coverImage: String? = null): Room
    suspend fun roomPkHistory(token: String, roomId: String): List<PkBattle>
    suspend fun roomMessages(roomId: String, token: String? = null): List<ChatMessage>
    suspend fun createRoom(token: String, room: Room, visibility: String = "PUBLIC", allowAudienceMicRequests: Boolean = true, scheduledFor: String? = null, coverImage: String? = null): Room
    suspend fun roomDetail(token: String, roomId: String): RoomDetail
    suspend fun trendingRooms(): List<Room>
    suspend fun recommendedRooms(token: String): List<Room>
    suspend fun scheduledRooms(): List<Room>
    suspend fun followedRooms(token: String): List<Room>
    suspend fun followRoom(token: String, roomId: String)
    suspend fun unfollowRoom(token: String, roomId: String)
    suspend fun presenceCount(token: String): Int

suspend fun leaderboard(): RoomLeaderboard
    suspend fun joinRoom(token: String, roomId: String)
    suspend fun leaveRoom(token: String, roomId: String)
    suspend fun liveKitToken(token: String, roomId: String): MediaSession
    suspend fun sendMessage(token: String, roomId: String, message: String, mediaUrl: String? = null, mediaType: String? = null): ChatMessage
    suspend fun requestSpeaker(token: String, roomId: String)
    suspend fun approveSpeaker(token: String, roomId: String, userId: String)
    suspend fun rejectSpeaker(token: String, roomId: String, userId: String)
    suspend fun takeRoomSeat(token: String, roomId: String, seatIndex: Int)
    suspend fun leaveRoomSeat(token: String, roomId: String)
    suspend fun inviteSpeaker(token: String, roomId: String, userId: String)
    suspend fun removeSpeaker(token: String, roomId: String, userId: String)
    suspend fun roomActivity(roomId: String, token: String? = null): List<RoomActivityItem>
    suspend fun roomPolls(token: String, roomId: String): List<RoomPoll>
    suspend fun createPoll(token: String, roomId: String, question: String, options: List<String>)
    suspend fun votePoll(token: String, roomId: String, pollId: String, optionIndex: Int)
    suspend fun closePoll(token: String, roomId: String, pollId: String)
    suspend fun roomMissions(token: String, roomId: String): List<RoomMission>
    suspend fun reactToRoom(token: String, roomId: String, type: String)
    suspend fun roomReactions(token: String? = null): List<RoomReaction>
    suspend fun inviteToRoom(token: String, roomId: String, userId: String)
    suspend fun roomFollowers(token: String, roomId: String): List<com.yugm.app.core.model.Host>
    suspend fun respondToRoomInvite(token: String, inviteId: String, accept: Boolean): String
    suspend fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String? = null)
    suspend fun endRoom(roomId: String, token: String): com.yugm.app.core.model.RoomSessionSummary
    suspend fun muteUser(roomId: String, userId: String, token: String)
    suspend fun unmuteUser(roomId: String, userId: String, token: String)
    suspend fun clearRoomChat(roomId: String, token: String)
    suspend fun setOwnRoomMicState(roomId: String, enabled: Boolean, token: String)
    suspend fun removeUser(roomId: String, userId: String, token: String)
    suspend fun setRoomAdmin(roomId: String, userId: String, isAdmin: Boolean, token: String)
    suspend fun setRoomMicLocked(roomId: String, locked: Boolean, token: String)
    suspend fun setRoomSeatLocked(roomId: String, seatIndex: Int, locked: Boolean, token: String)
    suspend fun searchRooms(query: String): List<Room>
    suspend fun uploadCover(token: String, bytes: ByteArray, mimeType: String, fileName: String): String
    suspend fun uploadAvatar(token: String, bytes: ByteArray, mimeType: String): String
    suspend fun uploadMessageMedia(token: String, bytes: ByteArray, mimeType: String, fileName: String): Pair<String, String>
    suspend fun uploadTrustVerificationMedia(token: String, bytes: ByteArray, mimeType: String, purpose: String): String

    // Room Modes
    suspend fun roomModes(): List<RoomModeInfo>
    suspend fun roomSetMode(token: String, roomId: String, mode: String): Pair<Room, RoomModeState>
    suspend fun roomModeState(token: String, roomId: String): Pair<String?, RoomModeState?>
    suspend fun roomModeAction(token: String, roomId: String, action: String, data: Map<String, Any>? = null): RoomModeState
    suspend fun roomModeRandom(token: String): Triple<String, Room?, List<Room>>

    suspend fun roomCoHosts(token: String, roomId: String): List<Host>
    suspend fun addCoHost(token: String, roomId: String, userId: String): Host
    suspend fun removeCoHost(token: String, roomId: String, userId: String)

    suspend fun wallet(token: String): Int
    suspend fun walletOverview(token: String): WalletOverview
    suspend fun coinPacks(token: String): List<CoinPack>
    suspend fun vipPlans(token: String): Pair<List<VipPlan>, VipStatus>
    suspend fun activateVip(token: String, planId: String): WalletProgressResult
    suspend fun verifyGooglePlayPurchase(token: String, packId: String, productId: String, purchaseToken: String, orderId: String? = null): Int
    suspend fun createRazorpayOrder(token: String, packId: String): RazorpayCheckoutData
    suspend fun verifyRazorpayPurchase(token: String, purchaseId: String, orderId: String, paymentId: String, signature: String): Int
    suspend fun gifts(token: String): List<GiftItem>
    suspend fun cosmetics(token: String): CosmeticCatalog
    suspend fun purchaseCosmetic(token: String, cosmeticId: String): CosmeticCatalog
    suspend fun purchaseCosmeticBundle(token: String, bundleId: String): CosmeticCatalog
    suspend fun equipCosmetic(token: String, cosmeticId: String, type: String): CosmeticCatalog
    suspend fun sendGift(token: String, roomId: String, gift: GiftItem, receiverId: String, currency: String = "COINS", inventoryItemId: String? = null)
    suspend fun devRecharge(token: String, amount: Int)
    suspend fun walletTransactions(token: String): List<WalletTransaction>
    suspend fun transferCosmetic(token: String, cosmeticId: String, receiverId: String)
    suspend fun claimDailyReward(token: String): DailyRewardClaimResult
    suspend fun purchaseHistory(token: String): List<PurchaseRecord>
    suspend fun sendDirectGift(token: String, giftId: String, receiverId: String): Conversation

    suspend fun datingExplore(token: String, filters: Set<String> = emptySet()): List<Host>
    suspend fun datingLike(token: String, likedId: String, type: String): Pair<Boolean, String?>
    suspend fun datingPass(token: String, likedId: String)
    suspend fun datingMatches(token: String): List<Host>
    suspend fun datingPreferences(token: String): JSONObject
    suspend fun updateDatingPreferences(token: String, preferences: JSONObject)

    suspend fun activePk(token: String, roomId: String): PkBattle?
    suspend fun activePkWithInvite(token: String, roomId: String): Pair<PkBattle?, PkInvite?>
    suspend fun availablePkOpponents(token: String, battleType: PkBattleType, search: String = ""): List<PkOpponent>
    suspend fun invitePk(token: String, roomId: String, opponentRoomId: String, opponentHostId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?>
    suspend fun autoMatchPk(token: String, roomId: String, battleType: PkBattleType, mode: PkMode, durationSeconds: Int, title: String): Pair<PkBattle, PkInvite?>
    suspend fun acceptPk(token: String, inviteId: String): PkBattle
    suspend fun rejectPk(token: String, inviteId: String)
    suspend fun endPk(token: String, battleId: String): PkBattle
    suspend fun startRoomPk(token: String, roomId: String, leftPlayerIds: List<String>, rightPlayerIds: List<String>, format: PkFormat, mode: PkMode, durationSeconds: Int, selectedGiftId: String?): PkBattle
    suspend fun votePk(token: String, battleId: String, side: PkSideType): PkBattle
    suspend fun readyPk(token: String, battleId: String): PkBattle
    suspend fun closePk(token: String, battleId: String): PkBattle
    suspend fun cancelPk(token: String, battleId: String)
    suspend fun requestRematch(token: String, battleId: String): Pair<PkBattle, Any?>
    suspend fun sendPkGift(token: String, battleId: String, giftId: String, side: PkSideType, quantity: Int = 1): PkBattle
    suspend fun sendPkReaction(token: String, battleId: String, side: PkSideType, type: String): PkBattle
    suspend fun pkLeaderboard(token: String, battleId: String): List<PkLeaderboardEntry>
    suspend fun pkMediaSession(token: String, battleId: String, roomId: String): PkMediaSession?
    suspend fun pkStats(token: String, userId: String): PkStats
    suspend fun pkHistory(token: String, userId: String): List<PkBattle>

    suspend fun myClan(token: String): Clan?
    suspend fun listClans(token: String, query: String = ""): List<ClanSummary>
    suspend fun getClanDetail(token: String, clanId: String): Clan
    suspend fun createClan(token: String, name: String, description: String = "", privacy: String = "PUBLIC", familyLabel: String = "Family", avatar: String? = null): Clan
    suspend fun updateClan(token: String, clanId: String, name: String, description: String, privacy: String, familyLabel: String, avatar: String?): Clan
    suspend fun setClanMemberRole(token: String, clanId: String, userId: String, role: String): Clan
    suspend fun kickClanMember(token: String, clanId: String, userId: String): Clan
    suspend fun deleteClan(token: String, clanId: String)
    suspend fun joinClan(token: String, clanId: String): Clan
    suspend fun leaveClan(token: String, clanId: String)
    suspend fun getClanMessages(token: String, clanId: String, limit: Int = 80, before: String? = null): List<ClanMessage>
    suspend fun sendClanMessage(token: String, clanId: String, message: String): ClanMessage
    suspend fun reactToClanMessage(token: String, clanId: String, messageId: String, type: String): ClanMessage
    suspend fun deleteClanMessage(token: String, clanId: String, messageId: String)
    suspend fun reportClanMessage(token: String, clanId: String, messageId: String, reason: String = "", description: String = "")

  suspend fun cleanClanChat(token: String, clanId: String): Int
    suspend fun clanInvitations(token: String): List<ClanInvitation>
    suspend fun clanSentInvitations(token: String, clanId: String): List<ClanSentInvitation>
    suspend fun cancelClanInvitation(token: String, clanId: String, inviteId: String)
    suspend fun respondToClanInvitation(token: String, invitationId: String, accept: Boolean)
    suspend fun inviteClanMember(token: String, clanId: String, userId: String)
    suspend fun transferClanOwnership(token: String, clanId: String, userId: String)
    suspend fun clanLeaderboard(token: String): List<ClanRankingEntry>

    suspend fun gameCatalog(token: String): GameCatalog
    suspend fun gameMissions(token: String): GameMissions
    suspend fun gameLeaderboard(token: String, gameId: String): GameLeaderboard
    suspend fun gameChallenges(token: String): GameChallenges
    suspend fun submitGameScore(token: String, gameId: String, score: Int, durationMs: Int? = null, rounds: Int? = null): SavedGameScoreResult
    suspend fun sendGameChallenge(token: String, gameId: String, score: Int, scoreId: String, targetUserId: String? = null, clanId: String? = null, message: String? = null): MiniGameChallenge
    suspend fun shareGameScore(token: String, scoreId: String, targetUserId: String)

    suspend fun updateProfile(token: String, name: String, username: String, bio: String? = null, city: String? = null, interests: List<String>? = null, languages: List<String>? = null, gender: String? = null, age: Int? = null, lookingFor: String? = null, avatar: String? = null, acceptTerms: Boolean = false, vibeLine: String? = null, hobbies: List<String>? = null, state: String? = null, interestedIn: String? = null, datingAgeMin: Int? = null, datingAgeMax: Int? = null): YugmUser
    suspend fun searchUsers(query: String, token: String? = null, usernameOnly: Boolean = false): List<Host>
    suspend fun getUser(userId: String, token: String? = null): Host
    suspend fun getPublicProfile(userId: String, token: String? = null): Host
    suspend fun getPublicProfileByUsername(username: String, token: String? = null): Host
    suspend fun fullInventory(token: String): UserFullInventory
    suspend fun levelOverview(token: String): LevelOverview
    suspend fun getUserRooms(userId: String, token: String? = null): List<Room>
    suspend fun getFollowers(userId: String, token: String? = null): List<Host>
    suspend fun getFollowing(userId: String, token: String? = null): List<Host>
    suspend fun getUserFriends(userId: String, token: String): List<Host>
    suspend fun getProfileVisitors(userId: String, token: String): List<Host>
    suspend fun vipPrivacy(token: String): VipPrivacySettings
    suspend fun updateVipPrivacy(token: String, settings: VipPrivacySettings): VipPrivacySettings
    suspend fun getFriends(token: String): List<Host>
    suspend fun followUser(token: String, userId: String)
    suspend fun unfollowUser(token: String, userId: String)
    suspend fun removeFollower(token: String, followerId: String)
    suspend fun blockUser(userId: String, token: String)
    suspend fun unblockUser(userId: String, token: String)
    suspend fun getBlockedUsers(token: String): List<Host>
    suspend fun closeFriends(token: String): List<Host>
    suspend fun addCloseFriend(token: String, userId: String)
    suspend fun removeCloseFriend(token: String, userId: String)
    suspend fun addProfileMedia(token: String, mediaUrl: String, mediaType: String)
    suspend fun deleteProfileMedia(token: String, mediaId: String)
    suspend fun suggestedHosts(token: String): List<Host>

    suspend fun recommendedChatUsers(token: String): List<Host>
    suspend fun levelLeaderboard(token: String): List<Host>
    suspend fun levelLeaderboardPage(token: String, page: Int = 1, pageSize: Int = 25): com.yugm.app.core.model.LevelLeaderboardPage
    suspend fun getNotifications(token: String): Pair<List<NotificationItem>, Int>
    suspend fun markNotificationRead(token: String, notificationId: String)
    suspend fun markAllNotificationsRead(token: String)
    suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String)
    suspend fun sendFeedback(token: String, subject: String, message: String, category: String = "OTHER")
    suspend fun registerFcmToken(token: String, fcmToken: String)
    suspend fun removeFcmToken(token: String, fcmToken: String)
    suspend fun deleteOwnAccount(token: String)
    suspend fun level(token: String): LevelStatus
    suspend fun checkIn(token: String): DailyCheckInResult
    suspend fun achievements(token: String): List<Achievement>
    suspend fun claimAchievement(token: String, achievementId: String): ClaimAchievementResult
    suspend fun notificationPreferences(token: String): NotificationPreferences
    suspend fun updateNotificationPreferences(token: String, preferences: Map<String, Boolean>): NotificationPreferences
    suspend fun conversation(token: String, userId: String, before: String? = null, limit: Int? = null, markRead: Boolean = true): Conversation
    suspend fun deleteConversation(token: String, userId: String)
    suspend fun deleteSelectedDirectMessages(token: String, userId: String, messageIds: List<String>, scope: String): List<String>
    suspend fun editDirectMessage(token: String, userId: String, messageId: String, message: String): DirectMessage
    suspend fun forwardDirectMessage(token: String, userId: String, messageId: String): DirectMessage
    suspend fun replyDirectMessage(token: String, userId: String, message: String, replyToId: String): DirectMessage
    suspend fun searchConversation(token: String, userId: String, query: String, before: String? = null, limit: Int? = null): List<DirectMessage>
    suspend fun searchConversationPage(token: String, userId: String, query: String, before: String? = null, limit: Int? = null): PagedDirectMessages
    suspend fun muteConversation(token: String, userId: String, muted: Boolean)
    suspend fun unreadCounts(token: String): Map<String, Int>
    suspend fun mutedConversations(token: String): Set<String>
    suspend fun sendDirectMessage(token: String, userId: String, message: String): Conversation
    suspend fun sendDirectMediaMessage(token: String, userId: String, mediaUrl: String, mediaType: String, caption: String = ""): Conversation
    suspend fun startPrivateCall(token: String, userId: String, type: RoomType): Room
    suspend fun searchRandomFriend(token: String): Room?
    suspend fun randomFriendMatch(token: String): Room?
    suspend fun cancelRandomFriendSearch(token: String)
    suspend fun reactToDirectMessage(token: String, userId: String, messageId: String, type: String = "heart"): DirectMessage
    suspend fun markAllMessagesRead(token: String)
    suspend fun markConversationRead(token: String, partnerId: String)
    suspend fun getRecentMessages(token: String, before: String? = null, limit: Int? = null): List<DirectMessage>
    suspend fun getRecentMessagesPage(token: String, before: String? = null, limit: Int? = null): PagedDirectMessages

    suspend fun experienceHome(token: String): ExperienceHome
    suspend fun creatorDashboard(token: String): CreatorDashboard
    suspend fun trustVerificationStatus(token: String): TrustVerificationStatus
    suspend fun startTrustVerification(token: String): TrustVerificationStatus
    suspend fun acceptTrustVerificationConsent(token: String): TrustVerificationStatus
    suspend fun trustVoicePrompt(token: String): String
    suspend fun submitTrustFace(token: String, selfieImageUrl: String? = null, selfieVideoUrl: String? = null, livenessVideoUrl: String? = null): TrustVerificationStatus
    suspend fun submitTrustVoice(token: String, audioUrl: String, promptText: String, transcriptText: String? = null): TrustVerificationStatus
    suspend fun submitTrustReview(token: String): TrustVerificationStatus
    suspend fun retryTrustVerification(token: String): TrustVerificationStatus
    suspend fun creatorPayoutKycStatus(token: String): CreatorPayoutKycStatus
    suspend fun submitCreatorPayoutKyc(token: String, legalFullName: String, panNumber: String, upiId: String? = null, bankAccount: String? = null, bankIfsc: String? = null, bankHolderName: String? = null, dateOfBirth: String? = null): CreatorPayoutKycStatus
    suspend fun withdrawalEligibility(token: String): WithdrawalEligibility
    suspend fun requestWithdrawal(token: String, amountCoins: Int): WithdrawalRequestResult

    suspend fun createSupportTicket(token: String, subject: String, message: String, category: String = "General", priority: String = "MEDIUM"): SupportTicket
    suspend fun listSupportTickets(token: String, status: String? = null, page: Int = 1, limit: Int = 20): Triple<List<SupportTicket>, Int, Int>
    suspend fun getSupportTicket(token: String, ticketId: String): SupportTicket
    suspend fun addSupportMessage(token: String, ticketId: String, message: String): SupportTicket
    suspend fun closeSupportTicket(token: String, ticketId: String): SupportTicket

    suspend fun giftLeaderboard(token: String, period: String = "all", skip: Int = 0, limit: Int = 20): GiftLeaderboardResponse

    suspend fun myWishlist(token: String): List<WishlistItem>
    suspend fun userWishlist(token: String, userId: String): List<WishlistItem>
    suspend fun addWishlistItem(token: String, giftId: String, message: String? = null, isPublic: Boolean = true): WishlistItem
    suspend fun deleteWishlistItem(token: String, itemId: String)
    suspend fun sendWishlistGift(token: String, itemId: String)

    suspend fun getReferralCode(token: String): String
    suspend fun generateReferralCode(token: String): String
    suspend fun claimReferral(token: String, code: String): Pair<Int, String>
    suspend fun referralStats(token: String): ReferralStatsResponse

    suspend fun startRecording(token: String, roomId: String, title: String? = null): RoomRecording
    suspend fun stopRecording(token: String, recordingId: String, recordingUrl: String, duration: Int): RoomRecording
    suspend fun roomRecordings(token: String, roomId: String, page: Int = 1, limit: Int = 20): Pair<List<RoomRecording>, Int>
    suspend fun recordingDetail(token: String, recordingId: String): RoomRecording
    suspend fun updateRecording(token: String, recordingId: String, title: String): RoomRecording
    suspend fun deleteRecording(token: String, recordingId: String)
    suspend fun viewRecording(token: String, recordingId: String): Int

    suspend fun listEvents(token: String? = null, page: Int = 1, limit: Int = 20, status: String? = null, type: String? = null, category: String? = null, upcoming: Boolean? = null, festival: String? = null, featured: Boolean? = null, roomId: String? = null): Pair<List<YugmEvent>, EventPagination>
    suspend fun eventDetail(eventId: String, token: String? = null): YugmEvent
    suspend fun createEvent(token: String, title: String, description: String? = null, coverImage: String? = null, category: String, type: String, eventDate: String, eventEndDate: String? = null, timezone: String? = null, roomId: String? = null, maxParticipants: Int? = null, tags: List<String>? = null, festival: String? = null): YugmEvent
    suspend fun joinEvent(token: String, eventId: String): YugmEvent
    suspend fun leaveEvent(token: String, eventId: String): YugmEvent
    suspend fun cancelEvent(token: String, eventId: String): YugmEvent
    suspend fun myEvents(token: String): MyEvents

    suspend fun storyFeed(token: String): List<StoryGroup>
    suspend fun userStories(token: String, userId: String): List<StoryItem>
    suspend fun createStory(token: String, mediaUrl: String, mediaType: String, caption: String? = null, backgroundColor: String? = null, textColor: String? = null, font: String? = null, sticker: String? = null, linkUrl: String? = null): StoryItem
    suspend fun viewStory(token: String, storyId: String)
    suspend fun likeStory(token: String, storyId: String)
    suspend fun hideStory(token: String, storyId: String)
    suspend fun deleteStory(token: String, storyId: String)
    suspend fun storyViewers(token: String, storyId: String): List<StoryUser>
    suspend fun storyComments(token: String, storyId: String, skip: Int = 0, limit: Int = 50): List<StoryCommentItem>
    suspend fun addStoryComment(token: String, storyId: String, text: String): StoryCommentItem
    suspend fun replyToStoryComment(token: String, storyId: String, commentId: String, text: String): StoryCommentItem
    suspend fun deleteStoryComment(token: String, commentId: String)

    suspend fun userHighlights(token: String, userId: String): List<StoryHighlight>
    suspend fun createHighlight(token: String, title: String, storyIds: List<String>): StoryHighlight
    suspend fun deleteHighlight(token: String, highlightId: String)

    suspend fun watchPartyStart(token: String, roomId: String, title: String, mediaUrl: String): WatchParty
    suspend fun watchPartyGet(token: String, roomId: String): WatchParty
    suspend fun watchPartySync(token: String, roomId: String, position: Double, isPlaying: Boolean): WatchParty
    suspend fun watchPartyStop(token: String, roomId: String)

    suspend fun friendRequest(token: String, userId: String)
    suspend fun friendAccept(token: String, userId: String)
    suspend fun friendDecline(token: String, userId: String)
    suspend fun friendUnfriend(token: String, userId: String)
    suspend fun friendList(token: String): List<FriendUser>
    suspend fun friendRequests(token: String): List<FriendRequest>
    suspend fun friendSent(token: String): List<FriendRequest>
    suspend fun friendStatus(token: String, userId: String): FriendStatusResponse
    suspend fun friendMutual(token: String, userId: String): MutualFriendsResponse
    suspend fun friendCount(token: String, userId: String): Int

    suspend fun subscribeCreator(token: String, creatorId: String, plan: String): Subscription
    suspend fun cancelSubscription(token: String, creatorId: String)
    suspend fun mySubscriptions(token: String): List<Subscription>
    suspend fun mySubscribers(token: String): SubscribersResponse
    suspend fun checkSubscription(token: String, creatorId: String): SubscriptionCheckResponse

    suspend fun feed(token: String): FeedResponse

    // AI Wingman
    suspend fun wingmanBioGenerate(token: String, request: com.yugm.app.core.model.WingmanBioGenerateRequest): com.yugm.app.core.model.WingmanBioGenerateResponse
    suspend fun wingmanBioRate(token: String, bio: String): com.yugm.app.core.model.WingmanBioRateResponse
    suspend fun wingmanOpeners(token: String, request: com.yugm.app.core.model.WingmanOpenerRequest): com.yugm.app.core.model.WingmanOpenerResponse
    suspend fun wingmanReplies(token: String, request: com.yugm.app.core.model.WingmanReplyRequest): com.yugm.app.core.model.WingmanReplyResponse
    suspend fun wingmanCoach(token: String, request: com.yugm.app.core.model.WingmanCoachRequest): com.yugm.app.core.model.WingmanCoachResponse
    suspend fun wingmanGhostDetect(token: String, request: com.yugm.app.core.model.WingmanGhostDetectRequest): com.yugm.app.core.model.WingmanGhostDetectResponse
    suspend fun wingmanDatePlan(token: String, request: com.yugm.app.core.model.WingmanDatePlanRequest): com.yugm.app.core.model.WingmanDatePlanResponse
    suspend fun wingmanGiftRecommend(token: String, request: com.yugm.app.core.model.WingmanGiftRecommendRequest): com.yugm.app.core.model.WingmanGiftRecommendResponse
    suspend fun wingmanAnalytics(token: String): com.yugm.app.core.model.WingmanAnalyticsResponse

    // Vibe Graph
    suspend fun vibeInit(token: String): VibeInitResponse
    suspend fun vibeUpdate(token: String, interactionType: String, targetUserId: String? = null): VibeUpdateResponse
    suspend fun vibeMatch(token: String, userId: String): VibeMatchResponse
    suspend fun vibeMatches(token: String, page: Int = 1, limit: Int = 20): VibeMatchesResponse
    suspend fun vibeGraph(token: String): VibeGraphResponse
    suspend fun vibeTrend(token: String): VibeTrendResponse
    suspend fun vibeDimensions(token: String): VibeDimensionListResponse
    suspend fun vibePreferences(token: String, dimensions: List<String>): VibeGraphResponse

    suspend fun updateBadgeShowcase(token: String, badgeIds: List<String>)
    suspend fun getUserBadges(token: String, userId: String): List<Achievement>
    suspend fun shareAchievement(token: String, achievementId: String): String

    // Themes
    suspend fun themes(token: String): List<ImmersiveTheme>
    suspend fun purchaseTheme(token: String, themeKey: String): ImmersiveTheme
    suspend fun setRoomTheme(token: String, roomId: String, themeKey: String): Room
    suspend fun userThemes(token: String): UserThemesResponse
    suspend fun equipTheme(token: String, slot: String, themeKey: String?): EquippedThemes

    // Missions
    suspend fun activeMissions(token: String): ActiveMissionsResponse
    suspend fun updateMissionProgress(token: String, action: String, delta: Int = 1): List<MissionProgressResult>
    suspend fun claimMission(token: String, missionId: String): MissionClaimResult

    // Battle Pass
    suspend fun battlePass(token: String): BattlePassResponse
    suspend fun purchaseBattlePass(token: String): BattlePassPurchaseResult
    suspend fun claimBattlePassReward(token: String, level: Int, track: String): BattlePassResponse

    // Social features (Week 9)
    suspend fun getMood(token: String): UserMood
    suspend fun setMood(token: String, mood: String, emoji: String? = null): UserMood
    suspend fun setActivity(token: String, activity: String, roomId: String? = null): UserMood
    suspend fun clearMood(token: String)
    suspend fun sendWave(token: String, receiverId: String, type: String, roomId: String? = null): WaveNudge
    suspend fun getWaves(token: String, unreadOnly: Boolean = false): List<WaveNudge>
    suspend fun getUnreadWaveCount(token: String): Int
    suspend fun markWaveRead(token: String, waveId: String)
    suspend fun getDailyQuestion(token: String): DailyQuestion
    suspend fun answerDailyQuestion(token: String, questionId: String, answer: String, isPublic: Boolean = true): DailyQuestionAnswer
    suspend fun getQuestionAnswers(token: String, questionId: String): List<DailyQuestionAnswer>
    suspend fun getMyAnswer(token: String, questionId: String): DailyQuestionAnswer?
    suspend fun createVoicePoll(token: String, question: String, options: List<Pair<String, String?>>, audioUrl: String? = null, duration: Int? = null, expiresInHours: Int? = 24): VoicePoll
    suspend fun getActiveVoicePolls(token: String, page: Int = 1, limit: Int = 20): VoicePollListResponse
    suspend fun getVoicePollById(token: String, pollId: String): VoicePoll
    suspend fun voteVoicePoll(token: String, pollId: String, optionIndex: Int): VoicePoll
    suspend fun closeVoicePoll(token: String, pollId: String): VoicePoll
    suspend fun getMyVoicePolls(token: String): List<VoicePoll>
    suspend fun getCountdowns(token: String): List<CountdownEvent>

    // Gifts v2
    suspend fun giftsV2(token: String, category: String? = null, rarity: String? = null, page: Int = 1, limit: Int = 20): Pair<List<GiftV2>, Int>
    suspend fun giftCollections(token: String): List<GiftCollection>
    suspend fun purchaseGift(token: String, giftId: String): GiftPurchaseResult
    suspend fun comboGift(token: String, roomId: String, giftId: String, participants: List<String>): ComboResult
    suspend fun roomWideGift(token: String, roomId: String, giftId: String, receiverIds: List<String>): RoomWideGiftResult
    suspend fun surpriseBox(token: String, tier: String): SurpriseBoxResult
    suspend fun upgradeGift(token: String, inventoryId: String): UpgradeResult
    suspend fun inventory(token: String): InventoryResponse
    suspend fun tradeGift(token: String, targetUserId: String, offerItems: List<String>, requestItems: List<String>): TradeResult

    // Moderation
    suspend fun moderationCheckText(token: String, request: ModerationCheckTextRequest): ModerationCheckTextResponse
    suspend fun moderationReport(token: String, request: ModerationReportRequest): ModerationReportResponse
    suspend fun moderationAppeal(token: String, request: ModerationAppealRequest): ModerationAppealResponse
    suspend fun moderationStatus(token: String): ModerationStatusResponse
}

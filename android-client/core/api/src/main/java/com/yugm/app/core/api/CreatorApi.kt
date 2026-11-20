package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.Achievement
import com.yugm.app.core.model.BadgeGallery
import com.yugm.app.core.model.ClaimAchievementResult
import com.yugm.app.core.model.CreatorEarningBalance
import com.yugm.app.core.model.CreatorPayoutKycStatus
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.PayoutRequirements
import com.yugm.app.core.model.TrustVerificationStatus
import com.yugm.app.core.model.WithdrawalEligibility
import com.yugm.app.core.model.WithdrawalRequestResult
import org.json.JSONArray
import org.json.JSONObject

object CreatorApi {
    suspend fun experienceHome(token: String): ExperienceHome {
        return YugmHttpClient.get("/experience/home", token).getJSONObject("data").toExperienceHome()
    }

    suspend fun claimAchievement(token: String, achievementId: String): ClaimAchievementResult {
        val data = YugmHttpClient.post("/experience/achievements/claim", token, JSONObject().put("achievementId", achievementId)).getJSONObject("data")
        return ClaimAchievementResult(
            claimed = data.optBoolean("claimed", false),
            rewardCoins = data.optInt("rewardCoins", 0),
            rewardCosmetic = data.optString("rewardCosmetic", ""),
            tier = data.optString("tier", "")
        )
    }

    suspend fun creatorDashboard(token: String): com.yugm.app.core.model.CreatorDashboard {
        return YugmHttpClient.get("/experience/creator-dashboard", token).getJSONObject("data").toCreatorDashboard()
    }

    suspend fun trustVerificationStatus(token: String): TrustVerificationStatus {
        val data = YugmHttpClient.get("/trust-verification/status", token).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun startTrustVerification(token: String): TrustVerificationStatus {
        val data = YugmHttpClient.post("/trust-verification/start", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun acceptTrustVerificationConsent(token: String): TrustVerificationStatus {
        val data = YugmHttpClient.post("/trust-verification/consent", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun trustVoicePrompt(token: String): String {
        return YugmHttpClient.get("/trust-verification/voice-prompt", token).getJSONObject("data").optString("promptText", "")
    }

    suspend fun submitTrustFace(token: String, selfieImageUrl: String? = null, selfieVideoUrl: String? = null, livenessVideoUrl: String? = null): TrustVerificationStatus {
        val body = JSONObject()
        if (!selfieImageUrl.isNullOrBlank()) body.put("selfieImageUrl", selfieImageUrl)
        if (!selfieVideoUrl.isNullOrBlank()) body.put("selfieVideoUrl", selfieVideoUrl)
        if (!livenessVideoUrl.isNullOrBlank()) body.put("livenessVideoUrl", livenessVideoUrl)
        val data = YugmHttpClient.post("/trust-verification/face", token, body).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun submitTrustVoice(token: String, audioUrl: String, promptText: String, transcriptText: String? = null): TrustVerificationStatus {
        val body = JSONObject().put("audioUrl", audioUrl).put("promptText", promptText)
        if (!transcriptText.isNullOrBlank()) body.put("transcriptText", transcriptText)
        val data = YugmHttpClient.post("/trust-verification/voice", token, body).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun submitTrustReview(token: String): TrustVerificationStatus {
        val data = YugmHttpClient.post("/trust-verification/submit-review", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun retryTrustVerification(token: String): TrustVerificationStatus {
        val data = YugmHttpClient.post("/trust-verification/retry", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun creatorPayoutKycStatus(token: String): CreatorPayoutKycStatus {
        val data = YugmHttpClient.get("/creator/payout-kyc/status", token).getJSONObject("data")
        return data.getJSONObject("kyc").toCreatorPayoutKycStatus()
    }

    suspend fun submitCreatorPayoutKyc(
        token: String,
        legalFullName: String,
        panNumber: String,
        upiId: String? = null,
        bankAccount: String? = null,
        bankIfsc: String? = null,
        bankHolderName: String? = null,
        dateOfBirth: String? = null
    ): CreatorPayoutKycStatus {
        val body = JSONObject()
            .put("legalFullName", legalFullName)
            .put("panNumber", panNumber)
            .put("declarationsAccepted", true)
        if (!upiId.isNullOrBlank()) body.put("upiId", upiId)
        if (!bankAccount.isNullOrBlank()) body.put("bankAccount", bankAccount)
        if (!bankIfsc.isNullOrBlank()) body.put("bankIfsc", bankIfsc)
        if (!bankHolderName.isNullOrBlank()) body.put("bankHolderName", bankHolderName)
        if (!dateOfBirth.isNullOrBlank()) body.put("dateOfBirth", dateOfBirth)
        val data = YugmHttpClient.post("/creator/payout-kyc/submit", token, body).getJSONObject("data")
        return data.getJSONObject("kyc").toCreatorPayoutKycStatus()
    }

    suspend fun withdrawalEligibility(token: String): WithdrawalEligibility {
        val data = YugmHttpClient.get("/creator/withdrawals/eligibility", token).getJSONObject("data")
        return WithdrawalEligibility(
            balance = data.getJSONObject("balance").toCreatorEarningBalance(),
            payoutKyc = data.getJSONObject("payoutKyc").toCreatorPayoutKycStatus(),
            requirements = data.optJSONObject("requirements")?.let {
                PayoutRequirements(
                    creatorAccount = it.optBoolean("creatorAccount", false),
                    trustVerified = it.optBoolean("trustVerified", false),
                    creatorTrustEnabled = it.optBoolean("creatorTrustEnabled", false),
                    payoutKycVerified = it.optBoolean("payoutKycVerified", false),
                    payoutEnabled = it.optBoolean("payoutEnabled", false)
                )
            } ?: PayoutRequirements(),
            coinToInrRate = data.optDouble("coinToInrRate", 0.01)
        )
    }

    suspend fun requestWithdrawal(token: String, amountCoins: Int): WithdrawalRequestResult {
        val data = YugmHttpClient.post("/creator/withdrawals", token, JSONObject().put("amountCoins", amountCoins)).getJSONObject("data")
        val withdrawal = data.optJSONObject("withdrawal") ?: JSONObject()
        return WithdrawalRequestResult(
            message = data.optString("message", ""),
            status = withdrawal.optString("status", "PENDING_REVIEW"),
            amountCoins = withdrawal.optInt("amountCoins", amountCoins),
            amountInr = withdrawal.optDouble("amountInr", 0.0)
        )
    }

    suspend fun updateBadgeShowcase(token: String, badgeIds: List<String>) {
        YugmHttpClient.put("/experience/badges/showcase", token, JSONObject().put("badgeIds", JSONArray(badgeIds)))
    }

    suspend fun getUserBadges(token: String, userId: String): List<Achievement> {
        val data = YugmHttpClient.get("/experience/badges/showcase/$userId", token).getJSONObject("data")
        return data.optJSONArray("badges")?.toAchievements().orEmpty()
    }

    suspend fun badgeGallery(token: String): BadgeGallery {
        val data = YugmHttpClient.get("/experience/badges", token).getJSONObject("data")
        val user = data.optJSONObject("user")
        val worn = data.optJSONArray("wornIds") ?: JSONArray()
        return BadgeGallery(
            name = user?.optString("name").orEmpty(),
            avatar = user?.parseAvatarUrlField("avatar").orEmpty(),
            avatarType = user?.parseAvatarTypeField(),
            avatarParts = user?.parseAvatarPartsField(),
            wornIds = List(worn.length()) { worn.getString(it) },
            badges = data.optJSONArray("badges")?.toAchievements().orEmpty()
        )
    }

    suspend fun shareAchievement(token: String, achievementId: String): String {
        val data = YugmHttpClient.post("/experience/achievements/$achievementId/share", token, JSONObject()).getJSONObject("data")
        return data.optString("shareText", data.optString("shareUrl", ""))
    }

    suspend fun achievements(token: String): List<Achievement> {
        val data = YugmHttpClient.get("/experience/achievements", token).getJSONObject("data")
        return data.optJSONArray("achievements")?.toAchievements() ?: emptyList()
    }
}

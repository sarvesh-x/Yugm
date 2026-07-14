package com.example.yugm.api

import com.example.yugm.model.CreatorEarningBalance
import com.example.yugm.model.CreatorPayoutKycStatus
import com.example.yugm.model.ExperienceHome
import com.example.yugm.model.PayoutRequirements
import com.example.yugm.model.TrustVerificationStatus
import com.example.yugm.model.WithdrawalEligibility
import com.example.yugm.model.WithdrawalRequestResult
import org.json.JSONObject

object CreatorApi {
    suspend fun experienceHome(token: String): ExperienceHome {
        return YugmHttpClient.get("/experience/home", token).getJSONObject("data").toExperienceHome()
    }

    suspend fun creatorDashboard(token: String): com.example.yugm.model.CreatorDashboard {
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
}

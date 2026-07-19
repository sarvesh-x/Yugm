package com.example.yugm.api

import com.example.yugm.model.ReferralStatsResponse
import com.example.yugm.model.ReferralStats
import com.example.yugm.model.ReferralDetail
import com.example.yugm.model.ReferralUser
import org.json.JSONObject

object ReferralApi {
    suspend fun getCode(token: String): String {
        val json = YugmHttpClient.get("/referrals/code", token)
        return json.getJSONObject("data").optString("referralCode", "")
    }

    suspend fun generateCode(token: String): String {
        val json = YugmHttpClient.post("/referrals/code", token, JSONObject())
        return json.getJSONObject("data").optString("referralCode", "")
    }

    suspend fun claim(token: String, code: String): Pair<Int, String> {
        val json = YugmHttpClient.post("/referrals/claim", token, JSONObject().put("code", code))
        val data = json.getJSONObject("data")
        return Pair(data.optInt("reward", 0), data.optString("message", "Referral code applied"))
    }

    suspend fun stats(token: String): ReferralStatsResponse {
        val json = YugmHttpClient.get("/referrals/stats", token)
        val data = json.getJSONObject("data")
        val statsObj = data.optJSONObject("stats") ?: JSONObject()
        val referralsArray = data.optJSONArray("referrals") ?: org.json.JSONArray()
        val referrals = mutableListOf<ReferralDetail>()
        for (i in 0 until referralsArray.length()) {
            val r = referralsArray.getJSONObject(i)
            val userObj = r.optJSONObject("referredUserId")
            referrals.add(ReferralDetail(
                _id = r.optString("_id", ""),
                referrerId = r.optString("referrerId", ""),
                referredUserId = userObj?.let { ReferralUser(
                    name = it.optString("name", "").ifEmpty { null },
                    username = it.optString("username", "").ifEmpty { null },
                    avatar = it.optString("avatar", "").ifEmpty { null }
                ) },
                referralCode = r.optString("referralCode", ""),
                status = r.optString("status", "PENDING"),
                rewardCoins = if (r.has("rewardCoins")) r.optInt("rewardCoins") else null,
                    createdAt = r.optString("createdAt", "").ifEmpty { null }
            ))
        }
        return ReferralStatsResponse(
            stats = ReferralStats(
                total = statsObj.optInt("total", 0),
                completed = statsObj.optInt("completed", 0),
                rewarded = statsObj.optInt("rewarded", 0),
                totalCoins = statsObj.optInt("totalCoins", 0)
            ),
            referrals = referrals
        )
    }
}

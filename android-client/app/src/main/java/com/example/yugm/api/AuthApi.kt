package com.example.yugm.api

import com.example.yugm.model.Session
import org.json.JSONObject

object AuthApi {
    suspend fun requestOtp(identifier: String): String? {
        val response = YugmHttpClient.post("/auth/request-otp", auth = null, body = YugmHttpClient.contactPayload(identifier))
        val data = response.optJSONObject("data")
        val devOtp = data?.optString("devOtp", "")
        return if (devOtp.isNullOrBlank()) null else devOtp
    }

    suspend fun verifyOtp(identifier: String, otp: String): Session {
        val response = YugmHttpClient.post("/auth/verify-otp", auth = null, body = YugmHttpClient.contactPayload(identifier).put("otp", otp))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }

    suspend fun googleAuth(idToken: String): Session {
        val response = YugmHttpClient.post("/auth/google", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }

    suspend fun phoneAuth(idToken: String): Session {
        val response = YugmHttpClient.post("/auth/phone", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }
}

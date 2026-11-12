package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.*
import com.example.yugm.core.model.Session
import org.json.JSONObject

object AuthApi {
    suspend fun requestOtp(identifier: String) {
        YugmHttpClient.post("/auth/request-otp", auth = null, body = YugmHttpClient.contactPayload(identifier))
    }

    suspend fun verifyOtp(identifier: String, otp: String): Session {
        val response = YugmHttpClient.post("/auth/verify-otp", auth = null, body = YugmHttpClient.contactPayload(identifier).put("otp", otp))
        val data = response.getJSONObject("data")
        val user = data.getJSONObject("user").toUser()
        return Session(token = data.getString("token"), user = user, isNewUser = data.optBoolean("isNewUser", !user.profileCompleted))
    }

    suspend fun googleAuth(idToken: String): Session {
        val response = YugmHttpClient.post("/auth/google", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        val user = data.getJSONObject("user").toUser()
        return Session(token = data.getString("token"), user = user, isNewUser = data.optBoolean("isNewUser", !user.profileCompleted))
    }

    suspend fun phoneAuth(idToken: String): Session {
        val response = YugmHttpClient.post("/auth/phone", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        val user = data.getJSONObject("user").toUser()
        return Session(token = data.getString("token"), user = user, isNewUser = data.optBoolean("isNewUser", !user.profileCompleted))
    }
}

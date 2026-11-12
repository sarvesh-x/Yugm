package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.toUser
import com.example.yugm.core.model.RefreshedSession
import com.example.yugm.core.model.Session
import com.example.yugm.core.model.YugmUser
import org.json.JSONObject

object AuthApi {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google"): Session {
        val response = YugmHttpClient.post("/auth/google", auth = null,
            JSONObject().put("idToken", idToken).put("acceptTerms", acceptTerms).put("provider", provider))
        val data = response.getJSONObject("data")
        val user = data.getJSONObject("user").toUser()
        return Session(
            token = data.optString("accessToken", data.optString("token")),
            user = user,
            isNewUser = data.optBoolean("isNewUser", !user.profileCompleted),
            refreshToken = data.optString("refreshToken"),
            sessionId = data.optString("sessionId"),
            expiresIn = data.optLong("expiresIn", 2700L)
        )
    }

    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Session {
        val response = YugmHttpClient.post("/auth/phone", auth = null,
            JSONObject().put("idToken", idToken).put("acceptTerms", acceptTerms))
        val data = response.getJSONObject("data")
        val user = data.getJSONObject("user").toUser()
        return Session(
            token = data.optString("accessToken", data.optString("token")),
            user = user,
            isNewUser = data.optBoolean("isNewUser", !user.profileCompleted),
            refreshToken = data.optString("refreshToken"),
            sessionId = data.optString("sessionId"),
            expiresIn = data.optLong("expiresIn", 2700L)
        )
    }

    suspend fun refresh(refreshToken: String): RefreshedSession {
        val data = YugmHttpClient.post("/auth/refresh", auth = null, JSONObject().put("refreshToken", refreshToken)).getJSONObject("data")
        return RefreshedSession(
            accessToken = data.optString("accessToken", data.optString("token")),
            refreshToken = data.getString("refreshToken"),
            sessionId = data.getString("sessionId"),
            expiresIn = data.optLong("expiresIn", 2700L)
        )
    }

    suspend fun logout(token: String, refreshToken: String) {
        YugmHttpClient.post("/auth/logout", auth = token, JSONObject().put("refreshToken", refreshToken))
    }

    suspend fun me(token: String): YugmUser {
        return YugmHttpClient.get("/auth/me", token).getJSONObject("data").getJSONObject("user").toUser()
    }
}

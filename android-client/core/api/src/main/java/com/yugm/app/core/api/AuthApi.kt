package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toUser
import com.yugm.app.core.model.RefreshedSession
import com.yugm.app.core.model.Session
import com.yugm.app.core.model.YugmUser
import org.json.JSONObject

object AuthApi {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google"): Session {
        val response = YugmHttpClient.post("/auth/google", auth = null,
            JSONObject().put("idToken", idToken).put("acceptTerms", acceptTerms).put("provider", provider))
        return parseSession(response)
    }

    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Session {
        val response = YugmHttpClient.post("/auth/phone", auth = null,
            JSONObject().put("idToken", idToken).put("acceptTerms", acceptTerms))
        return parseSession(response)
    }

    private fun parseSession(response: JSONObject): Session {
        val data = response.optJSONObject("data")
            ?: throw ApiProtocolException("Sign-in response is missing session data")
        val userJson = data.optJSONObject("user")
            ?: throw ApiProtocolException("Sign-in response is missing the user")
        val user = try {
            userJson.toUser()
        } catch (error: Exception) {
            throw ApiProtocolException("Sign-in response contains an invalid user", error)
        }
        val accessToken = data.optString("accessToken").ifBlank { data.optString("token") }
        val refreshToken = data.optString("refreshToken")
        val sessionId = data.optString("sessionId")
        val expiresIn = data.optLong("expiresIn", 0L)
        if (accessToken.isBlank() || refreshToken.isBlank() || sessionId.isBlank() || expiresIn <= 0L || user.id.isBlank()) {
            throw ApiProtocolException("Sign-in response is missing required session fields")
        }
        return Session(
            token = accessToken,
            user = user,
            isNewUser = data.optBoolean("isNewUser", !user.profileCompleted),
            refreshToken = refreshToken,
            sessionId = sessionId,
            expiresIn = expiresIn
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

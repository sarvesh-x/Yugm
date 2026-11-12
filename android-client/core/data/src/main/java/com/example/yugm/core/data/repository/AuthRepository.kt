package com.example.yugm.core.data.repository

import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.Session
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor() {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google"): Result<Session> = runCatching {
        YugmApi.googleAuth(idToken, acceptTerms, provider)
    }

    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Result<Session> = runCatching {
        YugmApi.phoneAuth(idToken, acceptTerms)
    }
}

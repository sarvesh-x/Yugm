package com.example.yugm.data.repository

import com.example.yugm.api.YugmApi
import com.example.yugm.model.Session
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor() {
    suspend fun googleAuth(idToken: String): Result<Session> = runCatching {
        YugmApi.googleAuth(idToken)
    }

    suspend fun phoneAuth(idToken: String): Result<Session> = runCatching {
        YugmApi.phoneAuth(idToken)
    }

    suspend fun requestOtp(identifier: String): Result<String?> = runCatching {
        YugmApi.requestOtp(identifier)
    }

    suspend fun verifyOtp(identifier: String, otp: String): Result<Session> = runCatching {
        YugmApi.verifyOtp(identifier, otp)
    }
}

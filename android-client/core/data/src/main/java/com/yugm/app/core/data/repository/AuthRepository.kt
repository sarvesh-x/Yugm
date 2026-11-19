package com.yugm.app.core.data.repository

import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Session
import com.yugm.app.core.model.AuthProfileUpdate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(private val api: IYugmApi) {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google"): Session =
        api.googleAuth(idToken, acceptTerms, provider)

    suspend fun facebookAuth(idToken: String, acceptTerms: Boolean): Session =
        api.facebookAuth(idToken, acceptTerms)

    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Session =
        api.phoneAuth(idToken, acceptTerms)

    suspend fun validateSession(token: String) = api.authMe(token)

    suspend fun uploadAvatar(token: String, bytes: ByteArray, mimeType: String): String =
        api.uploadAvatar(token, bytes, mimeType)

    suspend fun updateProfile(token: String, update: AuthProfileUpdate) = api.updateProfile(
        token = token,
        name = update.name,
        username = update.username,
        bio = update.bio,
        city = update.city,
        interests = update.interests,
        languages = update.languages,
        gender = update.gender,
        age = update.age,
        lookingFor = update.lookingFor,
        avatar = update.avatar,
        acceptTerms = update.acceptTerms,
        vibeLine = update.vibeLine,
        state = update.state,
        hobbies = update.hobbies,
        interestedIn = update.interestedIn,
        datingAgeMin = update.datingAgeMin,
        datingAgeMax = update.datingAgeMax,
    )
}

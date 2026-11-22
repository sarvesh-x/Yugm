package com.yugm.app.core.data.repository

import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.MediaUploadProgress
import com.yugm.app.core.model.Session
import com.yugm.app.core.model.AuthProfileUpdate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(private val api: IYugmApi) {
    suspend fun googleAuth(idToken: String, acceptTerms: Boolean, provider: String = "google", name: String? = null, mode: String? = null): Session =
        api.googleAuth(idToken, acceptTerms, provider, name, mode)

    suspend fun facebookAuth(idToken: String, acceptTerms: Boolean, name: String? = null): Session =
        api.facebookAuth(idToken, acceptTerms, name)

    suspend fun phoneAuth(idToken: String, acceptTerms: Boolean): Session =
        api.phoneAuth(idToken, acceptTerms)

    suspend fun validateSession(token: String) = api.authMe(token)

    suspend fun uploadAvatar(token: String, bytes: ByteArray, mimeType: String): String =
        api.uploadAvatar(token, bytes, mimeType)

    suspend fun uploadAvatarWithProgress(
        token: String,
        bytes: ByteArray,
        mimeType: String,
        onProgress: (MediaUploadProgress) -> Unit,
        isCancelled: () -> Boolean
    ): String = api.uploadAvatarWithProgress(token, bytes, mimeType, onProgress, isCancelled)

    suspend fun cancelMediaUpload(token: String, sessionId: String) = api.cancelMediaUpload(token, sessionId)

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
        avatarType = update.avatarType,
        avatarPartsJson = update.avatarPartsJson,
        acceptTerms = update.acceptTerms,
        vibeLine = update.vibeLine,
        state = update.state,
        hobbies = update.hobbies,
        interestedIn = update.interestedIn,
        datingAgeMin = update.datingAgeMin,
        datingAgeMax = update.datingAgeMax,
    )
}

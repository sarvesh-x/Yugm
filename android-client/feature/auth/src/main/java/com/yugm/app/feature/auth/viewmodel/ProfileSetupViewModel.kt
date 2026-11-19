package com.yugm.app.feature.auth.viewmodel

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.data.SessionManager
import com.yugm.app.core.data.repository.AuthRepository
import com.yugm.app.core.model.AuthProfileUpdate
import com.yugm.app.core.model.Session
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AvatarUploadState { IDLE, UPLOADING, SUCCEEDED, FAILED }

@HiltViewModel
class ProfileSetupViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager,
    @param:ApplicationContext private val context: Context,
) : ViewModel() {
    var avatarUploadState by mutableStateOf(AvatarUploadState.IDLE)
        private set
    var isSubmitting by mutableStateOf(false)
        private set
    fun uploadAvatar(uri: Uri, onResult: (String?, String?) -> Unit) {
        if (avatarUploadState == AvatarUploadState.UPLOADING || isSubmitting) return
        avatarUploadState = AvatarUploadState.UPLOADING
        viewModelScope.launch {
            try {
                val (mime, bytes) = withContext(Dispatchers.IO) { readImage(uri) }
                val token = requireSessionToken()
                val url = withContext(Dispatchers.IO) { authRepository.uploadAvatar(token, bytes, mime) }
                avatarUploadState = AvatarUploadState.SUCCEEDED
                onResult(url, null)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                avatarUploadState = AvatarUploadState.FAILED
                onResult(null, failure.message ?: "Could not upload that photo. Try another image.")
            } finally {
                if (avatarUploadState == AvatarUploadState.UPLOADING) {
                    avatarUploadState = AvatarUploadState.IDLE
                }
            }
        }
    }

    fun submit(update: AuthProfileUpdate, onSuccess: (Session) -> Unit, onFailure: (String) -> Unit) {
        if (isSubmitting || avatarUploadState == AvatarUploadState.UPLOADING) return
        isSubmitting = true
        viewModelScope.launch {
            try {
                val token = requireSessionToken()
                val user = withContext(Dispatchers.IO) { authRepository.updateProfile(token, update) }
                check(user.profileCompleted) {
                    "Your profile was saved, but Yugm still needs required details. Review your profile and try again."
                }
                onSuccess(Session(token = token, user = user))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                val message = failure.message?.takeIf(String::isNotBlank)
                    ?: "Profile creation failed. Check your connection and try again."
                onFailure(message)
            } finally {
                isSubmitting = false
            }
        }
    }

    private fun requireSessionToken(): String = sessionManager.authToken.takeIf(String::isNotBlank)
        ?: error("Your sign-in session expired. Please sign in again.")

    private fun readImage(uri: Uri): Pair<String, ByteArray> {
        val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
        require(mime.startsWith("image/", ignoreCase = true)) { "Choose an image file." }
        val input = context.contentResolver.openInputStream(uri) ?: error("Could not read the selected image")
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8 * 1024)
        var totalBytes = 0
        input.use { stream ->
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                totalBytes += count
                require(totalBytes <= 5 * 1024 * 1024) { "Choose a photo smaller than 5 MB." }
                output.write(buffer, 0, count)
            }
        }
        require(totalBytes > 0) { "The selected image is empty." }
        return mime to output.toByteArray()
    }
}

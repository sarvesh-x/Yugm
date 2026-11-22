package com.yugm.app.feature.auth.viewmodel

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AvatarUploadState { IDLE, UPLOADING, SUCCEEDED, FAILED }

@HiltViewModel
class ProfileSetupViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager,
    @param:ApplicationContext private val context: Context
) : ViewModel() {
    var avatarUploadState by mutableStateOf(AvatarUploadState.IDLE)
        private set
    var avatarUploadProgress by mutableStateOf(0f)
        private set
    var activeAvatarUploadSessionId by mutableStateOf<String?>(null)
        private set
    var isSubmitting by mutableStateOf(false)
        private set

    private val mainHandler = Handler(Looper.getMainLooper())
    private var avatarUploadJob: Job? = null
    @Volatile private var cancelUploadRequested = false

    fun uploadAvatar(uri: Uri, onResult: (String?, String?) -> Unit) {
        if (avatarUploadState == AvatarUploadState.UPLOADING || isSubmitting) return
        avatarUploadState = AvatarUploadState.UPLOADING
        avatarUploadProgress = 0f
        activeAvatarUploadSessionId = null
        cancelUploadRequested = false
        avatarUploadJob = viewModelScope.launch {
            try {
                val (mime, bytes) = withContext(Dispatchers.IO) { readImage(uri) }
                val token = requireSessionToken()
                val url = withContext(Dispatchers.IO) {
                    authRepository.uploadAvatarWithProgress(
                        token = token,
                        bytes = bytes,
                        mimeType = mime,
                        onProgress = { progress ->
                            mainHandler.post {
                                if (activeAvatarUploadSessionId == null) {
                                    activeAvatarUploadSessionId = progress.sessionId
                                }
                                avatarUploadProgress = if (progress.totalBytes > 0) {
                                    (progress.uploadedBytes.toFloat() / progress.totalBytes).coerceIn(0f, 1f)
                                } else 0f
                            }
                        },
                        isCancelled = { cancelUploadRequested }
                    )
                }
                avatarUploadState = AvatarUploadState.SUCCEEDED
                onResult(url, null)
            } catch (cancelled: CancellationException) {
                if (cancelUploadRequested) onResult(null, "Upload cancelled")
                throw cancelled
            } catch (failure: Exception) {
                avatarUploadState = if (cancelUploadRequested) AvatarUploadState.IDLE else AvatarUploadState.FAILED
                onResult(null, failure.message ?: "Could not upload that photo. Try another image.")
            } finally {
                if (avatarUploadState == AvatarUploadState.UPLOADING) {
                    avatarUploadState = AvatarUploadState.IDLE
                }
                activeAvatarUploadSessionId = null
                avatarUploadProgress = 0f
                avatarUploadJob = null
                cancelUploadRequested = false
            }
        }
    }

    /** Cancels the staging grant first, then aborts the in-flight request. */
    fun cancelAvatarUpload() {
        val sessionId = activeAvatarUploadSessionId ?: return
        cancelUploadRequested = true
        val token = sessionManager.authToken
        viewModelScope.launch {
            if (token.isNotBlank()) {
                runCatching { withContext(Dispatchers.IO) { authRepository.cancelMediaUpload(token, sessionId) } }
            }
            avatarUploadJob?.cancel()
            avatarUploadState = AvatarUploadState.IDLE
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

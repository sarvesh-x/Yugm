package com.yugm.app.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.data.SessionManager
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.ApiHttpException
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.api.YugmSocket
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.model.RefreshedSession
import com.yugm.app.core.model.NotificationItem
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

@HiltViewModel
class MainViewModel @Inject constructor(
    private val sessionManager: SessionManager,
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {
    private var startupSessionCheckStarted = false
    var startupSessionCheckComplete by mutableStateOf(sessionManager.authToken.isBlank())
        private set

    var authToken by mutableStateOf(sessionManager.authToken)
        private set

    var currentUserId by mutableStateOf(sessionManager.userId)
        private set

    var userName by mutableStateOf(sessionManager.userName)
        private set

    var username by mutableStateOf(sessionManager.username)
        private set

    var userEmail by mutableStateOf(sessionManager.userEmail)
        private set

    var userAvatar by mutableStateOf(sessionManager.userAvatar.takeIf { it.isNotBlank() })
        private set

    var userAvatarType by mutableStateOf(sessionManager.userAvatarType.takeIf { it.isNotBlank() })
        private set

    var userAvatarPartsJson by mutableStateOf(sessionManager.userAvatarParts.takeIf { it.isNotBlank() })
        private set

    var balance by mutableStateOf(sessionManager.balance)
        private set

    var emailVerified by mutableStateOf(sessionManager.emailVerified)
        private set

    var profileCompleted by mutableStateOf(sessionManager.profileCompleted)
        private set

    var onboardingCompleted by mutableStateOf(sessionManager.onboardingCompleted)
        private set

    fun markOnboardingCompleted() {
        sessionManager.onboardingCompleted = true
        onboardingCompleted = true
    }

    var inAppNotification by mutableStateOf<NotificationItem?>(null)
        private set

    init {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                if (event is com.yugm.app.core.api.SocketEvent.NotificationReceived) {
                    inAppNotification = event.notification
                }
            }
        }
    }

    fun dismissInAppNotification() {
        inAppNotification = null
    }

    /** Validate restored auth/profile data before the splash chooses an authenticated route. */
    suspend fun validateStartupSession() {
        val token = sessionManager.authToken
        if (token.isBlank() || startupSessionCheckComplete) {
            startupSessionCheckComplete = true
            return
        }
        if (startupSessionCheckStarted) return
        startupSessionCheckStarted = true
        try {
            withTimeout(10_000L) {
                val user = withContext(Dispatchers.IO) { yugmApi.authMe(token) }
                if (sessionManager.authToken == token) {
                    // The server response is authoritative for identity as well as
                    // profile completion; repair older cached sessions with no ID.
                    currentUserId = user.id
                    sessionManager.userId = user.id
                    validateAndUpdate(user, registerPush = false)
                }
            }
        } catch (_: kotlinx.coroutines.TimeoutCancellationException) {
            // The splash remains bounded and falls back to the saved session.
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            // Network/App Check failures do not prove the account is revoked. A
            // definitive unauthorized response clears the session; transient
            // failures continue from the locally restored session snapshot.
            if (failure is ApiHttpException && failure.statusCode in 401..403 &&
                !failure.message.orEmpty().contains("app verification", ignoreCase = true) &&
                sessionManager.authToken == token
            ) {
                logout(revokeServerSession = false)
            }
        } finally {
            startupSessionCheckComplete = true
            sessionManager.authToken.takeIf(String::isNotBlank)?.let(socketManager::connect)
        }
    }

    fun updateSession(
        token: String,
        userId: String,
        name: String,
        username: String,
        email: String,
        balance: Int,
        refreshToken: String,
        sessionId: String,
        expiresIn: Long,
        emailVerified: Boolean,
        profileCompleted: Boolean,
        avatar: String? = null,
        avatarType: String? = null,
        avatarPartsJson: String? = null,
    ) {
        this.authToken = token
        this.currentUserId = userId
        this.userName = name
        this.username = username
        this.userEmail = email
        this.userAvatar = avatar?.takeIf { it.isNotBlank() }
        this.userAvatarType = avatarType?.takeIf { it.isNotBlank() }
        this.userAvatarPartsJson = avatarPartsJson?.takeIf { it.isNotBlank() }
        this.balance = balance
        this.emailVerified = emailVerified
        this.profileCompleted = profileCompleted

        sessionManager.saveSession(token, refreshToken, sessionId, expiresIn, userId, name, username, balance, emailVerified, profileCompleted, email, avatar, avatarType, avatarPartsJson)
        socketManager.connect(token)
        syncPushToken()
    }

    fun updateBalance(newBalance: Int) {
        this.balance = newBalance
        sessionManager.balance = newBalance
    }

    fun validateAndUpdate(user: com.yugm.app.core.model.YugmUser, registerPush: Boolean = true) {
        userName = user.name
        username = user.username
        if (user.email.isNotBlank()) {
            userEmail = user.email
            sessionManager.userEmail = user.email
        }
        userAvatar = user.avatar?.takeIf { it.isNotBlank() }
        userAvatarType = user.avatarType?.takeIf { it.isNotBlank() }
        userAvatarPartsJson = user.avatarParts?.let {
            org.json.JSONObject()
                .put("background", it.background)
                .put("clothes", it.clothes)
                .put("head", it.head)
                .put("mouth", it.mouth)
                .put("eyes", it.eyes)
                .put("top", it.top)
                .toString()
        }
        balance = user.walletBalance
        emailVerified = user.emailVerified
        profileCompleted = user.profileCompleted
        sessionManager.userName = user.name
        sessionManager.username = user.username
        sessionManager.userAvatar = user.avatar.orEmpty()
        sessionManager.userAvatarType = user.avatarType.orEmpty()
        sessionManager.userAvatarParts = userAvatarPartsJson.orEmpty()
        sessionManager.balance = user.walletBalance
        sessionManager.emailVerified = user.emailVerified
        sessionManager.profileCompleted = user.profileCompleted
        if (registerPush) syncPushToken()
    }

    fun syncEmailVerification(onResult: (Boolean) -> Unit = {}) {
        val token = authToken
        if (token.isBlank()) return
        viewModelScope.launch {
            try {
                val isVerified = withContext(Dispatchers.IO) {
                    val fbUser = FirebaseAuth.getInstance().currentUser
                    if (fbUser != null) {
                        Tasks.await(fbUser.reload(), 10, TimeUnit.SECONDS)
                        if (fbUser.isEmailVerified) {
                            val idToken = Tasks.await(fbUser.getIdToken(true), 10, TimeUnit.SECONDS).token
                            yugmApi.verifyEmail(token, idToken)
                        } else {
                            yugmApi.verifyEmail(token, null)
                        }
                    } else {
                        yugmApi.verifyEmail(token, null)
                    }
                }
                if (isVerified) {
                    emailVerified = true
                    sessionManager.emailVerified = true
                }
                onResult(isVerified)
            } catch (_: Exception) {
                onResult(emailVerified)
            }
        }
    }

    fun resendVerificationEmail(onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            try {
                val fbUser = FirebaseAuth.getInstance().currentUser
                    ?: error("Sign in again to resend verification email.")
                withContext(Dispatchers.IO) {
                    Tasks.await(fbUser.sendEmailVerification(), 15, TimeUnit.SECONDS)
                }
                val dest = fbUser.email?.takeIf(String::isNotBlank) ?: "your email address"
                onResult(true, "Verification link sent to $dest.")
            } catch (e: Exception) {
                onResult(false, e.message ?: "Could not send verification email. Try again later.")
            }
        }
    }

    fun updateTokens(tokens: RefreshedSession) {
        authToken = tokens.accessToken
        socketManager.connect(tokens.accessToken)
        sessionManager.saveSession(
            token = tokens.accessToken,
            refresh = tokens.refreshToken,
            session = tokens.sessionId,
            expiresInSeconds = tokens.expiresIn,
            id = sessionManager.userId,
            name = sessionManager.userName,
            handle = sessionManager.username,
            walletBalance = sessionManager.balance,
            emailVerified = sessionManager.emailVerified,
            profileCompleted = sessionManager.profileCompleted,
            email = sessionManager.userEmail,
            avatar = sessionManager.userAvatar.takeIf { it.isNotBlank() },
            avatarType = sessionManager.userAvatarType.takeIf { it.isNotBlank() },
            avatarPartsJson = sessionManager.userAvatarParts.takeIf { it.isNotBlank() }
        )
    }

    fun logout(revokeServerSession: Boolean = true) {
        val token = sessionManager.authToken
        val refresh = sessionManager.refreshToken

        // Clear local state first so logout never waits on network availability or
        // Firebase token retrieval. Revoke the server session as best effort.
        runCatching { FirebaseAuth.getInstance().signOut() }
        runCatching { YugmSocket.disconnect() }
        runCatching { socketManager.disconnect() }
        YugmMediaRoom.disconnectAsync()
        com.yugm.app.core.api.ReactionCatalogCache.clear()
        com.yugm.app.feature.chat.cache.ChatConversationCache.clear()
        inAppNotification = null
        com.yugm.app.core.api.AppSync.invalidate(
            com.yugm.app.core.api.SyncTopic.ALL
        )
        sessionManager.logout()
        authToken = ""
        currentUserId = ""
        userName = "Yugm User"
        username = "vibe_user"
        userEmail = ""
        userAvatar = null
        userAvatarType = null
        userAvatarPartsJson = null
        balance = 0
        emailVerified = false
        profileCompleted = false

        if (revokeServerSession && token.isNotBlank()) {
            viewModelScope.launch(Dispatchers.IO) {
                val deviceToken = runCatching {
                    Tasks.await(FirebaseMessaging.getInstance().token).takeIf(String::isNotBlank)
                }.getOrNull()
                runCatching { yugmApi.logoutAuth(token, refresh, deviceToken) }
            }
        }
    }

    private fun syncPushToken() {
        viewModelScope.launch {
            runCatching {
                val token: String = sessionManager.pendingFcmToken.takeIf { it.isNotBlank() }
                    ?: withContext(Dispatchers.IO) { Tasks.await(FirebaseMessaging.getInstance().token) }
                if (token.isNotBlank()) sessionManager.pendingFcmToken = token
                withContext(Dispatchers.IO) { yugmApi.registerFcmToken(sessionManager.authToken, token) }
                if (sessionManager.pendingFcmToken == token) sessionManager.pendingFcmToken = ""
            }
        }
    }
}

package com.yugm.app.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.data.SessionManager
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.YugmSocket
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.model.RefreshedSession
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.google.android.gms.tasks.Tasks
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@HiltViewModel
class MainViewModel @Inject constructor(
    private val sessionManager: SessionManager,
    private val yugmApi: IYugmApi
) : ViewModel() {

    var authToken by mutableStateOf(sessionManager.authToken)
        private set

    var currentUserId by mutableStateOf(sessionManager.userId)
        private set

    var userName by mutableStateOf(sessionManager.userName)
        private set

    var username by mutableStateOf(sessionManager.username)
        private set

    var balance by mutableStateOf(sessionManager.balance)
        private set

    var emailVerified by mutableStateOf(sessionManager.emailVerified)
        private set

    var profileCompleted by mutableStateOf(sessionManager.profileCompleted)
        private set

    fun updateSession(token: String, userId: String, name: String, username: String, balance: Int, refreshToken: String, sessionId: String, expiresIn: Long, emailVerified: Boolean, profileCompleted: Boolean) {
        this.authToken = token
        this.currentUserId = userId
        this.userName = name
        this.username = username
        this.balance = balance
        this.emailVerified = emailVerified
        this.profileCompleted = profileCompleted

        sessionManager.saveSession(token, refreshToken, sessionId, expiresIn, userId, name, username, balance, emailVerified, profileCompleted)
        syncPushToken()
    }

    fun updateBalance(newBalance: Int) {
        this.balance = newBalance
        sessionManager.balance = newBalance
    }

    fun validateAndUpdate(user: com.yugm.app.core.model.YugmUser) {
        userName = user.name
        username = user.username
        balance = user.walletBalance
        emailVerified = user.emailVerified
        profileCompleted = user.profileCompleted
        sessionManager.userName = user.name
        sessionManager.username = user.username
        sessionManager.balance = user.walletBalance
        sessionManager.emailVerified = user.emailVerified
        sessionManager.profileCompleted = user.profileCompleted
        syncPushToken()
    }

    fun updateTokens(tokens: RefreshedSession) {
        authToken = tokens.accessToken
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
            profileCompleted = sessionManager.profileCompleted
        )
    }

    fun logout(revokeServerSession: Boolean = true) {
        val token = sessionManager.authToken
        val refresh = sessionManager.refreshToken

        // Clear local state first so logout never waits on network availability or
        // Firebase token retrieval. Revoke the server session as best effort.
        runCatching { FirebaseAuth.getInstance().signOut() }
        runCatching { YugmSocket.disconnect() }
        runCatching { YugmMediaRoom.disconnect() }
        sessionManager.logout()
        authToken = ""
        currentUserId = ""
        userName = "Yugm User"
        username = "vibe_user"
        balance = 0
        emailVerified = false
        profileCompleted = false

        if (revokeServerSession && token.isNotBlank()) {
            viewModelScope.launch(Dispatchers.IO) {
                runCatching {
                    val deviceToken = Tasks.await(FirebaseMessaging.getInstance().token)
                    if (deviceToken.isNotBlank()) yugmApi.removeFcmToken(token, deviceToken)
                }
                runCatching { yugmApi.logoutAuth(token, refresh) }
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

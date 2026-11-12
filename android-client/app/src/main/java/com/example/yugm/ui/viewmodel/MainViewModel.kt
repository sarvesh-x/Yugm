package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.data.SessionManager
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.api.YugmSocket
import com.example.yugm.core.api.YugmMediaRoom
import com.example.yugm.core.model.RefreshedSession
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

    fun updateSession(token: String, userId: String, name: String, username: String, balance: Int, refreshToken: String = "", sessionId: String = "", expiresIn: Long = 2700, emailVerified: Boolean = false) {
        this.authToken = token
        this.currentUserId = userId
        this.userName = name
        this.username = username
        this.balance = balance
        this.emailVerified = emailVerified

        sessionManager.saveSession(token, refreshToken, sessionId, expiresIn, userId, name, username, balance, emailVerified)
        syncPushToken()
    }

    fun updateBalance(newBalance: Int) {
        this.balance = newBalance
        sessionManager.balance = newBalance
    }

    suspend fun validateAndUpdate(user: com.example.yugm.core.model.YugmUser) {
        userName = user.name
        username = user.username
        balance = user.walletBalance
        emailVerified = user.emailVerified
        sessionManager.userName = user.name
        sessionManager.username = user.username
        sessionManager.balance = user.walletBalance
        sessionManager.emailVerified = user.emailVerified
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
            emailVerified = sessionManager.emailVerified
        )
    }

    suspend fun logout() {
        val token = sessionManager.authToken
        val refresh = sessionManager.refreshToken
        if (token.isNotBlank()) {
            runCatching {
                val deviceToken = withContext(Dispatchers.IO) { Tasks.await(FirebaseMessaging.getInstance().token) }
                if (deviceToken.isNotBlank()) withContext(Dispatchers.IO) { yugmApi.removeFcmToken(token, deviceToken) }
            }
            runCatching { withContext(Dispatchers.IO) { yugmApi.logoutAuth(token, refresh) } }
        }
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

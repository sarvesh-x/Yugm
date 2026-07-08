package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.example.yugm.data.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val sessionManager: SessionManager
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

    fun updateSession(token: String, userId: String, name: String, username: String, balance: Int) {
        this.authToken = token
        this.currentUserId = userId
        this.userName = name
        this.username = username
        this.balance = balance

        sessionManager.authToken = token
        sessionManager.userId = userId
        sessionManager.userName = name
        sessionManager.username = username
        sessionManager.balance = balance
    }

    fun updateBalance(newBalance: Int) {
        this.balance = newBalance
        sessionManager.balance = newBalance
    }

    fun logout() {
        sessionManager.logout()
        authToken = ""
        currentUserId = ""
        userName = "Yugm User"
        username = "vibe_user"
        balance = 0
    }
}

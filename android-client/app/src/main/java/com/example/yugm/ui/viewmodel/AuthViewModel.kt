package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.data.SessionManager
import com.example.yugm.data.repository.AuthRepository
import com.example.yugm.model.Session
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    var isLoading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    private val _authSuccess = MutableSharedFlow<Session>()
    val authSuccess = _authSuccess.asSharedFlow()

    fun googleAuth(idToken: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            authRepository.googleAuth(idToken)
                .onSuccess { session ->
                    saveSession(session)
                    _authSuccess.emit(session)
                }
                .onFailure {
                    error = it.message ?: "Google Sign-In failed"
                }
            isLoading = false
        }
    }

    fun phoneAuth(idToken: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            authRepository.phoneAuth(idToken)
                .onSuccess { session ->
                    saveSession(session)
                    _authSuccess.emit(session)
                }
                .onFailure {
                    error = it.message ?: "Phone Authentication failed"
                }
            isLoading = false
        }
    }

    private fun saveSession(session: Session) {
        sessionManager.authToken = session.token
        sessionManager.userId = session.user.id
        sessionManager.userName = session.user.name
        sessionManager.username = session.user.username
        sessionManager.balance = session.user.walletBalance
    }

    fun clearError() {
        error = null
    }
}

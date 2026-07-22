package com.example.yugm.feature.auth.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Session
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var isLoading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    var session by mutableStateOf<Session?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun requestOtp(identifier: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.requestOtp(identifier) }
            }.onSuccess {
                isLoading = false
                onSuccess()
            }.onFailure {
                isLoading = false
                error = it.message ?: "Failed to send OTP"
            }
        }
    }

    fun verifyOtp(identifier: String, otp: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.verifyOtp(identifier, otp) }
            }.onSuccess {
                session = it
                isLoading = false
            }.onFailure {
                isLoading = false
                error = it.message ?: "Verification failed"
            }
        }
    }

    fun googleAuth(idToken: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.googleAuth(idToken) }
            }.onSuccess {
                session = it
                isLoading = false
            }.onFailure {
                isLoading = false
                error = it.message ?: "Google sign-in failed"
            }
        }
    }

    fun phoneAuth(idToken: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.phoneAuth(idToken) }
            }.onSuccess {
                session = it
                isLoading = false
            }.onFailure {
                isLoading = false
                error = it.message ?: "Phone auth failed"
            }
        }
    }
}

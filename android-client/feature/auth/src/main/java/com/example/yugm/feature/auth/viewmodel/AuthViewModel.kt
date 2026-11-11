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
import com.google.firebase.auth.FirebaseAuth
import com.google.android.gms.tasks.Tasks

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

    fun emailAuth(email: String, password: String, createAccount: Boolean) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) {
                    val auth = FirebaseAuth.getInstance()
                    // If Firebase account creation succeeded but the Yugm API
                    // timed out, Firebase keeps the new user signed in. Reuse
                    // that user on a signup retry instead of attempting to
                    // create the same Firebase account again.
                    val existingSignupUser = auth.currentUser?.takeIf {
                        createAccount && it.email.equals(email, ignoreCase = true)
                    }
                    val firebaseUser = existingSignupUser ?: if (createAccount) {
                        Tasks.await(auth.createUserWithEmailAndPassword(email, password)).user
                    } else {
                        Tasks.await(auth.signInWithEmailAndPassword(email, password)).user
                    } ?: throw IllegalStateException("Firebase did not return a user")
                    val idToken = Tasks.await(
                        firebaseUser.getIdToken(true)
                    ).token ?: throw IllegalStateException("Firebase did not return an ID token")
                    yugmApi.googleAuth(idToken)
                }
            }.onSuccess {
                session = it
                isLoading = false
            }.onFailure {
                isLoading = false
                error = when (it) {
                    is com.google.firebase.auth.FirebaseAuthInvalidCredentialsException -> "Check your email and password, then try again."
                    is com.google.firebase.auth.FirebaseAuthUserCollisionException -> "An account already uses this email. Sign in instead."
                    is com.google.firebase.auth.FirebaseAuthInvalidUserException -> "No account found for this email. Create an account first."
                    is java.net.SocketTimeoutException -> "The server took too long to respond. Try again; your Firebase signup is saved."
                    else -> it.message ?: "Email sign-in failed"
                }
            }
        }
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
                error = if (it is java.net.SocketTimeoutException) {
                    "The server took too long to respond. Try Google sign-in again."
                } else {
                    it.message ?: "Google sign-in failed"
                }
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

package com.example.yugm.feature.auth.viewmodel

import android.util.Patterns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Session
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(private val yugmApi: IYugmApi) : ViewModel() {
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var session by mutableStateOf<Session?>(null)
        private set
    var googleCredentialLoading by mutableStateOf(false)
        private set

    fun setGoogleCredentialBusy(value: Boolean) { googleCredentialLoading = value }

    fun clearError() { error = null }

    fun emailAuth(email: String, password: String, createAccount: Boolean, acceptTerms: Boolean) {
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(normalizedEmail).matches()) { error = "Enter a valid email address."; return }
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        if (password.length < 8 || password.none(Char::isDigit) || password.none(Char::isLetter)) {
            error = "Use at least 8 characters with a letter and a number."; return
        }
        launchAuth {
            val auth = FirebaseAuth.getInstance()
            val priorSignup = auth.currentUser?.takeIf { createAccount && it.email.equals(normalizedEmail, true) }
            val user = priorSignup ?: if (createAccount) {
                Tasks.await(auth.createUserWithEmailAndPassword(normalizedEmail, password)).user
            } else {
                Tasks.await(auth.signInWithEmailAndPassword(normalizedEmail, password)).user
            } ?: error("Firebase did not return a user")
            // Sending the verification email is best-effort and should not hold up
            // the session exchange or navigation into the app.
            if (createAccount && !user.isEmailVerified) {
                viewModelScope.launch(Dispatchers.IO) {
                    runCatching { Tasks.await(user.sendEmailVerification()) }
                }
            }
            // Sign-in has just produced a current Firebase user/token. Avoid forcing
            // another Firebase network round trip before exchanging it with Yugm.
            val firebaseToken = Tasks.await(user.getIdToken(false)).token ?: error("Firebase did not return an ID token")
            yugmApi.googleAuth(firebaseToken, acceptTerms, provider = "email")
        }
    }

    fun googleAuth(googleIdToken: String, acceptTerms: Boolean) {
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        launchAuth {
            val credential = GoogleAuthProvider.getCredential(googleIdToken, null)
            val user = Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential)).user ?: error("Google sign-in returned no user")
            val firebaseToken = Tasks.await(user.getIdToken(false)).token ?: error("Firebase did not return an ID token")
            yugmApi.googleAuth(firebaseToken, acceptTerms, provider = "google")
        }
    }

    fun phoneAuth(firebaseIdToken: String, acceptTerms: Boolean) {
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        launchAuth { yugmApi.phoneAuth(firebaseIdToken, acceptTerms) }
    }

    fun forgotPassword(email: String) {
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(normalizedEmail).matches()) { error = "Enter your email address first."; return }
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching { withContext(Dispatchers.IO) { Tasks.await(FirebaseAuth.getInstance().sendPasswordResetEmail(normalizedEmail)) } }
                .onFailure { error = mapAuthError(it) }
            isLoading = false
        }
    }

    fun refreshEmailVerification(onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val user = FirebaseAuth.getInstance().currentUser ?: error("Sign in again to check verification.")
                    Tasks.await(user.reload())
                    user.isEmailVerified
                }
            }
            result.onSuccess(onComplete).onFailure { error = mapAuthError(it) }
        }
    }

    private fun launchAuth(block: suspend () -> Session) {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching { withContext(Dispatchers.IO) { block() } }
                .onSuccess { session = it }
                .onFailure { error = mapAuthError(it) }
            isLoading = false
        }
    }

    private fun mapAuthError(error: Throwable): String {
        val root = generateSequence(error) { it.cause }.last()
        return when (root) {
            is com.google.firebase.auth.FirebaseAuthInvalidCredentialsException -> "Check your email, password, or verification code."
            is com.google.firebase.auth.FirebaseAuthUserCollisionException -> "An account already uses this email. Sign in instead."
            is com.google.firebase.auth.FirebaseAuthInvalidUserException -> "No account was found for this email. Create one first."
            is com.google.firebase.auth.FirebaseAuthWeakPasswordException -> "Choose a stronger password with at least 8 characters."
            is com.google.firebase.FirebaseNetworkException, is java.io.IOException -> "Check your connection and try again."
            else -> if (root.message?.contains("too many", ignoreCase = true) == true) "Too many attempts. Wait a little before trying again."
                else root.message?.takeIf(String::isNotBlank) ?: "Sign-in failed. Please try again."
        }
    }
}

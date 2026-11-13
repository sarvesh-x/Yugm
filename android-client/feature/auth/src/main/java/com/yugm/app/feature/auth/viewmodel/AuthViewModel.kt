package com.yugm.app.feature.auth.viewmodel

import android.content.Context
import android.util.Patterns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Session
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.GoogleAuthProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.lifecycle.HiltViewModel
import com.yugm.app.feature.auth.AppCheckReadiness
import com.yugm.app.feature.auth.AppCheckSetupException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var notice by mutableStateOf<String?>(null)
        private set
    var session by mutableStateOf<Session?>(null)
        private set
    var googleCredentialLoading by mutableStateOf(false)
        private set

    fun setGoogleCredentialBusy(value: Boolean) { googleCredentialLoading = value }

    fun clearError() { error = null; notice = null }

    fun reportError(message: String) {
        error = message
        notice = null
    }

    fun emailAuth(email: String, password: String, createAccount: Boolean, acceptTerms: Boolean) {
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(normalizedEmail).matches()) { error = "Enter a valid email address."; return }
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        if (createAccount && (password.length < 8 || password.none(Char::isDigit) || password.none(Char::isLetter))) {
            error = "Use at least 8 characters with a letter and a number."; return
        }
        launchAuth {
            val auth = FirebaseAuth.getInstance()
            val priorSignup = auth.currentUser?.takeIf { createAccount && it.email.equals(normalizedEmail, true) }
            val user = if (priorSignup != null) {
                // A previous attempt may have created the Firebase identity but failed
                // before Yugm finished creating its profile. Reuse it only after Firebase
                // confirms the password entered on this attempt.
                Tasks.await(priorSignup.reauthenticate(EmailAuthProvider.getCredential(normalizedEmail, password)))
                priorSignup
            } else if (createAccount) {
                Tasks.await(auth.createUserWithEmailAndPassword(normalizedEmail, password)).user
            } else {
                Tasks.await(auth.signInWithEmailAndPassword(normalizedEmail, password)).user
            } ?: error("Firebase did not return a user")
            // Sign-in has just produced a current Firebase user/token. Avoid forcing
            // another Firebase network round trip before exchanging it with Yugm.
            val firebaseToken = Tasks.await(user.getIdToken(false)).token ?: error("Firebase did not return an ID token")
            val session = yugmApi.googleAuth(firebaseToken, acceptTerms, provider = "email")
            // Send verification only after the backend session exchange succeeded.
            if (createAccount && !user.isEmailVerified) {
                viewModelScope.launch(Dispatchers.IO) {
                    runCatching { Tasks.await(user.sendEmailVerification()) }
                }
            }
            session
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
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            error = null
            notice = null
            try {
                withContext(Dispatchers.IO) {
                    AppCheckReadiness.requireReady(context)
                    Tasks.await(FirebaseAuth.getInstance().sendPasswordResetEmail(normalizedEmail))
                }
                // Keep this response generic to avoid revealing whether an email is registered.
                notice = "If an account uses this email, a password reset link is on its way."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = mapAuthError(failure)
            } finally {
                isLoading = false
            }
        }
    }

    fun refreshEmailVerification(onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            try {
                val verified = withContext(Dispatchers.IO) {
                    AppCheckReadiness.requireReady(context)
                    val user = FirebaseAuth.getInstance().currentUser ?: error("Sign in again to check verification.")
                    Tasks.await(user.reload())
                    user.isEmailVerified
                }
                onComplete(verified)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = mapAuthError(failure)
            }
        }
    }

    private fun launchAuth(block: suspend () -> Session) {
        if (isLoading) {
            googleCredentialLoading = false
            return
        }
        viewModelScope.launch {
            isLoading = true
            error = null
            notice = null
            try {
                session = withContext(Dispatchers.IO) { block() }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = mapAuthError(failure)
            } finally {
                isLoading = false
                googleCredentialLoading = false
            }
        }
    }

    private fun mapAuthError(error: Throwable): String {
        val appCheckFailure = generateSequence(error) { it.cause }
            .filterIsInstance<AppCheckSetupException>()
            .firstOrNull()
        if (appCheckFailure != null) return appCheckFailure.message.orEmpty()
        val root = generateSequence(error) { it.cause }.last()
        if (root is com.google.firebase.auth.FirebaseAuthException) {
            when (root.errorCode) {
                "ERROR_TOO_MANY_REQUESTS" -> return "Too many attempts. Wait a little before trying again."
                "ERROR_USER_DISABLED" -> return "This account is disabled. Contact support for help."
                "ERROR_OPERATION_NOT_ALLOWED" -> return "This sign-in method is not enabled for the app."
                "ERROR_EMAIL_ALREADY_IN_USE", "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL" ->
                    return "An account already uses this email. Sign in with its original method."
                "ERROR_INVALID_VERIFICATION_CODE" -> return "That verification code is incorrect or expired. Request a new code."
                "ERROR_INVALID_PHONE_NUMBER" -> return "Enter a valid phone number with its country code."
            }
        }
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

package com.yugm.app.feature.auth.viewmodel

import android.content.Context
import android.util.Patterns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.data.repository.AuthRepository
import com.yugm.app.core.model.Session
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
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

class NoAccountFoundException(val email: String, val name: String, message: String) : Exception(message)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    @param:ApplicationContext private val context: Context,
) : ViewModel() {
    private var authOperation by mutableStateOf<AuthOperation?>(null)

    val isLoading: Boolean
        get() = authOperation != null
    var error by mutableStateOf<String?>(null)
        private set
    var notice by mutableStateOf<String?>(null)
        private set
    var session by mutableStateOf<Session?>(null)
        private set
    var isCreateAccount by mutableStateOf(false)
        private set
    var prefilledEmail by mutableStateOf("")
        private set
    var prefilledName by mutableStateOf("")
        private set
    val googleCredentialLoading: Boolean
        get() = authOperation == AuthOperation(AuthProvider.GOOGLE, AuthPhase.CREDENTIAL)
    val facebookCredentialLoading: Boolean
        get() = authOperation == AuthOperation(AuthProvider.FACEBOOK, AuthPhase.CREDENTIAL)

    fun switchToSignUp(email: String = "", name: String = "", message: String? = null) {
        isCreateAccount = true
        if (email.isNotBlank()) prefilledEmail = email
        if (name.isNotBlank()) prefilledName = name
        if (!message.isNullOrBlank()) notice = message
        error = null
    }

    fun setAuthMode(create: Boolean) {
        isCreateAccount = create
        if (!create) {
            prefilledEmail = ""
            prefilledName = ""
        }
    }

    /** The ViewModel owns one provider operation across UI credential and API phases. */
    fun beginCredentialAuth(provider: AuthProvider): Boolean {
        authOperation = beginAuthOperation(authOperation, provider) ?: return false
        error = null
        notice = null
        return true
    }

    fun cancelCredentialAuth(provider: AuthProvider, failure: Throwable? = null) {
        if (authOperation?.provider != provider) {
            if (failure != null) error = mapAuthError(failure, provider)
            return
        }
        if (failure != null) error = mapAuthError(failure, provider)
        authOperation = finishAuthOperation(authOperation, provider)
    }

    fun clearError() { error = null; notice = null }
    fun consumeSession(): Session? = session.also { session = null }

    fun emailAuth(email: String, password: String, createAccount: Boolean, acceptTerms: Boolean) {
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(normalizedEmail).matches()) { error = "Enter a valid email address."; return }
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        if (createAccount && (password.length < 8 || password.none(Char::isDigit) || password.none(Char::isLetter))) {
            error = "Use at least 8 characters with a letter and a number."; return
        }
        launchAuth(AuthProvider.EMAIL) {
            val auth = FirebaseAuth.getInstance()
            val priorSignup = auth.currentUser?.takeIf { createAccount && it.email.equals(normalizedEmail, true) }
            val user = if (priorSignup != null) {
                // A previous attempt may have created the Firebase identity but failed
                // before Yugm finished creating its profile. Reuse it only after Firebase
                // confirms the password entered on this attempt.
                withContext(Dispatchers.IO) { Tasks.await(priorSignup.reauthenticate(EmailAuthProvider.getCredential(normalizedEmail, password))) }
                priorSignup
            } else if (createAccount) {
                withContext(Dispatchers.IO) { Tasks.await(auth.createUserWithEmailAndPassword(normalizedEmail, password)).user }
            } else {
                try {
                    withContext(Dispatchers.IO) { Tasks.await(auth.signInWithEmailAndPassword(normalizedEmail, password)).user }
                } catch (userEx: com.google.firebase.auth.FirebaseAuthInvalidUserException) {
                    throw NoAccountFoundException(normalizedEmail, "", "No account found for this email. Create a password to sign up.")
                }
            } ?: error("Firebase did not return a user")
            // Sign-in has just produced a current Firebase user/token. Avoid forcing
            // another Firebase network round trip before exchanging it with Yugm.
            val firebaseToken = withContext(Dispatchers.IO) { Tasks.await(user.getIdToken(false)).token } ?: error("Firebase did not return an ID token")
            beginBackendExchange(AuthProvider.EMAIL)
            val session = authRepository.googleAuth(
                firebaseToken,
                acceptTerms,
                provider = "email",
                name = prefilledName.takeIf(String::isNotBlank)
            )
            // Send verification only after the backend session exchange succeeded.
            if (createAccount && !user.isEmailVerified) {
                viewModelScope.launch(Dispatchers.IO) {
                    runCatching { Tasks.await(user.sendEmailVerification()) }
                }
            }
            if ((session.user.name.isBlank() || session.user.name == "Yugm User") && prefilledName.isNotBlank()) {
                session.copy(user = session.user.copy(name = prefilledName))
            } else {
                session
            }
        }
    }

    fun googleAuth(
        googleIdToken: String,
        acceptTerms: Boolean,
        email: String? = null,
        name: String? = null
    ) {
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        launchAuth(AuthProvider.GOOGLE) {
            val credential = GoogleAuthProvider.getCredential(googleIdToken, null)
            val user = try {
                withContext(Dispatchers.IO) { Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential)).user }
            } catch (authEx: Exception) {
                val fallbackEmail = email.orEmpty()
                if (fallbackEmail.isNotBlank()) {
                    throw NoAccountFoundException(fallbackEmail, name.orEmpty(), "No account found for this Google email. Create a password to sign up.")
                }
                throw authEx
            } ?: error("Google sign-in returned no user")

            val firebaseToken = withContext(Dispatchers.IO) { Tasks.await(user.getIdToken(false)).token } ?: error("Firebase did not return an ID token")
            val resolvedEmail = email?.takeIf(String::isNotBlank) ?: user.email
            val accountName = name?.takeIf(String::isNotBlank) ?: user.displayName?.takeIf(String::isNotBlank)
            beginBackendExchange(AuthProvider.GOOGLE)
            try {
                val session = authRepository.googleAuth(firebaseToken, acceptTerms, provider = "google", name = accountName, mode = "login")
                if ((session.user.name.isBlank() || session.user.name == "Yugm User") && !accountName.isNullOrBlank()) {
                    session.copy(user = session.user.copy(name = accountName))
                } else {
                    session
                }
            } catch (httpEx: com.yugm.app.core.api.ApiHttpException) {
                if (httpEx.statusCode == 404) {
                    val fallbackEmail = resolvedEmail.orEmpty()
                    if (fallbackEmail.isNotBlank()) {
                        throw NoAccountFoundException(
                            fallbackEmail,
                            accountName.orEmpty(),
                            "No account found for this Google email. Create a password to sign up."
                        )
                    }
                }
                throw httpEx
            }
        }
    }

    fun facebookAuth(facebookAccessToken: String, acceptTerms: Boolean) {
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        if (facebookAccessToken.isBlank()) { error = "Facebook did not return an access token. Try again."; return }
        launchAuth(AuthProvider.FACEBOOK) {
            val credential = FacebookAuthProvider.getCredential(facebookAccessToken)
            val user = withContext(Dispatchers.IO) { Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential)).user }
                ?: error("Facebook sign-in returned no user")
            val firebaseToken = withContext(Dispatchers.IO) { Tasks.await(user.getIdToken(false)).token } ?: error("Firebase did not return an ID token")
            val accountName = user.displayName?.takeIf(String::isNotBlank)
            beginBackendExchange(AuthProvider.FACEBOOK)
            val session = authRepository.facebookAuth(firebaseToken, acceptTerms, name = accountName)
            if ((session.user.name.isBlank() || session.user.name == "Yugm User") && !accountName.isNullOrBlank()) {
                session.copy(user = session.user.copy(name = accountName))
            } else {
                session
            }
        }
    }

    fun phoneAuth(credential: PhoneAuthCredential, acceptTerms: Boolean) {
        if (!acceptTerms) { error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."; return }
        launchAuth(AuthProvider.PHONE) {
            val user = withContext(Dispatchers.IO) { Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential)).user }
                ?: error("Phone sign-in returned no user")
            val firebaseToken = withContext(Dispatchers.IO) { Tasks.await(user.getIdToken(false)).token }
                ?: error("Firebase did not return an ID token")
            beginBackendExchange(AuthProvider.PHONE)
            authRepository.phoneAuth(firebaseToken, acceptTerms)
        }
    }

    fun forgotPassword(email: String) {
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(normalizedEmail).matches()) { error = "Enter your email address first."; return }
        if (isLoading) return
        viewModelScope.launch {
            authOperation = AuthOperation(AuthProvider.PASSWORD, AuthPhase.PASSWORD_RESET)
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
                error = mapAuthError(failure, AuthProvider.PASSWORD)
            } finally {
                authOperation = finishAuthOperation(authOperation, AuthProvider.PASSWORD)
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
                error = mapAuthError(failure, AuthProvider.EMAIL)
            }
        }
    }

    private fun launchAuth(provider: AuthProvider, block: suspend () -> Session) {
        authOperation = startAuthExecution(authOperation, provider) ?: return
        error = null
        notice = null
        viewModelScope.launch {
            try {
                session = block()
            } catch (noAccount: NoAccountFoundException) {
                switchToSignUp(noAccount.email, noAccount.name, noAccount.message)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = mapAuthError(failure, provider)
            } finally {
                authOperation = finishAuthOperation(authOperation, provider)
            }
        }
    }

    private suspend fun beginBackendExchange(provider: AuthProvider) {
        withContext(Dispatchers.Main.immediate) {
            authOperation = advanceAuthOperation(authOperation, provider, AuthPhase.BACKEND_EXCHANGE)
        }
        withContext(Dispatchers.IO) { AppCheckReadiness.requireReady(context) }
    }

    private fun mapAuthError(error: Throwable, provider: AuthProvider): String {
        val apiFailure = generateSequence(error) { it.cause }
            .filterIsInstance<com.yugm.app.core.api.ApiHttpException>()
            .firstOrNull()
        if (apiFailure?.statusCode == 401 && apiFailure.message.orEmpty().contains("app verification", ignoreCase = true)) {
            return "App verification failed. Update or restart Yugm and try again."
        }
        if (apiFailure?.statusCode == 401 && apiFailure.message.orEmpty().contains("another device", ignoreCase = true)) {
            return "This account was signed in on another device. Sign in again to continue."
        }
        if (apiFailure?.statusCode == 401 && apiFailure.message.orEmpty().contains("firebase", ignoreCase = true)) {
            return "Authentication could not be verified. Please try again or sign up with email."
        }
        if (apiFailure?.statusCode == 409) return apiFailure.message ?: "This account conflicts with an existing sign-in. Use the original sign-in method."
        val appCheckFailure = generateSequence(error) { it.cause }
            .filterIsInstance<AppCheckSetupException>()
            .firstOrNull()
        if (appCheckFailure != null) return appCheckFailure.message.orEmpty()
        val root = generateSequence(error) { it.cause }.last()
        if (root is com.google.firebase.auth.FirebaseAuthException) {
            firebaseCredentialErrorMessage(provider, root.errorCode)?.let { return it }
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

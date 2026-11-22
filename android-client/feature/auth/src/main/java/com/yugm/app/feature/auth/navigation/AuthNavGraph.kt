package com.yugm.app.feature.auth.navigation

import android.util.Log
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.setValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.model.Session
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.auth.screens.*
import com.yugm.app.feature.auth.viewmodel.AuthViewModel
import com.yugm.app.feature.auth.viewmodel.AuthProvider
import com.yugm.app.feature.auth.viewmodel.ProfileSetupViewModel
import com.yugm.app.feature.auth.rememberFacebookSignIn
import kotlinx.coroutines.launch
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import kotlinx.coroutines.CancellationException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

fun NavGraphBuilder.authNavGraph(
    navController: NavHostController,
    profileName: String,
    profileUsername: String,
    googleWebClientId: String,
    validateStartupSession: suspend () -> Unit,
    currentStartupDestination: () -> String,
    navigateAfterLogin: (Session) -> Unit,
    onProfileComplete: (Session) -> Unit,
    onProfileExit: () -> Unit,
    onOnboardingComplete: () -> Unit = {},
) {
    composable(Screen.Splash.route) {
        SplashScreen {
            validateStartupSession()
            val start = currentStartupDestination()
            navController.navigate(start) {
                popUpTo(Screen.Splash.route) { inclusive = true }
            }
        }
    }

    composable(Screen.Onboarding.route) {
        OnboardingScreen(
            onStart = {
                onOnboardingComplete()
                navController.navigate(Screen.Login.route) {
                    popUpTo(Screen.Onboarding.route) { inclusive = true }
                    launchSingleTop = true
                }
            }
        )
    }

    composable(Screen.Login.route) {
        val authViewModel: AuthViewModel = hiltViewModel()
        val context = LocalContext.current
        val scope = rememberCoroutineScope()
        val facebookSignIn = rememberFacebookSignIn(
            onToken = { token, acceptTerms ->
                authViewModel.facebookAuth(token, acceptTerms)
            },
            onError = { message ->
                authViewModel.cancelCredentialAuth(AuthProvider.FACEBOOK, IllegalStateException(message))
            },
            onFinished = { authViewModel.cancelCredentialAuth(AuthProvider.FACEBOOK) },
        )

        LoginScreen(
            onGoogleSignIn = { acceptTerms ->
                if (!acceptTerms || !authViewModel.beginCredentialAuth(AuthProvider.GOOGLE)) return@LoginScreen
                if (googleWebClientId.isBlank()) {
                    authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE, IllegalStateException("Google sign-in is not configured for this build."))
                    return@LoginScreen
                }
                Log.d("YugmAuth", "Google sign-in started")
                scope.launch {
                    try {
                        val credentialManager = CredentialManager.create(context)
                        val result = try {
                            // Prefer the explicit Google sign-in UI for a deliberate sign-in tap.
                            val signInOption = GetSignInWithGoogleOption.Builder(googleWebClientId).build()
                            val request = GetCredentialRequest.Builder().addCredentialOption(signInOption).build()
                            credentialManager.getCredential(context, request)
                        } catch (cancelled: GetCredentialCancellationException) {
                            throw cancelled
                        } catch (error: Exception) {
                            Log.w("YugmAuth", "GetSignInWithGoogleOption failed (${error.javaClass.simpleName}); trying GetGoogleIdOption", error)
                            val googleOption = GetGoogleIdOption.Builder()
                                .setServerClientId(googleWebClientId)
                                .setFilterByAuthorizedAccounts(false)
                                .setAutoSelectEnabled(false)
                                .build()
                            val request = GetCredentialRequest.Builder().addCredentialOption(googleOption).build()
                            credentialManager.getCredential(context, request)
                        }

                        val credential = result.credential
                        Log.d("YugmAuth", "Google credential received type=${credential.type}")
                        val googleCredential = runCatching {
                            when {
                                credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL ->
                                    GoogleIdTokenCredential.createFrom(credential.data)
                                credential is CustomCredential -> GoogleIdTokenCredential.createFrom(credential.data)
                                else -> GoogleIdTokenCredential.createFrom(credential.data)
                            }
                        }.getOrElse { parseError ->
                            throw IllegalStateException("Google did not return a valid sign-in credential", parseError)
                        }
                        authViewModel.googleAuth(
                            googleIdToken = googleCredential.idToken,
                            acceptTerms = acceptTerms,
                            email = googleCredential.id,
                            name = googleCredential.displayName
                        )
                    } catch (_: GetCredentialCancellationException) {
                        Log.d("YugmAuth", "Google sign-in cancelled")
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE)
                    } catch (_: androidx.credentials.exceptions.NoCredentialException) {
                        Log.w("YugmAuth", "No Google credential available")
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE)
                        authViewModel.switchToSignUp(message = "No Google account found. Create an account with your email.")
                    } catch (error: GetCredentialException) {
                        Log.w("YugmAuth", "Google credential request failed: ${error.javaClass.simpleName}: ${error.message}", error)
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE, error)
                    } catch (cancelled: CancellationException) {
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE)
                        throw cancelled
                    } catch (error: Exception) {
                        Log.e("YugmAuth", "Google sign-in failed", error)
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE, error)
                    }
                }
            },
            onFacebookSignIn = { acceptTerms ->
                if (acceptTerms && authViewModel.beginCredentialAuth(AuthProvider.FACEBOOK)) facebookSignIn(acceptTerms)
            },
            onPhoneSignIn = {
                navController.navigate(Screen.PhoneLogin.route)
            },
            onEmailAuth = { email, password, createAccount, accepted ->
                authViewModel.emailAuth(email, password, createAccount, accepted)
            },
            onForgotPassword = authViewModel::forgotPassword,
            onClearError = authViewModel::clearError,
            loading = authViewModel.isLoading,
            error = authViewModel.error,
            notice = authViewModel.notice,
            googleLoading = authViewModel.googleCredentialLoading,
            facebookLoading = authViewModel.facebookCredentialLoading,
            initialEmail = authViewModel.prefilledEmail,
            initialCreateAccount = authViewModel.isCreateAccount,
            pendingVerificationEmail = authViewModel.pendingVerificationEmail,
            onCheckVerification = authViewModel::checkEmailVerificationAndContinue,
            onResendVerification = authViewModel::resendVerificationEmailForPending,
            onCancelVerification = authViewModel::clearPendingVerification,
            onModeChange = authViewModel::setAuthMode
        )
        LaunchedEffect(authViewModel.session) {
            authViewModel.session?.let(navigateAfterLogin)
        }
    }

    composable(Screen.PhoneLogin.route) {
        PhoneAuthScreen(
            onBack = { navController.popBackStack() },
            onAuthSuccess = { session -> navigateAfterLogin(session) }
        )
    }

    composable(Screen.ProfileSetup.route) {
        val profileSetupViewModel: ProfileSetupViewModel = hiltViewModel()
        CreateProfileScreen(
            initialName = profileName.takeUnless { it == "Yugm User" }.orEmpty(),
            initialUsername = profileUsername.takeUnless { it == "vibe_user" }.orEmpty(),
            isSubmitting = profileSetupViewModel.isSubmitting,
            isUploadingAvatar = profileSetupViewModel.avatarUploadState == com.yugm.app.feature.auth.viewmodel.AvatarUploadState.UPLOADING,
            avatarUploadProgress = profileSetupViewModel.avatarUploadProgress,
            activeAvatarUploadSessionId = profileSetupViewModel.activeAvatarUploadSessionId,
            onCancelAvatarUpload = profileSetupViewModel::cancelAvatarUpload,
            onExit = onProfileExit,
            onUploadAvatar = profileSetupViewModel::uploadAvatar,
            onDone = { profileData, onResult ->
                profileSetupViewModel.submit(
                    update = com.yugm.app.core.model.AuthProfileUpdate(
                        name = profileData.name,
                        username = profileData.username,
                        bio = profileData.bio,
                        city = profileData.city,
                        interests = profileData.interests,
                        languages = profileData.languages,
                        gender = profileData.gender,
                        age = profileData.age,
                        lookingFor = profileData.lookingFor,
                        avatar = null,
                        avatarType = if (profileData.generatedAvatar != null) "GENERATED" else null,
                        avatarPartsJson = profileData.generatedAvatar?.let { desc ->
                            "{\"background\":${desc.parts.background},\"clothes\":${desc.parts.clothes},\"head\":${desc.parts.head},\"mouth\":${desc.parts.mouth},\"eyes\":${desc.parts.eyes},\"top\":${desc.parts.top}}"
                        },
                        acceptTerms = profileData.acceptTerms,
                        vibeLine = profileData.vibeLine.ifBlank { null },
                    ),
                    onSuccess = { session ->
                        onResult(null)
                        onProfileComplete(session)
                    },
                    onFailure = onResult
                )
            }
        )
    }
}

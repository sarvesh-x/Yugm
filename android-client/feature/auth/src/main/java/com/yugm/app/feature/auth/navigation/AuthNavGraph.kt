package com.yugm.app.feature.auth.navigation

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
import com.yugm.app.core.model.YugmUser
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.auth.screens.*
import com.yugm.app.feature.auth.viewmodel.AuthViewModel
import kotlinx.coroutines.launch
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import kotlinx.coroutines.CancellationException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

fun NavGraphBuilder.authNavGraph(
    navController: NavHostController,
    isLoggedIn: Boolean,
    isProfileCompleted: Boolean,
    profileName: String,
    profileUsername: String,
    authTokenProvider: () -> String,
    googleWebClientId: String,
    navigateAfterLogin: (Session) -> Unit,
    onProfileComplete: (Session) -> Unit,
) {
    composable(Screen.Splash.route) {
        SplashScreen {
            // Use the persisted session to render the app immediately. API requests
            // refresh an expired access token in the background; making /auth/me a
            // prerequisite here added a network round trip to every cold launch.
            val start = when {
                !isLoggedIn -> Screen.Onboarding.route
                !isProfileCompleted -> Screen.ProfileSetup.route
                else -> Screen.Discover.route
            }
            navController.navigate(start) {
                popUpTo(Screen.Splash.route) { inclusive = true }
            }
        }
    }

    composable(Screen.Onboarding.route) {
        OnboardingScreen(
            onStart = { navController.navigate(Screen.Login.route) }
        )
    }

    composable(Screen.Login.route) {
        val authViewModel: AuthViewModel = hiltViewModel()
        val context = LocalContext.current
        val scope = rememberCoroutineScope()

        LoginScreen(
            onGoogleSignIn = { acceptTerms ->
                if (!acceptTerms || authViewModel.googleCredentialLoading) return@LoginScreen
                authViewModel.setGoogleCredentialBusy(true)
                scope.launch {
                    try {
                        val googleOption = GetGoogleIdOption.Builder()
                            .setServerClientId(googleWebClientId)
                            .setFilterByAuthorizedAccounts(false)
                            .setAutoSelectEnabled(false)
                            .build()
                        val request = GetCredentialRequest.Builder().addCredentialOption(googleOption).build()
                        val result = CredentialManager.create(context).getCredential(context, request)
                        val credential = result.credential
                        val googleCredential = if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                            GoogleIdTokenCredential.createFrom(credential.data)
                        } else throw IllegalStateException("Google did not return an ID token")
                        authViewModel.googleAuth(googleCredential.idToken, acceptTerms)
                    } catch (_: GetCredentialCancellationException) {
                        authViewModel.setGoogleCredentialBusy(false)
                    } catch (error: GetCredentialException) {
                        authViewModel.reportError("Google sign-in is unavailable right now. Try email or phone.")
                        authViewModel.setGoogleCredentialBusy(false)
                    } catch (cancelled: CancellationException) {
                        authViewModel.setGoogleCredentialBusy(false)
                        throw cancelled
                    } catch (error: Exception) {
                        authViewModel.setGoogleCredentialBusy(false)
                        authViewModel.reportError(error.message?.takeIf(String::isNotBlank) ?: "Google sign-in failed. Please try again.")
                    }
                }
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
            googleLoading = authViewModel.googleCredentialLoading
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
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        CreateProfileScreen(
            initialName = profileName.takeUnless { it == "Yugm User" }.orEmpty(),
            initialUsername = profileUsername.takeUnless { it == "vibe_user" }.orEmpty(),
            onUploadAvatar = { uri, onResult ->
                scope.launch {
                    runCatching {
                        val sessionToken = authTokenProvider().takeIf(String::isNotBlank)
                            ?: throw IllegalStateException("Your sign-in session expired. Please sign in again.")
                        val uploadedUrl = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                            val (mime, bytes) = readImageUpload(context, uri)
                            com.yugm.app.core.api.YugmApi.uploadAvatar(sessionToken, bytes, mime)
                        }
                        uploadedUrl
                    }.onSuccess { url -> onResult(url, null) }
                        .onFailure { failure -> onResult(null, failure.message ?: "Could not upload that photo. Try another image.") }
                }
            },
            onDone = { profileData, onResult ->
                scope.launch {
                    var sessionToken = ""
                    runCatching {
                        // Read the token when the user submits the form. The navigation graph
                        // can outlive the login composition that originally registered it.
                        sessionToken = authTokenProvider().takeIf(String::isNotBlank)
                            ?: throw IllegalStateException("Your sign-in session expired. Please sign in again.")
                        com.yugm.app.core.api.YugmApi.updateProfile(
                            token = sessionToken,
                            name = profileData.name,
                            username = profileData.username,
                            bio = profileData.bio,
                            city = profileData.city,
                            interests = profileData.interests,
                            languages = profileData.languages,
                            gender = profileData.gender,
                            age = profileData.age,
                            lookingFor = profileData.lookingFor,
                            avatar = profileData.avatar.ifBlank { null },
                            acceptTerms = profileData.acceptTerms,
                            vibeLine = profileData.vibeLine.ifBlank { null }
                        )
                    }.onSuccess { user ->
                        onResult(null)
                        onProfileComplete(Session(token = sessionToken, user = user))
                    }.onFailure { failure ->
                        onResult(failure.message?.takeIf(String::isNotBlank) ?: "Profile creation failed. Check your connection and try again.")
                    }
                }
            }
        )
    }
}

private fun readImageUpload(context: android.content.Context, uri: android.net.Uri): Pair<String, ByteArray> {
    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
    require(mime.startsWith("image/", ignoreCase = true)) { "Choose an image file." }
    val input = context.contentResolver.openInputStream(uri) ?: error("Could not read the selected image")
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8 * 1024)
    var totalBytes = 0
    input.use { stream ->
        while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            totalBytes += count
            require(totalBytes <= 5 * 1024 * 1024) { "Choose a photo smaller than 5 MB." }
            output.write(buffer, 0, count)
        }
    }
    require(totalBytes > 0) { "The selected image is empty." }
    return mime to output.toByteArray()
}

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
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.auth.screens.*
import com.yugm.app.feature.auth.viewmodel.AuthViewModel
import com.yugm.app.feature.auth.viewmodel.AuthProvider
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
    authTokenProvider: () -> String,
    googleWebClientId: String,
    validateStartupSession: suspend () -> Unit,
    currentStartupDestination: () -> String,
    navigateAfterLogin: (Session) -> Unit,
    onProfileComplete: (Session) -> Unit,
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
                scope.launch {
                    try {
                        val result = try {
                            val googleOption = GetGoogleIdOption.Builder()
                                .setServerClientId(googleWebClientId)
                                .setFilterByAuthorizedAccounts(true)
                                .setAutoSelectEnabled(false)
                                .build()
                            val request = GetCredentialRequest.Builder().addCredentialOption(googleOption).build()
                            CredentialManager.create(context).getCredential(context, request)
                        } catch (_: androidx.credentials.exceptions.NoCredentialException) {
                            val signInOption = GetSignInWithGoogleOption.Builder(googleWebClientId).build()
                            val request = GetCredentialRequest.Builder().addCredentialOption(signInOption).build()
                            CredentialManager.create(context).getCredential(context, request)
                        } catch (_: GetCredentialException) {
                            val signInOption = GetSignInWithGoogleOption.Builder(googleWebClientId).build()
                            val request = GetCredentialRequest.Builder().addCredentialOption(signInOption).build()
                            CredentialManager.create(context).getCredential(context, request)
                        }

                        val credential = result.credential
                        val googleCredential = if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                            GoogleIdTokenCredential.createFrom(credential.data)
                        } else throw IllegalStateException("Google did not return an ID token")
                        authViewModel.googleAuth(googleCredential.idToken, acceptTerms)
                    } catch (_: GetCredentialCancellationException) {
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE)
                    } catch (error: GetCredentialException) {
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE, error)
                    } catch (cancelled: CancellationException) {
                        authViewModel.cancelCredentialAuth(AuthProvider.GOOGLE)
                        throw cancelled
                    } catch (error: Exception) {
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
            facebookLoading = authViewModel.facebookCredentialLoading
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
        val profileAuthViewModel: AuthViewModel = hiltViewModel()
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
                            profileAuthViewModel.uploadAvatar(sessionToken, bytes, mime)
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
                        val updatedUser = profileAuthViewModel.updateProfile(
                            token = sessionToken,
                            update = com.yugm.app.core.model.AuthProfileUpdate(
                                name = profileData.name,
                                username = profileData.username,
                                bio = profileData.bio,
                                city = profileData.city,
                                interests = profileData.interests,
                                languages = profileData.languages,
                                gender = profileData.gender.ifBlank { null },
                                age = profileData.age,
                                lookingFor = profileData.lookingFor.ifBlank { null },
                                avatar = profileData.avatar.ifBlank { null },
                                acceptTerms = profileData.acceptTerms,
                                vibeLine = profileData.vibeLine.ifBlank { null },
                            )
                        )
                        if (!updatedUser.profileCompleted) {
                            throw IllegalStateException("Your profile was saved, but Yugm still needs the required profile details. Review your name, username, bio, city, and interests.")
                        }
                        updatedUser
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

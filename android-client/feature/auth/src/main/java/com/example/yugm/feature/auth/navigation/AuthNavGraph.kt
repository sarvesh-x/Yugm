package com.example.yugm.feature.auth.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.setValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.model.Session
import com.example.yugm.core.model.YugmUser
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.auth.screens.*
import com.example.yugm.feature.auth.viewmodel.AuthViewModel
import kotlinx.coroutines.launch
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

fun NavGraphBuilder.authNavGraph(
    navController: NavHostController,
    isLoggedIn: Boolean,
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
            val start = if (isLoggedIn) Screen.Discover.route else Screen.Onboarding.route
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
                        authViewModel.clearError()
                        authViewModel.setGoogleCredentialBusy(false)
                        android.widget.Toast.makeText(context, "Google sign-in is unavailable right now. Try email or phone.", android.widget.Toast.LENGTH_LONG).show()
                    } catch (error: Exception) {
                        authViewModel.setGoogleCredentialBusy(false)
                        android.widget.Toast.makeText(context, error.message ?: "Google sign-in failed", android.widget.Toast.LENGTH_LONG).show()
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
            loading = authViewModel.isLoading,
            error = authViewModel.error,
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
            initialName = "",
            initialUsername = "",
            onDone = { name, handle, bio, city, interests, languages, gender, age, lookingFor, avatar, accepted ->
                scope.launch {
                    var sessionToken = ""
                    runCatching {
                        // Read the token when the user submits the form. The navigation graph
                        // can outlive the login composition that originally registered it.
                        sessionToken = authTokenProvider().takeIf(String::isNotBlank)
                            ?: throw IllegalStateException("Your sign-in session expired. Please sign in again.")
                        com.example.yugm.core.api.YugmApi.updateProfile(
                            token = sessionToken,
                            name = name,
                            username = handle,
                            bio = bio,
                            city = city,
                            interests = interests,
                            languages = languages,
                            gender = gender,
                            age = age,
                            lookingFor = lookingFor,
                            avatar = avatar.ifBlank { null },
                            acceptTerms = accepted
                        )
                    }.onSuccess { user ->
                        onProfileComplete(Session(token = sessionToken, user = user))
                    }.onFailure {
                        android.widget.Toast.makeText(context, it.message ?: "Profile creation failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }
}

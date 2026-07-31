package com.example.yugm.feature.auth.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.core.model.Session
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.auth.screens.*
import com.example.yugm.feature.auth.viewmodel.AuthViewModel
import kotlinx.coroutines.launch

fun NavGraphBuilder.authNavGraph(
    navController: NavHostController,
    isLoggedIn: Boolean,
    authToken: String,
    onGoogleSignIn: () -> Unit,
    navigateAfterLogin: (Session) -> Unit,
) {
    composable(Screen.Splash.route) {
        SplashScreen {
            val start = if (!isLoggedIn) {
                Screen.Onboarding.route
            } else {
                Screen.Discover.route
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

        LoginScreen(
            onGoogleSignIn = onGoogleSignIn,
            onPhoneSignIn = {
                navController.navigate(Screen.PhoneLogin.route)
            },
            onEmailLogin = { email ->
                authViewModel.requestOtp(email) {
                    navController.navigate(Screen.OtpVerify.createRoute(email))
                }
            },
            loading = authViewModel.isLoading,
            error = authViewModel.error
        )
    }

    composable(Screen.PhoneLogin.route) {
        PhoneAuthScreen(
            onBack = { navController.popBackStack() },
            onAuthSuccess = { session -> navigateAfterLogin(session) }
        )
    }

    composable(
        route = Screen.OtpVerify.route,
        arguments = listOf(
            navArgument("identifier") { type = NavType.StringType }
        )
    ) { backStackEntry ->
        val identifier = backStackEntry.arguments?.getString("identifier") ?: ""
        val authViewModel: AuthViewModel = hiltViewModel()

        LaunchedEffect(authViewModel.session) {
            authViewModel.session?.let { session ->
                navigateAfterLogin(session)
                authViewModel.clearError()
            }
        }

        OtpScreen(
            identifier = identifier,
            loading = authViewModel.isLoading,
            error = authViewModel.error,
            onVerified = { otp ->
                if (!authViewModel.isLoading) {
                    authViewModel.verifyOtp(identifier, otp)
                }
            },
            onResend = {
                authViewModel.requestOtp(identifier) { }
            }
        )
    }

    composable(Screen.ProfileSetup.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        CreateProfileScreen(
            initialName = "",
            initialUsername = "",
            onDone = { name, handle, bio, city, interests, languages, gender, age, lookingFor, avatar ->
                scope.launch {
                    runCatching {
                        com.example.yugm.core.api.YugmApi.updateProfile(
                            token = authToken,
                            name = name,
                            username = handle,
                            bio = bio,
                            city = city,
                            interests = interests,
                            languages = languages,
                            gender = gender,
                            age = age,
                            lookingFor = lookingFor,
                            avatar = avatar.ifBlank { null }
                        )
                    }.onSuccess { user ->
                        navigateAfterLogin(Session(token = authToken, user = user))
                        navController.navigate(Screen.Discover.route) {
                            popUpTo(Screen.ProfileSetup.route) { inclusive = true }
                        }
                    }.onFailure {
                        android.widget.Toast.makeText(context, it.message ?: "Profile creation failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }
}

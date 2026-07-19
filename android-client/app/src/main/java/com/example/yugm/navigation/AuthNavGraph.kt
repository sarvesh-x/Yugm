package com.example.yugm.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.MainViewModel
import kotlinx.coroutines.launch

fun NavGraphBuilder.authNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    onGoogleSignIn: () -> Unit,
    navigateAfterLogin: (com.example.yugm.model.Session) -> Unit,
) {
    composable(Screen.Splash.route) {
        SplashScreen {
            val start = if (mainViewModel.authToken.isEmpty()) {
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
        val scope = rememberCoroutineScope()
        var loginLoading by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
        var loginError by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }

        LoginScreen(
            onGoogleSignIn = onGoogleSignIn,
            onPhoneSignIn = {
                navController.navigate(Screen.PhoneLogin.route)
            },
            onEmailLogin = { email ->
                loginLoading = true
                loginError = null
                scope.launch {
                    runCatching {
                        com.example.yugm.api.YugmApi.requestOtp(email)
                    }.onSuccess {
                        loginLoading = false
                        navController.navigate(Screen.OtpVerify.createRoute(email))
                    }.onFailure {
                        loginLoading = false
                        loginError = it.message ?: "Failed to send OTP"
                    }
                }
            },
            loading = loginLoading,
            error = loginError
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
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var verifying by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }

        OtpScreen(
            identifier = identifier,
            loading = verifying,
            onVerified = { otp ->
                if (verifying) return@OtpScreen
                verifying = true
                scope.launch {
                    runCatching {
                        com.example.yugm.api.YugmApi.verifyOtp(identifier, otp)
                    }.onSuccess { session ->
                        navigateAfterLogin(session)
                    }.onFailure {
                        verifying = false
                        android.widget.Toast.makeText(
                            context,
                            it.message ?: "Verification failed",
                            android.widget.Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        )
    }

    composable(Screen.ProfileSetup.route) {
        val scope = rememberCoroutineScope()
        CreateProfileScreen(
            initialName = mainViewModel.userName,
            initialUsername = mainViewModel.username,
            onDone = { name, handle, bio, city, interests, languages, gender, age, lookingFor, avatar ->
                scope.launch {
                    runCatching {
                        com.example.yugm.api.YugmApi.updateProfile(
                            token = mainViewModel.authToken,
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
                        mainViewModel.updateSession(
                            token = mainViewModel.authToken,
                            userId = user.id,
                            name = user.name,
                            username = user.username,
                            balance = user.walletBalance
                        )
                        navController.navigate(Screen.Discover.route) {
                            popUpTo(Screen.ProfileSetup.route) { inclusive = true }
                        }
                    }
                }
            }
        )
    }
}

package com.example.yugm.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.yugm.core.api.VibeApi
import com.example.yugm.core.model.CoinPack
import com.example.yugm.core.model.RazorpayCheckoutData
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.auth.navigation.authNavGraph
import com.example.yugm.feature.chat.navigation.chatNavGraph
import com.example.yugm.feature.creator.navigation.creatorNavGraph
import com.example.yugm.feature.discover.navigation.discoverNavGraph
import com.example.yugm.feature.events.navigation.eventsNavGraph
import com.example.yugm.feature.gift.navigation.giftNavGraph
import com.example.yugm.feature.missions.navigation.missionsNavGraph
import com.example.yugm.feature.moderation.navigation.moderationNavGraph
import com.example.yugm.feature.profile.navigation.profileNavGraph
import com.example.yugm.feature.room.navigation.roomNavGraph
import com.example.yugm.feature.roommodes.navigation.roomModesNavGraph
import com.example.yugm.feature.settings.navigation.settingsNavGraph
import com.example.yugm.feature.social.navigation.socialNavGraph
import com.example.yugm.feature.wallet.navigation.walletNavGraph
import com.example.yugm.ui.screens.WingmanScreen
import com.example.yugm.ui.viewmodel.AuthViewModel
import com.example.yugm.ui.viewmodel.MainViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    onGoogleSignIn: () -> Unit,
    onRechargeOrderReady: (RazorpayCheckoutData) -> Unit,
    onStartGooglePlayPurchase: (CoinPack) -> Unit,
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val authSuccess by authViewModel.authSuccess.collectAsState(initial = null)

    LaunchedEffect(authSuccess) {
        authSuccess?.let { session ->
            mainViewModel.updateSession(
                token = session.token,
                userId = session.user.id,
                name = session.user.name,
                username = session.user.username,
                balance = session.user.walletBalance,
            )
            val destination = if (!session.user.profileCompleted) {
                Screen.ProfileSetup.route
            } else {
                Screen.Discover.route
            }
            navController.navigate(destination) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    val vibeInitDone = remember { mutableStateOf(false) }
    LaunchedEffect(mainViewModel.authToken) {
        if (mainViewModel.authToken.isNotBlank() && !vibeInitDone.value) {
            runCatching { VibeApi.init(mainViewModel.authToken) }
                .onFailure { e -> android.util.Log.w("NavGraph", "Vibe init failed (non-fatal): ${e.message}") }
            vibeInitDone.value = true
        }
    }

    fun navigateAfterLogin(session: com.example.yugm.core.model.Session) {
        mainViewModel.updateSession(
            token = session.token,
            userId = session.user.id,
            name = session.user.name,
            username = session.user.username,
            balance = session.user.walletBalance,
        )
        val dest = if (!session.user.profileCompleted) {
            Screen.ProfileSetup.route
        } else {
            Screen.Discover.route
        }
        navController.navigate(dest) {
            popUpTo(Screen.Login.route) { inclusive = true }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {
        authNavGraph(
            navController = navController,
            isLoggedIn = mainViewModel.authToken.isNotBlank(),
            authTokenProvider = { mainViewModel.authToken },
            onGoogleSignIn = onGoogleSignIn,
            navigateAfterLogin = ::navigateAfterLogin,
            onProfileComplete = { session ->
                mainViewModel.updateSession(
                    token = session.token,
                    userId = session.user.id,
                    name = session.user.name,
                    username = session.user.username,
                    balance = session.user.walletBalance,
                )
                navController.navigate(Screen.Discover.route) {
                    popUpTo(Screen.ProfileSetup.route) { inclusive = true }
                    launchSingleTop = true
                }
            }
        )
        discoverNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId
        )
        roomNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId,
            userName = mainViewModel.userName,
            username = mainViewModel.username,
            balance = mainViewModel.balance
        )
        profileNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId
        )
        socialNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId
        )
        walletNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            balance = mainViewModel.balance,
            currentUserId = mainViewModel.currentUserId,
            onRechargeOrderReady = onRechargeOrderReady,
            onStartGooglePlayPurchase = onStartGooglePlayPurchase
        )
        settingsNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId,
            userName = mainViewModel.userName,
            username = mainViewModel.username,
            onLogout = { mainViewModel.logout() }
        )
        roomModesNavGraph(navController, mainViewModel.authToken, mainViewModel.currentUserId)
        moderationNavGraph(navController, mainViewModel.authToken)
        missionsNavGraph(navController, mainViewModel.authToken)
        eventsNavGraph(navController, mainViewModel.authToken, mainViewModel.currentUserId)
        giftNavGraph(navController, mainViewModel.authToken)
        chatNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId
        )
        creatorNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId
        )

        composable(Screen.Wingman.route) {
            WingmanScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
            )
        }
        composable(Screen.VibeGraph.route) {
            com.example.yugm.feature.discover.screens.VibeGraphScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
            )
        }
    }
}

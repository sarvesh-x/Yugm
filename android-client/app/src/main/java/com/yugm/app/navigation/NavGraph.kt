package com.yugm.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.yugm.app.core.api.VibeApi
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.navigation.Screen
import com.yugm.app.feature.auth.navigation.authNavGraph
import com.yugm.app.feature.chat.navigation.chatNavGraph
import com.yugm.app.feature.creator.navigation.creatorNavGraph
import com.yugm.app.feature.discover.navigation.discoverNavGraph
import com.yugm.app.feature.events.navigation.eventsNavGraph
import com.yugm.app.feature.gift.navigation.giftNavGraph
import com.yugm.app.feature.missions.navigation.missionsNavGraph
import com.yugm.app.feature.moderation.navigation.moderationNavGraph
import com.yugm.app.feature.profile.navigation.profileNavGraph
import com.yugm.app.feature.room.navigation.roomNavGraph
import com.yugm.app.feature.roommodes.navigation.roomModesNavGraph
import com.yugm.app.feature.settings.navigation.settingsNavGraph
import com.yugm.app.feature.social.navigation.socialNavGraph
import com.yugm.app.feature.wallet.navigation.walletNavGraph
import com.yugm.app.ui.screens.WingmanScreen
import com.yugm.app.ui.viewmodel.MainViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    onRechargeOrderReady: (RazorpayCheckoutData) -> Unit,
    onStartGooglePlayPurchase: (CoinPack) -> Unit,
) {
    val resources = LocalResources.current
    val vibeInitDone = remember { mutableStateOf(false) }
    var minimizedRoomId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(mainViewModel.authToken) {
        if (mainViewModel.authToken.isNotBlank() && !vibeInitDone.value) {
            runCatching { VibeApi.init(mainViewModel.authToken) }
                .onFailure { e -> android.util.Log.w("NavGraph", "Vibe init failed (non-fatal): ${e.message}") }
            vibeInitDone.value = true
        }
    }

    fun navigateAfterLogin(session: com.yugm.app.core.model.Session) {
        mainViewModel.updateSession(
            token = session.token,
            userId = session.user.id,
            name = session.user.name,
            username = session.user.username,
            balance = session.user.walletBalance,
            refreshToken = session.refreshToken,
            sessionId = session.sessionId,
            expiresIn = session.expiresIn,
            emailVerified = session.user.emailVerified,
            profileCompleted = session.user.profileCompleted,
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

    // The app runs edge-to-edge on modern Android versions. Keep every destination
    // inside the status/navigation bars and display cutouts, while allowing child
    // screens to draw their backgrounds normally within that safe area.
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
      NavHost(
          navController = navController,
          startDestination = Screen.Splash.route
      ) {
        authNavGraph(
            navController = navController,
            isLoggedIn = mainViewModel.authToken.isNotBlank(),
            isProfileCompleted = mainViewModel.profileCompleted,
            profileName = mainViewModel.userName,
            profileUsername = mainViewModel.username,
            authTokenProvider = { mainViewModel.authToken },
            googleWebClientId = resources.getString(com.yugm.app.R.string.default_web_client_id),
            navigateAfterLogin = ::navigateAfterLogin,
            onProfileComplete = { session ->
                // Profile completion returns only the updated user. Keep the refresh
                // token/session ID saved during sign-in instead of overwriting them
                // with the empty defaults on this lightweight Session wrapper.
                mainViewModel.validateAndUpdate(session.user)
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
            balance = mainViewModel.balance,
            onMinimizeRoom = { roomId ->
                minimizedRoomId = roomId
                navController.navigate(Screen.Discover.route) { launchSingleTop = true }
            }
        )
        profileNavGraph(
            navController = navController,
            authToken = mainViewModel.authToken,
            currentUserId = mainViewModel.currentUserId,
            onProfileUpdated = mainViewModel::validateAndUpdate,
            onSettings = { navController.navigate(Screen.Settings.route) },
            onOpenStore = { navController.navigate(Screen.Cosmetics.route) },
            onOpenVip = { navController.navigate(Screen.Vip.route) },
            onOpenTasks = { navController.navigate(Screen.Missions.route) },
            onOpenLevel = { navController.navigate(Screen.BattlePass.route) },
            onOpenWallet = { navController.navigate(Screen.Wallet.route) },
            onOpenInventory = { navController.navigate(Screen.Inventory.route) }
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
            com.yugm.app.feature.discover.screens.VibeGraphScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
            )
        }
      }

      minimizedRoomId?.let { roomId ->
          Box(
              modifier = Modifier
                  .align(Alignment.BottomEnd)
                  .padding(end = 18.dp, bottom = 96.dp)
                  .size(58.dp)
                  .background(Color(0xFF7C3AED), CircleShape)
                  .semantics {
                      contentDescription = "Return to live voice room"
                  }
                  .clickable(role = androidx.compose.ui.semantics.Role.Button) {
                      val roomRoute = Screen.VoiceRoom.createRoute(roomId)
                      val restored = navController.popBackStack(roomRoute, inclusive = false)
                      if (!restored) navController.navigate(roomRoute) { launchSingleTop = true }
                      minimizedRoomId = null
                  },
              contentAlignment = Alignment.Center
          ) {
              Icon(Icons.Filled.Mic, contentDescription = null, modifier = Modifier.size(26.dp), tint = Color.White)
          }
      }
    }
}

package com.example.yugm.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.yugm.api.VibeApi
import com.example.yugm.feature.gift.screens.GiftCatalogScreen
import com.example.yugm.feature.gift.screens.InventoryScreen
import com.example.yugm.feature.missions.screens.BattlePassScreen
import com.example.yugm.feature.missions.screens.MissionsScreen
import com.example.yugm.ui.viewmodel.AuthViewModel
import com.example.yugm.ui.viewmodel.MainViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    onGoogleSignIn: () -> Unit,
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
            val destination = if ((session.user.name == "Yugm User") || session.user.name.isBlank()) {
                Screen.ProfileSetup.route
            } else {
                Screen.Discover.route
            }
            navController.navigate(destination) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    val vibeInitDone = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    LaunchedEffect(mainViewModel.authToken) {
        if (mainViewModel.authToken.isNotBlank() && !vibeInitDone.value) {
            runCatching { VibeApi.init(mainViewModel.authToken) }
            vibeInitDone.value = true
        }
    }

    fun navigateAfterLogin(session: com.example.yugm.model.Session) {
        mainViewModel.updateSession(
            token = session.token,
            userId = session.user.id,
            name = session.user.name,
            username = session.user.username,
            balance = session.user.walletBalance,
        )
        val dest = if ((session.user.name == "Yugm User") || session.user.name.isBlank()) {
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
        authNavGraph(navController, mainViewModel, onGoogleSignIn, ::navigateAfterLogin)
        discoverNavGraph(navController, mainViewModel)
        roomNavGraph(navController, mainViewModel)
        profileNavGraph(navController, mainViewModel)
        socialNavGraph(navController, mainViewModel)
        walletNavGraph(navController, mainViewModel)
        settingsNavGraph(navController, mainViewModel)

        composable(Screen.Missions.route) {
            MissionsScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onBattlePass = { navController.navigate(Screen.BattlePass.route) }
            )
        }

        composable(Screen.BattlePass.route) {
            BattlePassScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.GiftCatalog.route) {
            GiftCatalogScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Inventory.route) {
            InventoryScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

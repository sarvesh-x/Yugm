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

fun NavGraphBuilder.settingsNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
) {
    composable(Screen.TrustVerificationIntro.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        TrustVerificationIntroScreen(
            onBack = { navController.popBackStack() },
            onStart = {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.startTrustVerification(mainViewModel.authToken) }
                        .onSuccess { navController.navigate(Screen.VerificationConsent.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not start verification", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.VerificationConsent.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        VerificationConsentScreen(
            onBack = { navController.popBackStack() },
            onAccept = {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.acceptTrustVerificationConsent(mainViewModel.authToken) }
                        .onSuccess { navController.navigate(Screen.FaceVerification.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not save consent", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.FaceVerification.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        FaceVerificationScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onSubmit = { mediaUrl ->
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.submitTrustFace(mainViewModel.authToken, selfieImageUrl = mediaUrl) }
                        .onSuccess { navController.navigate(Screen.VoiceVerification.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Face submission failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.VoiceVerification.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var prompt by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("I am completing Yugm Trust Verification to show people I am real.") }
        LaunchedEffect(mainViewModel.authToken) {
            runCatching { com.example.yugm.api.YugmApi.trustVoicePrompt(mainViewModel.authToken) }
                .onSuccess { if (it.isNotBlank()) prompt = it }
        }
        VoiceVerificationScreen(
            token = mainViewModel.authToken,
            promptText = prompt,
            onBack = { navController.popBackStack() },
            onSubmit = { audioUrl ->
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.submitTrustVoice(mainViewModel.authToken, audioUrl, prompt) }
                        .onSuccess { navController.navigate(Screen.TrustVerificationStatus.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Voice submission failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.TrustVerificationStatus.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.model.TrustVerificationStatus()) }
        LaunchedEffect(mainViewModel.authToken) {
            runCatching { com.example.yugm.api.YugmApi.trustVerificationStatus(mainViewModel.authToken) }
                .onSuccess { status = it }
        }
        TrustVerificationStatusScreen(
            status = status,
            onBack = { navController.popBackStack() },
            onSubmitReview = {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.submitTrustReview(mainViewModel.authToken) }
                        .onSuccess {
                            status = it
                            android.widget.Toast.makeText(context, "Submitted for review", android.widget.Toast.LENGTH_SHORT).show()
                        }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Review submission failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onRetry = { navController.navigate(Screen.FaceVerification.route) }
        )
    }

    composable(Screen.Safety.route) {
        SafetyScreen(
            token = mainViewModel.authToken,
            onNavigateToBlocked = { navController.navigate(Screen.BlockedUsers.route) },
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.BlockedUsers.route) {
        BlockedUsersScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Settings.route) {
        SettingsScreen(
            token = mainViewModel.authToken,
            userName = mainViewModel.userName,
            username = mainViewModel.username,
            onLogout = {
                mainViewModel.logout()
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            },
            onBack = { navController.popBackStack() },
            onNavigateToSafety = { navController.navigate(Screen.Safety.route) },
            onNavigateToSupport = { navController.navigate(Screen.Support.route) },
            onNavigateToProfileSetup = { navController.navigate(Screen.ProfileSetup.route) },
            onNavigateToGames = { navController.navigate(Screen.Games.route) },
            onNavigateToClans = { navController.navigate(Screen.ClanList.route) },
            onNavigateToTrustVerification = { navController.navigate(Screen.TrustVerificationIntro.route) }
        )
    }

    composable(Screen.Support.route) {
        SupportScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onTicketClick = { ticketId -> navController.navigate(Screen.TicketDetail.createRoute(ticketId)) }
        )
    }

    composable(
        route = Screen.TicketDetail.route,
        arguments = listOf(navArgument("ticketId") { type = NavType.StringType })
    ) { backStackEntry ->
        val ticketId = backStackEntry.arguments?.getString("ticketId") ?: ""
        TicketDetailScreen(
            token = mainViewModel.authToken,
            ticketId = ticketId,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.ClanList.route) {
        ClanListScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onCreateClan = { navController.navigate(Screen.ClanCreate.route) },
            onClanClick = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
            onMyClanClick = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) }
        )
    }

    composable(Screen.ClanCreate.route) {
        ClanCreateScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() },
            onClanCreated = { clanId ->
                navController.navigate(Screen.ClanDetail.createRoute(clanId)) {
                    popUpTo(Screen.ClanList.route)
                }
            }
        )
    }

    composable(Screen.ClanDetail.route) { backStackEntry ->
        val clanId = backStackEntry.arguments?.getString("clanId") ?: return@composable
        ClanDetailScreen(
            token = mainViewModel.authToken,
            clanId = clanId,
            currentUserId = mainViewModel.currentUserId,
            onBack = { navController.popBackStack() },
            onChat = { id ->
                navController.navigate(Screen.ClanChat.createRoute(id))
            },
            onMemberClick = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) }
        )
    }

    composable(Screen.ClanChat.route, arguments = listOf(
        navArgument("clanId") { type = NavType.StringType },
        navArgument("clanName") { type = NavType.StringType; defaultValue = "" }
    )) { backStackEntry ->
        val clanId = backStackEntry.arguments?.getString("clanId") ?: return@composable
        val clanName = backStackEntry.arguments?.getString("clanName") ?: ""
        ClanChatScreen(
            token = mainViewModel.authToken,
            clanId = clanId,
            currentUserId = mainViewModel.currentUserId,
            clanName = clanName,
            onBack = { navController.popBackStack() }
        )
    }
}

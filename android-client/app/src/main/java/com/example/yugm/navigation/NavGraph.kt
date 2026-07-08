package com.example.yugm.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.yugm.model.DirectMessage
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.AuthViewModel
import com.example.yugm.ui.viewmodel.MainViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    onGoogleSignIn: () -> Unit,
    onPhoneSignIn: () -> Unit
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
                balance = session.user.walletBalance
            )
            navController.navigate(Screen.Discover.route) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    val startDestination = if (mainViewModel.authToken.isEmpty()) {
        Screen.Onboarding.route
    } else {
        Screen.Discover.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Onboarding.route) {
            OnboardingScreen(onStart = {
                navController.navigate(Screen.Login.route)
            })
        }
        composable(Screen.Login.route) {
            LoginScreen(
                onGoogleSignIn = onGoogleSignIn,
                onPhoneSignIn = onPhoneSignIn,
                onOtpSignIn = {
                    // navController.navigate(Screen.Otp.createRoute("vibe_user"))
                }
            )
        }
        composable(Screen.Discover.route) {
            DiscoverScreen(
                onOpenRoom = { room ->
                    navController.navigate(Screen.Chat.createRoute(room.id))
                },
                onSearch = {
                    navController.navigate(Screen.Search.route)
                }
            )
        }
        composable(Screen.Chat.route) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: return@composable
            val chatViewModel: com.example.yugm.ui.viewmodel.ChatViewModel = hiltViewModel()
            
            androidx.compose.runtime.LaunchedEffect(roomId) {
                chatViewModel.connect(mainViewModel.authToken, roomId)
            }
            
            val messages = chatViewModel.messages.map { 
                DirectMessage(message = it.text, senderId = if (it.author == mainViewModel.userName) mainViewModel.currentUserId else "other")
            }

            ChatScreen(
                partner = null,
                currentUserId = mainViewModel.currentUserId,
                messages = messages,
                relationship = null,
                gifts = emptyList(),
                balance = mainViewModel.balance,
                onBack = { navController.popBackStack() },
                onSend = { text: String -> chatViewModel.sendMessage(roomId, text) }
            )
        }
    }
}

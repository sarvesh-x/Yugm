package com.example.yugm.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.AuthViewModel
import com.example.yugm.ui.viewmodel.MainViewModel
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch

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
            // Redirect to setup profile or Discover contextually
            val destination = if (session.user.name == "Yugm User" || session.user.name.isBlank()) {
                Screen.ProfileSetup.route
            } else {
                Screen.Discover.route
            }
            navController.navigate(destination) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {
        // Splash Screen
        composable(Screen.Splash.route) {
            SplashScreen(onTimeout = {
                val start = if (mainViewModel.authToken.isEmpty()) {
                    Screen.Onboarding.route
                } else {
                    Screen.Discover.route
                }
                navController.navigate(start) {
                    popUpTo(Screen.Splash.route) { inclusive = true }
                }
            })
        }

        // Onboarding Screen
        composable(Screen.Onboarding.route) {
            OnboardingScreen(
                onStart = { navController.navigate(Screen.Login.route) }
            )
        }

        // Login Screen
        composable(Screen.Login.route) {
            LoginScreen(
                onGoogleSignIn = onGoogleSignIn,
                onPhoneSignIn = onPhoneSignIn,
                onOtpSignIn = {
                    navController.navigate(Screen.PhoneLogin.route)
                }
            )
        }

        // Phone Login (Request OTP screen)
        composable(Screen.PhoneLogin.route) {
            var phoneNumber by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            PhoneAuthScreen(
                phoneNumber = phoneNumber,
                onPhoneChange = { phoneNumber = it },
                onSendOtp = {
                    // Send OTP via Dev bypass
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.requestOtp(phoneNumber)
                        }.onSuccess { devOtp ->
                            navController.navigate(
                                Screen.OtpVerify.createRoute(phoneNumber, devOtp ?: "123456")
                            )
                        }.onFailure {
                            // Handled via toast
                        }
                    }
                },
                otp = "",
                onOtpChange = {},
                onVerify = {},
                verificationId = "",
                onBack = { navController.popBackStack() },
                toast = {}
            )
        }

        // OTP Verify screen
        composable(
            route = Screen.OtpVerify.route,
            arguments = listOf(
                navArgument("username") { type = NavType.StringType },
                navArgument("devOtp") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username") ?: ""
            val devOtp = backStackEntry.arguments?.getString("devOtp") ?: ""
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            
            OtpScreen(
                identifier = username,
                devOtp = devOtp,
                onVerified = { otp ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.verifyOtp(username, otp)
                        }.onSuccess { session ->
                            mainViewModel.updateSession(
                                token = session.token,
                                userId = session.user.id,
                                name = session.user.name,
                                username = session.user.username,
                                balance = session.user.walletBalance
                            )
                            val dest = if (session.user.name == "Yugm User" || session.user.name.isBlank()) {
                                Screen.ProfileSetup.route
                            } else {
                                Screen.Discover.route
                            }
                            navController.navigate(dest) {
                                popUpTo(Screen.Login.route) { inclusive = true }
                            }
                        }
                    }
                }
            )
        }

        // Profile Setup Flow
        composable(Screen.ProfileSetup.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
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

        // Discover Home
        composable(Screen.Discover.route) {
            DiscoverScreen(
                onOpenRoom = { room ->
                    val route = if (room.type == com.example.yugm.model.RoomType.Voice) {
                        Screen.VoiceRoom.createRoute(room.id)
                    } else {
                        Screen.VideoRoom.createRoute(room.id)
                    }
                    navController.navigate(route)
                },
                onSearch = {
                    navController.navigate(Screen.Search.route)
                }
            )
        }

        // Dating Discovery Swipe
        composable(Screen.DatingDiscovery.route) {
            DatingDiscoveryScreen(
                token = mainViewModel.authToken,
                onNavigateToChat = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                },
                onNavigateToProfile = { userId ->
                    navController.navigate(Screen.ProfileDetail.createRoute(userId))
                }
            )
        }

        // Profile Detail screen
        composable(
            route = Screen.ProfileDetail.route,
            arguments = listOf(navArgument("userId") { type = NavType.StringType })
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: ""
            ProfileDetailScreen(
                token = mainViewModel.authToken,
                userId = userId,
                onBack = { navController.popBackStack() },
                onMessage = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                },
                onInviteToRoom = {
                    // Send room invitation
                }
            )
        }

        // Matches / Threads home screen
        composable(Screen.ChatList.route) {
            ChatListScreen(
                token = mainViewModel.authToken,
                currentUserId = mainViewModel.currentUserId,
                onOpenChat = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                }
            )
        }

        // Private Chat Screen
        composable(
            route = Screen.Chat.route,
            arguments = listOf(navArgument("conversationId") { type = NavType.StringType })
        ) { backStackEntry ->
            val partnerId = backStackEntry.arguments?.getString("conversationId") ?: ""
            val chatViewModel: com.example.yugm.ui.viewmodel.ChatViewModel = hiltViewModel()
            
            LaunchedEffect(partnerId) {
                chatViewModel.connect(mainViewModel.authToken, partnerId)
            }
            
            val messages = chatViewModel.messages.map { 
                com.example.yugm.model.DirectMessage(
                    message = it.text, 
                    senderId = if (it.author == mainViewModel.userName) mainViewModel.currentUserId else partnerId
                )
            }

            ChatScreen(
                partner = null,
                currentUserId = mainViewModel.currentUserId,
                messages = messages,
                relationship = null,
                gifts = emptyList(),
                balance = mainViewModel.balance,
                onBack = { navController.popBackStack() },
                onSend = { text -> chatViewModel.sendMessage(partnerId, text) }
            )
        }

        // Create Room screen
        composable(Screen.CreateRoom.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            CreateRoomScreen(
                host = com.example.yugm.model.Host(
                    id = mainViewModel.currentUserId,
                    name = mainViewModel.userName,
                    username = mainViewModel.username
                ),
                onBack = { navController.popBackStack() },
                onCreate = { room ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.createRoom(mainViewModel.authToken, room)
                        }.onSuccess { createdRoom ->
                            val route = if (createdRoom.type == com.example.yugm.model.RoomType.Voice) {
                                Screen.VoiceRoom.createRoute(createdRoom.id)
                            } else {
                                Screen.VideoRoom.createRoute(createdRoom.id)
                            }
                            navController.navigate(route) {
                                popUpTo(Screen.CreateRoom.route) { inclusive = true }
                            }
                        }
                    }
                }
            )
        }

        // Active Voice Room
        composable(
            route = Screen.VoiceRoom.route,
            arguments = listOf(navArgument("roomId") { type = NavType.StringType })
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
            var roomState by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.Room?>(null) }
            val context = androidx.compose.ui.platform.LocalContext.current
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
            val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }

            LaunchedEffect(roomId) {
                runCatching {
                    com.example.yugm.api.YugmApi.rooms(com.example.yugm.model.RoomType.Voice)
                }.onSuccess { list ->
                    roomState = list.find { it.id == roomId }
                }
            }

            roomState?.let { room ->
                ActiveVoiceRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = mainViewModel.balance,
                    isHost = room.host?.id == mainViewModel.currentUserId,
                    onBack = { navController.popBackStack() },
                    onSendMessage = { text ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendMessage(roomId, text, mainViewModel.authToken)
                            }
                        }
                    },
                    onGift = { gift ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendGift(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    gift = gift,
                                    receiverId = room.host?.id ?: ""
                                )
                                val balanceRes = com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)
                                mainViewModel.updateBalance(balanceRes)
                                gifts.add(gift)
                            }
                        }
                    },
                    onToast = { msg ->
                        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                    },
                    onJoin = {
                        scope.launch {
                            runCatching {
                                val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                                com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                                com.example.yugm.api.YugmSocket.connect(mainViewModel.authToken, roomId) { author, text ->
                                    chat.add(com.example.yugm.model.ChatMessage(author, text))
                                }
                            }
                        }
                    }
                )
            }
        }

        // Active Video Room
        composable(
            route = Screen.VideoRoom.route,
            arguments = listOf(navArgument("roomId") { type = NavType.StringType })
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
            var roomState by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.Room?>(null) }
            val context = androidx.compose.ui.platform.LocalContext.current
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
            val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }

            LaunchedEffect(roomId) {
                runCatching {
                    com.example.yugm.api.YugmApi.rooms(com.example.yugm.model.RoomType.Video)
                }.onSuccess { list ->
                    roomState = list.find { it.id == roomId }
                }
            }

            roomState?.let { room ->
                ActiveVideoRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = mainViewModel.balance,
                    isHost = room.host?.id == mainViewModel.currentUserId,
                    onBack = { navController.popBackStack() },
                    onSendMessage = { text ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendMessage(roomId, text, mainViewModel.authToken)
                            }
                        }
                    },
                    onGift = { gift ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendGift(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    gift = gift,
                                    receiverId = room.host?.id ?: ""
                                )
                                val balanceRes = com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)
                                mainViewModel.updateBalance(balanceRes)
                                gifts.add(gift)
                            }
                        }
                    },
                    onToast = { msg ->
                        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                    },
                    onJoin = {
                        scope.launch {
                            runCatching {
                                val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                                com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                                com.example.yugm.api.YugmSocket.connect(mainViewModel.authToken, roomId) { author, text ->
                                    chat.add(com.example.yugm.model.ChatMessage(author, text))
                                }
                            }
                        }
                    }
                )
            }
        }

        // Wallet
        composable(Screen.Wallet.route) {
            WalletScreen(
                balance = mainViewModel.balance,
                transactions = emptyList()
            )
        }

        // Cosmetics Store
        composable(Screen.Cosmetics.route) {
            CosmeticsStoreScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }

        // VIP subscription
        composable(Screen.Vip.route) {
            VipPlansScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }

        // Safety Screen
        composable(Screen.Safety.route) {
            SafetyScreen(
                onNavigateToBlocked = { navController.navigate(Screen.BlockedUsers.route) },
                onBack = { navController.popBackStack() }
            )
        }

        // Blocked Users management
        composable(Screen.BlockedUsers.route) {
            BlockedUsersScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() }
            )
        }

        // Settings Screen
        composable(Screen.Settings.route) {
            SettingsScreen(
                onLogout = {
                    mainViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
                onNavigateToSafety = { navController.navigate(Screen.Safety.route) }
            )
        }
    }
}

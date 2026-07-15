package com.example.yugm.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.AuthViewModel
import com.example.yugm.ui.viewmodel.MainViewModel
import com.example.yugm.navigation.NotificationTarget
import com.example.yugm.navigation.notificationTarget
import com.example.yugm.BuildConfig
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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
                            val safeOtp = if (BuildConfig.DEBUG) devOtp else null
                            navController.navigate(
                                Screen.OtpVerify.createRoute(phoneNumber, safeOtp)
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
                navArgument("devOtp") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username") ?: ""
            val devOtp = backStackEntry.arguments?.getString("devOtp") ?: ""
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            
            OtpScreen(
                identifier = username,
                devOtp = if (BuildConfig.DEBUG) devOtp.takeIf { it.isNotBlank() } else null,
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
                token = mainViewModel.authToken,
                onOpenRoom = { room ->
                    navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
                },
                onOpenProfile = { userId ->
                    navController.navigate(Screen.ProfileDetail.createRoute(userId))
                },
                onCreateRoom = {
                    navController.navigate(Screen.CreateRoom.route)
                },
                onNotifications = {
                    navController.navigate(Screen.Notifications.route)
                },
                onGrowth = {
                    navController.navigate(Screen.Growth.route)
                },
                onSearch = {
                    navController.navigate(Screen.Search.route)
                },
                onGames = {
                    navController.navigate(Screen.Games.route)
                },
                onDating = {
                    navController.navigate(Screen.DatingDiscovery.route)
                },
                onChat = {
                    navController.navigate(Screen.ChatList.route)
                },
                onWallet = {
                    navController.navigate(Screen.Wallet.route)
                },
                onSelfProfile = {
                    if (mainViewModel.currentUserId.isNotBlank()) {
                        navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                    } else {
                        navController.navigate(Screen.ProfileSetup.route)
                    }
                },
                onVoiceRooms = {
                    navController.navigate(Screen.VoiceRooms.route)
                }
            )
        }

        composable(Screen.VoiceRooms.route) {
            VoiceRoomsScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) },
                onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                onSearch = { navController.navigate(Screen.Search.route) },
                onNotifications = { navController.navigate(Screen.Notifications.route) },
                onDiscover = { navController.navigate(Screen.Discover.route) },
                onDating = { navController.navigate(Screen.DatingDiscovery.route) },
                onChat = { navController.navigate(Screen.ChatList.route) },
                onWallet = { navController.navigate(Screen.Wallet.route) },
                onProfile = {
                    if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                    else navController.navigate(Screen.ProfileSetup.route)
                }
            )
        }

        composable(Screen.Search.route) {
            SearchScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenRoom = { room ->
                    navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
                },
                onOpenProfile = { userId ->
                    navController.navigate(Screen.ProfileDetail.createRoute(userId))
                }
            )
        }

        composable(Screen.Notifications.route) {
            NotificationsScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenTarget = { item ->
                    when (val target = notificationTarget(item)) {
                        is NotificationTarget.Room -> navController.navigate(Screen.RoomLobby.createRoute(target.roomId))
                        is NotificationTarget.Chat -> navController.navigate(Screen.Chat.createRoute(target.partnerId))
                        is NotificationTarget.Profile -> navController.navigate(Screen.ProfileDetail.createRoute(target.userId))
                        NotificationTarget.Wallet -> navController.navigate(Screen.Wallet.route)
                        NotificationTarget.Safety -> navController.navigate(Screen.Safety.route)
                        NotificationTarget.Growth -> navController.navigate(Screen.Growth.route)
                        NotificationTarget.Home -> navController.navigate(Screen.Discover.route)
                    }
                }
            )
        }

        composable(Screen.Growth.route) {
            GrowthScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                onPayoutVerification = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
                onWithdraw = { navController.navigate(Screen.WithdrawalEligibility.route) },
                onOpenRoom = { room ->
                    navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
                }
            )
        }

        composable(Screen.Games.route) {
            GamesScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onOpenChat = { userId -> navController.navigate(Screen.Chat.createRoute(userId)) }
            )
        }

        composable(Screen.TrustVerificationIntro.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
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
            val scope = androidx.compose.runtime.rememberCoroutineScope()
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
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val context = androidx.compose.ui.platform.LocalContext.current
            FaceVerificationScreen(
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
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val context = androidx.compose.ui.platform.LocalContext.current
            var prompt by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("I am completing Yugm Trust Verification to show people I am real.") }
            LaunchedEffect(mainViewModel.authToken) {
                runCatching { com.example.yugm.api.YugmApi.trustVoicePrompt(mainViewModel.authToken) }
                    .onSuccess { if (it.isNotBlank()) prompt = it }
            }
            VoiceVerificationScreen(
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
            val scope = androidx.compose.runtime.rememberCoroutineScope()
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

        composable(Screen.CreatorPayoutKycIntro.route) {
            CreatorPayoutKycIntroScreen(
                onBack = { navController.popBackStack() },
                onStart = { navController.navigate(Screen.CreatorPayoutKycForm.route) }
            )
        }

        composable(Screen.CreatorPayoutKycForm.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val context = androidx.compose.ui.platform.LocalContext.current
            CreatorPayoutKycFormScreen(
                onBack = { navController.popBackStack() },
                onSubmit = { legalName, pan, upi ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.submitCreatorPayoutKyc(mainViewModel.authToken, legalName, pan, upiId = upi) }
                            .onSuccess { navController.navigate(Screen.CreatorPayoutKycStatus.route) }
                            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Payout verification failed", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            )
        }

        composable(Screen.CreatorPayoutKycStatus.route) {
            var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.model.CreatorPayoutKycStatus()) }
            LaunchedEffect(mainViewModel.authToken) {
                runCatching { com.example.yugm.api.YugmApi.creatorPayoutKycStatus(mainViewModel.authToken) }
                    .onSuccess { status = it }
            }
            CreatorPayoutKycStatusScreen(status = status, onBack = { navController.popBackStack() })
        }

        composable(Screen.WithdrawalEligibility.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val context = androidx.compose.ui.platform.LocalContext.current
            var eligibility by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.model.WithdrawalEligibility()) }
            fun refreshEligibility() {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.withdrawalEligibility(mainViewModel.authToken) }
                        .onSuccess { eligibility = it }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load withdrawals", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
            LaunchedEffect(mainViewModel.authToken) { refreshEligibility() }
            WithdrawalEligibilityScreen(
                balance = eligibility.balance,
                payoutKyc = eligibility.payoutKyc,
                requirements = eligibility.requirements,
                coinToInrRate = eligibility.coinToInrRate,
                onBack = { navController.popBackStack() },
                onOpenKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
                onWithdraw = { amount ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.requestWithdrawal(mainViewModel.authToken, amount) }
                            .onSuccess {
                                android.widget.Toast.makeText(context, it.message.ifBlank { "Withdrawal requested" }, android.widget.Toast.LENGTH_SHORT).show()
                                refreshEligibility()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Withdrawal failed", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                }
            )
        }

        composable(
            route = Screen.RoomLobby.route,
            arguments = listOf(
                navArgument("roomId") { type = NavType.StringType },
                navArgument("roomType") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
            val fallbackType = if (backStackEntry.arguments?.getString("roomType") == "VIDEO") {
                com.example.yugm.model.RoomType.Video
            } else {
                com.example.yugm.model.RoomType.Voice
            }
            RoomLobbyScreen(
                token = mainViewModel.authToken,
                roomId = roomId,
                fallbackType = fallbackType,
                currentUserId = mainViewModel.currentUserId,
                onBack = { navController.popBackStack() },
                onJoin = { type ->
                    val route = if (type == com.example.yugm.model.RoomType.Video) {
                        Screen.VideoRoom.createRoute(roomId)
                    } else {
                        Screen.VoiceRoom.createRoute(roomId)
                    }
                    navController.navigate(route)
                },
                onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
                onEdit = { id -> navController.navigate(Screen.EditRoom.createRoute(id)) }
            )
        }

        // Edit Room screen
        composable(
            route = Screen.EditRoom.route,
            arguments = listOf(navArgument("roomId") { type = NavType.StringType })
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
            val context = androidx.compose.ui.platform.LocalContext.current
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }

            LaunchedEffect(roomId) {
                runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                    .onSuccess { roomDetail = it }
            }

            roomDetail?.let { detail ->
                EditRoomScreen(
                    token = mainViewModel.authToken,
                    room = detail.room,
                    host = detail.room.host ?: com.example.yugm.model.Host(),
                    onBack = { navController.popBackStack() },
                    onUpdate = { updatedRoom ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.RoomApi.updateRoom(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    room = updatedRoom
                                )
                            }.onSuccess {
                                android.widget.Toast.makeText(context, "Room updated", android.widget.Toast.LENGTH_SHORT).show()
                                navController.popBackStack()
                            }.onFailure {
                                android.widget.Toast.makeText(context, it.message ?: "Update failed", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                )
            } ?: run {
                com.example.yugm.ui.components.LoadingState("Loading room details...")
            }
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
                },
                onMatches = { navController.navigate(Screen.ChatList.route) },
                onDiscover = { navController.navigate(Screen.Discover.route) },
                onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                onLive = { navController.navigate(Screen.VoiceRooms.route) },
                onWallet = { navController.navigate(Screen.Wallet.route) },
                onSelfProfile = {
                    if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                    else navController.navigate(Screen.ProfileSetup.route)
                }
            )
        }

        // Profile Detail screen
        composable(
            route = Screen.ProfileDetail.route,
            arguments = listOf(navArgument("userId") { type = NavType.StringType })
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: ""
            val profileScope = androidx.compose.runtime.rememberCoroutineScope()
            val profileContext = androidx.compose.ui.platform.LocalContext.current
            ProfileDetailScreen(
                token = mainViewModel.authToken,
                userId = userId,
                onBack = { navController.popBackStack() },
                onMessage = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                },
                onInviteToRoom = { inviteeId ->
                    profileScope.launch {
                        val ownLiveRoom = runCatching { com.example.yugm.api.YugmApi.rooms() }.getOrDefault(emptyList())
                            .firstOrNull { it.status.equals("LIVE", true) && it.host?.id == mainViewModel.currentUserId }
                        if (ownLiveRoom == null) {
                            android.widget.Toast.makeText(profileContext, "Start a room first, then invite ${userId.take(6)}", android.widget.Toast.LENGTH_SHORT).show()
                            navController.navigate(Screen.CreateRoom.route)
                        } else {
                            runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, ownLiveRoom.id, inviteeId) }
                                .onSuccess { android.widget.Toast.makeText(profileContext, "Room invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                                .onFailure { android.widget.Toast.makeText(profileContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    }
                },
                onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) }
            )
        }

        // Matches / Threads home screen
        composable(Screen.ChatList.route) {
            ChatListScreen(
                token = mainViewModel.authToken,
                currentUserId = mainViewModel.currentUserId,
                onOpenChat = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                },
                onDiscover = { navController.navigate(Screen.Discover.route) },
                onDating = { navController.navigate(Screen.DatingDiscovery.route) },
                onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                onWallet = { navController.navigate(Screen.Wallet.route) },
                onProfile = {
                    if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                    else navController.navigate(Screen.ProfileSetup.route)
                }
            )
        }

        // Matches Screen
        composable(Screen.Matches.route) {
            MatchesScreen(
                token = mainViewModel.authToken,
                onOpenChat = { partnerId ->
                    navController.navigate(Screen.Chat.createRoute(partnerId))
                },
                onDiscover = { navController.navigate(Screen.Discover.route) },
                onDating = { navController.navigate(Screen.DatingDiscovery.route) },
                onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
                onWallet = { navController.navigate(Screen.Wallet.route) },
                onProfile = {
                    if (mainViewModel.currentUserId.isNotBlank()) navController.navigate(Screen.ProfileDetail.createRoute(mainViewModel.currentUserId))
                    else navController.navigate(Screen.ProfileSetup.route)
                },
                onBack = { navController.popBackStack() }
            )
        }

        // Private Chat Screen
        composable(
            route = Screen.Chat.route,
            arguments = listOf(navArgument("partnerId") { type = NavType.StringType })
        ) { backStackEntry ->
            val partnerId = backStackEntry.arguments?.getString("partnerId") ?: ""
            val chatViewModel: com.example.yugm.ui.viewmodel.ChatViewModel = hiltViewModel()
            val directGifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
            val chatContext = androidx.compose.ui.platform.LocalContext.current
            val chatScope = androidx.compose.runtime.rememberCoroutineScope()
            
            LaunchedEffect(partnerId, mainViewModel.authToken, mainViewModel.currentUserId) {
                chatViewModel.connect(
                    token = mainViewModel.authToken,
                    userId = mainViewModel.currentUserId,
                    partnerId = partnerId
                )
                runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                    .onSuccess { directGifts.apply { clear(); addAll(it) } }
            }

            ChatScreen(
                partner = chatViewModel.partner,
                currentUserId = mainViewModel.currentUserId,
                messages = chatViewModel.messages,
                relationship = chatViewModel.relationship,
                gifts = directGifts,
                balance = mainViewModel.balance,
                loading = chatViewModel.isLoading,
                isPartnerTyping = chatViewModel.isPartnerTyping,
                error = chatViewModel.error,
                onBack = { navController.popBackStack() },
                onRetry = chatViewModel::refresh,
                onSend = chatViewModel::sendMessage,
                onTyping = { typing -> chatViewModel.sendTypingStatus(typing) },
                onGift = { gift ->
                    chatScope.launch {
                        runCatching { com.example.yugm.api.YugmApi.sendDirectGift(mainViewModel.authToken, gift.id, partnerId) }
                            .onSuccess {
                                mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                                chatViewModel.refresh()
                            }
                            .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onReactMessage = { message ->
                    chatScope.launch {
                        runCatching { com.example.yugm.api.YugmApi.reactToDirectMessage(mainViewModel.authToken, partnerId, message.id, "heart") }
                            .onSuccess { chatViewModel.refresh() }
                            .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAudioCall = {
                    chatScope.launch {
                        runCatching { com.example.yugm.api.YugmApi.startPrivateCall(mainViewModel.authToken, partnerId, com.example.yugm.model.RoomType.Voice) }
                            .onSuccess { room -> navController.navigate(Screen.VoiceRoom.createRoute(room.id)) }
                            .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onVideoCall = {
                    chatScope.launch {
                        runCatching { com.example.yugm.api.YugmApi.startPrivateCall(mainViewModel.authToken, partnerId, com.example.yugm.model.RoomType.Video) }
                            .onSuccess { room -> navController.navigate(Screen.VideoRoom.createRoute(room.id)) }
                            .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAttachmentSelected = { bytes, mimeType, fileName ->
                    chatScope.launch {
                        runCatching {
                            val (url, type) = com.example.yugm.api.YugmApi.uploadMessageMedia(mainViewModel.authToken, bytes, mimeType, fileName)
                            com.example.yugm.api.YugmApi.sendDirectMediaMessage(mainViewModel.authToken, partnerId, url, type)
                        }.onSuccess { chatViewModel.refresh() }
                            .onFailure { android.widget.Toast.makeText(chatContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onReport = { chatScope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, "", partnerId, "Inappropriate private conversation") } } },
                onBlock = { chatScope.launch { runCatching { com.example.yugm.api.YugmApi.blockUser(partnerId, mainViewModel.authToken) }.onSuccess { navController.popBackStack() } } }
            )
        }

        // Create Room screen
        composable(Screen.CreateRoom.route) {
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            CreateRoomScreen(
                token = mainViewModel.authToken,
                host = com.example.yugm.model.Host(
                    id = mainViewModel.currentUserId,
                    name = mainViewModel.userName,
                    username = mainViewModel.username
                ),
                onBack = { navController.popBackStack() },
                onCreate = { room, scheduleLater, visibility, allowMicRequests, coverImage ->
                    scope.launch {
                        runCatching {
                            val scheduledFor = if (scheduleLater) {
                                SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                    timeZone = TimeZone.getTimeZone("UTC")
                                }.format(Date(System.currentTimeMillis() + 60 * 60 * 1000))
                            } else null
                            com.example.yugm.api.YugmApi.createRoom(
                                token = mainViewModel.authToken,
                                room = room,
                                visibility = visibility,
                                allowAudienceMicRequests = allowMicRequests,
                                scheduledFor = scheduledFor,
                                coverImage = coverImage
                            )
                        }.onSuccess { createdRoom ->
                            if (scheduleLater) {
                                navController.navigate(Screen.Growth.route) {
                                    popUpTo(Screen.CreateRoom.route) { inclusive = true }
                                }
                                return@onSuccess
                            }
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
            var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }
            var polls by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomPoll>>(emptyList()) }
            var missions by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomMission>>(emptyList()) }
            var activity by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomActivityItem>>(emptyList()) }
            var pkBattle by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkBattle?>(null) }
            var pkInviteId by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
            var pkOpponents by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkOpponent>>(emptyList()) }
            var pkLeaderboard by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkLeaderboardEntry>>(emptyList()) }
            var pkLiveEffect by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkLiveEffect?>(null) }
            val context = androidx.compose.ui.platform.LocalContext.current
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
            val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
            var inviteCandidates by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.Host>>(emptyList()) }

            fun refreshVoiceRoom() {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                        .onSuccess { roomDetail = it }
                    runCatching { com.example.yugm.api.YugmApi.roomPolls(roomId) }
                        .onSuccess { polls = it }
                    runCatching { com.example.yugm.api.YugmApi.roomMissions(mainViewModel.authToken, roomId) }
                        .onSuccess { missions = it }
                    runCatching { com.example.yugm.api.YugmApi.roomActivity(roomId) }
                        .onSuccess { activity = it }
                    runCatching { com.example.yugm.api.YugmApi.roomMessages(roomId, mainViewModel.authToken) }
                        .onSuccess {
                            chat.clear()
                            chat.addAll(it)
                        }
                    runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                        .onSuccess {
                            gifts.clear()
                            gifts.addAll(it)
                        }
                    if (mainViewModel.currentUserId.isNotBlank()) {
                        runCatching { com.example.yugm.api.YugmApi.getFollowing(mainViewModel.currentUserId, mainViewModel.authToken) }
                            .onSuccess { inviteCandidates = it }
                    }
                    runCatching { com.example.yugm.api.YugmApi.activePkWithInvite(mainViewModel.authToken, roomId) }
                        .onSuccess { result ->
                            val battle = result.first
                            pkBattle = battle
                            pkInviteId = result.second?.id
                            if (battle != null) {
                                runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                    .onSuccess { pkLeaderboard = it }
                            } else {
                                pkLeaderboard = emptyList()
                            }
                        }
                }
            }

            LaunchedEffect(roomId) { refreshVoiceRoom() }

            roomDetail?.let { detail ->
                val room = detail.room
                ActiveVoiceRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = mainViewModel.balance,
                    isHost = room.host?.id == mainViewModel.currentUserId,
                    participants = detail.participants,
                    inviteCandidates = inviteCandidates,
                    pkBattle = pkBattle,
                    pkInviteId = pkInviteId,
                    pkOpponents = pkOpponents,
                    pkLeaderboard = pkLeaderboard,
                    pkLiveEffect = pkLiveEffect,
                    speakerRequests = detail.speakerRequests,
                    polls = polls,
                    missions = missions,
                    activity = activity,
                    onBack = { navController.popBackStack() },
                    onSendMessage = { text ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendMessage(mainViewModel.authToken, roomId, text)
                                chat.add(com.example.yugm.model.ChatMessage(mainViewModel.userName, text))
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
                            }.onSuccess {
                                runCatching { mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)) }
                                gifts.add(gift)
                            }
                        }
                    },
                    onToast = { msg ->
                        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                    },
                    onRequestSpeaker = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.requestSpeaker(mainViewModel.authToken, roomId) }
                                .onSuccess {
                                    android.widget.Toast.makeText(context, "Mic request sent", android.widget.Toast.LENGTH_SHORT).show()
                                    refreshVoiceRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onApproveSpeaker = { userId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.approveSpeaker(mainViewModel.authToken, roomId, userId) }
                                .onSuccess { refreshVoiceRoom() }
                        }
                    },
                    onRejectSpeaker = { userId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.rejectSpeaker(mainViewModel.authToken, roomId, userId) }
                                .onSuccess { refreshVoiceRoom() }
                        }
                    },
                    onCreatePoll = {
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.createPoll(
                                    mainViewModel.authToken,
                                    roomId,
                                    "What should we do next?",
                                    listOf("Music", "Games", "Q&A", "Chill")
                                )
                            }.onSuccess { refreshVoiceRoom() }
                        }
                    },
                    onCreateCustomPoll = { question, options ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.createPoll(mainViewModel.authToken, roomId, question, options)
                            }.onSuccess { refreshVoiceRoom() }
                        }
                    },
                    onVotePoll = { pollId, optionIndex ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.votePoll(mainViewModel.authToken, roomId, pollId, optionIndex) }
                                .onSuccess { refreshVoiceRoom() }
                        }
                    },
                    onInviteFriend = { userId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, roomId, userId) }
                                .onSuccess { android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onDirectMessage = { receiverId ->
                        scope.launch {
                            val targetId = receiverId ?: room.host?.id
                            runCatching {
                                com.example.yugm.api.YugmApi.roomDirectMessage(
                                    mainViewModel.authToken,
                                    roomId,
                                    "Loved this room. Let's continue after the live.",
                                    receiverId
                                )
                            }.onSuccess {
                                if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onReact = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.reactToRoom(mainViewModel.authToken, roomId, "fire") }
                                .onSuccess {
                                    android.widget.Toast.makeText(context, "Reaction sent", android.widget.Toast.LENGTH_SHORT).show()
                                    refreshVoiceRoom()
                                }
                        }
                    },
                    onLoadPkOpponents = { search ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.availablePkOpponents(mainViewModel.authToken, com.example.yugm.model.PkBattleType.VOICE, search) }
                                .onSuccess { pkOpponents = it }
                        }
                    },
                    onInvitePk = { opponent, mode, duration, title ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.invitePk(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    opponentRoomId = opponent.roomId,
                                    opponentHostId = opponent.hostId,
                                    battleType = com.example.yugm.model.PkBattleType.VOICE,
                                    mode = mode,
                                    durationSeconds = duration,
                                    title = title
                                )
                            }.onSuccess {
                                pkBattle = it.first
                                android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onAutoMatchPk = { mode, duration, title ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.autoMatchPk(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    battleType = com.example.yugm.model.PkBattleType.VOICE,
                                    mode = mode,
                                    durationSeconds = duration,
                                    title = title
                                )
                            }.onSuccess {
                                pkBattle = it.first
                                pkInviteId = it.second?.id
                                android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onSendPkGift = { gift, side ->
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            runCatching { com.example.yugm.api.YugmApi.sendPkGift(mainViewModel.authToken, battleId, gift.id, side) }
                                .onSuccess {
                                    pkBattle = it
                                    mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onSendPkReaction = { reaction, side ->
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            runCatching { com.example.yugm.api.YugmApi.sendPkReaction(mainViewModel.authToken, battleId, side, reaction) }
                                .onSuccess { pkBattle = it }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onAcceptPk = { inviteId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.acceptPk(mainViewModel.authToken, inviteId) }
                                .onSuccess {
                                    pkBattle = it
                                    pkInviteId = null
                                    refreshVoiceRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onRejectPk = { inviteId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.rejectPk(mainViewModel.authToken, inviteId) }
                                .onSuccess {
                                    pkBattle = null
                                    pkInviteId = null
                                    refreshVoiceRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onEndPk = {
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            val battle = pkBattle
                            if (battle?.status == com.example.yugm.model.PkStatus.INVITED || battle?.status == com.example.yugm.model.PkStatus.WAITING) {
                                runCatching { com.example.yugm.api.YugmApi.cancelPk(mainViewModel.authToken, battleId) }
                                    .onSuccess {
                                        pkBattle = null
                                        pkInviteId = null
                                    }
                                    .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                            } else {
                                runCatching { com.example.yugm.api.YugmApi.endPk(mainViewModel.authToken, battleId) }
                                    .onSuccess {
                                        pkBattle = it
                                        pkInviteId = null
                                    }
                                    .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                            }
                        }
                    },
                    onEndRoom = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.endRoom(roomId, mainViewModel.authToken) }
                                .onSuccess { navController.popBackStack() }
                        }
                    },
                    onMuteUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.muteUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVoiceRoom() } }
                    },
                    onRemoveUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.removeUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVoiceRoom() } }
                    },
                    onReportUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, roomId, userId, "Inappropriate behavior") } }
                    },
                    onJoin = {
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.joinRoom(mainViewModel.authToken, roomId)
                                val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                                com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                                com.example.yugm.api.YugmSocket.connect(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    onMessage = { author, text -> chat.add(com.example.yugm.model.ChatMessage(author, text)) },
                                    onPkState = { battle ->
                                        scope.launch {
                                            pkBattle = battle
                                            if (battle.status == com.example.yugm.model.PkStatus.ACTIVE) pkInviteId = null
                                            runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                                .onSuccess { pkLeaderboard = it }
                                        }
                                    },
                                    onPkInvite = { battle, invite ->
                                        scope.launch {
                                            pkBattle = battle
                                            pkInviteId = invite.id
                                            android.widget.Toast.makeText(context, "PK invite received", android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    onPkEffect = { effect ->
                                        scope.launch {
                                            pkLiveEffect = effect
                                            kotlinx.coroutines.delay(1400)
                                            if (pkLiveEffect == effect) pkLiveEffect = null
                                        }
                                    },
                                    onPkRefresh = { refreshVoiceRoom() },
                                    onPkLeadChanged = { leader, leftScore, rightScore ->
                                        scope.launch {
                                            val current = pkBattle ?: return@launch
                                            pkBattle = current.copy(
                                                leader = com.example.yugm.model.PkSideType.valueOf(leader),
                                                left = current.left.copy(score = leftScore),
                                                right = current.right.copy(score = rightScore)
                                            )
                                        }
                                    },
                                    onPkRematchRequested = { previousBattleId ->
                                        scope.launch {
                                            android.widget.Toast.makeText(context, "Opponent wants a rematch!", android.widget.Toast.LENGTH_SHORT).show()
                                            refreshVoiceRoom()
                                        }
                                    }
                                )
                                refreshVoiceRoom()
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
            var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }
            var polls by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomPoll>>(emptyList()) }
            var missions by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomMission>>(emptyList()) }
            var activity by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomActivityItem>>(emptyList()) }
            var pkBattle by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkBattle?>(null) }
            var pkInviteId by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
            var pkOpponents by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkOpponent>>(emptyList()) }
            var pkLeaderboard by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkLeaderboardEntry>>(emptyList()) }
            var pkLiveEffect by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkLiveEffect?>(null) }
            var pkOpponentMedia by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkMediaSession?>(null) }
            val context = androidx.compose.ui.platform.LocalContext.current
            val scope = androidx.compose.runtime.rememberCoroutineScope()
            val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
            val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
            var inviteCandidates by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.Host>>(emptyList()) }

            fun refreshVideoRoom() {
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                        .onSuccess { roomDetail = it }
                    runCatching { com.example.yugm.api.YugmApi.roomPolls(roomId) }
                        .onSuccess { polls = it }
                    runCatching { com.example.yugm.api.YugmApi.roomMissions(mainViewModel.authToken, roomId) }
                        .onSuccess { missions = it }
                    runCatching { com.example.yugm.api.YugmApi.roomActivity(roomId) }
                        .onSuccess { activity = it }
                    runCatching { com.example.yugm.api.YugmApi.roomMessages(roomId, mainViewModel.authToken) }
                        .onSuccess {
                            chat.clear()
                            chat.addAll(it)
                        }
                    runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                        .onSuccess {
                            gifts.clear()
                            gifts.addAll(it)
                        }
                    if (mainViewModel.currentUserId.isNotBlank()) {
                        runCatching { com.example.yugm.api.YugmApi.getFollowing(mainViewModel.currentUserId, mainViewModel.authToken) }
                            .onSuccess { inviteCandidates = it }
                    }
                    runCatching { com.example.yugm.api.YugmApi.activePkWithInvite(mainViewModel.authToken, roomId) }
                        .onSuccess { result ->
                            val battle = result.first
                            pkBattle = battle
                            pkInviteId = result.second?.id
                            if (battle != null) {
                                runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                    .onSuccess { pkLeaderboard = it }
                                if (battle.status == com.example.yugm.model.PkStatus.ACTIVE && battle.battleType == com.example.yugm.model.PkBattleType.VIDEO) {
                                    runCatching { com.example.yugm.api.YugmApi.pkMediaSession(mainViewModel.authToken, battle.id, roomId) }
                                        .onSuccess {
                                            pkOpponentMedia = it
                                            if (it != null) com.example.yugm.api.YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName)
                                        }
                                }
                            } else {
                                pkLeaderboard = emptyList()
                                pkOpponentMedia = null
                            }
                        }
                }
            }

            LaunchedEffect(roomId) { refreshVideoRoom() }

            roomDetail?.let { detail ->
                val room = detail.room
                ActiveVideoRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = mainViewModel.balance,
                    isHost = room.host?.id == mainViewModel.currentUserId,
                    participants = detail.participants,
                    inviteCandidates = inviteCandidates,
                    pkBattle = pkBattle,
                    pkInviteId = pkInviteId,
                    pkOpponents = pkOpponents,
                    pkLeaderboard = pkLeaderboard,
                    pkLiveEffect = pkLiveEffect,
                    pkOpponentMedia = pkOpponentMedia,
                    polls = polls,
                    missions = missions,
                    activity = activity,
                    onBack = { navController.popBackStack() },
                    onSendMessage = { text ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.sendMessage(mainViewModel.authToken, roomId, text)
                                chat.add(com.example.yugm.model.ChatMessage(mainViewModel.userName, text))
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
                            }.onSuccess {
                                runCatching { mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)) }
                                gifts.add(gift)
                            }
                        }
                    },
                    onToast = { msg ->
                        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                    },
                    onRequestSpeaker = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.requestSpeaker(mainViewModel.authToken, roomId) }
                                .onSuccess {
                                    android.widget.Toast.makeText(context, "Speaker request sent", android.widget.Toast.LENGTH_SHORT).show()
                                    refreshVideoRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onCreatePoll = {
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.createPoll(
                                    mainViewModel.authToken,
                                    roomId,
                                    "What should we do next?",
                                    listOf("Music", "Games", "Q&A", "Chill")
                                )
                            }.onSuccess { refreshVideoRoom() }
                        }
                    },
                    onCreateCustomPoll = { question, options ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.createPoll(mainViewModel.authToken, roomId, question, options)
                            }.onSuccess { refreshVideoRoom() }
                        }
                    },
                    onVotePoll = { pollId, optionIndex ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.votePoll(mainViewModel.authToken, roomId, pollId, optionIndex) }
                                .onSuccess { refreshVideoRoom() }
                        }
                    },
                    onInviteFriend = { userId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, roomId, userId) }
                                .onSuccess { android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onDirectMessage = { receiverId ->
                        scope.launch {
                            val targetId = receiverId ?: room.host?.id
                            runCatching {
                                com.example.yugm.api.YugmApi.roomDirectMessage(
                                    mainViewModel.authToken,
                                    roomId,
                                    "Loved this room. Let's continue after the live.",
                                    receiverId
                                )
                            }.onSuccess {
                                if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onReact = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.reactToRoom(mainViewModel.authToken, roomId, "fire") }
                                .onSuccess {
                                    android.widget.Toast.makeText(context, "Reaction sent", android.widget.Toast.LENGTH_SHORT).show()
                                    refreshVideoRoom()
                                }
                        }
                    },
                    onLoadPkOpponents = { search ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.availablePkOpponents(mainViewModel.authToken, com.example.yugm.model.PkBattleType.VIDEO, search) }
                                .onSuccess { pkOpponents = it }
                        }
                    },
                    onInvitePk = { opponent, mode, duration, title ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.invitePk(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    opponentRoomId = opponent.roomId,
                                    opponentHostId = opponent.hostId,
                                    battleType = com.example.yugm.model.PkBattleType.VIDEO,
                                    mode = mode,
                                    durationSeconds = duration,
                                    title = title
                                )
                            }.onSuccess {
                                pkBattle = it.first
                                android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onAutoMatchPk = { mode, duration, title ->
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.autoMatchPk(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    battleType = com.example.yugm.model.PkBattleType.VIDEO,
                                    mode = mode,
                                    durationSeconds = duration,
                                    title = title
                                )
                            }.onSuccess {
                                pkBattle = it.first
                                pkInviteId = it.second?.id
                                android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onSendPkGift = { gift, side ->
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            runCatching { com.example.yugm.api.YugmApi.sendPkGift(mainViewModel.authToken, battleId, gift.id, side) }
                                .onSuccess {
                                    pkBattle = it
                                    mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onSendPkReaction = { reaction, side ->
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            runCatching { com.example.yugm.api.YugmApi.sendPkReaction(mainViewModel.authToken, battleId, side, reaction) }
                                .onSuccess { pkBattle = it }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onAcceptPk = { inviteId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.acceptPk(mainViewModel.authToken, inviteId) }
                                .onSuccess {
                                    pkBattle = it
                                    pkInviteId = null
                                    refreshVideoRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onRejectPk = { inviteId ->
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.rejectPk(mainViewModel.authToken, inviteId) }
                                .onSuccess {
                                    pkBattle = null
                                    pkInviteId = null
                                    refreshVideoRoom()
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    },
                    onEndPk = {
                        scope.launch {
                            val battleId = pkBattle?.id ?: return@launch
                            val battle = pkBattle
                            if (battle?.status == com.example.yugm.model.PkStatus.INVITED || battle?.status == com.example.yugm.model.PkStatus.WAITING) {
                                runCatching { com.example.yugm.api.YugmApi.cancelPk(mainViewModel.authToken, battleId) }
                                    .onSuccess {
                                        pkBattle = null
                                        pkInviteId = null
                                        pkOpponentMedia = null
                                    }
                                    .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                            } else {
                                runCatching { com.example.yugm.api.YugmApi.endPk(mainViewModel.authToken, battleId) }
                                    .onSuccess {
                                        pkBattle = it
                                        pkInviteId = null
                                        pkOpponentMedia = null
                                    }
                                    .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                            }
                        }
                    },
                    onEndRoom = {
                        scope.launch {
                            runCatching { com.example.yugm.api.YugmApi.endRoom(roomId, mainViewModel.authToken) }
                                .onSuccess { navController.popBackStack() }
                        }
                    },
                    onMuteUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.muteUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVideoRoom() } }
                    },
                    onRemoveUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.removeUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVideoRoom() } }
                    },
                    onReportUser = { userId ->
                        scope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, roomId, userId, "Inappropriate behavior") } }
                    },
                    onJoin = {
                        scope.launch {
                            runCatching {
                                com.example.yugm.api.YugmApi.joinRoom(mainViewModel.authToken, roomId)
                                val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                                com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                                com.example.yugm.api.YugmSocket.connect(
                                    token = mainViewModel.authToken,
                                    roomId = roomId,
                                    onMessage = { author, text -> chat.add(com.example.yugm.model.ChatMessage(author, text)) },
                                    onPkState = { battle ->
                                        scope.launch {
                                            pkBattle = battle
                                            if (battle.status == com.example.yugm.model.PkStatus.ACTIVE) pkInviteId = null
                                            runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                                .onSuccess { pkLeaderboard = it }
                                            if (battle.status == com.example.yugm.model.PkStatus.ACTIVE && battle.battleType == com.example.yugm.model.PkBattleType.VIDEO) {
                                                runCatching { com.example.yugm.api.YugmApi.pkMediaSession(mainViewModel.authToken, battle.id, roomId) }
                                                    .onSuccess {
                                                        pkOpponentMedia = it
                                                        if (it != null) com.example.yugm.api.YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName)
                                                    }
                                            }
                                        }
                                    },
                                    onPkInvite = { battle, invite ->
                                        scope.launch {
                                            pkBattle = battle
                                            pkInviteId = invite.id
                                            android.widget.Toast.makeText(context, "PK invite received", android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    onPkEffect = { effect ->
                                        scope.launch {
                                            pkLiveEffect = effect
                                            kotlinx.coroutines.delay(1400)
                                            if (pkLiveEffect == effect) pkLiveEffect = null
                                        }
                                    },
                                    onPkRefresh = { refreshVideoRoom() },
                                    onPkLeadChanged = { leader, leftScore, rightScore ->
                                        scope.launch {
                                            val current = pkBattle ?: return@launch
                                            pkBattle = current.copy(
                                                leader = com.example.yugm.model.PkSideType.valueOf(leader),
                                                left = current.left.copy(score = leftScore),
                                                right = current.right.copy(score = rightScore)
                                            )
                                        }
                                    },
                                    onPkRematchRequested = { previousBattleId ->
                                        scope.launch {
                                            android.widget.Toast.makeText(context, "Opponent wants a rematch!", android.widget.Toast.LENGTH_SHORT).show()
                                            refreshVideoRoom()
                                        }
                                    }
                                )
                                refreshVideoRoom()
                            }
                        }
                    }
                )
            }
        }

        // Wallet
        composable(Screen.Wallet.route) {
            val walletContext = androidx.compose.ui.platform.LocalContext.current
            val scope = rememberCoroutineScope()

            WalletScreen(
                token = mainViewModel.authToken,
                initialBalance = mainViewModel.balance,
                onBack = { navController.popBackStack() },
                onOpenEarnings = { navController.navigate(Screen.Growth.route) },
                onBalanceChanged = mainViewModel::updateBalance,
                onRechargeOrderReady = { checkoutData ->
                    val activity = walletContext as? android.app.Activity
                    if (activity != null) {
                        runCatching { com.example.yugm.payments.RazorpayCoordinator.start(activity, checkoutData) }
                            .onFailure { android.widget.Toast.makeText(walletContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onStartGooglePlayPurchase = { pack ->
                    val activity = walletContext as? android.app.Activity ?: return@WalletScreen
                    if (pack.googleProductId.isBlank()) return@WalletScreen
                    scope.launch {
                        val rawDetails = com.example.yugm.payments.GooglePlayBillingManager.queryRawProductDetails(listOf(pack.googleProductId))
                        val details = rawDetails.firstOrNull()
                        if (details != null) {
                            com.example.yugm.payments.GooglePlayBillingManager.setPendingPurchaseHandler { productId, purchaseToken, orderId ->
                                val balance = runCatching {
                                    com.example.yugm.api.YugmApi.verifyGooglePlayPurchase(
                                        token = mainViewModel.authToken,
                                        packId = pack.id,
                                        productId = productId,
                                        purchaseToken = purchaseToken,
                                        orderId = orderId
                                    )
                                }.onFailure { e ->
                                    withContext(Dispatchers.Main) {
                                        android.widget.Toast.makeText(walletContext, "Verification failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                }.getOrNull()
                                if (balance != null) {
                                    withContext(Dispatchers.Main) {
                                        mainViewModel.updateBalance(balance)
                                        android.widget.Toast.makeText(walletContext, "Purchase successful! +${pack.coinAmount} coins", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                            com.example.yugm.payments.GooglePlayBillingManager.launchBillingFlow(activity, details)
                        } else {
                            withContext(Dispatchers.Main) {
                                android.widget.Toast.makeText(walletContext, "Product not available in Google Play", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
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
                token = mainViewModel.authToken,
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

        // Support Screen
        composable(Screen.Support.route) {
            SupportScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onTicketClick = { ticketId -> navController.navigate(Screen.TicketDetail.createRoute(ticketId)) }
            )
        }

        // Ticket Detail Screen
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

        // Clan List
        composable(Screen.ClanList.route) {
            ClanListScreen(
                token = mainViewModel.authToken,
                onBack = { navController.popBackStack() },
                onCreateClan = { navController.navigate(Screen.ClanCreate.route) },
                onClanClick = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) },
                onMyClanClick = { clanId -> navController.navigate(Screen.ClanDetail.createRoute(clanId)) }
            )
        }

        // Clan Create
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

        // Clan Detail
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

        // Clan Chat
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
}

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
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.Role
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.api.VibeApi
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.Room
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.ui.components.Avatar
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.round
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
import com.yugm.app.ui.screens.MainTabsScreen
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
    var minimizedRoom by remember { mutableStateOf<Room?>(null) }
    var minimizedRoomType by remember { mutableStateOf(RoomType.Voice) }
    var minimizedVideoFeed by remember { mutableStateOf<YugmMediaRoom.VideoFeed?>(null) }
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
            Screen.MainTabs.createRoute("discover")
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
                navController.navigate(Screen.MainTabs.createRoute("discover")) {
                    popUpTo(Screen.ProfileSetup.route) { inclusive = true }
                    launchSingleTop = true
                }
            }
        )
        composable(
            route = Screen.MainTabs.route,
            arguments = listOf(navArgument("tab") { type = NavType.StringType; defaultValue = "discover" })
        ) { backStackEntry ->
            val tab = backStackEntry.arguments?.getString("tab") ?: "discover"
            val requestedTab by backStackEntry.savedStateHandle
                .getStateFlow<String?>("tab_request", null)
                .collectAsState()
            MainTabsScreen(
                navController = navController,
                token = mainViewModel.authToken,
                currentUserId = mainViewModel.currentUserId,
                initialTab = tab,
                requestedTab = requestedTab,
                onRequestedTabConsumed = { backStackEntry.savedStateHandle["tab_request"] = null },
                onProfileUpdated = mainViewModel::validateAndUpdate
            )
        }
        discoverNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId }
        )
        roomNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId },
            userNameProvider = { mainViewModel.userName },
            usernameProvider = { mainViewModel.username },
            balanceProvider = { mainViewModel.balance },
            onMinimizeRoom = { room, roomType ->
                minimizedRoom = room
                minimizedRoomType = roomType
                navController.navigate(Screen.MainTabs.createRoute("discover")) { launchSingleTop = true }
            }
        )
        profileNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId },
            onProfileUpdated = mainViewModel::validateAndUpdate,
            onSettings = { navController.navigate(Screen.Settings.route) },
            onOpenStore = { navController.navigate(Screen.Cosmetics.route) },
            onOpenVip = { navController.navigate(Screen.Vip.route) },
            onOpenTasks = { navController.navigate(Screen.Growth.route) },
            onOpenLevel = { navController.navigate(Screen.BattlePass.route) },
            onOpenWallet = { navController.navigate(Screen.Wallet.route) },
            onOpenInventory = { navController.navigate(Screen.Inventory.route) }
        )
        socialNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId }
        )
        walletNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            balanceProvider = { mainViewModel.balance },
            currentUserIdProvider = { mainViewModel.currentUserId },
            onRechargeOrderReady = onRechargeOrderReady,
            onStartGooglePlayPurchase = onStartGooglePlayPurchase
        )
        settingsNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId },
            userNameProvider = { mainViewModel.userName },
            usernameProvider = { mainViewModel.username },
            onLogout = { mainViewModel.logout() }
        )
        roomModesNavGraph(navController, { mainViewModel.authToken }, { mainViewModel.currentUserId })
        moderationNavGraph(navController, { mainViewModel.authToken })
        missionsNavGraph(navController, { mainViewModel.authToken })
        eventsNavGraph(navController, { mainViewModel.authToken }, { mainViewModel.currentUserId })
        giftNavGraph(navController, { mainViewModel.authToken })
        chatNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId }
        )
        creatorNavGraph(
            navController = navController,
            authTokenProvider = { mainViewModel.authToken },
            currentUserIdProvider = { mainViewModel.currentUserId }
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

      LaunchedEffect(minimizedRoom?.id, minimizedRoomType) {
          minimizedVideoFeed = null
          val room = minimizedRoom
          if (room != null && minimizedRoomType == RoomType.Video) {
              while (kotlinx.coroutines.currentCoroutineContext().isActive) {
                  minimizedVideoFeed = YugmMediaRoom.videoFeeds().firstOrNull { it.identity == room.host?.id }
                  delay(350)
              }
          }
      }
      minimizedRoom?.let { room ->
          var dragOffset by remember(room.id) { mutableStateOf(IntOffset.Zero) }
          BoxWithConstraints(Modifier.fillMaxSize()) {
              val density = LocalDensity.current
              val bubbleWidth = with(density) { (if (minimizedRoomType == RoomType.Video) 128.dp else 68.dp).roundToPx() }
              val bubbleHeight = with(density) { (if (minimizedRoomType == RoomType.Video) 82.dp else 68.dp).roundToPx() }
              val endInset = with(density) { 14.dp.toPx().toInt() }
              val bottomInset = with(density) { 94.dp.toPx().toInt() }
              val maxLeft = (constraints.maxWidth - bubbleWidth - endInset).coerceAtLeast(0)
              val maxUp = (constraints.maxHeight - bubbleHeight - bottomInset).coerceAtLeast(0)
              RoomMinimizedBubble(
                  room = room,
                  isVideo = minimizedRoomType == RoomType.Video,
                  videoFeed = minimizedVideoFeed,
                  modifier = Modifier
                      .align(Alignment.BottomEnd)
                      .padding(end = 14.dp, bottom = 94.dp)
                      .offset { dragOffset }
                      .pointerInput(room.id, maxLeft, maxUp) {
                          detectDragGestures { change, amount ->
                              change.consume()
                              dragOffset = IntOffset(
                                  (dragOffset.x + amount.round().x).coerceIn(-maxLeft, 0),
                                  (dragOffset.y + amount.round().y).coerceIn(-maxUp, 0)
                              )
                          }
                      }
                      .clickable(role = Role.Button) {
                          val roomRoute = if (minimizedRoomType == RoomType.Video) {
                              Screen.VideoRoom.createRoute(room.id)
                          } else {
                              Screen.VoiceRoom.createRoute(room.id)
                          }
                          val restored = navController.popBackStack(roomRoute, inclusive = false)
                          if (!restored) navController.navigate(roomRoute) { launchSingleTop = true }
                          minimizedRoom = null
                      }
              )
          }
      }
    }
}

@Composable
private fun RoomMinimizedBubble(
    room: Room,
    isVideo: Boolean,
    videoFeed: YugmMediaRoom.VideoFeed?,
    modifier: Modifier = Modifier
) {
    val bubbleShape = RoundedCornerShape(if (isVideo) 20.dp else 50.dp)
    Box(
        modifier = modifier
            .width(if (isVideo) 128.dp else 68.dp)
            .height(if (isVideo) 82.dp else 68.dp)
            .clip(bubbleShape)
            .background(Color(0xFF21172F))
            .semantics {
                contentDescription = if (isVideo) "Return to video room ${room.title}" else "Return to voice room ${room.title}"
            },
        contentAlignment = Alignment.Center
    ) {
        if (isVideo && videoFeed != null) {
            MiniRoomVideoPreview(videoFeed, Modifier.fillMaxSize())
        } else {
            Avatar(
                initial = room.host?.name?.take(1) ?: room.title.take(1),
                size = if (isVideo) 62 else 56,
                imageUrl = room.coverImage ?: room.host?.avatar,
                cosmetics = room.host?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics()
            )
        }
        if (isVideo) {
            Text(
                "LIVE",
                color = Color.White,
                fontSize = 8.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(5.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xFFD72E68))
                    .padding(horizontal = 5.dp, vertical = 2.dp)
            )
        }
    }
}

@Composable
private fun MiniRoomVideoPreview(feed: YugmMediaRoom.VideoFeed, modifier: Modifier = Modifier) {
    var renderer by remember(feed.track) { mutableStateOf<SurfaceViewRenderer?>(null) }
    androidx.compose.runtime.DisposableEffect(feed.track) {
        onDispose {
            renderer?.let { feed.track.removeRenderer(it); it.release() }
            renderer = null
        }
    }
    AndroidView(
        factory = { viewContext ->
            SurfaceViewRenderer(viewContext).also { view ->
                YugmMediaRoom.initializeVideoRenderer(view)
                view.setMirror(feed.isLocal)
                feed.track.addRenderer(view)
                renderer = view
            }
        },
        modifier = modifier.background(Color.Black)
    )
}

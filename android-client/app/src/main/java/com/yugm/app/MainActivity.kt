package com.yugm.app

import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.ApiHttpException
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.api.YugmHttpClient
import com.yugm.app.navigation.NavGraph
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.YugmTheme
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.ui.viewmodel.MainViewModel
import com.yugm.app.core.data.SessionManager
import com.yugm.app.payments.RazorpayCoordinator
import com.yugm.app.payments.GooglePlayBillingManager
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.withLock
import timber.log.Timber
import javax.inject.Inject

private const val TAG = "MainActivity"

@AndroidEntryPoint
class MainActivity : ComponentActivity(), PaymentResultWithDataListener {
    @Inject lateinit var sessionManager: SessionManager
    private val pendingPushRoute = mutableStateOf<String?>(null)


    override fun onResume() {
        super.onResume()
        // FLAG_KEEP_SCREEN_ON is managed by room screens (voice/video) via DisposableEffect.
        // Setting it unconditionally here keeps the display on during login/onboarding, which
        // drains battery unnecessarily. Leave it off at the Activity level.
        YugmMediaRoom.syncForegroundAudioType()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute.value = routeFromPushIntent(intent)
        FirebaseApp.initializeApp(this)
        YugmHttpClient.authTokenProvider = { sessionManager.authToken }
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(
                lightScrim = android.graphics.Color.TRANSPARENT,
                darkScrim = android.graphics.Color.TRANSPARENT
            ),
            navigationBarStyle = SystemBarStyle.auto(
                lightScrim = android.graphics.Color.TRANSPARENT,
                darkScrim = android.graphics.Color.TRANSPARENT
            )
        )

        setContent {
            val themeMode by sessionManager.themeModeFlow.collectAsState()
            val darkTheme = when (themeMode) {
                "DARK" -> true
                "LIGHT" -> false
                else -> isSystemInDarkTheme()
            }
            LaunchedEffect(darkTheme) {
                androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)?.apply {
                    isAppearanceLightStatusBars = !darkTheme
                    isAppearanceLightNavigationBars = !darkTheme
                }
            }
            YugmTheme(darkTheme = darkTheme, dynamicColor = false) {
                val navController = androidx.navigation.compose.rememberNavController()
                val mainViewModel: MainViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
                com.yugm.app.core.ui.components.AutomaticSyncEffect(mainViewModel.currentUserId, mainViewModel.authToken,
                    topics = setOf(com.yugm.app.core.api.SyncTopic.PROFILE, com.yugm.app.core.api.SyncTopic.WALLET, com.yugm.app.core.api.SyncTopic.TASKS),
                    enabled = mainViewModel.authToken.isNotBlank() && mainViewModel.startupSessionCheckComplete) {
                    val accountId = mainViewModel.currentUserId
                    runCatching { YugmApi.authMe(sessionManager.authToken) }.onSuccess { user ->
                        if (accountId == mainViewModel.currentUserId && user.id == accountId) mainViewModel.validateAndUpdate(user, registerPush = false)
                    }
                }
                val inAppNotification = mainViewModel.inAppNotification
                LaunchedEffect(inAppNotification?.id) {
                    if (inAppNotification != null) {
                        kotlinx.coroutines.delay(5_000)
                        mainViewModel.dismissInAppNotification()
                    }
                }
                val scope = rememberCoroutineScope()
                val context = this@MainActivity
                var notificationPromptAttempted by remember { mutableStateOf(false) }
                val notificationPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
                LaunchedEffect(mainViewModel.authToken, mainViewModel.startupSessionCheckComplete) {
                    if (Build.VERSION.SDK_INT >= 33 && mainViewModel.authToken.isNotBlank() && mainViewModel.startupSessionCheckComplete &&
                        !notificationPromptAttempted &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        notificationPromptAttempted = true
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }

                val pushRoute = pendingPushRoute.value
                LaunchedEffect(pushRoute, mainViewModel.authToken, mainViewModel.profileCompleted, mainViewModel.startupSessionCheckComplete) {
                    if (!pushRoute.isNullOrBlank() && mainViewModel.authToken.isNotBlank() && mainViewModel.startupSessionCheckComplete && mainViewModel.profileCompleted) {
                        navController.navigate(pushRoute)
                        pendingPushRoute.value = null
                    }
                }

                LaunchedEffect(Unit) {
                    val refreshMutex = kotlinx.coroutines.sync.Mutex()
                    YugmHttpClient.refreshAccessToken = { rejectedToken ->
                        refreshMutex.withLock {
                            val current = sessionManager.authToken
                            if (current != rejectedToken) return@withLock current
                            val refreshToken = sessionManager.refreshToken
                            if (refreshToken.isBlank()) {
                                mainViewModel.logout(revokeServerSession = false)
                                return@withLock null
                            }
                            try {
                                val pair = withContext(Dispatchers.IO) { YugmApi.refreshAuth(refreshToken) }
                                mainViewModel.updateTokens(pair)
                                pair.accessToken
                            } catch (error: ApiHttpException) {
                                if (error.statusCode == 401 && sessionManager.authToken == rejectedToken) {
                                    mainViewModel.logout(revokeServerSession = false)
                                    null
                                } else throw error
                            }
                        }
                    }
                    YugmHttpClient.onUnauthorized = { rejectedToken, reason ->
                        // Several requests may fail together. Only clear the session if
                        // the rejected token is still the current one, and navigate once.
                        val rejectedCurrentSession = rejectedToken == sessionManager.authToken && rejectedToken == mainViewModel.authToken
                        if (rejectedCurrentSession) {
                            mainViewModel.logout(revokeServerSession = false)
                        }
                        val sessionAlreadyCleared = sessionManager.authToken.isBlank() && mainViewModel.authToken.isBlank()
                        val route = navController.currentDestination?.route
                        if ((rejectedCurrentSession || sessionAlreadyCleared) && route != Screen.Login.route && route != Screen.Splash.route) {
                                val message = if (reason.contains("another device", ignoreCase = true)) {
                                    "This account was signed in on another device. Sign in again to continue."
                                } else {
                                    "Your session expired or was revoked. Sign in again to continue."
                                }
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                                navController.navigate(Screen.Login.route) {
                                    popUpTo(navController.graph.id) { inclusive = true }
                                    launchSingleTop = true
                                }
                        }
                    }
                }

                // Initialize Google Play Billing
                LaunchedEffect(Unit) {
                    GooglePlayBillingManager.init(context)
                    GooglePlayBillingManager.setPendingPurchaseHandler { productId, purchaseToken, orderId ->
                        val token = mainViewModel.authToken
                        if (token.isBlank()) return@setPendingPurchaseHandler GooglePlayBillingManager.PurchaseHandleResult.RETRY
                        runCatching {
                            val pack = YugmApi.coinPacks(token).firstOrNull { it.googleProductId == productId }
                                ?: error("Unknown product: $productId")
                            val balance = YugmApi.verifyGooglePlayPurchase(
                                token = token,
                                packId = pack.id,
                                productId = productId,
                                purchaseToken = purchaseToken,
                                orderId = orderId,
                            )
                            mainViewModel.updateBalance(balance)
                            GooglePlayBillingManager.PurchaseHandleResult.VERIFIED
                        }.getOrElse {
                            Timber.tag("GooglePlay").w(it, "Purchase verification pending/retry")
                            GooglePlayBillingManager.PurchaseHandleResult.RETRY
                        }
                    }
                }

                // Register network callback
                DisposableEffect(Unit) {
                    val cm = context.getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
                    fun updateConnectivity() {
                        val capabilities = cm.getNetworkCapabilities(cm.activeNetwork)
                        YugmHttpClient.isOnline = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
                    }
                    updateConnectivity()
                    val callback = object : ConnectivityManager.NetworkCallback() {
                        override fun onAvailable(network: Network) { updateConnectivity() }
                        override fun onLost(network: Network) { updateConnectivity() }
                        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) { updateConnectivity() }
                    }
                    cm.registerDefaultNetworkCallback(callback)
                    onDispose { cm.unregisterNetworkCallback(callback) }
                }

                Box(Modifier.fillMaxSize().background(Background)) {
                    NavGraph(
                        navController = navController,
                        mainViewModel = mainViewModel,
                        onRechargeOrderReady = { checkout ->
                            runCatching { RazorpayCoordinator.start(this@MainActivity, checkout) }
                                .onFailure { Toast.makeText(context, it.message ?: "Checkout could not start", Toast.LENGTH_LONG).show() }
                        },
                        onStartGooglePlayPurchase = { pack ->
                            scope.launch {
                                if (GooglePlayBillingManager.isBillingUnavailable()) {
                                    Toast.makeText(context, "Google Play Billing is unavailable. Choose Razorpay to continue.", Toast.LENGTH_LONG).show()
                                    return@launch
                                }
                                runCatching {
                                    if (pack.googleProductId.isBlank()) {
                                        error("This coin pack is not configured for Google Play.")
                                    }
                                    if (!GooglePlayBillingManager.isBillingReady()) {
                                        GooglePlayBillingManager.init(this@MainActivity)
                                        val ready = GooglePlayBillingManager.awaitBillingReady()
                                        if (!ready) error("Google Play Billing could not connect. Check Play Store sign-in/network, then try again.")
                                    }
                                    GooglePlayBillingManager.queryRawProductDetails(listOf(pack.googleProductId))
                                        .firstOrNull() ?: error("This coin pack isn't available in Google Play for this app yet. Check Play Console product IDs and app version.")
                                }.onSuccess { details ->
                                    val result = GooglePlayBillingManager.launchBillingFlow(this@MainActivity, details)
                                    if (result == null || result.responseCode != com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                                        val cancelled = result?.responseCode == com.android.billingclient.api.BillingClient.BillingResponseCode.USER_CANCELED
                                        if (!cancelled) {
                                            Toast.makeText(context, result?.debugMessage ?: "Purchase flow could not start", Toast.LENGTH_LONG).show()
                                        }
                                    }
                                }.onFailure {
                                    Toast.makeText(context, it.message ?: "Google Play purchase could not start. Choose Razorpay to continue.", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                    )
                    inAppNotification?.let { notification ->
                        val colors = LocalYugmColors.current
                        Surface(
                            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp)
                                .fillMaxWidth().clickable {
                                    mainViewModel.dismissInAppNotification()
                                    when {
                                        notification.actionType == "BONDS" -> navController.navigate(Screen.Bonds.createRoute(center = true))
                                        notification.callType.equals("VIDEO", true) && notification.roomId.isNotBlank() -> navController.navigate(Screen.VideoRoom.createRoute(notification.roomId))
                                        notification.callType.equals("VOICE", true) && notification.roomId.isNotBlank() -> navController.navigate(Screen.VoiceRoom.createRoute(notification.roomId))
                                        notification.clanId.isNotBlank() -> navController.navigate(Screen.ClanDetail.createRoute(notification.clanId))
                                        notification.roomId.isNotBlank() -> navController.navigate(Screen.RoomLobby.createRoute(notification.roomId))
                                        notification.partnerId.isNotBlank() -> navController.navigate(Screen.Chat.createRoute(notification.partnerId))
                                        notification.actorId.isNotBlank() -> navController.navigate(Screen.ProfileDetail.createRoute(notification.actorId))
                                        else -> navController.navigate(Screen.Notifications.route)
                                    }
                                },
                            shape = RoundedCornerShape(18.dp),
                            color = colors.surfaceElevated,
                            contentColor = colors.textPrimary,
                            shadowElevation = 10.dp
                        ) {
                            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                                Text(notification.actorName.ifBlank { "New activity" }, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(notification.message, color = colors.textSecondary, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 3.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingPushRoute.value = routeFromPushIntent(intent)
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData?) {
        val purchaseId = RazorpayCoordinator.pendingPurchaseId(this)
        if (purchaseId.isBlank() || (paymentData == null)) return
        lifecycleScope.launch {
            runCatching {
                YugmApi.verifyRazorpayPurchase(
                    token = sessionManager.authToken,
                    purchaseId = purchaseId,
                    orderId = paymentData.orderId,
                    paymentId = paymentData.paymentId.ifBlank { razorpayPaymentId.orEmpty() },
                    signature = paymentData.signature
                )
            }.onSuccess { balance ->
                sessionManager.balance = balance
                RazorpayCoordinator.notifyVerified(balance)
                RazorpayCoordinator.clearPending(this@MainActivity)
                Toast.makeText(this@MainActivity, "Recharge successful", Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(this@MainActivity, it.message ?: "Payment verification failed", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onPaymentError(code: Int, response: String?, paymentData: PaymentData?) {
        RazorpayCoordinator.clearPending(this)
        Toast.makeText(this, response ?: "Payment cancelled", Toast.LENGTH_LONG).show()
    }

    private fun routeFromPushIntent(intent: Intent?): String? {
        if (intent?.getStringExtra("type") == "BONDS") return Screen.Bonds.createRoute(center = true)
        val roomId = intent?.getStringExtra("roomId")
        val callType = intent?.getStringExtra("callType").orEmpty()
        val clanId = intent?.getStringExtra("clanId")
        // The API sends partnerId in direct-message notification data. Accept the
        // older chatPartnerId key too so notifications from either client version work.
        val chatPartnerId = intent?.getStringExtra("chatPartnerId")
            ?: intent?.getStringExtra("partnerId")
        return when {
            !roomId.isNullOrBlank() && callType.equals("VIDEO", true) -> Screen.VideoRoom.createRoute(roomId)
            !roomId.isNullOrBlank() && callType.equals("VOICE", true) -> Screen.VoiceRoom.createRoute(roomId)
            !roomId.isNullOrBlank() -> Screen.RoomLobby.createRoute(roomId)
            !clanId.isNullOrBlank() -> Screen.ClanDetail.createRoute(clanId)
            !chatPartnerId.isNullOrBlank() -> Screen.Chat.createRoute(chatPartnerId)
            else -> null
        }
    }
}

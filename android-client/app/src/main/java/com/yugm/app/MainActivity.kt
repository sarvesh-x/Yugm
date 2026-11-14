package com.yugm.app

import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.api.ApiHttpException
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.api.YugmHttpClient
import com.yugm.app.navigation.NavGraph
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.YugmTheme
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
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun onPause() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onPause()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute.value = routeFromPushIntent(intent)
        FirebaseApp.initializeApp(this)
        YugmHttpClient.authTokenProvider = { sessionManager.authToken }
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )

        setContent {
            YugmTheme(dynamicColor = false) {
                val navController = androidx.navigation.compose.rememberNavController()
                val mainViewModel: MainViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
                val scope = rememberCoroutineScope()
                val context = this@MainActivity
                val notificationPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
                LaunchedEffect(mainViewModel.authToken) {
                    if (Build.VERSION.SDK_INT >= 33 && mainViewModel.authToken.isNotBlank() &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        val prefs = context.getSharedPreferences("yugm_permissions", MODE_PRIVATE)
                        if (!prefs.getBoolean("notification_prompted", false)) {
                            prefs.edit().putBoolean("notification_prompted", true).apply()
                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    }
                }

                val pushRoute = pendingPushRoute.value
                LaunchedEffect(pushRoute, mainViewModel.authToken, mainViewModel.profileCompleted) {
                    if (!pushRoute.isNullOrBlank() && mainViewModel.authToken.isNotBlank() && mainViewModel.profileCompleted) {
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
                    YugmHttpClient.onUnauthorized = { rejectedToken ->
                        // Several requests may fail together. Only clear the session if
                        // the rejected token is still the current one, and navigate once.
                        val rejectedCurrentSession = rejectedToken == sessionManager.authToken && rejectedToken == mainViewModel.authToken
                        if (rejectedCurrentSession) {
                            mainViewModel.logout(revokeServerSession = false)
                        }
                        val sessionAlreadyCleared = sessionManager.authToken.isBlank() && mainViewModel.authToken.isBlank()
                        val route = navController.currentDestination?.route
                        if ((rejectedCurrentSession || sessionAlreadyCleared) && route != Screen.Login.route && route != Screen.Splash.route) {
                                navController.navigate(Screen.Login.route) {
                                    popUpTo(0) { inclusive = true }
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
                    val callback = object : ConnectivityManager.NetworkCallback() {
                        override fun onAvailable(network: Network) { YugmHttpClient.isOnline = true }
                        override fun onLost(network: Network) { YugmHttpClient.isOnline = false }
                    }
                    val request = NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build()
                    cm.registerNetworkCallback(request, callback)
                    onDispose { cm.unregisterNetworkCallback(callback) }
                }

                val startRazorpayFallback: (CoinPack) -> Unit = { pack ->
                    val token = mainViewModel.authToken
                    if (token.isBlank()) {
                        Toast.makeText(context, "Sign in again to finish your purchase.", Toast.LENGTH_LONG).show()
                    } else {
                        scope.launch {
                            runCatching {
                                withContext(Dispatchers.IO) { YugmApi.createRazorpayOrder(token, pack.id) }
                            }.onSuccess { checkout: RazorpayCheckoutData ->
                                RazorpayCoordinator.start(this@MainActivity, checkout)
                            }.onFailure {
                                Toast.makeText(context, it.message ?: "Checkout could not start", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
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
                                    startRazorpayFallback(pack)
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
                                    GooglePlayBillingManager.launchBillingFlow(this@MainActivity, details)
                                }.onFailure {
                                    if (GooglePlayBillingManager.isBillingUnavailable()) {
                                        startRazorpayFallback(pack)
                                    } else {
                                        Toast.makeText(context, it.message ?: "Purchase could not start", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        },
                    )
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
        val roomId = intent?.getStringExtra("roomId")
        val chatPartnerId = intent?.getStringExtra("chatPartnerId")
        return when {
            !roomId.isNullOrBlank() -> Screen.RoomLobby.createRoute(roomId)
            !chatPartnerId.isNullOrBlank() -> Screen.Chat.createRoute(chatPartnerId)
            else -> null
        }
    }
}

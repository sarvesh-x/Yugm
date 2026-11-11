package com.example.yugm

import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.lifecycleScope
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.api.YugmHttpClient
import com.example.yugm.navigation.NavGraph
import com.example.yugm.core.navigation.Screen
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.YugmTheme
import com.example.yugm.ui.viewmodel.MainViewModel
import com.example.yugm.core.data.SessionManager
import com.example.yugm.payments.RazorpayCoordinator
import com.example.yugm.payments.GooglePlayBillingManager
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject

private const val TAG = "MainActivity"

@AndroidEntryPoint
class MainActivity : ComponentActivity(), PaymentResultWithDataListener {
    @Inject lateinit var sessionManager: SessionManager
    private val pendingPushRoute = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute.value = routeFromPushIntent(intent)
        FirebaseApp.initializeApp(this)
        YugmHttpClient.authTokenProvider = { sessionManager.authToken }
        enableEdgeToEdge()

        setContent {
            YugmTheme(dynamicColor = false) {
                val navController = androidx.navigation.compose.rememberNavController()
                val mainViewModel: MainViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
                val scope = rememberCoroutineScope()
                val context = this@MainActivity

                val pushRoute = pendingPushRoute.value
                LaunchedEffect(pushRoute, mainViewModel.authToken) {
                    if (!pushRoute.isNullOrBlank() && mainViewModel.authToken.isNotBlank()) {
                        navController.navigate(pushRoute)
                        pendingPushRoute.value = null
                    }
                }

                LaunchedEffect(Unit) {
                    YugmHttpClient.onUnauthorized = { rejectedToken ->
                        // Several requests may fail together. Only clear the session if
                        // the rejected token is still the current one, and navigate once.
                        if (rejectedToken == sessionManager.authToken &&
                            rejectedToken == mainViewModel.authToken
                        ) {
                            mainViewModel.logout()
                            if (navController.currentDestination?.route != Screen.Login.route) {
                                navController.navigate(Screen.Login.route) {
                                    popUpTo(0) { inclusive = true }
                                    launchSingleTop = true
                                }
                            }
                        }
                    }
                }

                // Initialize Google Play Billing
                LaunchedEffect(Unit) {
                    GooglePlayBillingManager.init(context)
                    GooglePlayBillingManager.setPendingPurchaseHandler { productId, purchaseToken, orderId ->
                        val token = mainViewModel.authToken
                        check(token.isNotBlank()) { "Sign in again to finish your purchase." }
                        val pack = YugmApi.coinPacks(token).firstOrNull { it.googleProductId == productId }
                            ?: error("This Play Store product is not configured for Yugm.")
                        val balance = YugmApi.verifyGooglePlayPurchase(
                            token = token,
                            packId = pack.id,
                            productId = productId,
                            purchaseToken = purchaseToken,
                            orderId = orderId,
                        )
                        mainViewModel.updateBalance(balance)
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

                // Google Sign In configuration
                @Suppress("DEPRECATION")
                val googleClientId = stringResource(R.string.google_web_client_id)
                val gso = remember(googleClientId) {
                    GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(googleClientId)
                        .requestEmail()
                        .build()
                }
                @Suppress("DEPRECATION")
                val googleSignInClient = remember { com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(context, gso) }

                val googleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                    if (result.resultCode != RESULT_OK) return@rememberLauncherForActivityResult
                    @Suppress("DEPRECATION")
                    val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(result.data)
                    try {
                        val account = task.getResult(ApiException::class.java)
                        val idToken = account.idToken ?: return@rememberLauncherForActivityResult
                        scope.launch {
                            runCatching {
                                val credential = GoogleAuthProvider.getCredential(idToken, null)
                                val authResult = withContext(Dispatchers.IO) {
                                    Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential))
                                }
                                val tokenResult = withContext(Dispatchers.IO) {
                                    Tasks.await(authResult.user?.getIdToken(true) ?: throw IllegalStateException("No authenticated user"))
                                }
                                val fbToken = tokenResult.token ?: throw IllegalStateException("No Firebase token")
                                YugmApi.googleAuth(fbToken)
                            }.onSuccess { session ->
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
                            }.onFailure {
                                Toast.makeText(context, "Google Sign-In failed: ${it.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    } catch (e: Exception) {
                        Timber.tag(TAG).e(e, "Google auth exception")
                    }
                }

                Box(Modifier.fillMaxSize().background(Background)) {
                    NavGraph(
                        navController = navController,
                        mainViewModel = mainViewModel,
                        onGoogleSignIn = {
                            googleLauncher.launch(googleSignInClient.signInIntent)
                        },
                        onRechargeOrderReady = { checkout ->
                            runCatching { RazorpayCoordinator.start(this@MainActivity, checkout) }
                                .onFailure { Toast.makeText(context, it.message ?: "Checkout could not start", Toast.LENGTH_LONG).show() }
                        },
                        onStartGooglePlayPurchase = { pack ->
                            scope.launch {
                                runCatching {
                                    GooglePlayBillingManager.queryRawProductDetails(listOf(pack.googleProductId))
                                        .firstOrNull() ?: error("This coin pack is not available in Google Play yet.")
                                }.onSuccess { details ->
                                    GooglePlayBillingManager.launchBillingFlow(this@MainActivity, details)
                                }.onFailure {
                                    Toast.makeText(context, it.message ?: "Purchase could not start", Toast.LENGTH_LONG).show()
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

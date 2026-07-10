package com.example.yugm

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Bundle
import android.util.Log
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
import com.example.yugm.api.YugmApi
import com.example.yugm.navigation.NavGraph
import com.example.yugm.navigation.Screen
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.YugmTheme
import com.example.yugm.ui.viewmodel.MainViewModel
import com.example.yugm.util.SessionPrefs
import com.google.android.gms.auth.api.signin.GoogleSignIn
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

private const val TAG = "MainActivity"

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val pendingPushRoute = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute.value = routeFromPushIntent(intent)
        FirebaseApp.initializeApp(this)
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

                // Register network callback
                DisposableEffect(Unit) {
                    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                    val callback = object : ConnectivityManager.NetworkCallback() {
                        override fun onAvailable(network: Network) { YugmApi.isOnline = true }
                        override fun onLost(network: Network) { YugmApi.isOnline = false }
                    }
                    val request = NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build()
                    cm.registerNetworkCallback(request, callback)
                    onDispose { cm.unregisterNetworkCallback(callback) }
                }

                // Google Sign In configuration
                val googleClientId = stringResource(R.string.google_web_client_id)
                val gso = remember(googleClientId) {
                    GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(googleClientId)
                        .requestEmail()
                        .build()
                }
                val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }

                val googleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                    if (result.resultCode != RESULT_OK) return@rememberLauncherForActivityResult
                    val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
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
                                    Tasks.await(authResult.user?.getIdToken(false) ?: throw IllegalStateException("No authenticated user"))
                                }
                                val fbToken = tokenResult.token ?: throw IllegalStateException("No Firebase token")
                                YugmApi.googleAuth(fbToken)
                            }.onSuccess { session ->
                                mainViewModel.updateSession(
                                    token = session.token,
                                    userId = session.user.id,
                                    name = session.user.name,
                                    username = session.user.username,
                                    balance = session.user.walletBalance
                                )
                                val destination = if (session.user.name == "Yugm User" || session.user.name.isBlank()) {
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
                        Log.e(TAG, "Google auth exception", e)
                    }
                }

                Box(Modifier.fillMaxSize().background(Background)) {
                    NavGraph(
                        navController = navController,
                        mainViewModel = mainViewModel,
                        onGoogleSignIn = {
                            googleLauncher.launch(googleSignInClient.signInIntent)
                        },
                        onPhoneSignIn = {
                            navController.navigate(Screen.PhoneLogin.route)
                        }
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

    private fun routeFromPushIntent(intent: Intent?): String? {
        val roomId = intent?.getStringExtra("roomId")
        return if (!roomId.isNullOrBlank()) {
            Screen.Chat.createRoute(roomId)
        } else {
            null
        }
    }
}

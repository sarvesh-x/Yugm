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
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

import com.example.yugm.api.YugmApi
import com.example.yugm.api.YugmMediaRoom
import com.example.yugm.api.YugmSocket
import com.example.yugm.api.isNetworkAvailable
import com.example.yugm.model.ActiveCosmetics
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.CoinPack
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.ProfileCosmetic
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.model.VipPlan
import com.example.yugm.model.VipStatus
import com.example.yugm.ui.components.*
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.theme.*
import com.example.yugm.util.SessionPrefs
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

import dagger.hilt.android.AndroidEntryPoint

private const val TAG = "YugmApp"

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val pendingPushRoute = androidx.compose.runtime.mutableStateOf<String?>(null)

    companion object {
        private const val TAG_ACTIVITY = "MainActivity"
        private const val PREFS = "yugm_session"
        private const val KEY_TOKEN = "authToken"
        private const val KEY_USER_ID = "userId"
        private const val KEY_NAME = "userName"
        private const val KEY_USERNAME = "username"
        private const val KEY_BALANCE = "balance"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingPushRoute.value = routeFromPushIntent(intent)
        FirebaseApp.initializeApp(this)
        enableEdgeToEdge()
        setContent {
            YugmTheme(dynamicColor = false) {
                val navController = androidx.navigation.compose.rememberNavController()
                val mainViewModel: com.example.yugm.ui.viewmodel.MainViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
                val pushRoute = pendingPushRoute.value
                LaunchedEffect(pushRoute, mainViewModel.authToken) {
                    if (!pushRoute.isNullOrBlank() && mainViewModel.authToken.isNotBlank()) {
                        navController.navigate(pushRoute)
                        pendingPushRoute.value = null
                    }
                }
                
                // For now we still need these triggers in MainActivity until we have a proper AuthManager
                val googleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                    // ... launcher logic
                }
                
                com.example.yugm.navigation.NavGraph(
                    navController = navController,
                    mainViewModel = mainViewModel,
                    onGoogleSignIn = { /* trigger googleLauncher */ },
                    onPhoneSignIn = { /* navigate to phone auth */ }
                )
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
            com.example.yugm.navigation.Screen.Chat.createRoute(roomId)
        } else {
            null
        }
    }
}

enum class AppScreen {
    Splash,
    Onboarding,
    Login,
    Otp,
    PhoneAuth,
    CreateProfile,
    Discover,
    Voice,
    Video,
    Search,
    Notifications,
    Wallet,
    Profile,
    Settings,
    CreateRoom,
    ActiveVoice,
    ActiveVideo,
    Chat
}

@Composable
fun YugmApp(
    savedToken: String = "",
    savedUserId: String = "",
    savedName: String = "Yugm User",
    savedUsername: String = "vibe_user",
    savedBalance: Int = 0
) {
    val scope = rememberCoroutineScope()
    val rooms = remember { mutableStateListOf<Room>() }
    val chat = remember { mutableStateListOf<ChatMessage>() }
    val gifts = remember { mutableStateListOf<GiftItem>() }
    var screen by rememberSaveable { mutableStateOf(AppScreen.Splash) }
    var activeRoomId by rememberSaveable { mutableStateOf("") }
    var balance by rememberSaveable { mutableIntStateOf(savedBalance) }
    var userName by rememberSaveable { mutableStateOf(savedName) }
    var username by rememberSaveable { mutableStateOf(savedUsername) }
    var authToken by rememberSaveable { mutableStateOf(savedToken) }
    var currentUserId by rememberSaveable { mutableStateOf(savedUserId) }
    var loadingRooms by rememberSaveable { mutableStateOf(false) }
    var roomError by rememberSaveable { mutableStateOf("") }
    var toast by remember { mutableStateOf("") }
    var phoneNumber by rememberSaveable { mutableStateOf("+91") }
    var phoneVerificationId by rememberSaveable { mutableStateOf("") }
    var phoneOtp by rememberSaveable { mutableStateOf("") }
    var devOtpValue by remember { mutableStateOf<String?>(null) }
    var isOnline by remember { mutableStateOf(true) }

    var searchQuery by rememberSaveable { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Room>>(emptyList()) }
    var searchUserResults by remember { mutableStateOf<List<Host>>(emptyList()) }
    var searchLoading by remember { mutableStateOf(false) }
    var searchError by remember { mutableStateOf("") }

    var profileHost by remember { mutableStateOf<Host?>(null) }
    var profileRooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var profileLoading by remember { mutableStateOf(false) }
    var profileError by remember { mutableStateOf("") }
    var selectedProfileUserId by rememberSaveable { mutableStateOf(savedUserId) }
    var isFollowing by remember { mutableStateOf(false) }
    var followBusy by remember { mutableStateOf(false) }
    var isBlocked by remember { mutableStateOf(false) }
    var walletLoading by remember { mutableStateOf(false) }
    var walletTransactions by remember { mutableStateOf<List<com.example.yugm.model.WalletTransaction>>(emptyList()) }
    var cosmeticsCatalog by remember { mutableStateOf<List<ProfileCosmetic>>(emptyList()) }
    var ownedCosmeticIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var activeCosmetics by remember { mutableStateOf(ActiveCosmetics()) }
    var walletLevel by remember { mutableStateOf(LevelStatus()) }
    var vipStatus by remember { mutableStateOf(VipStatus()) }
    var vipPlans by remember { mutableStateOf<List<VipPlan>>(emptyList()) }
    var coinPacks by remember { mutableStateOf<List<CoinPack>>(emptyList()) }

    var chatPartnerId by rememberSaveable { mutableStateOf("") }
    var chatPartner by remember { mutableStateOf<Host?>(null) }
    var directMessages by remember { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var relationshipStatus by remember { mutableStateOf<RelationshipStatus?>(null) }
    var chatLoading by remember { mutableStateOf(false) }
    var chatError by remember { mutableStateOf("") }

    var notifItems by remember { mutableStateOf<List<com.example.yugm.model.NotificationItem>>(emptyList()) }
    var notifUnread by remember { mutableStateOf(0) }
    var notifLoading by remember { mutableStateOf(false) }

    data class ConfirmData(val title: String, val message: String, val confirmLabel: String = "Confirm", val isDestructive: Boolean = true, val action: () -> Unit)
    var confirmDialog by remember { mutableStateOf<ConfirmData?>(null) }

    val context = androidx.compose.ui.platform.LocalContext.current
    val sessionPrefs = remember { SessionPrefs }
    LaunchedEffect(Unit) { sessionPrefs.init(context) }
    val googleClientId = context.getString(com.example.yugm.R.string.google_web_client_id)
    val googleConfigured = googleClientId.isNotBlank() && googleClientId != "your_web_client_id_here"
    val gso = remember(context) {
        if (googleConfigured) {
            GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(googleClientId)
                .requestEmail()
                .build()
        } else {
            GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .build()
        }
    }
    val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }
    val googleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != android.app.Activity.RESULT_OK) {
            if (!googleConfigured) toast = "Google Sign-In not configured — use OTP login or set google_web_client_id in strings.xml"
            return@rememberLauncherForActivityResult
        }
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken == null || idToken.isBlank()) {
                toast = if (googleConfigured) "Google Sign-In failed — try again" else "Google Sign-In not configured — set google_web_client_id in strings.xml"
                return@rememberLauncherForActivityResult
            }
            scope.launch {
                loadingRooms = true
                runCatching {
                    val credential = GoogleAuthProvider.getCredential(idToken, null)
                    val authResult = withContext(Dispatchers.IO) {
                        Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential))
                    }
                    val tokenResult = withContext(Dispatchers.IO) {
                        Tasks.await(authResult.user?.getIdToken(false) ?: throw IllegalStateException("No authenticated user found"))
                    }
                    val fbToken = tokenResult.token ?: throw IllegalStateException("Could not retrieve Firebase token")
                    YugmApi.googleAuth(fbToken)
                }
                    .onSuccess { session ->
                        authToken = session.token
                        currentUserId = session.user.id
                        userName = session.user.name
                        username = session.user.username
                        balance = session.user.walletBalance
                        screen = AppScreen.CreateProfile
                    }
                    .onFailure { toast = it.message ?: "Google Sign-In failed" }
                loadingRooms = false
            }
        } catch (error: ApiException) {
            Log.e(TAG, "Google Sign-In failed", error)
            toast = if (googleConfigured) "Google Sign-In failed: ${error.localizedMessage}" else "Google not configured — use OTP login"
        }
    }

    // Reactive connectivity observer
    DisposableEffect(Unit) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { isOnline = true; YugmApi.isOnline = true }
            override fun onLost(network: Network) { isOnline = false; YugmApi.isOnline = false }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                val online = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                isOnline = online; YugmApi.isOnline = online
            }
        }
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        cm.registerNetworkCallback(request, callback)
        onDispose { cm.unregisterNetworkCallback(callback) }
    }

    var refreshJob by remember { mutableStateOf<Job?>(null) }

    fun refreshRooms() {
        refreshJob?.cancel()
        refreshJob = scope.launch {
            loadingRooms = true
            roomError = ""
            if (!context.isNetworkAvailable()) {
                roomError = "No internet connection"
                loadingRooms = false
                return@launch
            }
            runCatching { YugmApi.rooms() }
                .onSuccess {
                    rooms.clear()
                    rooms.addAll(it)
                }
                .onFailure { roomError = it.message ?: "Could not load live rooms" }
            loadingRooms = false
        }
    }

    fun doSearch(query: String) {
        searchQuery = query
        if (query.isBlank()) {
            searchResults = emptyList()
            searchUserResults = emptyList()
            searchError = ""
            searchLoading = false
            return
        }
        searchLoading = true
        searchError = ""
        scope.launch {
            runCatching { YugmApi.searchRooms(query) }
                .onSuccess { searchResults = it }
                .onFailure { searchError = it.message ?: "Search failed" }
            runCatching { YugmApi.searchUsers(query, authToken.ifBlank { null }) }
                .onSuccess { searchUserResults = it }
                .onFailure { if (searchError.isBlank()) searchError = it.message ?: "Search failed" }
            searchLoading = false
        }
    }

    fun loadProfile(hostId: String) {
        selectedProfileUserId = hostId
        profileLoading = true
        profileError = ""
        scope.launch {
            runCatching { YugmApi.getUser(hostId, authToken.ifBlank { null }) }
                .onSuccess {
                    profileHost = it
                    isFollowing = it.isFollowing
                }
                .onFailure { profileError = it.message ?: "Could not load profile" }
            runCatching { YugmApi.getUserRooms(hostId, authToken.ifBlank { null }) }
                .onSuccess { profileRooms = it }
                .onFailure { if (profileError.isBlank()) profileError = it.message ?: "Could not load rooms" }
            profileLoading = false
        }
    }

    fun openProfile(hostId: String) {
        selectedProfileUserId = hostId
        loadProfile(hostId)
        screen = AppScreen.Profile
    }

    fun toggleProfileFollow() {
        val host = profileHost ?: return
        if (authToken.isBlank()) {
            toast = "Login required to follow"
            return
        }
        if (host.id == currentUserId) return
        followBusy = true
        scope.launch {
            val wasFollowing = host.isFollowing
            runCatching {
                if (wasFollowing) YugmApi.unfollowUser(authToken, host.id) else YugmApi.followUser(authToken, host.id)
            }.onSuccess {
                val followers = (host.followers + if (wasFollowing) -1 else 1).coerceAtLeast(0)
                profileHost = host.copy(isFollowing = !wasFollowing, followers = followers)
                isFollowing = !wasFollowing
                toast = if (wasFollowing) "Unfollowed ${host.name}" else "Following ${host.name}"
                loadProfile(host.id)
            }.onFailure {
                toast = it.message ?: "Follow update failed"
            }
            followBusy = false
        }
    }

    fun loadChat(userId: String) {
        if (authToken.isBlank()) {
            toast = "Login required to chat"
            return
        }
        chatPartnerId = userId
        chatLoading = true
        chatError = ""
        scope.launch {
            runCatching { YugmApi.getUser(userId, authToken) }
                .onSuccess { chatPartner = it }
                .onFailure { if (chatError.isBlank()) chatError = it.message ?: "Could not load chat partner" }
            runCatching { YugmApi.conversation(authToken, userId) }
                .onSuccess {
                    directMessages = it.messages
                    relationshipStatus = it.relationship
                }
                .onFailure { chatError = it.message ?: "Could not load conversation" }
            chatLoading = false
        }
    }

    fun openChat(userId: String) {
        loadChat(userId)
        screen = AppScreen.Chat
    }

    fun loadNotifications() {
        if (authToken.isBlank()) return
        notifLoading = true
        scope.launch {
            runCatching { YugmApi.getNotifications(authToken) }
                .onSuccess {
                    notifItems = it.first
                    notifUnread = it.second
                }
                .onFailure { toast = it.message ?: "Could not load notifications" }
            notifLoading = false
        }
    }

    fun applyCosmeticCatalog(catalog: CosmeticCatalog) {
        if (catalog.cosmetics.isNotEmpty()) cosmeticsCatalog = catalog.cosmetics
        ownedCosmeticIds = catalog.ownedCosmeticIds
        activeCosmetics = catalog.activeCosmetics
        profileHost = profileHost?.let {
            if (it.id == currentUserId || currentUserId.isBlank()) it.copy(activeCosmetics = catalog.activeCosmetics) else it
        }
        rooms.indices.forEach { index ->
            val room = rooms[index]
            if (room.host?.id == currentUserId) {
                rooms[index] = room.copy(host = room.host.copy(activeCosmetics = catalog.activeCosmetics))
            }
        }
    }

    fun refreshWallet() {
        if (authToken.isBlank()) return
        walletLoading = true
        scope.launch {
            runCatching { YugmApi.walletOverview(authToken) }
                .onSuccess {
                    balance = it.balance
                    walletLevel = it.level
                    vipStatus = it.vip
                    ownedCosmeticIds = it.cosmetics.ownedCosmeticIds
                    activeCosmetics = it.cosmetics.activeCosmetics
                }
                .onFailure { toast = it.message ?: "Could not load wallet" }
            runCatching { YugmApi.walletTransactions(authToken) }
                .onSuccess { walletTransactions = it }
            runCatching { YugmApi.cosmetics(authToken) }
                .onSuccess { applyCosmeticCatalog(it) }
                .onFailure { Log.e(TAG, "Cosmetics catalog load failed", it) }
            runCatching { YugmApi.vipPlans(authToken) }
                .onSuccess {
                    vipPlans = it.first
                    vipStatus = it.second
                }
                .onFailure { Log.e(TAG, "VIP plans load failed", it) }
            runCatching { YugmApi.coinPacks(authToken) }
                .onSuccess { coinPacks = it }
                .onFailure { Log.e(TAG, "Coin packs load failed", it) }
            walletLoading = false
        }
    }

    LaunchedEffect(authToken) {
        if (authToken.isNotBlank()) {
            sessionPrefs.save(authToken, currentUserId, userName, username, balance)
            runCatching { YugmApi.walletOverview(authToken) }.onSuccess {
                balance = it.balance
                walletLevel = it.level
                vipStatus = it.vip
                ownedCosmeticIds = it.cosmetics.ownedCosmeticIds
                activeCosmetics = it.cosmetics.activeCosmetics
            }.onFailure { Log.e(TAG, "Wallet load failed", it) }
            runCatching { YugmApi.gifts(authToken) }.onSuccess {
                gifts.clear()
                gifts.addAll(it)
            }.onFailure { Log.e(TAG, "Gift catalog load failed", it) }
            runCatching { YugmApi.cosmetics(authToken) }
                .onSuccess { applyCosmeticCatalog(it) }
                .onFailure { Log.e(TAG, "Cosmetics catalog load failed", it) }
            runCatching { YugmApi.vipPlans(authToken) }
                .onSuccess {
                    vipPlans = it.first
                    vipStatus = it.second
                }
                .onFailure { Log.e(TAG, "VIP plans load failed", it) }
            runCatching { YugmApi.coinPacks(authToken) }
                .onSuccess { coinPacks = it }
                .onFailure { Log.e(TAG, "Coin packs load failed", it) }
            try {
                val fcmToken = Tasks.await(FirebaseMessaging.getInstance().token)
                if (fcmToken.isNotBlank()) {
                    scope.launch {
                        runCatching { YugmApi.registerFcmToken(authToken, fcmToken) }
                            .onFailure { Log.e(TAG, "FCM registration failed", it) }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Firebase not initialized", e)
            }
        }
    }

    val hasSession = savedToken.isNotBlank()
    val notifPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }
    LaunchedEffect(Unit) {
        if (screen != AppScreen.Splash) return@LaunchedEffect
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (!hasSession) { screen = AppScreen.Onboarding; return@LaunchedEffect }
        val job = scope.launch { refreshRooms() }
        job.join()
        screen = AppScreen.Discover
    }

    LaunchedEffect(screen) {
        when (screen) {
            AppScreen.Profile -> if (selectedProfileUserId.isNotBlank()) loadProfile(selectedProfileUserId)
            AppScreen.Notifications -> if (authToken.isNotBlank()) loadNotifications()
            AppScreen.Wallet -> if (authToken.isNotBlank()) refreshWallet()
            AppScreen.Chat -> if (chatPartnerId.isNotBlank()) loadChat(chatPartnerId)
            else -> {}
        }
    }

    val activeRoom = rooms.firstOrNull { it.id == activeRoomId }

        YugmScaffold(
            screen = screen,
            showBottomBar = screen in setOf(
                AppScreen.Discover,
                AppScreen.Voice,
                AppScreen.Video,
                AppScreen.Search,
                AppScreen.Notifications,
                AppScreen.Wallet,
                AppScreen.Profile,
                AppScreen.Settings
            ),
            toast = toast,
            isOnline = isOnline,
            onDismissToast = { toast = "" },
            onNavigate = {
                if (it == AppScreen.Profile) selectedProfileUserId = currentUserId
                screen = it
            },
            onCreate = { screen = AppScreen.CreateRoom }
        ) {
        when (screen) {
            AppScreen.Splash -> SplashScreen()
            AppScreen.Onboarding -> OnboardingScreen(onStart = { screen = AppScreen.Login })
            AppScreen.Login -> LoginScreen(
                onOtp = { identifier ->
                    scope.launch {
                        if (identifier.isBlank()) {
                            toast = "Please enter a phone number or email"
                            return@launch
                        }
                        runCatching { YugmApi.requestOtp(identifier) }
                            .onSuccess { devOtp ->
                                username = identifier
                                devOtpValue = devOtp
                                screen = AppScreen.Otp
                            }
                            .onFailure { toast = it.message ?: "OTP request failed" }
                    }
                },
                onGoogle = { googleLauncher.launch(googleSignInClient.signInIntent) },
                onPhone = { screen = AppScreen.PhoneAuth }
            )
            AppScreen.Otp -> OtpScreen(identifier = username, devOtp = devOtpValue, onVerified = { otp ->
                scope.launch {
                    runCatching { YugmApi.verifyOtp(username, otp) }
                        .onSuccess { session ->
                            authToken = session.token
                            currentUserId = session.user.id
                            userName = session.user.name
                            username = session.user.username
                            balance = session.user.walletBalance
                            screen = AppScreen.CreateProfile
                        }
                        .onFailure { toast = it.message ?: "OTP verification failed" }
                }
            })
            AppScreen.PhoneAuth -> PhoneAuthScreen(
                phoneNumber = phoneNumber,
                onPhoneChange = { phoneNumber = it },
                onSendOtp = {
                    scope.launch {
                        runCatching {
                            val auth = FirebaseAuth.getInstance()
                            val activity = context as? android.app.Activity ?: throw IllegalStateException("Cannot start phone auth from non-Activity context")
                            val options = PhoneAuthOptions.newBuilder(auth)
                                .setPhoneNumber(phoneNumber)
                                .setTimeout(60L, java.util.concurrent.TimeUnit.SECONDS)
                                .setActivity(activity)
                                .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                                    override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                                        FirebaseAuth.getInstance().signInWithCredential(credential)
                                            .addOnSuccessListener { authResult ->
                                                authResult.user?.getIdToken(false)
                                                    ?.addOnSuccessListener { tokenResult ->
                                                        scope.launch {
                                                            runCatching { YugmApi.phoneAuth(tokenResult.token ?: return@launch) }
                                                                .onSuccess { session ->
                                                                    authToken = session.token
                                                                    currentUserId = session.user.id
                                                                    userName = session.user.name
                                                                    username = session.user.username
                                                                    balance = session.user.walletBalance
                                                                    screen = AppScreen.CreateProfile
                                                                }
                                                                .onFailure { toast = it.message ?: "Phone auth failed" }
                                                        }
                                                    }
                                            }
                                    }
                                    override fun onVerificationFailed(e: com.google.firebase.FirebaseException) {
                                        Log.e(TAG, "Phone auth verification failed", e)
                                        toast = "Phone auth failed: ${e.localizedMessage}"
                                    }
                                    override fun onCodeSent(id: String, token: PhoneAuthProvider.ForceResendingToken) {
                                        phoneVerificationId = id
                                    }
                                })
                                .build()
                            PhoneAuthProvider.verifyPhoneNumber(options)
                        }.onFailure { toast = it.message ?: "Could not send OTP" }
                    }
                },
                otp = phoneOtp,
                onOtpChange = { phoneOtp = it },
                onVerify = {
                    scope.launch {
                        if (phoneVerificationId.isBlank()) { toast = "Request OTP first"; return@launch }
                        runCatching {
                            val credential = PhoneAuthProvider.getCredential(phoneVerificationId, phoneOtp)
                            val authResult = withContext(Dispatchers.IO) {
                                Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential))
                            }
                            val tokenResult = withContext(Dispatchers.IO) {
                                Tasks.await(authResult.user?.getIdToken(false) ?: throw IllegalStateException("No authenticated user found"))
                            }
                            val fbToken = tokenResult.token ?: throw IllegalStateException("Could not retrieve Firebase token")
                            YugmApi.phoneAuth(fbToken)
                        }.onSuccess { session ->
                            authToken = session.token
                            currentUserId = session.user.id
                            userName = session.user.name
                            username = session.user.username
                            balance = session.user.walletBalance
                            screen = AppScreen.CreateProfile
                        }.onFailure { toast = it.message ?: "Phone verification failed" }
                    }
                },
                verificationId = phoneVerificationId,
                onBack = { screen = AppScreen.Login },
                toast = { toast = it }
            )
            AppScreen.CreateProfile -> CreateProfileScreen(
                initialName = userName,
                initialUsername = username,
                onDone = { name, handle ->
                    scope.launch {
                        if (authToken.isNotBlank()) {
                            runCatching { YugmApi.updateProfile(authToken, name, handle) }
                                .onSuccess {
                                    userName = it.name
                                    username = it.username
                                    currentUserId = it.id
                                }
                                .onFailure { toast = it.message ?: "Profile saved locally only" }
                        } else {
                            userName = name
                            username = handle
                        }
                        refreshRooms()
                        screen = AppScreen.Discover
                    }
                }
            )
            AppScreen.Discover -> DiscoverScreen(
                onOpenRoom = {
                    activeRoomId = it.id
                    screen = if (it.type == RoomType.Voice) AppScreen.ActiveVoice else AppScreen.ActiveVideo
                },
                onSearch = { screen = AppScreen.Search }
            )
            AppScreen.Voice -> RoomListScreen(
                title = "Voice rooms",
                subtitle = "Live mics, speaker seats and fast-moving chat.",
                rooms = rooms.filter { it.type == RoomType.Voice },
                onOpenRoom = {
                    activeRoomId = it.id
                    screen = AppScreen.ActiveVoice
                }
            )
            AppScreen.Video -> RoomListScreen(
                title = "Video rooms",
                subtitle = "Creator tables with audience mode and camera controls.",
                rooms = rooms.filter { it.type == RoomType.Video },
                onOpenRoom = {
                    activeRoomId = it.id
                    screen = AppScreen.ActiveVideo
                }
            )
            AppScreen.Search -> SearchScreen(
                onBack = { screen = AppScreen.Discover },
                onOpenRoom = {
                    activeRoomId = it.id
                    screen = if (it.type == RoomType.Voice) AppScreen.ActiveVoice else AppScreen.ActiveVideo
                },
                onOpenProfile = { openProfile(it) }
            )
            AppScreen.Notifications -> NotificationsScreen(
                notifications = notifItems,
                loading = notifLoading,
                onRefresh = { loadNotifications() }
            )
            AppScreen.Wallet -> WalletScreen(
                balance = balance,
                transactions = walletTransactions
            )
            AppScreen.Profile -> ProfileScreen(
                host = profileHost,
                isOwnProfile = selectedProfileUserId == currentUserId || selectedProfileUserId.isBlank(),
                followBusy = followBusy,
                onFollowToggle = { toggleProfileFollow() },
                onSettings = { screen = AppScreen.Settings }
            )
            AppScreen.Chat -> ChatScreen(
                partner = chatPartner,
                currentUserId = currentUserId,
                messages = directMessages,
                relationship = relationshipStatus,
                gifts = gifts,
                balance = balance,
                loading = chatLoading,
                error = chatError,
                onBack = { screen = AppScreen.Profile },
                onRetry = { if (chatPartnerId.isNotBlank()) loadChat(chatPartnerId) },
                onSend = { message ->
                    scope.launch {
                        runCatching { YugmApi.sendDirectMessage(authToken, chatPartnerId, message) }
                            .onSuccess {
                                directMessages = directMessages + it.messages
                                relationshipStatus = it.relationship ?: relationshipStatus
                                loadChat(chatPartnerId)
                            }
                            .onFailure { toast = it.message ?: "Message failed" }
                    }
                },
                onGift = { gift ->
                    scope.launch {
                        runCatching { YugmApi.sendDirectGift(authToken, gift.id, chatPartnerId) }
                            .onSuccess {
                                directMessages = directMessages + it.messages
                                relationshipStatus = it.relationship ?: relationshipStatus
                                refreshWallet()
                                loadChat(chatPartnerId)
                                toast = "Gift sent"
                            }
                            .onFailure { toast = it.message ?: "Gift failed" }
                    }
                }
            )
            AppScreen.Settings -> SettingsScreen(onLogout = {
                confirmDialog = ConfirmData(
                    title = "Log out",
                    message = "Are you sure you want to log out? You'll need to log in again.",
                    confirmLabel = "Log out",
                    action = {
                        sessionPrefs.clear()
                        authToken = ""
                        currentUserId = ""
                        userName = ""
                        username = ""
                        balance = 0
                        screen = AppScreen.Onboarding
                    }
                )
            })
            AppScreen.CreateRoom -> CreateRoomScreen(
                host = Host(id = currentUserId, name = userName, username = username, city = "India", vibe = "Fresh host", followers = 0, activeCosmetics = activeCosmetics),
                onBack = { screen = AppScreen.Discover },
                onCreate = { room ->
                    scope.launch {
                        if (authToken.isBlank()) {
                            toast = "Login required to create a room"
                            screen = AppScreen.Login
                            return@launch
                        }
                        runCatching { YugmApi.createRoom(authToken, room) }
                            .onSuccess { created ->
                                rooms.add(0, created)
                                activeRoomId = created.id
                                screen = if (created.type == RoomType.Voice) AppScreen.ActiveVoice else AppScreen.ActiveVideo
                                toast = "Room is live!"
                            }
                            .onFailure { toast = it.message ?: "Room creation failed" }
                    }
                }
            )
            AppScreen.ActiveVoice -> activeRoom?.let { room ->
                val currentRoomId = room.id
                val isHost = authToken.isNotBlank() && room.host?.id == currentUserId
                ActiveVoiceRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = balance,
                    isHost = isHost,
                    onBack = {
                        YugmMediaRoom.disconnect()
                        YugmSocket.disconnect()
                        if (authToken.isNotBlank()) scope.launch { runCatching { YugmApi.leaveRoom(authToken, room.id) } }
                        screen = AppScreen.Discover
                    },
                    onSendMessage = { message ->
                        scope.launch {
                            runCatching {
                                if (authToken.isBlank()) error("Login required")
                                YugmApi.sendMessage(authToken, room.id, message)
                            }.onSuccess {
                                chat.add(ChatMessage(username, message))
                            }.onFailure { toast = it.message ?: "Message failed" }
                        }
                    },
                    onGift = { gift ->
                        scope.launch {
                            val hostId = room.host?.id ?: return@launch
                            val hostName = room.host?.name ?: ""
                            runCatching {
                                if (authToken.isBlank()) error("Login required")
                                YugmApi.sendGift(authToken, room.id, gift, hostId)
                            }.onSuccess {
                                if (balance >= gift.price) balance -= gift.price
                                chat.add(ChatMessage("System", "${gift.name} sent to $hostName"))
                                toast = "${gift.name} sent"
                            }.onFailure { toast = it.message ?: "Gift failed" }
                        }
                    },
                    onToast = { toast = it },
                    onJoin = {
                        if (authToken.isNotBlank()) scope.launch {
                            runCatching { YugmApi.joinRoom(authToken, room.id) }
                                .onFailure { toast = it.message ?: "Join failed" }
                            runCatching { YugmApi.liveKitToken(authToken, room.id) }
                                .onSuccess { session ->
                                    YugmMediaRoom.connect(session.token, session.url)
                                }
                                .onFailure { toast = it.message ?: "LiveKit failed" }
                        }
                        scope.launch {
                            runCatching {
                                YugmApi.roomMessages(room.id, authToken.ifBlank { null })
                            }.onSuccess { msgs ->
                                if (activeRoomId == currentRoomId) {
                                    chat.clear()
                                    chat.addAll(msgs)
                                }
                            }
                        }
                        YugmSocket.connect(authToken, room.id) { name, text ->
                            scope.launch { chat.add(ChatMessage(name, text)) }
                        }
                    },
                    onRequestSpeaker = {
                        scope.launch {
                            runCatching { YugmApi.requestSpeaker(authToken, room.id) }
                                .onSuccess { toast = "Speaker request sent" }
                                .onFailure { toast = it.message ?: "Request failed" }
                        }
                    },
                    onEndRoom = {
                        confirmDialog = ConfirmData(
                            title = "End room",
                            message = "This will disconnect all participants and end the session.",
                            confirmLabel = "End room",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.endRoom(room.id, authToken) }
                                        .onSuccess { toast = "Room ended"; screen = AppScreen.Discover }
                                        .onFailure { toast = it.message ?: "Failed to end room" }
                                }
                            }
                        )
                    },
                    onMuteUser = { userId ->
                        scope.launch {
                            runCatching { YugmApi.muteUser(room.id, userId, authToken) }
                                .onSuccess { toast = "User muted" }
                                .onFailure { toast = it.message ?: "Failed to mute" }
                        }
                    },
                    onRemoveUser = { userId ->
                        confirmDialog = ConfirmData(
                            title = "Remove participant",
                            message = "Remove this participant from the room? They won't be able to rejoin.",
                            confirmLabel = "Remove",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.removeUser(room.id, userId, authToken) }
                                        .onSuccess { toast = "User removed" }
                                        .onFailure { toast = it.message ?: "Failed to remove" }
                                }
                            }
                        )
                    },
                    onReportUser = { targetUserId ->
                        confirmDialog = ConfirmData(
                            title = "Report user",
                            message = "Report this user for inappropriate behavior?",
                            confirmLabel = "Report",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.reportUser(authToken, room.id, targetUserId, "Inappropriate behavior") }
                                        .onSuccess { toast = "Report submitted" }
                                        .onFailure { toast = it.message ?: "Report failed" }
                                }
                            }
                        )
                    }
                )
            } ?: EmptyRoomsScreen(message = "No active room selected", onAction = { screen = AppScreen.Discover }, action = "Back to Discover")
            AppScreen.ActiveVideo -> activeRoom?.let { room ->
                val currentRoomId = room.id
                val isHost = authToken.isNotBlank() && room.host?.id == currentUserId
                ActiveVideoRoomScreen(
                    room = room,
                    chat = chat,
                    gifts = gifts,
                    balance = balance,
                    isHost = isHost,
                    onBack = {
                        YugmMediaRoom.disconnect()
                        YugmSocket.disconnect()
                        if (authToken.isNotBlank()) scope.launch { runCatching { YugmApi.leaveRoom(authToken, room.id) } }
                        screen = AppScreen.Discover
                    },
                    onSendMessage = { message ->
                        scope.launch {
                            runCatching {
                                if (authToken.isBlank()) error("Login required")
                                YugmApi.sendMessage(authToken, room.id, message)
                            }.onSuccess {
                                chat.add(ChatMessage(username, message))
                            }.onFailure { toast = it.message ?: "Message failed" }
                        }
                    },
                    onGift = { gift ->
                        scope.launch {
                            val hostId = room.host?.id ?: return@launch
                            val hostName = room.host?.name ?: ""
                            runCatching {
                                if (authToken.isBlank()) error("Login required")
                                YugmApi.sendGift(authToken, room.id, gift, hostId)
                            }.onSuccess {
                                if (balance >= gift.price) balance -= gift.price
                                chat.add(ChatMessage("System", "${gift.name} sent to $hostName"))
                                toast = "${gift.name} sent"
                            }.onFailure { toast = it.message ?: "Gift failed" }
                        }
                    },
                    onToast = { toast = it },
                    onJoin = {
                        if (authToken.isNotBlank()) scope.launch {
                            runCatching { YugmApi.joinRoom(authToken, room.id) }
                                .onFailure { toast = it.message ?: "Join failed" }
                            runCatching { YugmApi.liveKitToken(authToken, room.id) }
                                .onSuccess { session ->
                                    YugmMediaRoom.connect(session.token, session.url)
                                }
                                .onFailure { toast = it.message ?: "LiveKit failed" }
                        }
                        scope.launch {
                            runCatching {
                                YugmApi.roomMessages(room.id, authToken.ifBlank { null })
                            }.onSuccess { msgs ->
                                if (activeRoomId == currentRoomId) {
                                    chat.clear()
                                    chat.addAll(msgs)
                                }
                            }
                        }
                        YugmSocket.connect(authToken, room.id) { name, text ->
                            scope.launch { chat.add(ChatMessage(name, text)) }
                        }
                    },
                    onEndRoom = {
                        confirmDialog = ConfirmData(
                            title = "End room",
                            message = "This will disconnect all participants and end the session.",
                            confirmLabel = "End room",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.endRoom(room.id, authToken) }
                                        .onSuccess { toast = "Room ended"; screen = AppScreen.Discover }
                                        .onFailure { toast = it.message ?: "Failed to end room" }
                                }
                            }
                        )
                    },
                    onMuteUser = { userId ->
                        scope.launch {
                            runCatching { YugmApi.muteUser(room.id, userId, authToken) }
                                .onSuccess { toast = "User muted" }
                                .onFailure { toast = it.message ?: "Failed to mute" }
                        }
                    },
                    onRemoveUser = { userId ->
                        confirmDialog = ConfirmData(
                            title = "Remove participant",
                            message = "Remove this participant from the room? They won't be able to rejoin.",
                            confirmLabel = "Remove",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.removeUser(room.id, userId, authToken) }
                                        .onSuccess { toast = "User removed" }
                                        .onFailure { toast = it.message ?: "Failed to remove" }
                                }
                            }
                        )
                    },
                    onReportUser = { targetUserId ->
                        confirmDialog = ConfirmData(
                            title = "Report user",
                            message = "Report this user for inappropriate behavior?",
                            confirmLabel = "Report",
                            action = {
                                scope.launch {
                                    runCatching { YugmApi.reportUser(authToken, room.id, targetUserId, "Inappropriate behavior") }
                                        .onSuccess { toast = "Report submitted" }
                                        .onFailure { toast = it.message ?: "Report failed" }
                                }
                            }
                        )
                    }
                )
            } ?: EmptyRoomsScreen(message = "No active room selected", onAction = { screen = AppScreen.Discover }, action = "Back to Discover")
        }
    }

    confirmDialog?.let { data ->
        ConfirmDialog(
            title = data.title,
            message = data.message,
            confirmLabel = data.confirmLabel,
            isDestructive = data.isDestructive,
            onConfirm = { data.action(); confirmDialog = null },
            onDismiss = { confirmDialog = null }
        )
    }
}

@Composable
fun YugmScaffold(
    screen: AppScreen,
    showBottomBar: Boolean,
    toast: String,
    isOnline: Boolean,
    onDismissToast: () -> Unit,
    onNavigate: (AppScreen) -> Unit,
    onCreate: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Ink, Color(0xFF080A19), Color(0xFF101028))))
            .statusBarsPadding()
    ) {
        content()
        if (showBottomBar) {
            BottomNavigation(
                current = screen,
                onNavigate = onNavigate,
                onCreate = onCreate,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
        AnimatedVisibility(
            visible = !isOnline,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(8.dp)
        ) {
            Surface(
                color = Danger,
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, Color(0xFFFF6666))
            ) {
                Text("No internet connection", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
        }
        AnimatedVisibility(
            visible = toast.isNotBlank(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = if (!isOnline) 44.dp else 18.dp)
        ) {
            Surface(
                color = Color(0xFF151A32),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, Line),
                modifier = Modifier.clickable { onDismissToast() }
            ) {
                Text(toast, color = TextPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
    }
}

@Composable
fun SplashScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Ink, Color(0xFF080A19), Color(0xFF101028)))),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Saffron, Pink, Purple))),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Canvas(Modifier.fillMaxSize().padding(16.dp)) {
                    val stroke = androidx.compose.ui.graphics.drawscope.Stroke(width = 5.dp.toPx())
                    drawLine(Color.White, androidx.compose.ui.geometry.Offset(size.width * 0.1f, size.height * 0.08f), androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.52f), strokeWidth = stroke.width)
                    drawLine(Color.White, androidx.compose.ui.geometry.Offset(size.width * 0.9f, size.height * 0.08f), androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.52f), strokeWidth = stroke.width)
                    drawLine(Color.White, androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.52f), androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.95f), strokeWidth = stroke.width)
                }
            }
            Spacer(Modifier.height(20.dp))
            Text("Yugm", color = TextPrimary, fontSize = 40.sp, fontWeight = FontWeight.Black)
            Text("Match the vibe.", color = Gold, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
    }
}

@Composable
fun OnboardingScreen(onStart: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        BrandHeader()
        Column {
            Text(
                text = "Find the rooms that match your mood tonight.",
                color = TextPrimary,
                fontSize = 40.sp,
                lineHeight = 44.sp,
                fontWeight = FontWeight.Black
            )
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Voice lounges, creator video tables, gifts, reactions and live discovery for Indian Gen Z.",
                color = TextMuted,
                fontSize = 16.sp,
                lineHeight = 24.sp
            )
            Spacer(Modifier.height(24.dp))
            FeatureRow(title = "Voice rooms", detail = "Host, speak or listen")
            FeatureRow(title = "Video tables", detail = "Camera seats and audience mode")
            FeatureRow(title = "Wallet and gifts", detail = "Ledger based coin flows")
        }
        PrimaryButton(text = "Start matching the vibe", onClick = onStart)
    }
}

@Composable
fun LoginScreen(onOtp: (String) -> Unit, onGoogle: () -> Unit, onPhone: () -> Unit) {
    var identifier by rememberSaveable { mutableStateOf("") }
    AuthShell(title = "Login to live rooms", subtitle = "Use email, phone, or Google.") {
        YugmTextField(value = identifier, onValueChange = { identifier = it }, label = "Phone or email")
        Spacer(Modifier.height(12.dp))
        PrimaryButton(text = "Send OTP", onClick = { onOtp(identifier) })
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(
                onClick = onGoogle,
                border = BorderStroke(1.dp, Line),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.weight(1f)
            ) { Text("Google", color = TextPrimary, fontWeight = FontWeight.Bold) }
            OutlinedButton(
                onClick = onPhone,
                border = BorderStroke(1.dp, Line),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.weight(1f)
            ) { Text("Phone", color = TextPrimary, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
fun OtpScreen(identifier: String, devOtp: String?, onVerified: (String) -> Unit) {
    val hint = if (devOtp != null) "Dev OTP: $devOtp" else ""
    var otp by rememberSaveable { mutableStateOf("") }
    AuthShell(title = "Verify OTP", subtitle = "Code sent to $identifier.") {
        if (devOtp != null) {
            Text(hint, color = TextMuted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp))
        }
        YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
        Spacer(Modifier.height(18.dp))
        PrimaryButton(text = "Verify and continue", onClick = { onVerified(otp) })
    }
}

@Composable
fun CreateProfileScreen(initialName: String, initialUsername: String, onDone: (String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var handle by rememberSaveable { mutableStateOf(initialUsername) }
    var city by rememberSaveable { mutableStateOf("") }
    var bio by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            BrandHeader(compact = true)
            Spacer(Modifier.height(24.dp))
            Text("Create your vibe card", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("No matrimonial energy. Just identity, city, language and interests.", color = TextMuted, modifier = Modifier.padding(top = 8.dp, bottom = 12.dp))
        }
        item { YugmTextField(name, { name = it }, "Name") }
        item { YugmTextField(handle, { handle = it }, "Username") }
        item { YugmTextField(city, { city = it }, "City") }
        item { YugmTextField(bio, { bio = it }, "Bio", minLines = 3) }
        item { ChipWrap(listOf("Hindi", "English", "Music", "Gaming", "Chill", "Friends")) }
        item { PrimaryButton("Enter Yugm") { onDone(name.ifBlank { "Yugm User" }, handle.ifBlank { "vibe_user" }) } }
    }
}

@Composable
fun RoomListScreen(title: String, subtitle: String, rooms: List<Room>, onOpenRoom: (Room) -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Text(title, color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = TextMuted, modifier = Modifier.padding(top = 6.dp, bottom = 10.dp))
        }
        items(rooms, key = { it.id }) { room -> RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) }) }
    }
}

@Composable
fun NotificationsScreen(
    notifications: List<com.example.yugm.model.NotificationItem> = emptyList(),
    loading: Boolean = false,
    onRefresh: () -> Unit = {}
) {
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Notifications", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("Speaker approvals, new followers, gifts and safety updates.", color = TextMuted, modifier = Modifier.padding(top = 8.dp))
        }
        if (loading) {
            item { LoadingState("Loading notifications...") }
        }
        if (!loading && notifications.isEmpty()) {
            item {
                GlassCard {
                    Text("No notifications yet", color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text("Follow activity, speaker invites, gifts and moderation updates will appear here.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        items(notifications, key = { it.id.ifBlank { it.createdAt + it.type + it.actorName } }) { item ->
            GlassCard {
                Text(item.message, color = TextPrimary, fontWeight = FontWeight.Bold)
                Text(item.actorName, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

@Composable
fun SettingsScreen(onLogout: () -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Settings", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("Privacy, moderation, language and live-room controls.", color = TextMuted, modifier = Modifier.padding(top = 8.dp, bottom = 10.dp))
        }
        item { SettingsRow("Privacy and blocked users", "Manage reports and blocks") }
        item { SettingsRow("Language preference", "Hindi, English") }
        item { SettingsRow("Notifications", "Follows, gifts and room invites") }
        item {
            OutlinedButton(onClick = onLogout, border = BorderStroke(1.dp, Danger), shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                Text("Log out", color = Danger, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun PhoneAuthScreen(
    phoneNumber: String,
    onPhoneChange: (String) -> Unit,
    onSendOtp: () -> Unit,
    otp: String,
    onOtpChange: (String) -> Unit,
    onVerify: () -> Unit,
    verificationId: String,
    onBack: () -> Unit,
    toast: (String) -> Unit
) {
    AuthShell(
        title = if (verificationId.isBlank()) "Enter phone number" else "Verify OTP",
        subtitle = if (verificationId.isBlank()) "You will receive a one-time code via SMS." else "Code sent to $phoneNumber"
    ) {
        if (verificationId.isBlank()) {
            YugmTextField(value = phoneNumber, onValueChange = onPhoneChange, label = "+911234567890")
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Send code", onClick = onSendOtp)
        } else {
            YugmTextField(value = otp, onValueChange = onOtpChange, label = "OTP")
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Verify", onClick = onVerify)
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
    }
}

@Composable
fun CreateRoomScreen(host: Host, onBack: () -> Unit, onCreate: (Room) -> Unit) {
    var type by rememberSaveable { mutableStateOf(RoomType.Voice) }
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var language by rememberSaveable { mutableStateOf("Hindi") }
    var category by rememberSaveable { mutableStateOf("Chill") }
    var maxSpeakers by rememberSaveable { mutableStateOf("6") }
    var micRequests by rememberSaveable { mutableStateOf(true) }
    var publicRoom by rememberSaveable { mutableStateOf(true) }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Create room", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
                TextButton(onClick = onBack) { Text("Close", color = TextMuted) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                SegmentButton("Voice", type == RoomType.Voice, Modifier.weight(1f)) { type = RoomType.Voice }
                SegmentButton("Video", type == RoomType.Video, Modifier.weight(1f)) { type = RoomType.Video }
            }
        }
        item { YugmTextField(title, { title = it }, "Title") }
        item { YugmTextField(description, { description = it }, "Description", minLines = 3) }
        item { YugmTextField(language, { language = it }, "Language") }
        item { YugmTextField(category, { category = it }, "Category") }
        item { YugmTextField(maxSpeakers, { maxSpeakers = it }, "Max speakers", KeyboardType.Number) }
        item { ToggleRow("Public room", publicRoom) { publicRoom = it } }
        item { ToggleRow("Audience mic requests", micRequests) { micRequests = it } }
        item {
            GlassCard {
                Text("NSFW is disabled for the MVP.", color = Danger, fontWeight = FontWeight.Bold)
            }
        }
        item {
            PrimaryButton("Go live") {
                onCreate(
                    Room(
                        id = "",
                        title = title.ifBlank { "Untitled live room" },
                        description = description,
                        type = type,
                        host = host,
                        category = category,
                        language = language,
                        tags = listOf(category.lowercase(), "new", if (publicRoom) "public" else "private"),
                        participants = 1,
                        maxSpeakers = maxSpeakers.toIntOrNull()?.coerceIn(1, 12) ?: 6,
                        gradient = listOf(Color(0xFF151A32), Purple, Pink)
                    )
                )
            }
        }
    }
}

@Composable
fun BottomNavigation(current: AppScreen, onNavigate: (AppScreen) -> Unit, onCreate: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Ink2)
            .navigationBarsPadding()
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceAround
    ) {
        NavItem("Discover", current == AppScreen.Discover) { onNavigate(AppScreen.Discover) }
        NavItem("Voice", current == AppScreen.Voice) { onNavigate(AppScreen.Voice) }
        NavItem("Video", current == AppScreen.Video) { onNavigate(AppScreen.Video) }
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Saffron, Pink, Purple)))
                .clickable(onClick = onCreate),
            contentAlignment = Alignment.Center
        ) {
            Text("+", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
        }
        NavItem("Wallet", current == AppScreen.Wallet) { onNavigate(AppScreen.Wallet) }
        NavItem("Profile", current == AppScreen.Profile) { onNavigate(AppScreen.Profile) }
    }
}

@Composable
fun NavItem(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text = label,
        color = if (selected) Gold else TextMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 10.dp)
    )
}

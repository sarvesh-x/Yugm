package com.yugm.app.feature.settings.screens

import com.yugm.app.core.api.resolveMediaUrl

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.api.YugmApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.content.Intent
import android.net.Uri
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.feature.settings.viewmodel.SettingsViewModel

private enum class SettingsPane { Home, Blocked, Notifications, Feedback, About, Terms, Privacy, Guidelines, Appearance }

// Theme-aware palette is read via LocalYugmColors inside composables.

private val docs = mapOf(
    SettingsPane.About to "Yugm is a social voice, video, chat, dating, and community app built around live connection, private conversations, creator growth, gifts, and families.",
    SettingsPane.Terms to "Use Yugm respectfully. Do not harass, impersonate, exploit payment systems, share illegal content, or attempt to bypass safety controls. Accounts may be restricted when platform rules are violated.",
    SettingsPane.Privacy to "Yugm uses profile, room, chat, wallet, safety, and device data to run the service, protect users, process purchases, personalize recommendations, and respond to support requests.",
    SettingsPane.Guidelines to "Keep rooms and chats respectful. No hateful conduct, explicit abuse, spam, fake accounts, threats, or attempts to move unsafe activity off-platform. Report anything that feels wrong."
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    token: String,
    userName: String,
    username: String,
    onLogout: () -> Unit,
    onBack: () -> Unit,
    onNavigateToSafety: () -> Unit,
    onNavigateToSupport: () -> Unit = {},
    onNavigateToProfileSetup: () -> Unit,
    onNavigateToGames: () -> Unit,
    onNavigateToClans: () -> Unit = {},
    onNavigateToTrustVerification: () -> Unit
) {
    var pane by remember { mutableStateOf(SettingsPane.Home) }
    var preferences by remember { mutableStateOf(defaultNotificationPreferences()) }
    var preferencesLoaded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var feedbackSubject by remember { mutableStateOf("") }
    var feedbackMessage by remember { mutableStateOf("") }
    var showLogoutConfirm by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deletePhrase by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val viewModel: SettingsViewModel = hiltViewModel()
    val context = LocalContext.current
    val appVersion = remember {
        runCatching {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val code = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
            "v${info.versionName ?: "1.0"} ($code)"
        }.getOrDefault("v1.0")
    }
    val scope = rememberCoroutineScope()
    fun openLegalPage(path: String) {
        runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(resolveMediaUrl("/legal/$path"))))
        }.onFailure { error = "Could not open the Yugm legal page." }
    }

    fun unblock(userId: String) {
        busy = true
        error = null
        viewModel.unblock(token, userId) { result ->
            busy = false
            result.onFailure { error = it.message ?: "Could not unblock this user." }
        }
    }

    com.yugm.app.core.ui.components.AutomaticSyncEffect(token, token, topics = setOf(com.yugm.app.core.api.SyncTopic.SETTINGS), enabled = token.isNotBlank()) {
        if (token.isNotBlank()) {
            viewModel.loadBlocked(token)
            runCatching { withContext(Dispatchers.IO) { YugmApi.notificationPreferences(token) } }
                .onSuccess { preferences = it.values; preferencesLoaded = true }
                .onFailure { error = it.message ?: "Could not load notification preferences."; preferencesLoaded = true }
        }
    }

    fun updateNotificationPreference(key: String, value: Boolean) {
        val previous = preferences
        preferences = previous + (key to value)
        scope.launch {
            busy = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { YugmApi.updateNotificationPreferences(token, mapOf(key to value)) }
            }.onSuccess { preferences = it.values }
                .onFailure {
                    preferences = previous
                    error = it.message ?: "Could not save notification preferences."
                }
            busy = false
        }
    }

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(LocalYugmColors.current.background))
        Scaffold(
            topBar = {
                if (pane == SettingsPane.About) {
                    CenterAlignedTopAppBar(
                        title = { Text("About", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) },
                        navigationIcon = {
                            TextButton(onClick = { pane = SettingsPane.Home }) {
                                Box(Modifier.size(42.dp).clip(CircleShape).background(LocalYugmColors.current.surface), contentAlignment = Alignment.Center) {
                                    Text("←", color = LocalYugmColors.current.textPrimary, fontSize = 24.sp)
                                }
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = LocalYugmColors.current.background)
                    )
                } else TopAppBar(
                    title = { Text(paneTitle(pane), color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black) },
                    navigationIcon = {
                        TextButton(onClick = { if (pane == SettingsPane.Home) onBack() else pane = SettingsPane.Home }) {
                            Text("Back", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = LocalYugmColors.current.background)
                )
            },
            containerColor = LocalYugmColors.current.background
        ) { innerPadding ->
        if (viewModel.isLoading && pane == SettingsPane.Home) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Loading settings...")
            }
        } else {
            when (pane) {
        SettingsPane.Home -> SettingsHome(
                    modifier = Modifier.padding(innerPadding),
                    userName = userName,
                    username = username,
                    blockedCount = viewModel.blockedUsers.size,
                    error = error,
                    onProfile = onNavigateToProfileSetup,
                    onGames = onNavigateToGames,
                    onClans = onNavigateToClans,
                    onTrustVerification = onNavigateToTrustVerification,
                    onSafety = onNavigateToSafety,
                    onBlocked = { pane = SettingsPane.Blocked },
                    onNotifications = { pane = SettingsPane.Notifications },
                    onAppearance = { pane = SettingsPane.Appearance },
                    themeMode = viewModel.themeMode,
                    onFeedback = { pane = SettingsPane.Feedback },
                    onDoc = { pane = it },
                    onOpenPrivacy = { openLegalPage("privacy") },
                    onOpenChildSafety = { openLegalPage("child-safety") },
                    onOpenTerms = { openLegalPage("terms") },
                    onDeleteAccount = { showDeleteConfirm = true },
                    onNavigateToSupport = onNavigateToSupport,
                    onLogout = { showLogoutConfirm = true }
                )
                SettingsPane.Blocked -> BlockedPane(Modifier.padding(innerPadding), viewModel.blockedUsers, busy || viewModel.isLoading, viewModel.error, onUnblock = { unblock(it) })
                SettingsPane.Notifications -> NotificationsPane(
                    Modifier.padding(innerPadding), preferences, busy, !preferencesLoaded,
                    error = error,
                    onToggle = ::updateNotificationPreference
                )
                SettingsPane.Appearance -> AppearancePane(Modifier.padding(innerPadding), viewModel.themeMode, onModeSelected = { viewModel.updateThemeMode(it) })
                SettingsPane.Feedback -> FeedbackPane(
                    modifier = Modifier.padding(innerPadding),
                    subject = feedbackSubject,
                    message = feedbackMessage,
                    busy = busy,
                    error = error,
                    onSubjectChange = { feedbackSubject = it },
                    onMessageChange = { feedbackMessage = it },
                    onSubmit = {
                        scope.launch {
                            busy = true
                            error = null
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    YugmApi.sendFeedback(token, feedbackSubject.trim(), feedbackMessage.trim(), "OTHER")
                                }
                            }.onSuccess {
                                feedbackSubject = ""
                                feedbackMessage = ""
                                pane = SettingsPane.Home
                                android.widget.Toast.makeText(context, "Feedback sent. Thank you!", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { error = it.message ?: "Could not send feedback. Please try again." }
                            busy = false
                        }
                    }
                )
                SettingsPane.About -> AboutPane(
                    modifier = Modifier.padding(innerPadding),
                    version = appVersion,
                    onPrivacy = { openLegalPage("privacy") },
                    onTerms = { openLegalPage("terms") }
                )
                SettingsPane.Terms, SettingsPane.Privacy, SettingsPane.Guidelines -> DocumentPane(Modifier.padding(innerPadding), pane)
            }
        }
    }

    }
    if (showLogoutConfirm) {
        ConfirmDialog(
            title = "Log out",
            message = "Are you sure you want to log out of Yugm?",
            confirmLabel = "Log out",
            onConfirm = {
                showLogoutConfirm = false
                onLogout()
            },
            onDismiss = { showLogoutConfirm = false }
        )
    }
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { if (!busy) showDeleteConfirm = false },
            title = { Text("Delete your account?", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Your account will be scheduled for deletion. Signing in again within 30 days cancels the request.", color = LocalYugmColors.current.textSecondary)
                    OutlinedTextField(value = deletePhrase, onValueChange = { deletePhrase = it }, label = { Text("Type DELETE") }, singleLine = true)
                    if (!error.isNullOrBlank()) Text(error.orEmpty(), color = Danger)
                }
            },
            confirmButton = {
                TextButton(enabled = !busy && deletePhrase == "DELETE", onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        runCatching { withContext(Dispatchers.IO) { YugmApi.deleteOwnAccount(token) } }
                            .onSuccess { showDeleteConfirm = false; onLogout() }
                            .onFailure { error = it.message ?: "Could not request account deletion." }
                        busy = false
                    }
                }) { Text(if (busy) "Submitting…" else "Delete account", color = Danger) }
            },
            dismissButton = { TextButton(enabled = !busy, onClick = { showDeleteConfirm = false }) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
        )
    }
}

@Composable
private fun SettingsHome(
    modifier: Modifier,
    userName: String,
    username: String,
    blockedCount: Int,
    error: String?,
    onProfile: () -> Unit,
    onGames: () -> Unit,
    onClans: () -> Unit = {},
    onTrustVerification: () -> Unit,
    onSafety: () -> Unit,
    onBlocked: () -> Unit,
    onNotifications: () -> Unit,
    onAppearance: () -> Unit = {},
    themeMode: String = "SYSTEM",
    onFeedback: () -> Unit,
    onDoc: (SettingsPane) -> Unit,
    onOpenPrivacy: () -> Unit,
    onOpenChildSafety: () -> Unit,
    onOpenTerms: () -> Unit,
    onDeleteAccount: () -> Unit,
    onNavigateToSupport: () -> Unit = {},
    onLogout: () -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            AnimatedEntrance(delay = 100) {
                WhiteCard(modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(userName.firstOrNull()?.toString() ?: "Y", 52)
                    Column(Modifier.weight(1f)) {
                        Text(userName.ifBlank { "Yugm User" }, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Text("@${username.ifBlank { "yugm" }}", color = LocalYugmColors.current.textPrimary.copy(alpha = 0.74f), fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(onClick = onProfile, border = BorderStroke(1.dp, Color.White.copy(alpha = 0.5f)), shape = RoundedCornerShape(8.dp)) {
                        Text("Edit", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
            }
            if (!error.isNullOrBlank()) {
                Text(error, color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
            }
        }
        item {
            AnimatedEntrance(delay = 200) {
                SettingsGroup("Account") {
                    SettingsNavRow("Yugm Trust Verification", "Verify your face and voice to show people you're real.", onTrustVerification)
                    SettingsNavRow("Yugm Arcade", "New games coming soon.", onGames)
                    SettingsNavRow("Yugm Clans", "Create or join a clan and chat with your family.", onClans)
                    SettingsNavRow("Notification settings", "Control messages, rooms, gifts, safety, and updates.", onNotifications)
                    SettingsNavRow("Appearance", "Choose light, dark, or system theme. Current: ${themeModeLabel(themeMode)}", onAppearance)
                    SettingsNavRow("Delete account", "Request deletion of your account and associated data.", onDeleteAccount)
                }
            }
        }
        item {
            AnimatedEntrance(delay = 300) {
                SettingsGroup("Privacy & Safety") {
                    SettingsNavRow("Blocked list", "$blockedCount people blocked.", onBlocked)
                    SettingsNavRow("Safety center", "Reports, trust checks, and privacy actions.", onSafety)
                    SettingsNavRow("Child safety standards", "Yugm’s adult-only policy and child-safety reporting.", onOpenChildSafety)
                    SettingsNavRow("Community guidelines", "Read the rules for rooms, chats, and profiles.") { onDoc(SettingsPane.Guidelines) }
                    SettingsNavRow("Privacy policy", "How Yugm uses data to run and protect the service.", onOpenPrivacy)
                }
            }
        }
        item {
            AnimatedEntrance(delay = 400) {
                SettingsGroup("Help & Legal") {
                    SettingsNavRow("Help and feedback", "Send a support note using the backend ticket flow.", onFeedback)
                    SettingsNavRow("Support", "Contact our support team for help.", onNavigateToSupport)
                    SettingsNavRow("About", "Yugm app summary and product scope.") { onDoc(SettingsPane.About) }
                    SettingsNavRow("Terms of use", "Respect, safety, and account rules.", onOpenTerms)
                }
            }
        }
        item {
            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(containerColor = Danger),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Text("Logout from Yugm", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black)
            }
            Text("Yugm v1.2.0 / Match the vibe.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 22.dp).fillMaxWidth())
        }
    }
}

@Composable
private fun AppearancePane(modifier: Modifier, currentMode: String, onModeSelected: (String) -> Unit) {
    val modes = listOf("SYSTEM" to "System default", "LIGHT" to "Light", "DARK" to "Dark")
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Pick how Yugm looks. System default follows your device setting.", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, lineHeight = 18.sp)
        }
        items(modes) { (value, label) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(LocalYugmColors.current.surface)
                    .clickable(role = Role.Button, onClickLabel = label) { onModeSelected(value) }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    Modifier.size(20.dp).clip(CircleShape)
                        .border(2.dp, if (currentMode == value) LocalYugmColors.current.secondary else LocalYugmColors.current.textSecondary, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (currentMode == value) Box(Modifier.size(10.dp).clip(CircleShape).background(LocalYugmColors.current.secondary))
                }
                Text(label, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        }
    }
}

private fun themeModeLabel(mode: String): String = when (mode) {
    "LIGHT" -> "Light"
    "DARK" -> "Dark"
    else -> "System"
}

@Composable
private fun BlockedPane(modifier: Modifier, blockedUsers: List<Host>, busy: Boolean, error: String?, onUnblock: (String) -> Unit) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!error.isNullOrBlank()) item { Text(error, color = Danger, fontSize = 13.sp) }
        if (busy && blockedUsers.isEmpty()) item { LoadingState("Loading blocked users...") }
        item {
            Text("People you unblock can view eligible public activity and interact again unless they have blocked you.", color = LocalYugmColors.current.textSecondary, fontWeight = FontWeight.Bold, lineHeight = 20.sp)
        }
        if (blockedUsers.isEmpty()) {
            item { WhiteCard { Text("No blocked users.", color = LocalYugmColors.current.textSecondary) } }
        } else {
            items(blockedUsers, key = { it.id }) { user ->
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(LocalYugmColors.current.surface).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Avatar(user.name.firstOrNull()?.toString() ?: "?", 44, imageUrl = user.avatar, cosmetics = user.activeCosmetics)
                    Column(Modifier.weight(1f)) {
                        Text(user.name, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("@${user.username.ifBlank { user.city }}", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                    }
                    Button(
                        onClick = { onUnblock(user.id) },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = LocalYugmColors.current.secondary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Unblock", color = Color.White, fontWeight = FontWeight.Black, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationsPane(
    modifier: Modifier,
    preferences: Map<String, Boolean>,
    busy: Boolean,
    loading: Boolean,
    error: String?,
    onToggle: (String, Boolean) -> Unit
) {
    val rows = listOf(
        Triple("messages", "Messages and calls", "New direct messages and private call alerts."),
        Triple("roomInvites", "Room invitations", "Invitations and speaker requests."),
        Triple("gifts", "Gifts", "Gifts sent to you in rooms and chats."),
        Triple("follows", "Social activity", "Follows, friend requests, comments and reactions."),
        Triple("hostGoingLive", "Live rooms", "When someone you follow starts a room."),
        Triple("wallet", "Wallet activity", "Coin rewards, purchases and payout updates."),
        Triple("safety", "Safety alerts", "Important account and moderation updates."),
        Triple("marketing", "Product updates", "News and announcements from Yugm.")
    )
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!error.isNullOrBlank()) item { Text(error, color = Danger, fontSize = 13.sp) }
        if (loading) item { LoadingState("Loading notification settings...") }
        items(rows, key = { it.first }) { (key, title, description) ->
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(LocalYugmColors.current.surface).padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(title, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black)
                    Text(description, color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                    Text(if (preferences[key] == true) "On" else "Off", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                    Switch(
                    checked = preferences[key] == true,
                    onCheckedChange = { onToggle(key, it) },
                    enabled = !busy && !loading
                )
            }
        }
    }
}

@Composable
private fun FeedbackPane(
    modifier: Modifier,
    subject: String,
    message: String,
    busy: Boolean,
    error: String?,
    onSubjectChange: (String) -> Unit,
    onMessageChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!error.isNullOrBlank()) item { Text(error, color = Danger, fontSize = 13.sp) }
        item {
            Text("Tell us what broke, what is confusing, or what you want Yugm to improve next.", color = LocalYugmColors.current.textSecondary, fontWeight = FontWeight.Bold, lineHeight = 20.sp)
        }
        item { YugmTextField(value = subject, onValueChange = onSubjectChange, label = "Subject") }
        item { YugmTextField(value = message, onValueChange = onMessageChange, label = "Write your feedback", minLines = 5) }
        item {
            Button(
                onClick = onSubmit,
                enabled = !busy && subject.trim().isNotBlank() && message.trim().isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = LocalYugmColors.current.secondary),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                if (busy) CircularProgressIndicator(color = LocalYugmColors.current.textPrimary, strokeWidth = 2.dp, modifier = Modifier.height(18.dp))
                else Text("Send feedback", color = Color.White, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun DocumentPane(modifier: Modifier, pane: SettingsPane) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(paneTitle(pane), color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black, fontSize = 24.sp)
            Text(docs[pane].orEmpty(), color = LocalYugmColors.current.textSecondary, fontWeight = FontWeight.Bold, lineHeight = 24.sp, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
private fun AboutPane(
    modifier: Modifier,
    version: String,
    onPrivacy: () -> Unit,
    onTerms: () -> Unit
) {
    val context = LocalContext.current
    val colors = LocalYugmColors.current
    val appIcon = remember {
        runCatching { context.packageManager.getApplicationIcon(context.packageName) }.getOrNull()
    }
    Box(modifier.fillMaxSize().background(colors.background)) {
        Box(
            Modifier.align(Alignment.TopEnd).size(210.dp)
                .background(Brush.radialGradient(listOf(Color(0xFFBCEAFF).copy(alpha = 0.16f), Color.Transparent)))
        )
        Box(
            Modifier.align(Alignment.BottomStart).size(230.dp)
                .background(Brush.radialGradient(listOf(Color(0xFFC6B0FF).copy(alpha = 0.18f), Color.Transparent)))
        )
        Column(
            Modifier.fillMaxSize().padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Column(
                Modifier.weight(1f).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    Modifier.size(104.dp).clip(RoundedCornerShape(28.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF9E48F5), Color(0xFF5D38D8))))
                        .border(1.dp, Color.White.copy(alpha = 0.7f), RoundedCornerShape(28.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (appIcon != null) AsyncImage(model = appIcon, contentDescription = "Yugm app icon", modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(28.dp)))
                    else Text("Y", color = Color.White, fontSize = 56.sp, fontWeight = FontWeight.Black)
                }
                Text("Yugm", color = colors.textPrimary, fontSize = 38.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 18.dp))
                Text("Current version $version", color = colors.textSecondary, fontSize = 14.sp, modifier = Modifier.padding(top = 7.dp))
            }

            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(colors.surface)) {
                AboutLinkRow("Privacy policy", "♢", colors.textPrimary, colors.secondary, onPrivacy)
                androidx.compose.material3.HorizontalDivider(color = colors.border, modifier = Modifier.padding(start = 64.dp))
                AboutLinkRow("Terms of use", "▤", colors.textPrimary, colors.secondary, onTerms)
            }
            Text(
                "Copyright © 2026 Yugm. All rights reserved.",
                color = colors.textSecondary,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 24.dp, bottom = 24.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

@Composable
private fun AboutLinkRow(
    label: String,
    icon: String,
    textColor: Color,
    iconColor: Color,
    onClick: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth().height(70.dp).clickable(role = Role.Button, onClickLabel = label, onClick = onClick).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, color = iconColor, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp).width(23.dp))
        Text(label, color = textColor, fontSize = 17.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Text("›", color = LocalYugmColors.current.textSecondary, fontSize = 27.sp, modifier = Modifier.padding(horizontal = 10.dp))
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    WhiteCard(modifier = Modifier.fillMaxWidth()) {
        Text(title, color = LocalYugmColors.current.secondary, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
        content()
    }
}

@Composable
private fun WhiteCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        color = LocalYugmColors.current.surface,
        border = BorderStroke(1.dp, LocalYugmColors.current.border),
        shape = RoundedCornerShape(20.dp),
        modifier = modifier
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun SettingsNavRow(title: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        color = LocalYugmColors.current.surface,
        border = BorderStroke(1.dp, LocalYugmColors.current.border),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = title, onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.width(4.dp).height(36.dp).clip(RoundedCornerShape(8.dp)).background(LocalYugmColors.current.secondary))
            Column(Modifier.weight(1f)) {
                Text(title, color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Black)
                Text(subtitle, color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Text(">", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Black)
        }
    }
}

private fun defaultNotificationPreferences(): Map<String, Boolean> = mapOf(
    "roomInvites" to true,
    "messages" to true,
    "gifts" to true,
    "follows" to true,
    "hostGoingLive" to true,
    "wallet" to true,
    "safety" to true,
    "marketing" to false
)

private fun paneTitle(pane: SettingsPane): String = when (pane) {
    SettingsPane.Home -> "Settings & Privacy"
    SettingsPane.Blocked -> "Blocked Users"
    SettingsPane.Notifications -> "Notifications"
    SettingsPane.Appearance -> "Appearance"
    SettingsPane.Feedback -> "Help & Feedback"
    SettingsPane.About -> "About Yugm"
    SettingsPane.Terms -> "Terms of Use"
    SettingsPane.Privacy -> "Privacy Policy"
    SettingsPane.Guidelines -> "Community Guidelines"
}

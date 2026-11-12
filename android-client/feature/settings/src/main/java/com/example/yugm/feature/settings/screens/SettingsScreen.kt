package com.example.yugm.feature.settings.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.api.YugmApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.content.Intent
import android.net.Uri
import com.example.yugm.core.model.Host
import com.example.yugm.core.ui.components.*
import com.example.yugm.core.ui.theme.Background
import com.example.yugm.core.ui.theme.Danger
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Line
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.PanelStrong
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.Purple
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.feature.settings.viewmodel.SettingsViewModel

private enum class SettingsPane { Home, Blocked, Notifications, Feedback, About, Terms, Privacy, Guidelines }

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
    var busy by remember { mutableStateOf(false) }
    var feedbackSubject by remember { mutableStateOf("") }
    var feedbackMessage by remember { mutableStateOf("") }
    var showLogoutConfirm by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deletePhrase by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val viewModel: SettingsViewModel = hiltViewModel()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    fun openLegalPage(path: String) {
        runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yugm.onrender.com/legal/$path")))
        }.onFailure { error = "Could not open the Yugm legal page." }
    }

    fun unblock(userId: String) {
        busy = true
        viewModel.unblock(token, userId)
        busy = false
    }

    LaunchedEffect(token) {
        if (token.isNotBlank()) viewModel.loadBlocked(token)
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(paneTitle(pane), color = TextPrimary, fontWeight = FontWeight.Black) },
                    navigationIcon = {
                        TextButton(onClick = { if (pane == SettingsPane.Home) onBack() else pane = SettingsPane.Home }) {
                            Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
                )
            },
            containerColor = Background
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
                    onFeedback = { pane = SettingsPane.Feedback },
                    onDoc = { pane = it },
                    onOpenPrivacy = { openLegalPage("privacy") },
                    onOpenChildSafety = { openLegalPage("child-safety") },
                    onOpenTerms = { openLegalPage("terms") },
                    onDeleteAccount = { showDeleteConfirm = true },
                    onNavigateToSupport = onNavigateToSupport,
                    onLogout = { showLogoutConfirm = true }
                )
                SettingsPane.Blocked -> BlockedPane(Modifier.padding(innerPadding), viewModel.blockedUsers, busy, onUnblock = { unblock(it) })
                SettingsPane.Notifications -> NotificationsPane(Modifier.padding(innerPadding), preferences, busy, onToggle = { key, value -> preferences = preferences + (key to value) })
                SettingsPane.Feedback -> FeedbackPane(
                    modifier = Modifier.padding(innerPadding),
                    subject = feedbackSubject,
                    message = feedbackMessage,
                    busy = busy,
                    onSubjectChange = { feedbackSubject = it },
                    onMessageChange = { feedbackMessage = it },
                    onSubmit = {
                        feedbackSubject = ""
                        feedbackMessage = ""
                        pane = SettingsPane.Home
                    }
                )
                SettingsPane.About, SettingsPane.Terms, SettingsPane.Privacy, SettingsPane.Guidelines -> DocumentPane(Modifier.padding(innerPadding), pane)
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
            title = { Text("Delete your account?", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Your account will be scheduled for deletion. Signing in again within 30 days cancels the request.", color = TextMuted)
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
            dismissButton = { TextButton(enabled = !busy, onClick = { showDeleteConfirm = false }) { Text("Cancel", color = TextMuted) } }
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
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(userName.firstOrNull()?.toString() ?: "Y", 52)
                    Column(Modifier.weight(1f)) {
                        Text(userName.ifBlank { "Yugm User" }, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Text("@${username.ifBlank { "yugm" }}", color = TextPrimary.copy(alpha = 0.74f), fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(onClick = onProfile, border = BorderStroke(1.dp, Color.White.copy(alpha = 0.5f)), shape = RoundedCornerShape(8.dp)) {
                        Text("Edit", color = TextPrimary, fontWeight = FontWeight.Bold)
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
                    SettingsNavRow("Detailed profile", "Edit your public profile and interests.", onProfile)
                    SettingsNavRow("Yugm Trust Verification", "Verify your face and voice to show people you're real.", onTrustVerification)
                    SettingsNavRow("Yugm Arcade", "Play mini games and manage challenges.", onGames)
                    SettingsNavRow("Yugm Clans", "Create or join a clan and chat with your family.", onClans)
                    SettingsNavRow("Notification settings", "Control messages, rooms, gifts, safety, and updates.", onNotifications)
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
                Text("Logout from Yugm", color = TextPrimary, fontWeight = FontWeight.Black)
            }
            Text("Yugm v1.2.0 / Match the vibe.", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 22.dp).fillMaxWidth())
        }
    }
}

@Composable
private fun BlockedPane(modifier: Modifier, blockedUsers: List<Host>, busy: Boolean, onUnblock: (String) -> Unit) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("People you unblock can view eligible public activity and interact again unless they have blocked you.", color = TextMuted, fontWeight = FontWeight.Bold, lineHeight = 20.sp)
        }
        if (blockedUsers.isEmpty()) {
            item { GlassCard { Text("No blocked users.", color = TextMuted) } }
        } else {
            items(blockedUsers, key = { it.id }) { user ->
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Panel).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Avatar(user.name.firstOrNull()?.toString() ?: "?", 44, imageUrl = user.avatar, cosmetics = user.activeCosmetics)
                    Column(Modifier.weight(1f)) {
                        Text(user.name, color = TextPrimary, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("@${user.username.ifBlank { user.city }}", color = TextMuted, fontSize = 12.sp)
                    }
                    Button(
                        onClick = { onUnblock(user.id) },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = Gold),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Unblock", color = Background, fontWeight = FontWeight.Black, fontSize = 12.sp)
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
    onToggle: (String, Boolean) -> Unit
) {
    val rows = listOf(
        "messages" to "Direct messages",
        "roomInvites" to "Room invites",
        "gifts" to "Gifts and wallet",
        "follows" to "Followers",
        "hostGoingLive" to "Hosts going live",
        "wallet" to "Wallet activity",
        "safety" to "Safety alerts",
        "marketing" to "Product updates"
    )
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(rows, key = { it.first }) { (key, title) ->
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Panel).padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
                    Text(if (preferences[key] == true) "Enabled" else "Muted", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Switch(
                    checked = preferences[key] == true,
                    onCheckedChange = { onToggle(key, it) },
                    enabled = !busy
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
    onSubjectChange: (String) -> Unit,
    onMessageChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Tell us what broke, what is confusing, or what you want Yugm to improve next.", color = TextMuted, fontWeight = FontWeight.Bold, lineHeight = 20.sp)
        }
        item { YugmTextField(value = subject, onValueChange = onSubjectChange, label = "Subject") }
        item { YugmTextField(value = message, onValueChange = onMessageChange, label = "Write your feedback", minLines = 5) }
        item {
            Button(
                onClick = onSubmit,
                enabled = !busy && subject.trim().isNotBlank() && message.trim().isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Pink),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                if (busy) CircularProgressIndicator(color = TextPrimary, strokeWidth = 2.dp, modifier = Modifier.height(18.dp))
                else Text("Send feedback", color = TextPrimary, fontWeight = FontWeight.Black)
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
            Text(paneTitle(pane), color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 24.sp)
            Text(docs[pane].orEmpty(), color = TextMuted, fontWeight = FontWeight.Bold, lineHeight = 24.sp, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        SectionTitle(title)
        content()
    }
}

@Composable
private fun SettingsNavRow(title: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        color = Panel,
        border = BorderStroke(1.dp, Line),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.width(4.dp).height(36.dp).clip(RoundedCornerShape(8.dp)).background(PanelStrong))
            Column(Modifier.weight(1f)) {
                Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
                Text(subtitle, color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Text(">", color = Gold, fontWeight = FontWeight.Black)
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
    SettingsPane.Feedback -> "Help & Feedback"
    SettingsPane.About -> "About Yugm"
    SettingsPane.Terms -> "Terms of Use"
    SettingsPane.Privacy -> "Privacy Policy"
    SettingsPane.Guidelines -> "Community Guidelines"
}

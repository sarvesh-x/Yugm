package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Logout
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.platform.LocalContext
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.api.VibeApi
import com.yugm.app.feature.profile.viewmodel.ProfileViewModel
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStats
import com.yugm.app.core.model.Room
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileDetailScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onMessage: (String) -> Unit,
    onInviteToRoom: (String) -> Unit,
    onOpenRoom: (Room) -> Unit = {},
    isOwnProfile: Boolean = false,
    onOpenSocialList: (String) -> Unit = {},
    onProfileUpdated: (com.yugm.app.core.model.YugmUser) -> Unit = {},
    onLogout: () -> Unit = {},
    onSettings: () -> Unit = {},
    onDiscover: () -> Unit = {},
    onParty: () -> Unit = {},
    onChatTab: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val viewModel: ProfileViewModel = hiltViewModel()
    var liked by remember { mutableStateOf(false) }
    var vibeMatch by remember { mutableStateOf<com.yugm.app.core.model.VibeMatchResponse?>(null) }
    var showNameDialog by remember { mutableStateOf(false) }
    var nameDraft by remember { mutableStateOf("") }
    var usernameDraft by remember { mutableStateOf("") }
    var bioDraft by remember { mutableStateOf("") }
    var vibeLineDraft by remember { mutableStateOf("") }
    var cityDraft by remember { mutableStateOf("") }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmNewPassword by remember { mutableStateOf("") }
    var accountBusy by remember { mutableStateOf(false) }
    var accountError by remember { mutableStateOf<String?>(null) }
    var showLogoutConfirm by remember { mutableStateOf(false) }
    var showOwnActionsMenu by remember { mutableStateOf(false) }
    var showReportDialog by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf("") }
    var showBlockConfirm by remember { mutableStateOf(false) }
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null && isOwnProfile && !accountBusy) {
            coroutineScope.launch {
                accountBusy = true
                accountError = null
                runCatching {
                    withContext(Dispatchers.IO) {
                        val (mime, bytes) = readProfileImageUpload(context, uri)
                        com.yugm.app.core.api.YugmApi.uploadAvatar(token, bytes, mime)
                    }
                }.onSuccess { url ->
                    viewModel.setOwnAvatar(url)
                    android.widget.Toast.makeText(context, "Profile photo updated", android.widget.Toast.LENGTH_SHORT).show()
                }.onFailure { accountError = it.message ?: "Could not update your photo." }
                accountBusy = false
            }
        }
    }

    LaunchedEffect(userId, token) {
        viewModel.loadProfile(token, userId)
        if (token.isNotBlank()) {
            runCatching { VibeApi.match(token, userId) }.onSuccess { vibeMatch = it }
        }
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        Scaffold(
            topBar = {
                if (isOwnProfile) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("My profile", color = TextPrimary, fontSize = 23.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        Box {
                            IconButton(onClick = { showOwnActionsMenu = true }) {
                                Icon(Icons.Filled.MoreVert, contentDescription = "More profile actions", tint = TextPrimary)
                            }
                            DropdownMenu(
                                expanded = showOwnActionsMenu,
                                onDismissRequest = { showOwnActionsMenu = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Settings") },
                                    leadingIcon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                                    onClick = { showOwnActionsMenu = false; onSettings() }
                                )
                                DropdownMenuItem(
                                    text = { Text("Edit profile") },
                                    leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                                    onClick = {
                                        showOwnActionsMenu = false
                                        viewModel.profile?.let {
                                            nameDraft = it.name
                                            usernameDraft = it.username
                                            bioDraft = it.bio
                                            vibeLineDraft = it.vibeLine
                                            cityDraft = it.city
                                        }
                                        showNameDialog = true
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("Change avatar") },
                                    leadingIcon = { Icon(Icons.Filled.CameraAlt, contentDescription = null) },
                                    enabled = !accountBusy,
                                    onClick = { showOwnActionsMenu = false; avatarPicker.launch("image/*") }
                                )
                                DropdownMenuItem(
                                    text = { Text("Change password") },
                                    leadingIcon = { Icon(Icons.Filled.Key, contentDescription = null) },
                                    onClick = { showOwnActionsMenu = false; accountError = null; showPasswordDialog = true }
                                )
                                DropdownMenuItem(
                                    text = { Text("Log out") },
                                    leadingIcon = { Icon(Icons.Filled.Logout, contentDescription = null) },
                                    onClick = { showOwnActionsMenu = false; showLogoutConfirm = true }
                                )
                            }
                        }
                    }
                } else {
                    YugmPageHeader(
                        title = viewModel.profile?.name?.takeIf(String::isNotBlank) ?: "Profile",
                        subtitle = viewModel.profile?.username?.takeIf(String::isNotBlank)?.let { "@$it" }.orEmpty(),
                        onBack = onBack,
                        trailing = {
                            IconButton(onClick = { showReportDialog = true }) {
                                Icon(Icons.Filled.MoreVert, contentDescription = "More profile options", tint = TextPrimary)
                            }
                        }
                    )
                }
            },
            bottomBar = {
            if (isOwnProfile) {
                YugmBottomDock(
                    selected = YugmDockTab.PROFILE,
                    onDiscover = onDiscover,
                    onLive = onParty,
                    onChat = onChatTab,
                    onProfile = {},
                    modifier = Modifier.fillMaxWidth()
                )
            } else viewModel.profile?.let { profile ->
                Surface(
                    color = SurfaceElevated,
                    border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 10.dp, vertical = 9.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        ProfileAction(if (liked) "♥" else "♡", if (liked) "Liked" else "Like", highlight = true) {
                                if (!liked) viewModel.like(token, profile.id) { liked = it }
                        }
                        ProfileAction("●●", "Message") { onMessage(profile.id) }
                        ProfileAction(if (viewModel.followBusy) "…" else if (viewModel.isFollowing) "✓" else "+", if (viewModel.followBusy) "Updating" else if (viewModel.isFollowing) "Unfollow" else "Follow", highlight = true, enabled = !viewModel.followBusy) {
                                if (!viewModel.followBusy) {
                                    if (viewModel.isFollowing) viewModel.unfollow(token, profile.id) else viewModel.follow(token, profile.id)
                                }
                        }
                        ProfileAction("◖", "Invite") { onInviteToRoom(profile.id) }
                        ProfileAction("⚑", "Report") { showReportDialog = true }
                    }
                }
            }
        },
        containerColor = Background
    ) { innerPadding ->
        if (viewModel.isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Retrieving profile info...")
            }
        } else if (viewModel.profile == null) {
            Column(
                Modifier.fillMaxSize().padding(innerPadding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    viewModel.profileLoadError ?: "This profile could not be found.",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                if (viewModel.profileLoadError != null) {
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { viewModel.loadProfile(token, userId, force = true) }) {
                        Text("Try again")
                    }
                }
            }
        } else {
            val profile = viewModel.profile!!
            val pkStats = viewModel.pkStats ?: PkStats()
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header card
                item {
                    AnimatedEntrance(delay = 100) {
                        ProfileHero(
                            profile = profile,
                            compatibilityScore = vibeMatch?.compatibility?.score?.takeUnless { isOwnProfile }
                        )
                    }
                }

                viewModel.followError?.let { message ->
                    item {
                        Text(message, color = DangerRed, modifier = Modifier.semantics {
                            liveRegion = LiveRegionMode.Polite
                        })
                    }
                }

                // VIP Status
                if (profile.isVip) {
                    item {
                        GlassCard(
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("👑", fontSize = 18.sp)
                                Column {
                                    Text("Premium VIP Member", color = Gold, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("This user has active profile boost and cosmetics priority.", color = TextMuted, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }

                item {
                    AnimatedEntrance(delay = 200) {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                                StatCard("Followers", "${profile.followers.coerceAtLeast(viewModel.followers.size)}", Modifier.weight(1f).semantics { contentDescription = "View ${profile.followers} followers" }.clickable(role = androidx.compose.ui.semantics.Role.Button, onClickLabel = "View followers") { onOpenSocialList("followers") })
                                StatCard("Following", "${profile.followingCount.coerceAtLeast(viewModel.following.size)}", Modifier.weight(1f).semantics { contentDescription = "View ${profile.followingCount} following" }.clickable(role = androidx.compose.ui.semantics.Role.Button, onClickLabel = "View following") { onOpenSocialList("following") })
                                StatCard("Level", "${profile.level}", Modifier.weight(1f))
                            }
                        }
                    }
                }

                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text("PK record", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                            StatCard("Wins", "${pkStats.wins}", Modifier.weight(1f))
                            StatCard("Rate", "${pkStats.winRate}%", Modifier.weight(1f))
                            StatCard("Streak", "${pkStats.bestStreak}", Modifier.weight(1f))
                        }
                        Text("${pkStats.played} played / best battle ${pkStats.bestBattle} / total score ${pkStats.totalScore}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                }

                if (viewModel.pkHistory.isNotEmpty()) {
                    item {
                        Text("Recent PK battles", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    items(viewModel.pkHistory.take(5), key = { it.id }) { battle ->
                        val ownSide = if (battle.left.hostId == userId) PkSideType.LEFT else PkSideType.RIGHT
                        val opponent = if (ownSide == PkSideType.LEFT) battle.right else battle.left
                        val outcome = when {
                            battle.winnerSide == PkSideType.DRAW -> "Draw"
                            battle.winnerSide == ownSide -> "Won"
                            else -> "Lost"
                        }
                        PkHistoryCard(
                            title = "$outcome vs ${opponent.hostName}",
                            subtitle = "${battle.left.score} - ${battle.right.score} / ${battle.mode.name.lowercase()} / ${battle.battleType.name.lowercase()}"
                        )
                    }
                }

                if (viewModel.followers.isNotEmpty() || viewModel.following.isNotEmpty()) {
                    item {
                        Text("Social Proof", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        GlassCard(modifier = Modifier.fillMaxWidth().clickable { onOpenSocialList("followers") }) {
                            Text(
                                text = "Followed by ${viewModel.followers.take(3).joinToString { it.name.ifBlank { it.username } }.ifBlank { "new people" }}",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            if (viewModel.following.isNotEmpty()) {
                                Text(
                                    text = "Recently followed ${viewModel.following.take(3).joinToString { it.name.ifBlank { it.username } }}",
                                    color = TextMuted,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Biography / Vibe Line
                item {
                    Text("My Vibe", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = profile.bio.ifBlank { "Hey there! I am matching the vibe on Yugm." },
                            color = Color.White,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
                    }
                }

                // Looking For / Preferences
                if (profile.lookingFor.isNotBlank() || profile.interestedIn.isNotBlank()) {
                    item {
                        Text("Looking For", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "Looking for: ${profile.lookingFor.ifBlank { "Social vibes" }}",
                                color = SaffronGold,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            if (profile.interestedIn.isNotBlank()) {
                                Text(
                                    text = "Interested in: ${profile.interestedIn}",
                                    color = TextMuted,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Interests & Languages
                item {
                    Text("Interests & Languages", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        profile.interests.forEach { interest ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0x26FFFFFF))
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(interest, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        profile.languages.forEach { language ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(PrimaryPurple.copy(alpha = 0.3f))
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(language, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                vibeMatch?.let { match ->
                    item {
                        Column(
                            Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Compatibility Score", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            GlassCard(Modifier.fillMaxWidth()) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            "♡ ${match.compatibility.score}%",
                                            color = Pink,
                                            fontSize = 28.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            match.compatibility.label,
                                            color = TextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    if (match.compatibility.sharedInterests.isNotEmpty()) {
                                        Text(
                                            "Shared interests: ${match.compatibility.sharedInterests.joinToString(", ")}",
                                            color = TextMuted,
                                            fontSize = 12.sp
                                        )
                                    }
                                    if (match.compatibility.sharedLanguages.isNotEmpty()) {
                                        Text(
                                            "Shared languages: ${match.compatibility.sharedLanguages.joinToString(", ")}",
                                            color = TextMuted,
                                            fontSize = 12.sp
                                        )
                                    }
                                    if (match.compatibility.sameCity) {
                                        Text("📍 Same city", color = Success, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }

                // Hosted Rooms
                if (viewModel.rooms.isNotEmpty()) {
                    item {
                        Text("Live Rooms by Host", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                    items(viewModel.rooms.size) { index ->
                        val room = viewModel.rooms[index]
                        GlassCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onOpenRoom(room) }
                        ) {
                            Text(room.title, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("${room.participants} people live • ${room.category}", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }

                // Safety Options (Report / Block)
                if (!isOwnProfile) {
                    item {
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = { showReportDialog = true },
                                border = BorderStroke(1.dp, DangerRed),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Report User", color = DangerRed, fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = { showBlockConfirm = true },
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Block User", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
    }

    if (showNameDialog) {
        AlertDialog(
            onDismissRequest = { if (!accountBusy) showNameDialog = false },
            title = { Text("Edit your profile", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Update the details people see on Yugm.", color = TextMuted)
                    OutlinedTextField(
                        value = nameDraft,
                        onValueChange = { nameDraft = it.take(60); accountError = null },
                        label = { Text("Display name") },
                        singleLine = true,
                        isError = accountError != null,
                        supportingText = { Text("${nameDraft.length}/60") }
                    )
                    OutlinedTextField(
                        value = usernameDraft,
                        onValueChange = {
                            usernameDraft = it.take(24).filter { char -> char in 'a'..'z' || char in 'A'..'Z' || char in '0'..'9' || char == '_' || char == '.' }
                            accountError = null
                        },
                        label = { Text("Username") },
                        prefix = { Text("@") },
                        singleLine = true,
                        supportingText = { Text("3–24 letters, numbers, dots, or underscores") }
                    )
                    OutlinedTextField(
                        value = bioDraft,
                        onValueChange = { bioDraft = it.take(180); accountError = null },
                        label = { Text("Bio") },
                        minLines = 2,
                        maxLines = 4,
                        supportingText = { Text("${bioDraft.length}/180") }
                    )
                    OutlinedTextField(
                        value = vibeLineDraft,
                        onValueChange = { vibeLineDraft = it.take(120); accountError = null },
                        label = { Text("Short vibe line") },
                        singleLine = true,
                        supportingText = { Text("${vibeLineDraft.length}/120") }
                    )
                    OutlinedTextField(
                        value = cityDraft,
                        onValueChange = { cityDraft = it.take(60); accountError = null },
                        label = { Text("City") },
                        singleLine = true,
                        supportingText = { Text("${cityDraft.length}/60") }
                    )
                    accountError?.let { Text(it, color = Danger) }
                }
            },
            confirmButton = {
                TextButton(enabled = !accountBusy && nameDraft.trim().length in 2..60 && usernameDraft.trim().length in 3..24, onClick = {
                    val current = viewModel.profile ?: return@TextButton
                    accountBusy = true
                    accountError = null
                    coroutineScope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) {
                                com.yugm.app.core.api.YugmApi.updateProfile(
                                    token = token,
                                    name = nameDraft.trim(),
                                    username = usernameDraft.trim().lowercase(java.util.Locale.ROOT),
                                    bio = bioDraft.trim(),
                                    city = cityDraft.trim(),
                                    vibeLine = vibeLineDraft.trim()
                                )
                            }
                        }.onSuccess { user ->
                            viewModel.setOwnProfile(user.name, user.username, bioDraft.trim(), vibeLineDraft.trim(), cityDraft.trim())
                            onProfileUpdated(user)
                            showNameDialog = false
                        }.onFailure { accountError = it.message ?: "Could not update your name." }
                        accountBusy = false
                    }
                }) { Text(if (accountBusy) "Saving…" else "Save", color = Gold) }
            },
            dismissButton = { TextButton(enabled = !accountBusy, onClick = { showNameDialog = false }) { Text("Cancel", color = TextMuted) } },
            containerColor = SurfaceElevated
        )
    }

    if (showPasswordDialog) {
        val user = FirebaseAuth.getInstance().currentUser
        val email = user?.email.orEmpty()
        val supportsPassword = user?.providerData?.any { it.providerId == "password" } == true
        AlertDialog(
            onDismissRequest = { if (!accountBusy) showPasswordDialog = false },
            title = { Text("Change password", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!supportsPassword || email.isBlank()) {
                        Text("This account does not use email and password sign-in, so its password cannot be changed here.", color = TextMuted)
                    } else {
                        Text("Confirm your current password, then choose a new one.", color = TextMuted)
                        OutlinedTextField(currentPassword, { currentPassword = it; accountError = null }, label = { Text("Current password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                        OutlinedTextField(newPassword, { newPassword = it; accountError = null }, label = { Text("New password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                        OutlinedTextField(confirmNewPassword, { confirmNewPassword = it; accountError = null }, label = { Text("Confirm new password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                        if (newPassword.isNotEmpty() && (newPassword.length < 8 || newPassword.none(Char::isLetter) || newPassword.none(Char::isDigit))) {
                            Text("Use at least 8 characters with a letter and a number.", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                    accountError?.let { Text(it, color = Danger) }
                }
            },
            confirmButton = {
                if (supportsPassword && email.isNotBlank()) TextButton(
                    enabled = !accountBusy && currentPassword.isNotBlank() && newPassword.length >= 8 && newPassword.any(Char::isLetter) && newPassword.any(Char::isDigit) && newPassword == confirmNewPassword,
                    onClick = {
                        accountBusy = true
                        accountError = null
                        coroutineScope.launch {
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    val currentUser = FirebaseAuth.getInstance().currentUser ?: error("Sign in again to change your password.")
                                    val currentEmail = currentUser.email ?: error("This account has no email address.")
                                    val credential = EmailAuthProvider.getCredential(currentEmail, currentPassword)
                                    Tasks.await(currentUser.reauthenticate(credential))
                                    Tasks.await(currentUser.updatePassword(newPassword))
                                }
                            }.onSuccess {
                                currentPassword = ""
                                newPassword = ""
                                confirmNewPassword = ""
                                showPasswordDialog = false
                                android.widget.Toast.makeText(context, "Password updated", android.widget.Toast.LENGTH_SHORT).show()
                            }.onFailure { accountError = it.message ?: "Could not change your password." }
                            accountBusy = false
                        }
                    }
                ) { Text(if (accountBusy) "Updating…" else "Update password", color = Gold) }
            },
            dismissButton = { TextButton(enabled = !accountBusy, onClick = { showPasswordDialog = false }) { Text("Close", color = TextMuted) } },
            containerColor = SurfaceElevated
        )
    }

    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Log out?", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = { Text("You can sign back in anytime.", color = TextMuted) },
            confirmButton = { TextButton(onClick = { showLogoutConfirm = false; onLogout() }) { Text("Log out", color = Danger) } },
            dismissButton = { TextButton(onClick = { showLogoutConfirm = false }) { Text("Cancel", color = TextMuted) } },
            containerColor = SurfaceElevated
        )
    }

    if (accountError != null && !showNameDialog && !showPasswordDialog) {
        AlertDialog(
            onDismissRequest = { accountError = null },
            title = { Text("Profile update failed", color = TextPrimary) },
            text = { Text(accountError.orEmpty(), color = TextMuted) },
            confirmButton = { TextButton(onClick = { accountError = null }) { Text("OK", color = Gold) } },
            containerColor = SurfaceElevated
        )
    }

    // Report Dialog
    if (showReportDialog) {
        AlertDialog(
            onDismissRequest = { showReportDialog = false },
            title = { Text("Report Profile", color = Color.White, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select a reason for reporting:", color = TextMuted)
                    listOf("Fake profile", "Harassment", "Nudity", "Hate speech", "Spam", "Underage user", "Other").forEach { reason ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { reportReason = reason }
                                .padding(vertical = 8.dp)
                        ) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(reason, color = Color.White)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        coroutineScope.launch {
                            viewModel.report(token, "", userId, reportReason)
                            showReportDialog = false
                        }
                    },
                    enabled = reportReason.isNotBlank()
                ) {
                    Text("Submit Report", color = DangerRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showReportDialog = false }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = SurfaceElevated
        )
    }

    // Block Confirm Dialog
    if (showBlockConfirm) {
        AlertDialog(
            onDismissRequest = { showBlockConfirm = false },
            title = { Text("Block User", color = Color.White, fontWeight = FontWeight.Black) },
            text = { Text("Are you sure you want to block this user? They will not be able to send you messages or view your profile.", color = TextMuted) },
            confirmButton = {
                TextButton(
                    onClick = {
                        coroutineScope.launch {
                            viewModel.block(token, userId)
                            showBlockConfirm = false
                            onBack()
                        }
                    }
                ) {
                    Text("Block", color = DangerRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showBlockConfirm = false }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = SurfaceElevated
        )
    }
}

private fun readProfileImageUpload(context: android.content.Context, uri: android.net.Uri): Pair<String, ByteArray> {
    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
    require(mime.startsWith("image/", ignoreCase = true)) { "Choose an image file." }
    val input = context.contentResolver.openInputStream(uri) ?: error("Could not read the selected image")
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8 * 1024)
    var totalBytes = 0
    input.use { stream ->
        while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            totalBytes += count
            require(totalBytes <= 5 * 1024 * 1024) { "Choose an image smaller than 5 MB." }
            output.write(buffer, 0, count)
        }
    }
    require(totalBytes > 0) { "The selected image is empty." }
    return mime to output.toByteArray()
}

@Composable
private fun ProfileHero(profile: Host, compatibilityScore: Int?) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(390.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(SurfaceElevated)
            .border(1.dp, Pink.copy(alpha = 0.4f), RoundedCornerShape(24.dp))
    ) {
        if (!profile.avatar.isNullOrBlank()) {
            AsyncImage(
                model = profile.avatar,
                contentDescription = profile.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier.fillMaxSize().background(Color(0xFF1A1A2E)),
                contentAlignment = Alignment.Center
            ) {
                Text("✦", color = Color.White.copy(alpha = 0.2f), fontSize = 64.sp)
            }
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Background.copy(alpha = 0.97f)))))
        Row(Modifier.align(Alignment.TopStart).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.clip(RoundedCornerShape(10.dp)).background(Background.copy(alpha = 0.78f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                Text(if (profile.isOnline) "●  Online" else "Recently active", color = if (profile.isOnline) Success else TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.weight(1f))
            if (compatibilityScore != null) {
                Box(Modifier.size(76.dp).clip(CircleShape).background(Background.copy(alpha = 0.72f)).border(2.dp, Pink, CircleShape), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("♡ $compatibilityScore%", color = Pink, fontSize = 17.sp, fontWeight = FontWeight.Black)
                        Text("Compatible", color = TextMuted, fontSize = 8.sp)
                    }
                }
            }
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (profile.age > 0) "${profile.name}, ${profile.age}" else profile.name,
                    color = Color.White,
                    fontSize = 29.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                if (profile.isVip) Text("  ◆", color = PrimaryPurple, fontSize = 17.sp)
            }
            if (profile.vibeLine.isNotBlank()) {
                Text(profile.vibeLine, color = Gold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
            }
            if (profile.city.isNotBlank()) {
                Text("⌖ ${profile.city}", color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
            }
            if (profile.bio.isNotBlank()) {
                Text(profile.bio, color = Color.White.copy(alpha = 0.86f), fontSize = 12.sp, lineHeight = 17.sp, maxLines = 3, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.padding(top = 9.dp))
            }
            Row(Modifier.padding(top = 11.dp).horizontalScroll(androidx.compose.foundation.rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                profile.interests.take(4).forEach { interest ->
                    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = 0.12f)).border(1.dp, BorderColor, RoundedCornerShape(12.dp)).padding(horizontal = 10.dp, vertical = 7.dp)) {
                        Text(interest, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileAction(glyph: String, label: String, highlight: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(68.dp).heightIn(min = 56.dp).semantics { contentDescription = label }.clickable(enabled = enabled, role = androidx.compose.ui.semantics.Role.Button, onClickLabel = label, onClick = onClick)) {
        Box(
            Modifier.size(46.dp).clip(CircleShape).background(if (highlight) Brush.linearGradient(listOf(Pink, PrimaryPurple)) else Brush.linearGradient(listOf(Color(0xFF2A2D42), SurfaceElevated))).border(1.dp, if (highlight) Pink.copy(alpha = 0.5f) else BorderColor, CircleShape),
            contentAlignment = Alignment.Center
        ) { Text(glyph, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        Text(label, color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.padding(top = 4.dp))
    }
}

// Simple FlowRow layout definition to keep Compose clean without external dependencies
@Composable
fun FlowRow(
    modifier: Modifier = Modifier,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.Start,
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    content: @Composable () -> Unit
) {
    androidx.compose.ui.layout.Layout(
        content = content,
        modifier = modifier
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = 0, minHeight = 0)) }
        var yPosition = 0
        var xPosition = 0
        var maxRowHeight = 0

        val childLayoutData = mutableListOf<Pair<androidx.compose.ui.layout.Placeable, IntOffset>>()

        placeables.forEach { placeable ->
            if (xPosition + placeable.width > constraints.maxWidth) {
                // Next row
                yPosition += maxRowHeight + verticalArrangement.let { 8.dp.roundToPx() }
                xPosition = 0
                maxRowHeight = 0
            }
            childLayoutData.add(placeable to IntOffset(xPosition, yPosition))
            xPosition += placeable.width + horizontalArrangement.let { 8.dp.roundToPx() }
            maxRowHeight = maxOf(maxRowHeight, placeable.height)
        }

        val totalHeight = yPosition + maxRowHeight
        layout(constraints.maxWidth, totalHeight) {
            childLayoutData.forEach { (placeable, offset) ->
                placeable.place(offset)
            }
        }
    }
}

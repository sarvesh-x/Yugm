package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
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
import com.yugm.app.core.ui.cosmetics.StyledName
import com.yugm.app.core.ui.cosmetics.profileThemeAccent
import com.yugm.app.core.ui.cosmetics.profileThemeColors
import com.yugm.app.core.ui.cosmetics.profileBannerColors
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
    onSettings: () -> Unit = {},
    onDiscover: () -> Unit = {},
    onParty: () -> Unit = {},
    onChatTab: () -> Unit = {},
    onOpenStore: () -> Unit = {},
    onOpenCustomize: () -> Unit = {},
    onOpenPublicProfile: () -> Unit = {},
    onOpenVip: () -> Unit = {},
    onOpenTasks: () -> Unit = {},
    onOpenLevel: () -> Unit = {},
    onOpenWallet: () -> Unit = {},
    onOpenInventory: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val viewModel: ProfileViewModel = hiltViewModel()
    var liked by remember { mutableStateOf(false) }
    var profileRefreshing by remember { mutableStateOf(false) }
    var vibeMatch by remember { mutableStateOf<com.yugm.app.core.model.VibeMatchResponse?>(null) }
    var showEditProfileScreen by remember { mutableStateOf(false) }
    var nameDraft by remember { mutableStateOf("") }
    var usernameDraft by remember { mutableStateOf("") }
    var bioDraft by remember { mutableStateOf("") }
    var vibeLineDraft by remember { mutableStateOf("") }
    var cityDraft by remember { mutableStateOf("") }
    var stateDraft by remember { mutableStateOf("") }
    var genderDraft by remember { mutableStateOf("") }
    var ageDraft by remember { mutableStateOf("") }
    var interestsDraft by remember { mutableStateOf<List<String>>(emptyList()) }
    var hobbiesDraft by remember { mutableStateOf<List<String>>(emptyList()) }
    var customInterestInput by remember { mutableStateOf("") }
    var customHobbyInput by remember { mutableStateOf("") }

    val openProfileEditor: () -> Unit = {
        viewModel.profile?.let {
            nameDraft = it.name
            usernameDraft = it.username
            bioDraft = it.bio
            vibeLineDraft = it.vibeLine
            cityDraft = it.city
            stateDraft = it.state
            genderDraft = it.gender
            ageDraft = it.age.takeIf { age -> age > 0 }?.toString().orEmpty()
            interestsDraft = it.interests
            hobbiesDraft = it.hobbies
        }
        showEditProfileScreen = true
    }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmNewPassword by remember { mutableStateOf("") }
    var accountBusy by remember { mutableStateOf(false) }
    var accountError by remember { mutableStateOf<String?>(null) }
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
                if (!isOwnProfile) {
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
                        ProfileAction(if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, if (liked) "Liked" else "Like", highlight = true) {
                                if (!liked) viewModel.like(token, profile.id) { liked = it }
                        }
                        ProfileAction(Icons.Filled.ChatBubbleOutline, "Message") { onMessage(profile.id) }
                        ProfileAction(if (viewModel.isFollowing) Icons.Filled.PersonRemove else Icons.Filled.PersonAdd, if (viewModel.followBusy) "Updating" else if (viewModel.isFollowing) "Unfollow" else "Follow", highlight = true, enabled = !viewModel.followBusy, isLoading = viewModel.followBusy) {
                                if (!viewModel.followBusy) {
                                    if (viewModel.isFollowing) viewModel.unfollow(token, profile.id) else viewModel.follow(token, profile.id)
                                }
                        }
                        ProfileAction(Icons.Filled.Email, "Invite") { onInviteToRoom(profile.id) }
                        ProfileAction(Icons.Filled.Flag, "Report") { showReportDialog = true }
                    }
                }
            }
        },
        containerColor = Background
    ) { innerPadding ->
        YugmPullToRefreshBox(
            isRefreshing = profileRefreshing,
            onRefresh = {
                if (!profileRefreshing) coroutineScope.launch {
                    profileRefreshing = true
                    try {
                        viewModel.loadProfile(token, userId, force = true).join()
                    } finally {
                        profileRefreshing = false
                    }
                }
            },
            modifier = Modifier.fillMaxSize().padding(innerPadding)
        ) {
        if (viewModel.isLoading && viewModel.profile == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                LoadingState("Retrieving profile info...")
            }
        } else if (viewModel.profile == null) {
            Column(
                Modifier.fillMaxSize().padding(24.dp),
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
                    .fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Header card
                item {
                    AnimatedEntrance(delay = 100) {
                        ProfileHero(
                            profile = profile,
                            compatibilityScore = vibeMatch?.compatibility?.score?.takeUnless { isOwnProfile },
                            isOwnProfile = isOwnProfile,
                            onEditProfile = if (isOwnProfile) openProfileEditor else null,
                            onOpenSocialList = onOpenSocialList,
                            onOpenWallet = onOpenWallet
                        )
                    }
                }

                if (isOwnProfile) {
                    item {
                        ProfileCompletionCard(
                            profile = profile,
                            onCompleteClick = openProfileEditor,
                            onAddAvatar = openProfileEditor
                        )
                    }
                    item {
                        ProfileMenuCard(
                            onCustomize = onOpenCustomize,
                            onStore = onOpenStore,
                            onVip = onOpenVip,
                            onTasks = onOpenTasks,
                            onLevel = onOpenLevel,
                            onWallet = onOpenWallet,
                            onInventory = onOpenInventory,
                            onSettings = onSettings
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

                // Compatibility follows PK stats and precedes the combined interests card.
                vibeMatch?.let { match ->
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Compatibility Score", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        "♥ ${match.compatibility.score}%",
                                        color = Pink,
                                        fontSize = 27.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        match.compatibility.label,
                                        color = TextPrimary,
                                        fontSize = 14.sp,
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

                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text("Interests & Passions", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Spacer(Modifier.height(8.dp))
                        val tags = (profile.interests + profile.hobbies).distinct()
                        if (tags.isEmpty()) {
                            Text(
                                if (isOwnProfile) "Add interests, hobbies, or activities to your profile." else "No interests or activities shared yet.",
                                color = TextMuted,
                                fontSize = 13.sp,
                                modifier = if (isOwnProfile) Modifier.clickable { openProfileEditor() } else Modifier
                            )
                        } else {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                tags.forEach { tag ->
                                    Box(
                                        Modifier.clip(RoundedCornerShape(12.dp))
                                            .background(PrimaryPurple.copy(alpha = 0.22f))
                                            .border(1.dp, PrimaryPurple.copy(alpha = 0.48f), RoundedCornerShape(12.dp))
                                            .padding(horizontal = 12.dp, vertical = 7.dp)
                                    ) {
                                        Text(tag, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(Modifier.weight(1f)) {
                            GlassCard(Modifier.fillMaxWidth()) {
                                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text("Looking For", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 14.sp)
                                    Text(profile.lookingFor.ifBlank { "Not set" }, color = SaffronGold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    if (profile.interestedIn.isNotBlank()) Text(profile.interestedIn, color = TextMuted, fontSize = 12.sp)
                                }
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            GlassCard(Modifier.fillMaxWidth()) {
                                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text("Languages Spoken", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 14.sp)
                                    if (profile.languages.isEmpty()) {
                                        Text("Not shared", color = TextMuted, fontSize = 12.sp)
                                    } else {
                                        profile.languages.forEach { language ->
                                            Text(language, color = TextPrimary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (profile.isVip) {
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
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

                if (viewModel.pkHistory.isNotEmpty()) {
                    item { Text("Recent PK battles", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black) }
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
    }

    if (showEditProfileScreen) {
        BackHandler { if (!accountBusy) showEditProfileScreen = false }
        EditProfilePage(
            profile = viewModel.profile,
            name = nameDraft, onNameChange = { nameDraft = it.take(60); accountError = null },
            username = usernameDraft, onUsernameChange = { usernameDraft = it.take(24).filter { char -> char in 'a'..'z' || char in 'A'..'Z' || char in '0'..'9' || char == '_' || char == '.' }; accountError = null },
            gender = genderDraft, onGenderChange = { genderDraft = it; accountError = null },
            age = ageDraft, onAgeChange = { ageDraft = it.filter(Char::isDigit).take(3); accountError = null },
            vibeLine = vibeLineDraft, onVibeLineChange = { vibeLineDraft = it.take(120); accountError = null },
            bio = bioDraft, onBioChange = { bioDraft = it.take(180); accountError = null },
            city = cityDraft, onCityChange = { cityDraft = it.take(60); accountError = null },
            state = stateDraft, onStateChange = { stateDraft = it.take(60); accountError = null },
            interests = interestsDraft, onInterestsChange = { interestsDraft = it },
            hobbies = hobbiesDraft, onHobbiesChange = { hobbiesDraft = it },
            customInterest = customInterestInput, onCustomInterestChange = { customInterestInput = it.take(24) },
            customHobby = customHobbyInput, onCustomHobbyChange = { customHobbyInput = it.take(24) },
            error = accountError, isBusy = accountBusy,
            onClose = { if (!accountBusy) { showEditProfileScreen = false; accountError = null } },
            onChangePhoto = { avatarPicker.launch("image/*") },
            onChangePassword = { if (!accountBusy) { showEditProfileScreen = false; accountError = null; showPasswordDialog = true } },
            onSave = {
                val current = viewModel.profile
                if (current != null) {
                    accountBusy = true
                    accountError = null
                    coroutineScope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) {
                                com.yugm.app.core.api.YugmApi.updateProfile(
                                    token = token,
                                    name = nameDraft.trim(),
                                    username = usernameDraft.trim().lowercase(java.util.Locale.ROOT),
                                    bio = bioDraft.trim(), city = cityDraft.trim(), state = stateDraft.trim(),
                                    vibeLine = vibeLineDraft.trim(), interests = interestsDraft, hobbies = hobbiesDraft,
                                    gender = genderDraft, age = ageDraft.toIntOrNull()
                                )
                            }
                        }.onSuccess { user ->
                            viewModel.setOwnProfile(
                                name = user.name, username = user.username, bio = bioDraft.trim(),
                                vibeLine = vibeLineDraft.trim(), city = cityDraft.trim(), state = stateDraft.trim(),
                                gender = genderDraft, age = ageDraft.toIntOrNull() ?: 0,
                                interests = interestsDraft, hobbies = hobbiesDraft
                            )
                            onProfileUpdated(user)
                            showEditProfileScreen = false
                        }.onFailure { accountError = it.message ?: "Could not update your profile." }
                        accountBusy = false
                    }
                }
            }
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

    if (accountError != null && !showEditProfileScreen && !showPasswordDialog) {
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

@Composable
private fun EditProfilePage(
    profile: Host?,
    name: String, onNameChange: (String) -> Unit,
    username: String, onUsernameChange: (String) -> Unit,
    gender: String, onGenderChange: (String) -> Unit,
    age: String, onAgeChange: (String) -> Unit,
    vibeLine: String, onVibeLineChange: (String) -> Unit,
    bio: String, onBioChange: (String) -> Unit,
    city: String, onCityChange: (String) -> Unit,
    state: String, onStateChange: (String) -> Unit,
    interests: List<String>, onInterestsChange: (List<String>) -> Unit,
    hobbies: List<String>, onHobbiesChange: (List<String>) -> Unit,
    customInterest: String, onCustomInterestChange: (String) -> Unit,
    customHobby: String, onCustomHobbyChange: (String) -> Unit,
    error: String?, isBusy: Boolean,
    onClose: () -> Unit, onChangePhoto: () -> Unit,
    onChangePassword: () -> Unit, onSave: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val canSave = !isBusy && profile != null && name.trim().length in 2..60 && username.trim().length in 3..24 && (age.isBlank() || age.toIntOrNull()?.let { it in 18..100 } == true)
    Column(
        Modifier.fillMaxSize().background(Color(0xFF101116)).systemBarsPadding(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onClose, enabled = !isBusy, modifier = Modifier.size(42.dp).clip(CircleShape).background(Color(0xFF1A1B22))) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text("Edit Profile", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(start = 12.dp))
            IconButton(onClick = onChangePassword, enabled = !isBusy) {
                Icon(Icons.Filled.Key, contentDescription = "Change password", tint = Color(0xFFB8BAC7))
            }
            Button(
                onClick = onSave,
                enabled = canSave,
                shape = CircleShape,
                contentPadding = PaddingValues(horizontal = 17.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF3E83), disabledContainerColor = Color(0xFF66304A))
            ) { Text(if (isBusy) "Saving…" else "Save", color = Color.White, fontWeight = FontWeight.Bold) }
        }

        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Column(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(contentAlignment = Alignment.BottomEnd) {
                    Box(Modifier.size(104.dp).clip(CircleShape).background(Color(0xFF20212A)).border(3.dp, Color.White.copy(alpha = .86f), CircleShape), contentAlignment = Alignment.Center) {
                        Avatar(name.take(1).ifBlank { "?" }, 96, profile?.avatar, profile?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics())
                    }
                    IconButton(
                        onClick = onChangePhoto,
                        enabled = !isBusy,
                        modifier = Modifier.size(34.dp).clip(CircleShape).background(Color(0xFFEF3E83)).border(2.dp, Color(0xFF101116), CircleShape)
                    ) { Icon(Icons.Filled.CameraAlt, contentDescription = "Change photo", tint = Color.White, modifier = Modifier.size(17.dp)) }
                }
                Text("Change Photo", color = Color(0xFFA4A6B3), fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 9.dp).clickable(onClick = onChangePhoto))
            }

            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFF291923)).border(1.dp, Color(0x55EF3E83), RoundedCornerShape(16.dp)).padding(13.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("ⓘ", color = Color(0xFFFF6B9E), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("Make your profile yours. Add a little detail so people can find a reason to connect.", color = Color(0xFFE4DDE2), fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(start = 10.dp))
            }

            EditProfileSection("BASIC INFO") {
                EditProfileTextField("Name", name, onNameChange, maxLength = 60)
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("ID", color = Color.White, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    Text(profile?.id?.takeLast(9).orEmpty(), color = Color(0xFFC3C5D0), fontSize = 14.sp)
                    TextButton(onClick = { clipboard.setText(AnnotatedString(profile?.id?.takeLast(9).orEmpty())) }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = null, tint = Color(0xFFC3C5D0), modifier = Modifier.size(15.dp))
                        Text("Copy", color = Color(0xFFC3C5D0), modifier = Modifier.padding(start = 4.dp))
                    }
                }
                EditProfileTextField("Username", username, onUsernameChange, prefix = "@", maxLength = 24)
                Text("Gender", color = Color(0xFFDADBE2), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Female", "Male", "Non-Binary", "Other", "Prefer not to say").forEach { option ->
                        ProfileEditChip(option, selected = gender.equals(option, ignoreCase = true)) { onGenderChange(option) }
                    }
                }
                EditProfileTextField("Age", age, onAgeChange, maxLength = 3, numberOnly = true, helper = "Must be between 18 and 100")
                EditProfileTextField("Short vibe line", vibeLine, onVibeLineChange, maxLength = 120)
                EditProfileTextField("About you", bio, onBioChange, maxLength = 180, minLines = 3)
            }

            EditProfileSection("LOCATION") {
                EditProfileTextField("City / Region", city, onCityChange, maxLength = 60)
                EditProfileTextField("State", state, onStateChange, maxLength = 60)
            }

            EditProfileSection("INTERESTS & PASSIONS") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    PresetInterests.forEach { item -> ProfileEditChip(item, interests.contains(item)) { onInterestsChange(if (interests.contains(item)) interests - item else interests + item) } }
                    interests.filterNot(PresetInterests::contains).forEach { item -> ProfileEditChip("$item  ×", true) { onInterestsChange(interests - item) } }
                }
                EditProfileAddRow("Add an interest", customInterest, onCustomInterestChange) {
                    val value = customInterest.trim()
                    if (value.isNotEmpty() && value !in interests) onInterestsChange(interests + value)
                    onCustomInterestChange("")
                }
            }

            EditProfileSection("HOBBIES & PASTIMES") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    PresetHobbies.forEach { item -> ProfileEditChip(item, hobbies.contains(item), accent = Color(0xFFFFB84D)) { onHobbiesChange(if (hobbies.contains(item)) hobbies - item else hobbies + item) } }
                    hobbies.filterNot(PresetHobbies::contains).forEach { item -> ProfileEditChip("$item  ×", true, accent = Color(0xFFFFB84D)) { onHobbiesChange(hobbies - item) } }
                }
                EditProfileAddRow("Add a hobby", customHobby, onCustomHobbyChange, accent = Color(0xFFFFB84D)) {
                    val value = customHobby.trim()
                    if (value.isNotEmpty() && value !in hobbies) onHobbiesChange(hobbies + value)
                    onCustomHobbyChange("")
                }
            }
            if (error != null) Text(error, color = Color(0xFFFF647C), fontSize = 13.sp, modifier = Modifier.padding(bottom = 20.dp))
        }
    }
}

@Composable
private fun EditProfileSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = Color(0xFF9EA3B4), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp, modifier = Modifier.padding(start = 4.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF191A20)).border(1.dp, Color(0xFF292A31), RoundedCornerShape(18.dp)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content
        )
    }
}

@Composable
private fun EditProfileTextField(label: String, value: String, onValueChange: (String) -> Unit, prefix: String? = null, maxLength: Int, numberOnly: Boolean = false, helper: String? = null, minLines: Int = 1) {
    OutlinedTextField(
        value = value,
        onValueChange = { input -> onValueChange(if (numberOnly) input.filter(Char::isDigit).take(maxLength) else input.take(maxLength)) },
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        prefix = prefix?.let { { Text(it) } },
        singleLine = minLines == 1,
        minLines = minLines,
        supportingText = { Text(helper ?: "${value.length}/$maxLength") },
        keyboardOptions = if (numberOnly) KeyboardOptions(keyboardType = KeyboardType.Number) else KeyboardOptions.Default,
        shape = RoundedCornerShape(13.dp)
    )
}

@Composable
private fun ProfileEditChip(label: String, selected: Boolean, accent: Color = Color(0xFFB777FF), onClick: () -> Unit) {
    Box(
        Modifier.clip(CircleShape).background(if (selected) accent.copy(alpha = .28f) else Color(0xFF22232A))
            .border(1.dp, if (selected) accent.copy(alpha = .72f) else Color(0xFF373840), CircleShape)
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp)
    ) { Text(label, color = if (selected) Color.White else Color(0xFFC2C4CF), fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium) }
}

@Composable
private fun EditProfileAddRow(label: String, value: String, onValueChange: (String) -> Unit, accent: Color = Color(0xFFB777FF), onAdd: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(value, onValueChange, modifier = Modifier.weight(1f), label = { Text(label) }, singleLine = true, shape = RoundedCornerShape(13.dp))
        Button(onClick = onAdd, enabled = value.isNotBlank(), colors = ButtonDefaults.buttonColors(containerColor = accent), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 13.dp)) {
            Text("Add", color = Color.White, fontWeight = FontWeight.Bold)
        }
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
private fun ProfileHero(
    profile: Host,
    compatibilityScore: Int?,
    isOwnProfile: Boolean = false,
    onEditProfile: (() -> Unit)? = null,
    onViewPublicProfile: (() -> Unit)? = null,
    onOpenSocialList: ((String) -> Unit)? = null,
    onOpenWallet: (() -> Unit)? = null
) {
    val surface = Color(0xE80C0D19)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF261044), surface, Color(0xFF0B0C15))))
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(26.dp))
            .padding(horizontal = 16.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.fillMaxWidth()) {
            if (isOwnProfile && onEditProfile != null) {
                OutlinedButton(
                    onClick = onEditProfile,
                    shape = RoundedCornerShape(50),
                    border = BorderStroke(1.dp, Color(0x55FFFFFF)),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0x22FFFFFF), contentColor = Color.White),
                    contentPadding = PaddingValues(horizontal = 11.dp, vertical = 6.dp),
                    modifier = Modifier.align(Alignment.TopEnd).height(34.dp)
                ) {
                    Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.White)
                    Spacer(Modifier.width(5.dp))
                    Text("Edit", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            } else if (compatibilityScore != null) {
                Text("$compatibilityScore% match", color = Gold, fontSize = 12.sp, modifier = Modifier.align(Alignment.TopEnd))
            }
            Box(
                Modifier.align(Alignment.TopCenter).size(104.dp).clip(CircleShape)
                    .background(Color(0xFF11121D)).border(3.dp, Color.White.copy(alpha = 0.9f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Avatar(
                    initial = profile.name.firstOrNull()?.toString() ?: "?",
                    size = 96,
                    imageUrl = profile.avatar,
                    cosmetics = profile.activeCosmetics
                )
            }
        }
        Spacer(Modifier.height(30.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            StyledName(text = profile.name.ifBlank { "Yugm Member" }, nameStyle = profile.activeCosmetics.nameStyle, fontSize = 25, maxLines = 1)
            if (profile.isOnline) Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF22C55E)))
            if (profile.isVip) ProfilePill("VIP", Gold)
        }
        Row(
            modifier = Modifier.padding(top = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Text("ID: ${profile.id.takeLast(9)}", color = Color(0xFFB8BAC8), fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text("🇮🇳", fontSize = 14.sp)
            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF9AD968)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                Text("Lv.${profile.level}", color = Color(0xFF18240E), fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
        }
        val headline = profile.vibeLine.ifBlank { profile.bio }
        if (headline.isNotBlank()) {
            Text(headline, color = Color(0xFFE7E5EE), fontSize = 15.sp, textAlign = TextAlign.Center, maxLines = 2, modifier = Modifier.padding(top = 12.dp))
        }
        if (profile.city.isNotBlank()) {
            Text(profile.city, color = Gold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 3.dp))
        }
        Spacer(Modifier.height(16.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xCC0E0F18)).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(16.dp)).padding(vertical = 10.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ProfileHeroStat("Friends", profile.closeFriendsCount.toString(), Modifier.weight(1f), null)
            Box(Modifier.width(1.dp).height(28.dp).background(Color(0x44FFFFFF)))
            ProfileHeroStat("Following", profile.followingCount.toString(), Modifier.weight(1f)) { onOpenSocialList?.invoke("following") }
            Box(Modifier.width(1.dp).height(28.dp).background(Color(0x44FFFFFF)))
            ProfileHeroStat("Followers", profile.followers.toString(), Modifier.weight(1f)) { onOpenSocialList?.invoke("followers") }
        }
        if (isOwnProfile) {
            Spacer(Modifier.height(9.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileBalanceTile("🪙", profile.walletBalance.toString(), "Coins", Modifier.weight(1f), onOpenWallet)
                ProfileBalanceTile("💎", profile.diamondBalance.toString(), "Diamonds", Modifier.weight(1f), onOpenWallet)
            }
        }
    }
}

@Composable
private fun ProfileHeroStat(label: String, value: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Column(
        modifier = modifier.then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(vertical = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
        Text(label, color = Color(0xFFB0B2BF), fontSize = 12.sp, maxLines = 1)
    }
}

@Composable
private fun ProfileBalanceTile(icon: String, value: String, label: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Row(
        modifier = modifier.height(64.dp).clip(RoundedCornerShape(15.dp)).background(Color(0xD8171822))
            .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(15.dp))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(icon, fontSize = 19.sp)
        Spacer(Modifier.width(6.dp))
        Column {
            Text(value, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text(label, color = Color(0xFFB0B2BF), fontSize = 11.sp)
        }
    }
}

@Composable
private fun ProfileHeroLegacy(
    profile: Host,
    compatibilityScore: Int?,
    isOwnProfile: Boolean = false,
    onEditProfile: (() -> Unit)? = null,
    onViewPublicProfile: (() -> Unit)? = null,
    onOpenSocialList: ((String) -> Unit)? = null,
    onOpenWallet: (() -> Unit)? = null
) {
    val themeColors = profileThemeColors(profile.activeCosmetics.profileTheme)
    val themeAccent = profileThemeAccent(profile.activeCosmetics.profileTheme)
    val bannerColors = profileBannerColors(profile.activeCosmetics.profileBanner)

    // Outer card container styled with soft glow and rounded corners matching reference
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(Color(0xFF131524))
            .border(1.dp, Color(0x338D35F6), RoundedCornerShape(28.dp))
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Top Cosmetic Profile Banner Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(104.dp)
                    .background(Brush.horizontalGradient(bannerColors))
            ) {
                // Subtle overlay shimmer
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.White.copy(alpha = 0.08f), Color.Transparent, Color.Black.copy(alpha = 0.35f))
                            )
                        )
                )
            }

            // Body content below banner with overlapping avatar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 16.dp)
            ) {
                // Row with overlapping avatar and action button (Edit Profile or Compatibility)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = (-38).dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Avatar overlapping the banner with circular white/accent ring
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF131524))
                            .border(3.dp, Color(0xFF131524), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Avatar(
                            initial = profile.name.firstOrNull()?.toString() ?: "?",
                            size = 86,
                            imageUrl = profile.avatar,
                            cosmetics = profile.activeCosmetics
                        )
                    }

                    // Action button aligned to right: Edit Profile button for own profile
                    if (isOwnProfile && onEditProfile != null) {
                        OutlinedButton(
                            onClick = onEditProfile,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.2.dp, Color(0x55FFFFFF)),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color(0x1AFFFFFF),
                                contentColor = Color.White
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                            modifier = Modifier
                                .height(36.dp)
                                .offset(y = 30.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Edit,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp),
                                tint = Color.White
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Edit Profile",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else if (compatibilityScore != null) {
                        Box(
                            modifier = Modifier
                                .offset(y = 36.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF2E1B4E))
                                .border(1.dp, PrimaryPurple, RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                "$compatibilityScore% Match",
                                color = Gold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Name, profile badges, and headline
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = (-24).dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        StyledName(
                            text = profile.name.ifBlank { "Yugm Member" },
                            nameStyle = profile.activeCosmetics.nameStyle,
                            fontSize = 22,
                            maxLines = 1
                        )
                        if (profile.isVip) {
                            ProfilePill("VIP", Gold)
                        }
                    }

                    if (profile.username.isNotBlank()) {
                        Text(
                            text = "@${profile.username}",
                            color = PrimaryPurple.copy(alpha = 0.85f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val genderLabel = profile.gender.trim().ifBlank { "Not set" }
                        ProfilePill("Gender · $genderLabel", Color(0xFFC4B5FD))
                        ProfilePill("Age · ${profile.age.takeIf { it > 0 }?.toString() ?: "Not set"}", Gold)
                    }

                    // Headline or Vibe Line / Role
                    val headline = when {
                        profile.vibeLine.isNotBlank() -> profile.vibeLine
                        profile.city.isNotBlank() -> "Explorer from ${profile.city}"
                        else -> "Yugm Community Creator"
                    }
                    Text(
                        text = headline,
                        color = Color(0xFFB0B6CF),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Normal,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )

                    // About section
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "About",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = profile.bio.ifBlank { "Welcome to my Yugm space! Connect, vibe, and join voice rooms with me." },
                        color = Color(0xFF9EA3B9),
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        maxLines = 3,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )

                    // Interests / Hobbies pills
                    if (profile.interests.isNotEmpty() || profile.hobbies.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            profile.interests.take(2).forEach {
                                ProfilePill(it, Color(0xFFC4B5FD))
                            }
                            profile.hobbies.take(2).forEach {
                                ProfilePill("🎸 $it", Gold.copy(alpha = 0.88f))
                            }
                        }
                    }

                    // Stats strip at bottom: Posts | Following | Followers
                    Spacer(Modifier.height(14.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0x2EFFFFFF))
                            .padding(vertical = 10.dp, horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        HeroStatChip(
                            label = "Level",
                            value = "${profile.level}",
                            modifier = Modifier.weight(1f),
                            onClick = null
                        )
                        Box(
                            Modifier
                                .width(1.dp)
                                .height(26.dp)
                                .background(Color(0x2EFFFFFF))
                        )
                        HeroStatChip(
                            label = "Following",
                            value = "${profile.followingCount}",
                            modifier = Modifier.weight(1f),
                            onClick = { onOpenSocialList?.invoke("following") }
                        )
                        Box(
                            Modifier
                                .width(1.dp)
                                .height(26.dp)
                                .background(Color(0x2EFFFFFF))
                        )
                        HeroStatChip(
                            label = "Followers",
                            value = "${profile.followers}",
                            modifier = Modifier.weight(1f),
                            onClick = { onOpenSocialList?.invoke("followers") }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileMenuCard(
    onCustomize: () -> Unit,
    onStore: () -> Unit,
    onVip: () -> Unit,
    onTasks: () -> Unit,
    onLevel: () -> Unit,
    onWallet: () -> Unit,
    onInventory: () -> Unit,
    onSettings: () -> Unit
) {
    val actions = listOf(
        Triple("🎨", "Customize", onCustomize), Triple("🛍️", "Store", onStore),
        Triple("👑", "VIP", onVip), Triple("✦", "Level", onLevel),
        Triple("✓", "Tasks", onTasks), Triple("◈", "Wallet", onWallet),
        Triple("🎒", "Inventory", onInventory), Triple("⚙", "Settings", onSettings)
    )
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Your Yugm", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("Profile shortcuts", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp, bottom = 10.dp))
        actions.chunked(4).forEach { rowActions ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                rowActions.forEach { (glyph, label, action) ->
                    Column(
                        Modifier.weight(1f).heightIn(min = 72.dp).clip(RoundedCornerShape(14.dp))
                            .clickable(role = androidx.compose.ui.semantics.Role.Button, onClickLabel = label, onClick = action)
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Color(0xFF30264F)), contentAlignment = Alignment.Center) {
                            Text(glyph, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                        Text(label, color = TextPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
                repeat(4 - rowActions.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ProfilePill(text: String, tint: Color) {
    Box(Modifier.clip(RoundedCornerShape(20.dp)).background(Color.Black.copy(alpha = .24f)).border(1.dp, Color.White.copy(alpha = .16f), RoundedCornerShape(20.dp)).padding(horizontal = 9.dp, vertical = 5.dp)) {
        Text(text, color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun HeroStatChip(label: String, value: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Column(
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable(role = androidx.compose.ui.semantics.Role.Button, onClickLabel = label, onClick = onClick) else Modifier)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(value, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
        Text(label, color = Color.White.copy(alpha = 0.65f), fontSize = 10.sp, fontWeight = FontWeight.Medium)
    }
}

private fun nameStyleColor(value: String): Color = when {
    value.contains("gold", true) -> Gold
    value.contains("neon", true) -> Color(0xFF55E6FF)
    value.contains("rainbow", true) -> Color(0xFFD5A7FF)
    else -> TextPrimary
}

@Composable
private fun ProfileAction(
    icon: ImageVector,
    label: String,
    highlight: Boolean = false,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    onClick: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(68.dp).heightIn(min = 56.dp).semantics { contentDescription = label }.clickable(enabled = enabled, role = androidx.compose.ui.semantics.Role.Button, onClickLabel = label, onClick = onClick)) {
        Box(
            Modifier.size(46.dp).clip(CircleShape).background(if (highlight) Brush.linearGradient(listOf(Pink, PrimaryPurple)) else Brush.linearGradient(listOf(Color(0xFF2A2D42), SurfaceElevated))).border(1.dp, if (highlight) Pink.copy(alpha = 0.5f) else BorderColor, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(19.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }
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

private val PresetInterests = listOf(
    "Music 🎵", "Gaming 🎮", "Anime 🍿", "Movies 🎬", "Tech 💻", "Travel ✈️",
    "Foodie 🍜", "Fitness 🏋️", "Art 🎨", "Books 📚", "Photography 📸", "Fashion 👗",
    "Nature 🌿", "Coffee ☕", "Crypto 🪙", "Pets 🐾"
)

private val PresetHobbies = listOf(
    "Guitar 🎸", "Singing 🎤", "Dancing 🕺", "Cooking 🍳", "Writing ✍️", "Chess ♟️",
    "Skating 🛹", "DJing 🎧", "Painting 🖌️", "Hiking 🏕️", "Gaming 🕹️", "Cycling 🚲",
    "Swimming 🏊", "Reading 📖"
)

@Composable
private fun ProfileCompletionCard(
    profile: Host,
    onCompleteClick: () -> Unit,
    onAddAvatar: () -> Unit
) {
    val tasks = listOf(
        Triple(!profile.avatar.isNullOrBlank(), "Avatar", 20),
        Triple(profile.bio.isNotBlank() && profile.bio.length >= 10, "Bio", 15),
        Triple(profile.vibeLine.isNotBlank(), "Vibe Line", 15),
        Triple(profile.interests.isNotEmpty(), "Interests", 20),
        Triple(profile.hobbies.isNotEmpty(), "Hobbies", 15),
        Triple(profile.city.isNotBlank(), "City", 15)
    )
    val score = tasks.filter { it.first }.sumOf { it.third }
    val isComplete = score >= 100

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        if (isComplete) "🌟 100% Vibe Master" else "Vibe Profile Strength",
                        color = if (isComplete) Gold else Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        if (isComplete) "Your profile is fully completed and boosted in discovery!" else "Complete your profile to unlock more matches & boosts",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (isComplete) Gold.copy(alpha = 0.2f) else PrimaryPurple.copy(alpha = 0.3f))
                        .border(1.dp, if (isComplete) Gold else PrimaryPurple, RoundedCornerShape(50))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        "$score%",
                        color = if (isComplete) Gold else Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            // Glowing progress bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0x33FFFFFF))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(score.toFloat() / 100f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(4.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(PrimaryPink, PrimaryPurple, Gold)
                            )
                        )
                )
            }

            if (!isComplete) {
                // Action chips for missing steps
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    tasks.filter { !it.first }.forEach { (_, label, weight) ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0x22FFFFFF))
                                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                .clickable {
                                    if (label == "Avatar") onAddAvatar() else onCompleteClick()
                                }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                "+$weight $label",
                                color = Gold,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Button(
                    onClick = onCompleteClick,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().height(38.dp)
                ) {
                    Text("Complete Profile Details", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

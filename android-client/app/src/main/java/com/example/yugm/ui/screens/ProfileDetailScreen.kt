package com.example.yugm.ui.screens

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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.example.yugm.R
import com.example.yugm.api.VibeApi
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStats
import com.example.yugm.model.Room
import com.example.yugm.ui.components.*
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileDetailScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onMessage: (String) -> Unit,
    onInviteToRoom: (String) -> Unit,
    onOpenRoom: (Room) -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    var host by remember { mutableStateOf<Host?>(null) }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var followers by remember { mutableStateOf<List<Host>>(emptyList()) }
    var following by remember { mutableStateOf<List<Host>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isFollowing by remember { mutableStateOf(false) }
    var followBusy by remember { mutableStateOf(false) }
    var liked by remember { mutableStateOf(false) }
    var pkStats by remember { mutableStateOf(PkStats()) }
    var pkHistory by remember { mutableStateOf<List<PkBattle>>(emptyList()) }
    var vibeMatch by remember { mutableStateOf<com.example.yugm.model.VibeMatchResponse?>(null) }

    var showReportDialog by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf("") }
    var showBlockConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(userId, token) {
        isLoading = true
        runCatching {
            YugmApi.getUser(userId, token.ifBlank { null })
        }.onSuccess {
            host = it
            isFollowing = it.isFollowing
        }
        runCatching {
            YugmApi.getUserRooms(userId, token.ifBlank { null })
        }.onSuccess {
            rooms = it
        }
        runCatching {
            YugmApi.getFollowers(userId, token.ifBlank { null })
        }.onSuccess {
            followers = it
        }
        runCatching {
            YugmApi.getFollowing(userId, token.ifBlank { null })
        }.onSuccess {
            following = it
        }
        if (token.isNotBlank()) {
            runCatching { YugmApi.pkStats(token, userId) }.onSuccess { pkStats = it }
            runCatching { YugmApi.pkHistory(token, userId) }.onSuccess { pkHistory = it }
            runCatching { VibeApi.match(token, userId) }.onSuccess { vibeMatch = it }
        }
        isLoading = false
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Yugm", color = Color.White, fontWeight = FontWeight.Black) },
                    navigationIcon = {
                        TextButton(onClick = onBack) {
                            Text("‹", color = Color.White, fontSize = 28.sp)
                        }
                    },
                    actions = { Text("⋮", color = Color.White, fontSize = 24.sp, modifier = Modifier.padding(horizontal = 16.dp).clickable { showReportDialog = true }) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
                )
            },
            bottomBar = {
            host?.let { profile ->
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
                            if (!liked) coroutineScope.launch {
                                runCatching { YugmApi.datingLike(token, profile.id, "LIKE") }.onSuccess { liked = true }
                            }
                        }
                        ProfileAction("●●", "Message") { onMessage(profile.id) }
                        ProfileAction(if (isFollowing) "✓" else "+", if (isFollowing) "Following" else "Follow", highlight = true) {
                            if (!followBusy) {
                                followBusy = true
                                coroutineScope.launch {
                                    runCatching { if (isFollowing) YugmApi.unfollowUser(token, profile.id) else YugmApi.followUser(token, profile.id) }
                                        .onSuccess { isFollowing = !isFollowing }
                                    followBusy = false
                                }
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
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Retrieving profile info...")
            }
        } else if (host == null) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("User not found.", color = Color.White, fontWeight = FontWeight.Bold)
            }
        } else {
            val profile = host!!
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
                        ProfileHero(profile)
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
                                StatCard("Followers", "${profile.followers.coerceAtLeast(followers.size)}", Modifier.weight(1f))
                                StatCard("Following", "${profile.followingCount.coerceAtLeast(following.size)}", Modifier.weight(1f))
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

                if (pkHistory.isNotEmpty()) {
                    item {
                        Text("Recent PK battles", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    items(pkHistory.take(5), key = { it.id }) { battle ->
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

                if (followers.isNotEmpty() || following.isNotEmpty()) {
                    item {
                        Text("Social Proof", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "Followed by ${followers.take(3).joinToString { it.name.ifBlank { it.username } }.ifBlank { "new people" }}",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            if (following.isNotEmpty()) {
                                Text(
                                    text = "Recently followed ${following.take(3).joinToString { it.name.ifBlank { it.username } }}",
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
                if (rooms.isNotEmpty()) {
                    item {
                        Text("Live Rooms by Host", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                    items(rooms.size) { index ->
                        val room = rooms[index]
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
                            runCatching {
                                YugmApi.reportUser(token, "", userId, reportReason)
                            }
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
                            runCatching {
                                YugmApi.blockUser(userId, token)
                            }
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
private fun ProfileHero(profile: Host) {
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
            Image(
                painter = painterResource(R.drawable.late_night_rooftop),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Background.copy(alpha = 0.97f)))))
        Row(Modifier.align(Alignment.TopStart).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.clip(RoundedCornerShape(10.dp)).background(Background.copy(alpha = 0.78f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                Text(if (profile.isOnline) "●  Online" else "Recently active", color = if (profile.isOnline) Success else TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.weight(1f))
            Box(Modifier.size(76.dp).clip(CircleShape).background(Background.copy(alpha = 0.72f)).border(2.dp, Pink, CircleShape), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("♡ ${profile.vibeScore.coerceAtLeast(80)}%", color = Pink, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Compatible", color = TextMuted, fontSize = 8.sp)
                }
            }
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${profile.name}  ${profile.age.takeIf { it > 0 } ?: 21}", color = Color.White, fontSize = 29.sp, fontWeight = FontWeight.Black)
                if (profile.isVip) Text("  ◆", color = PrimaryPurple, fontSize = 17.sp)
            }
            Text("⌖ ${profile.city.ifBlank { "India" }}", color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
            Text(profile.bio.ifBlank { "Dreamer. Overthinker. Night owl. Looking for good energy and real vibes ✨" }, color = Color.White.copy(alpha = 0.86f), fontSize = 12.sp, lineHeight = 17.sp, maxLines = 3, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.padding(top = 9.dp))
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
private fun ProfileAction(glyph: String, label: String, highlight: Boolean = false, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(64.dp).clickable(onClick = onClick)) {
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

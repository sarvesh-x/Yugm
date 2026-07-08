package com.example.yugm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileDetailScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onMessage: (String) -> Unit,
    onInviteToRoom: (String) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var host by remember { mutableStateOf<Host?>(null) }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isFollowing by remember { mutableStateOf(false) }
    var followBusy by remember { mutableStateOf(false) }

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
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile Detail", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
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
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Follow Button
                        Button(
                            onClick = {
                                if (followBusy) return@Button
                                followBusy = true
                                coroutineScope.launch {
                                    runCatching {
                                        if (isFollowing) YugmApi.unfollowUser(token, profile.id)
                                        else YugmApi.followUser(token, profile.id)
                                    }.onSuccess {
                                        isFollowing = !isFollowing
                                    }
                                    followBusy = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isFollowing) Color.Gray else PrimaryPink
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(if (isFollowing) "Unfollow" else "Follow", color = Color.White, fontWeight = FontWeight.Bold)
                        }

                        // Message Button
                        Button(
                            onClick = { onMessage(profile.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = SaffronGold),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Message", color = Background, fontWeight = FontWeight.Black)
                        }

                        // Invite Button
                        Button(
                            onClick = { onInviteToRoom(profile.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Invite", color = Color.White, fontWeight = FontWeight.Bold)
                        }
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
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Avatar(
                            initial = profile.name.firstOrNull()?.toString() ?: "?",
                            size = 110,
                            imageUrl = profile.avatar,
                            cosmetics = profile.activeCosmetics,
                            showEntry = true
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "${profile.name}, ${profile.age.takeIf { it > 0 } ?: 21}",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = "@${profile.username} • ${profile.city}",
                            color = TextMuted,
                            fontSize = 14.sp
                        )
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
                                .clickable {
                                    // Join room logic
                                }
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

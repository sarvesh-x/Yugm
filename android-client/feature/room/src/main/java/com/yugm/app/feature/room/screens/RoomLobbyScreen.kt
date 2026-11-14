package com.yugm.app.feature.room.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomDetail
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.DangerRed
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SaffronGold
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.util.cosmeticDisplayName
import com.yugm.app.feature.room.viewmodel.RoomViewModel
import kotlinx.coroutines.launch

private val PreviewCardBg = Color(0xFF141224)
private val PreviewBorder = Color(0x28FFFFFF)
private val PreviewAccentPurple = Color(0xFF8D35F6)

@Composable
fun RoomLobbyScreen(
    token: String,
    roomId: String,
    fallbackType: RoomType,
    currentUserId: String = "",
    onBack: () -> Unit,
    onJoin: (RoomType) -> Unit,
    onOpenProfile: (String) -> Unit,
    onEdit: ((String) -> Unit)? = null,
    onOpenModes: (() -> Unit)? = null,
    viewModel: RoomViewModel = hiltViewModel()
) {
    var detail by remember { mutableStateOf<RoomDetail?>(null) }
    var polls by remember { mutableStateOf<List<RoomPoll>>(emptyList()) }
    var missions by remember { mutableStateOf<List<RoomMission>>(emptyList()) }
    var activity by remember { mutableStateOf<List<RoomActivityItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showReportDialog by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf("") }
    var reportHostId by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(roomId, token) {
        isLoading = true
        viewModel.connect(token, roomId, currentUserId)
    }
    LaunchedEffect(viewModel.roomDetail) {
        viewModel.roomDetail?.let { rd ->
            detail = rd
            polls = viewModel.polls
            missions = viewModel.missions
            activity = viewModel.activity
            isLoading = false
        }
    }

    Box(Modifier.fillMaxSize().background(Background)) {
        AuroraBackground(speed = 0.4f)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Top App Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color(0x33FFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Text(
                    text = "Room Preview",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )

                IconButton(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Room Link", "yugm.live/room/$roomId"))
                        Toast.makeText(context, "Room link copied!", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color(0x33FFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.Filled.Share,
                        contentDescription = "Share",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            if (isLoading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading room preview...")
                }
            } else if (error != null || detail == null) {
                Box(Modifier.weight(1f).fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(
                        text = error ?: "This room could not be loaded or has ended.",
                        color = TextMuted,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                val payload = detail!!
                val room = payload.room
                val host = room.host

                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // ================= 1. HERO ROOM CARD =================
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(22.dp))
                                .background(PreviewCardBg)
                                .border(1.dp, PreviewBorder, RoundedCornerShape(22.dp))
                                .padding(16.dp)
                        ) {
                            // Header tags: Status, Category, Room ID
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    // Live Pulse Pill
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(50))
                                            .background(Color(0x3300E676))
                                            .border(1.dp, Color(0xFF00E676), RoundedCornerShape(50))
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFF00E676))
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("LIVE NOW", color = Color(0xFF00E676), fontSize = 10.sp, fontWeight = FontWeight.Black)
                                    }

                                    // Category Pill
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(50))
                                            .background(Color(0x338D35F6))
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text(room.category.ifBlank { "Voice" }, color = Color(0xFFC084FC), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }

                                    if (room.vipOnly) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(50))
                                                .background(Color(0x33FFD54F))
                                                .border(1.dp, Gold, RoundedCornerShape(50))
                                                .padding(horizontal = 8.dp, vertical = 3.dp)
                                        ) {
                                            Text("VIP ONLY", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                        }
                                    }
                                }

                                // Unique Room ID pill with copy button
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(Color(0x33FFFFFF))
                                        .clickable {
                                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            clipboard.setPrimaryClip(ClipData.newPlainText("Room ID", room.id))
                                            Toast.makeText(context, "Room ID copied: ${room.id.takeLast(8)}", Toast.LENGTH_SHORT).show()
                                        }
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text("ID:${room.id.takeLast(8)}", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(Icons.Filled.ContentCopy, contentDescription = "Copy", tint = TextMuted, modifier = Modifier.size(11.dp))
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            // Room Title with Cover Avatar Thumbnail
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                // Never substitute the host's profile photo for room artwork.
                                val cover = room.coverImage
                                Box(
                                    modifier = Modifier
                                        .size(68.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Brush.linearGradient(listOf(PreviewAccentPurple, Pink))),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (!cover.isNullOrBlank()) {
                                        AsyncImage(
                                            model = cover,
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop
                                        )
                                    } else {
                                        Text("🎙️", fontSize = 32.sp)
                                    }
                                }

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = room.title.ifBlank { "Voice Room" },
                                        color = Color.White,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "${room.participants} listening • ${room.language.ifBlank { "English" }}",
                                        color = TextMuted,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            // Room Description
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = room.description.ifBlank { "Welcome to our room! Join the vibe, talk with new people, and enjoy the stream." },
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 13.sp,
                                lineHeight = 19.sp
                            )

                            // Room Cosmetics pills (Theme, Ambience, Badge)
                            if (room.theme.isNotBlank() || room.ambience.isNotBlank() || room.badge.isNotBlank()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    if (room.theme.isNotBlank()) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(Color(0x22FFFFFF))
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text("🎨 ${cosmeticDisplayName(room.theme)}", color = TextMuted, fontSize = 11.sp)
                                        }
                                    }
                                    if (room.ambience.isNotBlank()) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(Color(0x22FFFFFF))
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text("♪ ${cosmeticDisplayName(room.ambience)}", color = TextMuted, fontSize = 11.sp)
                                        }
                                    }
                                    if (room.badge.isNotBlank()) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(Color(0x22FFFFFF))
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text("🏷️ ${cosmeticDisplayName(room.badge)}", color = Gold, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ================= 2. HOST PROFILE CARD =================
                    if (host != null) {
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(PreviewCardBg)
                                    .border(1.dp, PreviewBorder, RoundedCornerShape(18.dp))
                                    .padding(14.dp)
                            ) {
                                Text("Room Host", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Avatar(
                                        initial = host.name.take(1),
                                        size = 46,
                                        imageUrl = host.avatar,
                                        cosmetics = host.activeCosmetics
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(host.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                        Text("@${host.username.ifBlank { "host" }} • ${host.followers} followers", color = TextMuted, fontSize = 12.sp)
                                    }
                                    Button(
                                        onClick = { onOpenProfile(host.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x33FFFFFF)),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Text("Profile", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    // ================= 3. STAGE PREVIEW (ACTIVE SPEAKERS) =================
                    val speakers = payload.participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
                    if (speakers.isNotEmpty()) {
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(PreviewCardBg)
                                    .border(1.dp, PreviewBorder, RoundedCornerShape(18.dp))
                                    .padding(14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Active on Stage", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("${speakers.size}/${room.maxSpeakers} mics", color = TextMuted, fontSize = 12.sp)
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                    items(speakers.take(6)) { spk ->
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            modifier = Modifier.width(56.dp)
                                        ) {
                                            Avatar(
                                                initial = spk.user.name.take(1),
                                                size = 44,
                                                imageUrl = spk.user.avatar,
                                                cosmetics = spk.user.activeCosmetics
                                            )
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = spk.user.name,
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ================= 4. ROOM PERKS & BOOSTS =================
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(PreviewCardBg)
                                .border(1.dp, PreviewBorder, RoundedCornerShape(18.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Room Perks & Experience", color = Gold, fontWeight = FontWeight.Black, fontSize = 13.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("💎", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("1.5x Intimacy & Room XP on all gifts", color = Color.White, fontSize = 12.sp)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("✨", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Cosmic Soundstage with High-Fidelity Audio", color = Color.White, fontSize = 12.sp)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("👑", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("VIP Stage Frame Priority for active members", color = Color.White, fontSize = 12.sp)
                            }
                        }
                    }

                    // Extra host controls if own room
                    if (host?.id == currentUserId && onEdit != null) {
                        item {
                            Button(
                                onClick = { onEdit(roomId) },
                                modifier = Modifier.fillMaxWidth().height(44.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0x33FFFFFF)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Filled.Edit, contentDescription = null, tint = Gold, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Edit Room Settings", color = Gold, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    item { Spacer(modifier = Modifier.height(8.dp)) }
                }

                // ================= 5. STICKY BOTTOM ACTION BAR =================
                Surface(
                    color = Color(0xF20B0A17),
                    border = BorderStroke(1.dp, PreviewBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Button(
                            onClick = { onJoin(room.type.takeUnless { room.id.isBlank() } ?: fallbackType) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PreviewAccentPurple
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Step Inside & Join Stage", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }

    if (showReportDialog) {
        val reasons = listOf("Inappropriate content", "Harassment", "Spam", "Fake profile", "Other")
        AlertDialog(
            onDismissRequest = { showReportDialog = false },
            title = { Text("Report Host", color = Color.White, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    Text("Select a reason for reporting:", color = TextMuted)
                    reasons.forEach { reason ->
                        Row(Modifier.fillMaxWidth().clickable { reportReason = reason }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Text(reason, color = Color.White, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.reportUser(reportHostId, reportReason)
                        Toast.makeText(context, "Report submitted", Toast.LENGTH_SHORT).show()
                        showReportDialog = false
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
            containerColor = Color(0xFF171522)
        )
    }
}

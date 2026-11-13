package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.cosmetics.StyledName
import com.yugm.app.core.ui.cosmetics.profileThemeColors
import com.yugm.app.core.ui.theme.*
import com.yugm.app.feature.profile.viewmodel.ProfileViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicProfilePreviewScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onOpenCustomize: () -> Unit = {}
) {
    val viewModel: ProfileViewModel = hiltViewModel()

    LaunchedEffect(userId, token) {
        viewModel.loadProfile(token, userId, force = true)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Public Profile Preview", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text("How others see your profile", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    TextButton(onClick = onOpenCustomize) {
                        Icon(Icons.Filled.Edit, contentDescription = null, tint = Gold, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Customize", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        bottomBar = {
            Surface(
                color = SurfaceElevated,
                border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onBack,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Close Preview", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = onOpenCustomize,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("🎨 Edit Look", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        containerColor = Background
    ) { innerPadding ->
        if (viewModel.isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Generating public preview...")
            }
        } else if (viewModel.profile == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = viewModel.profileLoadError ?: "Could not load profile preview.",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(12.dp))
                Button(onClick = { viewModel.loadProfile(token, userId, force = true) }) {
                    Text("Retry")
                }
            }
        } else {
            val profile = viewModel.profile!!
            val pkStats = viewModel.pkStats ?: com.yugm.app.core.model.PkStats()

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Informative banner explaining public view
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(Gold.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.Visibility, contentDescription = null, tint = Gold, modifier = Modifier.size(20.dp))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Public View Enabled", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text("This preview shows your equipped avatar frame, profile theme, and cosmetics as seen by visitors.", color = TextMuted, fontSize = 11.sp)
                            }
                        }
                    }
                }

                // Profile Hero with applied theme, frame, name style
                item {
                    PublicHeroCard(profile = profile)
                }

                // Stats row
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                            StatCard("Followers", "${profile.followers}", Modifier.weight(1f))
                            StatCard("Following", "${profile.followingCount}", Modifier.weight(1f))
                            StatCard("Level", "${profile.level}", Modifier.weight(1f))
                        }
                    }
                }

                // PK Record
                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text("PK Record", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                            StatCard("Wins", "${pkStats.wins}", Modifier.weight(1f))
                            StatCard("Win Rate", "${pkStats.winRate}%", Modifier.weight(1f))
                            StatCard("Streak", "${pkStats.bestStreak}", Modifier.weight(1f))
                        }
                    }
                }

                // Bio & Vibe
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("About Me", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(
                                text = profile.bio.ifBlank { "No bio provided." },
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 13.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }
                }

                // Interests Section
                if (profile.interests.isNotEmpty()) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Interests & Passions 🎯", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    profile.interests.forEach { interest ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(PrimaryPurple.copy(alpha = 0.3f))
                                                .border(1.dp, PrimaryPurple.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                                .padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                            Text(interest, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Hobbies Section
                if (profile.hobbies.isNotEmpty()) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Hobbies & Activities 🎸", color = Gold, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    profile.hobbies.forEach { hobby ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(Gold.copy(alpha = 0.2f))
                                                .border(1.dp, Gold.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                                                .padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                            Text(hobby, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Preview Visitor Actions (What visitors see)
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Visitor Actions (Preview)", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                PreviewVisitorAction("♥", "Like")
                                PreviewVisitorAction("💬", "Message")
                                PreviewVisitorAction("+", "Follow")
                                PreviewVisitorAction("◖", "Invite")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PublicHeroCard(profile: Host) {
    val themeColors = profileThemeColors(profile.activeCosmetics.profileTheme)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(themeColors))
            .border(1.dp, PrimaryPurple.copy(alpha = 0.5f), RoundedCornerShape(24.dp))
            .padding(18.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Avatar(
                    initial = profile.name.firstOrNull()?.toString() ?: "?",
                    size = 88,
                    imageUrl = profile.avatar,
                    cosmetics = profile.activeCosmetics
                )

                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = if (profile.isOnline) "● ONLINE" else "OFFLINE",
                        color = if (profile.isOnline) Color(0xFF6EE7B7) else TextMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )

                    StyledName(
                        text = profile.name.ifBlank { "User" },
                        nameStyle = profile.activeCosmetics.nameStyle,
                        fontSize = 22,
                        maxLines = 1
                    )

                    if (profile.username.isNotBlank()) {
                        Text("@${profile.username}", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (profile.isVip) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Gold.copy(alpha = 0.3f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("👑 VIP", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (profile.activeCosmetics.profileBadge.isNotBlank()) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(PrimaryPurple.copy(alpha = 0.4f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    profile.activeCosmetics.profileBadge.substringAfterLast('_').replaceFirstChar { it.uppercase() },
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            if (profile.vibeLine.isNotBlank()) {
                Text(
                    text = "“${profile.vibeLine}”",
                    color = Gold,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            if (profile.city.isNotBlank()) {
                Text("📍 ${profile.city}", color = TextMuted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun PreviewVisitorAction(glyph: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(Color(0xFF242038))
                .border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(glyph, fontSize = 16.sp, color = Color.White)
        }
        Text(label, color = TextMuted, fontSize = 10.sp)
    }
}

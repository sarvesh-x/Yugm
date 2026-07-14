package com.example.yugm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.YugmBottomDock
import com.example.yugm.ui.components.YugmDockTab
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchesScreen(
    token: String,
    onOpenChat: (String) -> Unit,
    onDiscover: () -> Unit,
    onDating: () -> Unit,
    onCreateRoom: () -> Unit,
    onWallet: () -> Unit,
    onProfile: () -> Unit,
    onBack: () -> Unit
) {
    var matches by remember { mutableStateOf<List<Host>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        if (token.isNotBlank()) {
            isLoading = true
            runCatching { YugmApi.datingMatches(token) }
                .onSuccess { matches = it }
            isLoading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Your Matches", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background,
        bottomBar = {
            YugmBottomDock(
                selected = YugmDockTab.MATCH,
                onDiscover = onDiscover,
                onMatch = onDating,
                onCreate = onCreateRoom,
                onLive = onDating,
                onChat = {},
                onWallet = onWallet,
                onProfile = onProfile
            )
        }
    ) { innerPadding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Loading matches...")
            }
        } else if (matches.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(innerPadding).padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No matches yet", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(8.dp))
                    Text("Keep swiping to find your vibe!", color = TextMuted, fontSize = 14.sp)
                    Spacer(Modifier.height(20.dp))
                    Button(
                        onClick = onDating,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("Start Swiping", color = Color.White, fontWeight = FontWeight.Bold) }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("New Matches", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("${matches.size} total", color = TextMuted, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(8.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(matches) { match ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onOpenChat(match.id) }) {
                                Box(
                                    modifier = Modifier
                                        .size(64.dp)
                                        .clip(CircleShape)
                                        .background(Brush.radialGradient(listOf(PrimaryPink, Color.Transparent)))
                                        .padding(3.dp)
                                ) {
                                    Avatar(url = match.avatar, name = match.name, size = 64)
                                }
                                Text(match.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.width(64.dp))
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(8.dp)) }
                matches.forEach { match ->
                    item {
                        Surface(
                            onClick = { onOpenChat(match.id) },
                            color = SurfaceElevated,
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Avatar(url = match.avatar, name = match.name, size = 52)
                                Spacer(Modifier.width(14.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(match.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    match.city?.let {
                                        Text(it, color = TextMuted, fontSize = 12.sp)
                                    }
                                }
                                if (match.isVip) {
                                    Surface(color = Gold, shape = RoundedCornerShape(4.dp)) {
                                        Text("VIP", color = Background, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

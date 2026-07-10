package com.example.yugm.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    partner: Host?,
    currentUserId: String,
    messages: List<DirectMessage>,
    relationship: RelationshipStatus?,
    gifts: List<com.example.yugm.model.GiftItem> = emptyList(),
    balance: Int = 0,
    loading: Boolean = false,
    isPartnerTyping: Boolean = false,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String) -> Unit = {},
    onGift: (com.example.yugm.model.GiftItem) -> Unit = {},
    onTyping: (Boolean) -> Unit = {}
) {
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    var showGiftSheet by remember { mutableStateOf(false) }

    var isTyping by remember { mutableStateOf(false) }

    LaunchedEffect(draft) {
        if (draft.isNotBlank()) {
            if (!isTyping) {
                isTyping = true
                onTyping(true)
            }
            // Debounce for 2 seconds of inactivity
            kotlinx.coroutines.delay(2000)
            isTyping = false
            onTyping(false)
        } else {
            if (isTyping) {
                isTyping = false
                onTyping(false)
            }
        }
    }

    // Scroll to bottom when new messages arrive
    LaunchedEffect(messages.size, isPartnerTyping) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Avatar(
                            initial = partner?.name?.firstOrNull()?.toString() ?: "?",
                            size = 40,
                            imageUrl = partner?.avatar,
                            cosmetics = partner?.activeCosmetics ?: com.example.yugm.model.ActiveCosmetics()
                        )
                        Column {
                            Text(
                                text = partner?.name ?: "Yugm User",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp
                            )
                            Text(
                                text = relationship?.let { "Relationship L${it.level} • ${it.title}" } ?: "@${partner?.username ?: "chat"}",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                actions = {
                    // Gift Button Icon
                    IconButton(onClick = { showGiftSheet = true }) {
                        Text("🎁", fontSize = 22.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Main Messages Area
            if (loading && messages.isEmpty()) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    LoadingState("Retrieving conversation history...")
                }
            } else {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Relationship Bond Indicator Card
                        relationship?.let { bond ->
                            item {
                                GlassCard(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                                    Row(
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("Bonding Rank ${bond.level}", color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                        Text(bond.title, color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 8.dp)
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp))
                                            .background(Color.White.copy(alpha = 0.1f))
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth(bond.progress.coerceIn(0f, 1f))
                                                .height(6.dp)
                                                .background(Brush.horizontalGradient(listOf(Gold, PrimaryPink)))
                                        )
                                    }
                                }
                            }
                        }

                        items(messages) { message ->
                            val isMine = message.senderId == currentUserId
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start
                            ) {
                                Box(
                                    modifier = Modifier
                                        .clip(
                                            RoundedCornerShape(
                                                topStart = 16.dp,
                                                topEnd = 16.dp,
                                                bottomStart = if (isMine) 16.dp else 2.dp,
                                                bottomEnd = if (isMine) 2.dp else 16.dp
                                            )
                                        )
                                        .background(
                                            if (isMine) {
                                                Brush.linearGradient(listOf(PrimaryPink, PrimaryPurple))
                                            } else {
                                                Brush.linearGradient(listOf(SurfaceElevated, Surface))
                                            }
                                        )
                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                        .widthIn(max = 260.dp)
                                ) {
                                    Text(
                                        text = message.message,
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        lineHeight = 18.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    if (isPartnerTyping) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            TypingBubble()
                        }
                    }
                }
            }

            // Pinned Bottom Input Tray
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
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    TextField(
                        value = draft,
                        onValueChange = { draft = it },
                        placeholder = { Text("Say something nice...", color = TextMuted) },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Background,
                            unfocusedContainerColor = Background,
                            disabledContainerColor = Background,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        ),
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.weight(1f)
                    )

                    Button(
                        onClick = {
                            val text = draft.trim()
                            if (text.isNotBlank()) {
                                draft = ""
                                onSend(text)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Gold),
                        shape = RoundedCornerShape(20.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Text("Send", color = Background, fontWeight = FontWeight.Black)
                    }
                }
            }
        }

        // Gifts bottom sheet
        if (showGiftSheet) {
            ModalBottomSheet(
                onDismissRequest = { showGiftSheet = false },
                containerColor = SurfaceElevated
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Send a Virtual Gift", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Text("Your Balance: $balance Coins", color = Gold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Simple catalog items
                    val demoGifts = listOf(
                        com.example.yugm.model.GiftItem(id = "1", name = "Rose 🌹", price = 10),
                        com.example.yugm.model.GiftItem(id = "2", name = "Samosa 🥟", price = 25),
                        com.example.yugm.model.GiftItem(id = "3", name = "Jalebi 🍥", price = 50),
                        com.example.yugm.model.GiftItem(id = "4", name = "Taj Mahal 🏛️", price = 500)
                    )
                    
                    demoGifts.forEach { gift ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Background)
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(gift.name, color = Color.White, fontWeight = FontWeight.Bold)
                                Text("${gift.price} Coins", color = Gold, fontSize = 12.sp)
                            }
                            Button(
                                onClick = {
                                    if (balance >= gift.price) {
                                        onGift(gift)
                                        showGiftSheet = false
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Gold),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Send", color = Background, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TypingIndicatorDot(delay: Int) {
    val infiniteTransition = rememberInfiniteTransition()
    val offsetY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = -8f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 300, delayMillis = delay, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )
    Box(
        modifier = Modifier
            .size(6.dp)
            .offset(y = offsetY.dp)
            .clip(CircleShape)
            .background(Color.White)
    )
}

@Composable
fun TypingBubble() {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 2.dp, bottomEnd = 16.dp))
            .background(Brush.linearGradient(listOf(SurfaceElevated, Surface)))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TypingIndicatorDot(delay = 0)
        TypingIndicatorDot(delay = 100)
        TypingIndicatorDot(delay = 200)
    }
}

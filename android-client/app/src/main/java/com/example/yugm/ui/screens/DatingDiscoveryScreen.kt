package com.example.yugm.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.example.yugm.model.Host
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.RoundAction
import com.example.yugm.ui.components.SegmentedTabs
import com.example.yugm.ui.components.YugmBottomDock
import com.example.yugm.ui.components.YugmDockTab
import com.example.yugm.ui.theme.*
import com.example.yugm.ui.viewmodel.DatingViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun DatingDiscoveryScreen(
    token: String,
    onNavigateToChat: (String) -> Unit,
    onNavigateToProfile: (String) -> Unit,
    onMatches: () -> Unit = {},
    onDiscover: () -> Unit = {},
    onCreateRoom: () -> Unit = {},
    onLive: () -> Unit = {},
    onWallet: () -> Unit = {},
    onSelfProfile: () -> Unit = {},
    viewModel: DatingViewModel = hiltViewModel()
) {
    val coroutineScope = rememberCoroutineScope()
    var matchedCandidate by remember { mutableStateOf<Host?>(null) }
    val dragOffset = remember { Animatable(0f) }
    var discoveryMode by rememberSaveable { mutableIntStateOf(1) }
    var showFilters by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(token) {
        if (token.isNotBlank()) {
            viewModel.loadCandidates(token)
        }
    }

    LaunchedEffect(Unit) {
        viewModel.matchEvent.collectLatest { candidate ->
            matchedCandidate = candidate
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 90.dp) // Leave space for bottom bar
        ) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                BrandHeader(compact = true)
                Spacer(Modifier.weight(1f))
                RoundAction("●●", onClick = onMatches)
                Spacer(Modifier.width(9.dp))
                RoundAction("☷", selected = showFilters, onClick = { showFilters = !showFilters })
            }
            Text("Find your vibe.", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp))
            SegmentedTabs(
                items = listOf("⌖" to "Nearby", "✦" to "For You", "◇" to "Verified"),
                selectedIndex = discoveryMode,
                onSelected = { discoveryMode = it; viewModel.loadCandidates(token) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
            )
            AnimatedVisibility(showFilters) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val filterChips = listOf(
                        "age" to "18–25",
                        "online" to "Online now",
                        "distance" to "Within 25 km",
                        "interests" to "Shared interests"
                    )
                    filterChips.forEach { (key, label) ->
                        val isSelected = viewModel.activeFilters.contains(key)
                        Surface(
                            onClick = { viewModel.toggleFilter(key); viewModel.loadCandidates(token) },
                            color = if (isSelected) PrimaryPink else SurfaceElevated,
                            shape = RoundedCornerShape(13.dp),
                            border = BorderStroke(1.dp, if (isSelected) PrimaryPink else BorderColor)
                        ) {
                            Text(label, color = if (isSelected) Color.White else TextPrimary, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp))
                        }
                    }
                }
            }

            if (viewModel.isLoading && viewModel.candidates.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Scanning the vibe scene...")
                }
            } else if (viewModel.candidates.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "No more vibes nearby!",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Try changing your settings or check back in a bit for new faces.",
                            color = TextMuted,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(18.dp))
                        Button(
                            onClick = { viewModel.loadCandidates(token) },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Refresh Discovery", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val width = LocalConfiguration.current.screenWidthDp.toFloat()
                    val density = LocalDensity.current.density
                    val swipeThreshold = width * 0.4f * density

                    // Display back candidate card
                    if (viewModel.candidates.size > 1) {
                        val progress = (kotlin.math.abs(dragOffset.value) / swipeThreshold).coerceIn(0f, 1f)
                        val currentScale = 0.92f + (0.08f * progress)
                        val currentTranslationY = 30f * (1f - progress)
                        DiscoveryCard(
                            candidate = viewModel.candidates[1],
                            isTopCard = false,
                            modifier = Modifier.graphicsLayer {
                                scaleX = currentScale
                                scaleY = currentScale
                                translationY = currentTranslationY
                            },
                            onProfileClick = {}
                        )
                    }

                    // Display top candidate card with gestures
                    val topCandidate = viewModel.candidates[0]
                    var swipedRight by remember { mutableStateOf(false) }
                    var swipedLeft by remember { mutableStateOf(false) }

                    // Reset dragOffset on new candidate
                    LaunchedEffect(topCandidate.id) {
                        dragOffset.snapTo(0f)
                    }

                    DiscoveryCard(
                        candidate = topCandidate,
                        isTopCard = true,
                        dragOffset = dragOffset,
                        onSwipeRight = {
                            swipedRight = true
                            viewModel.like(token, topCandidate, "LIKE")
                        },
                        onSwipeLeft = {
                            swipedLeft = true
                            viewModel.pass(token, topCandidate.id)
                        },
                        onSuperLike = {
                            swipedRight = true
                            viewModel.like(token, topCandidate, "SUPER_LIKE")
                            coroutineScope.launch {
                                dragOffset.animateTo(width * 1.5f * density, animationSpec = tween(300))
                            }
                        },
                        onProfileClick = {
                            onNavigateToProfile(topCandidate.id)
                        }
                    )
                }
            }
        }

        // Mutual Match Overlay Dialog
        matchedCandidate?.let { partner ->
            Dialog(
                onDismissRequest = { matchedCandidate = null },
                properties = DialogProperties(usePlatformDefaultWidth = false)
            ) {
                MatchOverlayScreen(
                    partner = partner,
                    onStartChat = {
                        matchedCandidate = null
                        onNavigateToChat(partner.id)
                    },
                    onClose = { matchedCandidate = null }
                )
            }
        }
        YugmBottomDock(
            selected = YugmDockTab.MATCH,
            modifier = Modifier.align(Alignment.BottomCenter),
            onDiscover = onDiscover,
            onMatch = {},
            onCreate = onCreateRoom,
            onLive = onLive,
            onChat = onMatches,
            onWallet = onWallet,
            onProfile = onSelfProfile
        )
    }
}

@Composable
fun DiscoveryCard(
    candidate: Host,
    isTopCard: Boolean,
    modifier: Modifier = Modifier,
    dragOffset: Animatable<Float, *>? = null,
    onSwipeRight: () -> Unit = {},
    onSwipeLeft: () -> Unit = {},
    onSuperLike: () -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val width = LocalConfiguration.current.screenWidthDp.toFloat()
    val density = LocalDensity.current.density
    val swipeThreshold = width * 0.4f * density

    val localOffsetX = remember { Animatable(0f) }
    val offsetX = dragOffset ?: localOffsetX
    val offsetY = remember { Animatable(0f) }

    val dragModifier = if (isTopCard) {
        Modifier.pointerInput(Unit) {
            detectDragGestures(
                onDrag = { change, dragAmount ->
                    change.consume()
                    coroutineScope.launch {
                        offsetX.snapTo(offsetX.value + dragAmount.x)
                        offsetY.snapTo(offsetY.value + dragAmount.y)
                    }
                },
                onDragEnd = {
                    if (offsetX.value > swipeThreshold) {
                        coroutineScope.launch {
                            offsetX.animateTo(width * 1.5f * density, animationSpec = tween(300))
                            onSwipeRight()
                        }
                    } else if (offsetX.value < -swipeThreshold) {
                        coroutineScope.launch {
                            offsetX.animateTo(-width * 1.5f * density, animationSpec = tween(300))
                            onSwipeLeft()
                        }
                    } else {
                        coroutineScope.launch {
                            offsetX.animateTo(0f, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
                            offsetY.animateTo(0f, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
                        }
                    }
                }
            )
        }
    } else {
        Modifier
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .offset { IntOffset(offsetX.value.roundToInt(), offsetY.value.roundToInt()) }
            .graphicsLayer {
                rotationZ = (offsetX.value / 60).coerceIn(-15f, 15f)
            }
            .then(dragModifier)
            .clip(RoundedCornerShape(24.dp))
            .background(Surface)
            .clickable { onProfileClick() }
    ) {
        // Large Profile Photo Placeholder or URL
        val imageFallbackUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
        AsyncImage(
            model = candidate.avatar ?: imageFallbackUrl,
            contentDescription = "Profile Photo",
            modifier = Modifier.fillMaxSize(),
            contentScale = androidx.compose.ui.layout.ContentScale.Crop
        )

        // PASS indicator badge (fades in as user drags left)
        val passAlpha = ((-offsetX.value) / swipeThreshold).coerceIn(0f, 1f)
        if (passAlpha > 0f) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(24.dp)
                    .graphicsLayer { alpha = passAlpha }
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.Red.copy(alpha = 0.8f))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text("PASS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp)
            }
        }

        // LIKE indicator badge (fades in as user drags right)
        val likeAlpha = ((offsetX.value) / swipeThreshold).coerceIn(0f, 1f)
        if (likeAlpha > 0f) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(24.dp)
                    .graphicsLayer { alpha = likeAlpha }
                    .clip(RoundedCornerShape(8.dp))
                    .background(SuccessGreen.copy(alpha = 0.8f))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text("LIKE", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp)
            }
        }

        // Vignette Shadow Overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.4f),
                            Color.Black.copy(alpha = 0.95f)
                        )
                    )
                )
        )

        // Card Content
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .padding(20.dp)
        ) {
            // Vibe score badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.horizontalGradient(listOf(SaffronGold, PrimaryPink)))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "${candidate.vibeScore}% Vibe Match",
                    color = Color.White,
                    fontWeight = FontWeight.Black,
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // User Name and Age
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "${candidate.name}, ${candidate.age.takeIf { it > 0 } ?: 21}",
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black
                )
                if (candidate.isVip) {
                    Surface(
                        color = Gold,
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Text(
                            text = "VIP",
                            color = Background,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // City + Vibe Line
            Text(
                text = "${candidate.city} • ${candidate.vibe.ifBlank { "Looking for positive vibes" }}",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Interest Chips
            if (candidate.interests.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 10.dp)
                ) {
                    candidate.interests.take(3).forEach { interest ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color.White.copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(interest, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Swiping Actions bar (only for top card)
            if (isTopCard) {
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Pass (Cross) Button
                    IconButton(
                        onClick = onSwipeLeft,
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.12f))
                    ) {
                        Text("❌", fontSize = 18.sp)
                    }

                    // Super Like (Star) Button
                    IconButton(
                        onClick = onSuperLike,
                        modifier = Modifier
                            .size(62.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(SaffronGold, Color(0xFFFF8A22))))
                    ) {
                        Text("⭐️", fontSize = 22.sp)
                    }

                    // Like (Heart) Button
                    IconButton(
                        onClick = onSwipeRight,
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(PrimaryPink, PrimaryPurple)))
                    ) {
                        Text("❤️", fontSize = 20.sp)
                    }

                    IconButton(
                        onClick = onProfileClick,
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.12f))
                    ) {
                        Text("♙", fontSize = 22.sp, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun MatchOverlayScreen(
    partner: Host,
    onStartChat: () -> Unit,
    onClose: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background.copy(alpha = 0.95f))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "It's a Yugm!",
                color = Gold,
                fontSize = 42.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )
            Text(
                text = "You matched the vibe with ${partner.name}",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 10.dp, bottom = 40.dp)
            )

            // Side-by-Side Glowing Avatars
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.padding(bottom = 50.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .clip(CircleShape)
                        .background(Brush.radialGradient(listOf(PrimaryPink, Color.Transparent)))
                        .padding(4.dp)
                ) {
                    AsyncImage(
                        model = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80", // user placeholder
                        contentDescription = "Me",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                }
                Text("🔥", fontSize = 36.sp)
                Box(
                    modifier = Modifier
                        .size(110.dp)
                        .clip(CircleShape)
                        .background(Brush.radialGradient(listOf(Gold, Color.Transparent)))
                        .padding(4.dp)
                ) {
                    AsyncImage(
                        model = partner.avatar ?: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
                        contentDescription = "Partner",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                }
            }

            // Actions
            Button(
                onClick = onStartChat,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("Send message", color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedButton(
                onClick = onClose,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("Keep swiping", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

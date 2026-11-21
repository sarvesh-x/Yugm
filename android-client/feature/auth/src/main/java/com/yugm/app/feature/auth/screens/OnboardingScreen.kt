package com.yugm.app.feature.auth.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import com.yugm.app.core.ui.theme.*
import com.yugm.app.core.ui.avatar.GeneratedAvatar
import com.yugm.app.core.ui.avatar.AvatarDescriptor
import com.yugm.app.core.ui.avatar.AvatarParts
import com.yugm.app.feature.auth.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

data class OnboardingSlide(
    val id: Int,
    val title: String,
    val description: String,
)

@Composable
fun OnboardingScreen(onStart: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    val colors = LocalYugmColors.current
    val slides = remember {
        listOf(
            OnboardingSlide(
                id = 1,
                title = "Match the vibe",
                description = "Discover people who share your interests, energy and ambitions.",
            ),
            OnboardingSlide(
                id = 2,
                title = "Find your people",
                description = "Join voice rooms, communities and conversations that feel like you.",
            ),
            OnboardingSlide(
                id = 3,
                title = "Share every moment",
                description = "Watch together, play, celebrate and make memories in real time.",
            ),
            OnboardingSlide(
                id = 4,
                title = "Build meaningful bonds",
                description = "Turn everyday conversations into lasting connections.",
            )
        )
    }

    val pagerState = rememberPagerState(pageCount = { slides.size })

    // Multiavatar-generated avatars for onboarding illustrations (deterministic seeds).
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.onboardingBackground)
    ) {
        val compactLayout = maxHeight < 680.dp
        val isVeryShort = maxHeight < 420.dp
        val horizontalPadding = if (compactLayout) 16.dp else 24.dp

        // Ambient soft lavender/pink glow background behind the central illustration
        OnboardingBackground(
            glowLavender = colors.onboardingGlowLavender,
            glowPink = colors.onboardingGlowPink,
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = horizontalPadding),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header: Yugm logo & wordmark (left) + Skip button (right, hidden on 4th page)
            OnboardingHeader(
                showSkip = pagerState.currentPage < slides.size - 1,
                onSkip = onStart,
                compact = compactLayout,
                textColor = colors.onboardingTextPrimary,
                mutedColor = colors.onboardingTextSecondary,
            )

            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .semantics {
                        stateDescription = "Slide ${pagerState.currentPage + 1} of ${slides.size}"
                    }
            ) { page ->
                val slide = slides[page]
                BoxWithConstraints(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    val useVerticalScroll = isVeryShort || LocalDensity.current.fontScale >= 1.3f
                    val verticalGap = if (compactLayout) 16.dp else 28.dp

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (useVerticalScroll) {
                                    Modifier
                                        .heightIn(max = maxHeight)
                                        .verticalScroll(rememberScrollState())
                                } else {
                                    Modifier.fillMaxHeight()
                                }
                            )
                            .padding(vertical = if (compactLayout) 4.dp else 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = if (useVerticalScroll) Arrangement.Top else Arrangement.Center,
                    ) {
                        // Illustration Area (Approx 40-45% screen height)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(if (compactLayout) 220.dp else 290.dp)
                                .clearAndSetSemantics { },
                            contentAlignment = Alignment.Center
                        ) {
                            when (page) {
                                0 -> MatchVibeIllustration(compact = compactLayout)
                                1 -> FindPeopleIllustration(compact = compactLayout)
                                2 -> ShareMomentsIllustration(compact = compactLayout)
                                3 -> BuildBondsIllustration(compact = compactLayout)
                            }
                        }

                        Spacer(modifier = Modifier.height(verticalGap))

                        // Text Content Area (Heading + Supporting Description)
                        OnboardingContent(
                            title = slide.title,
                            description = slide.description,
                            textColor = colors.onboardingTextPrimary,
                            secondaryColor = colors.onboardingTextSecondary,
                            compact = compactLayout,
                        )
                    }
                }
            }

            // Footer Area: Page Indicator + Primary Action Button
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = if (compactLayout) 12.dp else 24.dp)
            ) {
                // Page Indicator
                OnboardingPageIndicator(
                    pageCount = slides.size,
                    currentPage = pagerState.currentPage,
                    modifier = Modifier.padding(bottom = if (compactLayout) 16.dp else 28.dp)
                )

                // Primary Button
                val isLastPage = pagerState.currentPage == slides.size - 1
                OnboardingPrimaryButton(
                    text = if (isLastPage) "Get started" else "Next",
                    onClick = {
                        if (isLastPage) {
                            onStart()
                        } else {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(pagerState.currentPage + 1)
                            }
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun OnboardingBackground(
    glowLavender: Color,
    glowPink: Color,
) {
    val motionEnabled = LocalMotionEnabled.current
    val (floatY1, floatY2, alpha1, alpha2) = if (motionEnabled) {
        val infiniteTransition = rememberInfiniteTransition(label = "bg_glow_floating")
        val y1 by infiniteTransition.animateFloat(
            initialValue = -14f,
            targetValue = 14f,
            animationSpec = infiniteRepeatable(
                animation = tween(4500, easing = LinearOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "floatY1"
        )
        val y2 by infiniteTransition.animateFloat(
            initialValue = 14f,
            targetValue = -14f,
            animationSpec = infiniteRepeatable(
                animation = tween(5500, easing = LinearOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "floatY2"
        )
        val a1 by infiniteTransition.animateFloat(
            initialValue = 0.45f,
            targetValue = 0.65f,
            animationSpec = infiniteRepeatable(
                animation = tween(3800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "alpha1"
        )
        val a2 by infiniteTransition.animateFloat(
            initialValue = 0.35f,
            targetValue = 0.55f,
            animationSpec = infiniteRepeatable(
                animation = tween(4200, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "alpha2"
        )
        listOf(y1, y2, a1, a2)
    } else {
        listOf(0f, 0f, 0.55f, 0.45f)
    }

    Canvas(modifier = Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val centerX = w * 0.5f
        val centerY = h * 0.38f

        drawCircle(
            color = glowLavender.copy(alpha = alpha1),
            radius = w * 0.55f,
            center = Offset(centerX - w * 0.1f, centerY - h * 0.05f + floatY1.dp.toPx())
        )
        drawCircle(
            color = glowPink.copy(alpha = alpha2),
            radius = w * 0.45f,
            center = Offset(centerX + w * 0.12f, centerY + h * 0.06f + floatY2.dp.toPx())
        )
    }
}

@Composable
private fun OnboardingHeader(
    showSkip: Boolean,
    onSkip: () -> Unit,
    compact: Boolean,
    textColor: Color,
    mutedColor: Color,
) {
    val context = LocalContext.current
    val appIcon = remember {
        runCatching {
            context.packageManager.getApplicationIcon(context.packageName).toBitmap(128, 128).asImageBitmap()
        }.getOrNull()
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = if (compact) 10.dp else 16.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Yugm Branding (Logo + Wordmark)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (appIcon != null) {
                Image(
                    bitmap = appIcon,
                    contentDescription = "Yugm",
                    modifier = Modifier.size(if (compact) 32.dp else 34.dp)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(if (compact) 32.dp else 34.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Brush.linearGradient(onboardingBrandGradient)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Y", color = Color.White, fontWeight = FontWeight.Black)
                }
            }

            Text(
                text = "Yugm",
                color = textColor,
                fontSize = if (compact) 21.sp else 23.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        // Skip Button (Hidden on page 4). Keep the button mounted (invisible) on the
        // last page so its size is reserved and the header does not pop/jump.
        TextButton(
            onClick = onSkip,
            enabled = showSkip,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            modifier = Modifier.alpha(if (showSkip) 1f else 0f)
        ) {
            Text(
                text = "Skip",
                color = mutedColor,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
        }
    }
}

/** Page 1 — Match the vibe: 3 floating profile cards with interest badges & match symbol */
@Composable
private fun MatchVibeIllustration(compact: Boolean) {
    val motionEnabled = LocalMotionEnabled.current
    val floatOffset = if (motionEnabled) {
        val infiniteTransition = rememberInfiniteTransition(label = "match_vibe_float")
        val offset by infiniteTransition.animateFloat(
            initialValue = -5f,
            targetValue = 5f,
            animationSpec = infiniteRepeatable(
                animation = tween(3200, easing = LinearOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "card_float"
        )
        offset
    } else 0f

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Orbit ring line behind cards
        Canvas(modifier = Modifier.size(if (compact) 230.dp else 290.dp)) {
            drawCircle(
                color = OnboardingBrandStart.copy(alpha = 0.12f),
                radius = size.width * 0.44f,
                style = Stroke(width = 1.5.dp.toPx())
            )
        }

        // Left Card (Tilted -8 deg, Gaming)
        Box(
            modifier = Modifier
                .offset(x = (-68).dp, y = ((-8) + floatOffset).dp)
                .graphicsLayer { rotationZ = -8f }
                .shadow(8.dp, RoundedCornerShape(18.dp))
                .clip(RoundedCornerShape(18.dp))
                .background(Color.White)
                .border(2.dp, Color.White, RoundedCornerShape(18.dp))
                .size(width = if (compact) 92.dp else 108.dp, height = if (compact) 122.dp else 142.dp)
        ) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(parts = AvatarParts(background = 5, clothes = 12, head = 8, mouth = 3, eyes = 17, top = 22)),
                size = if (compact) 92.dp else 108.dp,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxSize()
            )
            // Gaming badge
            InterestBadge(
                text = "Gaming",
                icon = "🎮",
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(6.dp)
            )
        }

        // Right Card (Tilted +8 deg, Travel)
        Box(
            modifier = Modifier
                .offset(x = 68.dp, y = ((-8) - floatOffset).dp)
                .graphicsLayer { rotationZ = 8f }
                .shadow(8.dp, RoundedCornerShape(18.dp))
                .clip(RoundedCornerShape(18.dp))
                .background(Color.White)
                .border(2.dp, Color.White, RoundedCornerShape(18.dp))
                .size(width = if (compact) 92.dp else 108.dp, height = if (compact) 122.dp else 142.dp)
        ) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(parts = AvatarParts(background = 10, clothes = 20, head = 15, mouth = 7, eyes = 25, top = 30)),
                size = if (compact) 92.dp else 108.dp,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxSize()
            )
            // Travel badge
            InterestBadge(
                text = "Travel",
                icon = "🏔️",
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
            )
        }

        // Center Card (Straight, Music, in front)
        Box(
            modifier = Modifier
                .offset(y = (12 + floatOffset * 0.7f).dp)
                .shadow(12.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(2.5.dp, Color.White, RoundedCornerShape(20.dp))
                .size(width = if (compact) 102.dp else 122.dp, height = if (compact) 134.dp else 156.dp)
        ) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(parts = AvatarParts(background = 15, clothes = 28, head = 22, mouth = 12, eyes = 33, top = 38)),
                size = if (compact) 102.dp else 122.dp,
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxSize()
            )
            // Music badge
            InterestBadge(
                text = "Music",
                icon = "🎵",
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(8.dp)
            )
        }

        // Bottom Yugm Lightning Match Symbol
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = ((-4) - floatOffset * 0.5f).dp)
                .shadow(6.dp, RoundedCornerShape(14.dp))
                .clip(RoundedCornerShape(14.dp))
                .background(Brush.linearGradient(onboardingBrandGradient))
                .size(if (compact) 36.dp else 42.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("⚡", fontSize = if (compact) 18.sp else 22.sp, color = Color.White)
        }
    }
}

@Composable
private fun InterestBadge(text: String, icon: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .shadow(4.dp, RoundedCornerShape(12.dp))
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.92f))
            .padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Text(icon, fontSize = 10.sp)
        Text(text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = OnboardingTextPrimaryLight)
    }
}

/** Page 2 — Find your people: Voice waveform center + 5 orbital avatars */
@Composable
private fun FindPeopleIllustration(compact: Boolean) {
    val sizePx = if (compact) 220.dp else 270.dp
    val radiusPx = if (compact) 85.dp else 105.dp
    val motionEnabled = LocalMotionEnabled.current

    val (avatarFloatY, waveformPhase) = if (motionEnabled) {
        val infiniteTransition = rememberInfiniteTransition(label = "find_people_motion")
        val floatY by infiniteTransition.animateFloat(
            initialValue = -4f,
            targetValue = 4f,
            animationSpec = infiniteRepeatable(
                animation = tween(3400, easing = LinearOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "avatarFloatY"
        )
        val phase by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = (2f * kotlin.math.PI).toFloat(),
            animationSpec = infiniteRepeatable(
                animation = tween(1400, easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "waveformPhase"
        )
        Pair(floatY, phase)
    } else Pair(0f, 0f)

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Concentric Orbital Rings
        Canvas(modifier = Modifier.size(sizePx)) {
            drawCircle(
                color = OnboardingBrandStart.copy(alpha = 0.15f),
                radius = size.width * 0.44f,
                style = Stroke(width = 1.5.dp.toPx())
            )
            drawCircle(
                color = OnboardingBrandStart.copy(alpha = 0.25f),
                radius = size.width * 0.28f,
                style = Stroke(width = 1.5.dp.toPx())
            )
        }

        // Central Audio Waveform Badge
        Box(
            modifier = Modifier
                .shadow(12.dp, CircleShape)
                .clip(CircleShape)
                .background(Brush.linearGradient(onboardingBrandGradient))
                .size(if (compact) 60.dp else 72.dp),
            contentAlignment = Alignment.Center
        ) {
            // Audio Waveform Lines
            Row(
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val heights = listOf(14.dp, 24.dp, 34.dp, 20.dp, 12.dp)
                heights.forEachIndexed { index, h ->
                    val scale = 0.6f + 0.4f * ((kotlin.math.sin(waveformPhase + index * 1.1f) + 1f) / 2f)
                    Box(
                        modifier = Modifier
                            .width(3.5.dp)
                            .height((if (compact) h * 0.85f else h) * scale)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color.White)
                    )
                }
            }
        }

        // 5 Orbital Avatars positioned around the central waveform
        val avatarDescriptors = listOf(
            AvatarDescriptor(parts = AvatarParts(background = 5, clothes = 12, head = 8, mouth = 3, eyes = 17, top = 22)),
            AvatarDescriptor(parts = AvatarParts(background = 10, clothes = 20, head = 15, mouth = 7, eyes = 25, top = 30)),
            AvatarDescriptor(parts = AvatarParts(background = 20, clothes = 35, head = 30, mouth = 18, eyes = 40, top = 45)),
            AvatarDescriptor(parts = AvatarParts(background = 15, clothes = 28, head = 22, mouth = 12, eyes = 33, top = 38)),
            AvatarDescriptor(parts = AvatarParts(background = 25, clothes = 42, head = 38, mouth = 25, eyes = 47, top = 5)),
        )
        val angles = listOf(-90.0, -18.0, 54.0, 126.0, 198.0) // 5 points around 360 deg

        angles.forEachIndexed { index, angleDeg ->
            val rad = Math.toRadians(angleDeg)
            val offsetX = (radiusPx.value * cos(rad)).dp
            val offsetY = (radiusPx.value * sin(rad)).dp
            val dynamicY = if (index % 2 == 0) avatarFloatY else -avatarFloatY

            Box(
                modifier = Modifier
                    .offset(x = offsetX, y = offsetY + dynamicY.dp)
                    .shadow(6.dp, CircleShape)
                    .clip(CircleShape)
                    .background(Color.White)
                    .border(2.dp, Color.White, CircleShape)
                    .size(if (compact) 44.dp else 52.dp)
            ) {
                GeneratedAvatar(
                    descriptor = avatarDescriptors[index],
                    size = if (compact) 44.dp else 52.dp,
                    shape = CircleShape,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

/** Page 3 — Share every moment: Video player, participant list & floating reaction pills */
@Composable
private fun ShareMomentsIllustration(compact: Boolean) {
    val motionEnabled = LocalMotionEnabled.current
    val floatY = if (motionEnabled) {
        val infiniteTransition = rememberInfiniteTransition(label = "share_moments_float")
        val y by infiniteTransition.animateFloat(
            initialValue = -5f,
            targetValue = 5f,
            animationSpec = infiniteRepeatable(
                animation = tween(2800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "reactionFloatY"
        )
        y
    } else 0f

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Main Landscape Video Player Container
        Box(
            modifier = Modifier
                .shadow(10.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(1.5.dp, Color.White.copy(alpha = 0.9f), RoundedCornerShape(20.dp))
                .size(width = if (compact) 260.dp else 300.dp, height = if (compact) 150.dp else 175.dp)
        ) {
            // Video Thumbnail Backdrop
            Image(
                painter = painterResource(id = R.drawable.ic_onboarding_video_thumb),
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )

            // Top-left Overlay Pill: Watch Party
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("👥", fontSize = 10.sp)
                Text("Watch party • 6 online", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }

            // Bottom Playback Controls Overlay
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f))
                        )
                    )
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("⏸", fontSize = 12.sp, color = Color.White)
                // Progress bar
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 8.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color.White.copy(alpha = 0.35f))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(0.6f)
                            .background(Brush.horizontalGradient(onboardingBrandGradient))
                    )
                }
                Text("1:24:37", fontSize = 9.sp, color = Color.White, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(6.dp))
                Text("⛶", fontSize = 11.sp, color = Color.White)
            }
        }

        // Participant Avatars Row below Video Player
        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = if (compact) 88.dp else 104.dp),
            horizontalArrangement = Arrangement.spacedBy((-6).dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val avatars = listOf(
                AvatarDescriptor(parts = AvatarParts(background = 5, clothes = 12, head = 8, mouth = 3, eyes = 17, top = 22)),
                AvatarDescriptor(parts = AvatarParts(background = 10, clothes = 20, head = 15, mouth = 7, eyes = 25, top = 30)),
                AvatarDescriptor(parts = AvatarParts(background = 20, clothes = 35, head = 30, mouth = 18, eyes = 40, top = 45)),
                AvatarDescriptor(parts = AvatarParts(background = 30, clothes = 3, head = 45, mouth = 32, eyes = 8, top = 12)),
            )
            avatars.forEach { avatar ->
                Box(
                    modifier = Modifier
                        .shadow(4.dp, CircleShape)
                        .clip(CircleShape)
                        .background(Color.White)
                        .border(1.5.dp, Color.White, CircleShape)
                        .size(if (compact) 32.dp else 36.dp)
                ) {
                    GeneratedAvatar(
                        descriptor = avatar,
                        size = if (compact) 32.dp else 36.dp,
                        shape = CircleShape,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            // Additional count pill (+2)
            Box(
                modifier = Modifier
                    .shadow(4.dp, CircleShape)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(onboardingBrandGradient))
                    .border(1.5.dp, Color.White, CircleShape)
                    .size(if (compact) 32.dp else 36.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("+2", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }

        // Floating 3D Reaction Elements
        // Top-Right: Heart ❤️
        ReactionPill(
            emoji = "❤️",
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = (-16).dp, y = (if (compact) 8.dp else 16.dp) + floatY.dp)
        )
        // Middle-Left: Controller 🎮
        ReactionPill(
            emoji = "🎮",
            modifier = Modifier
                .align(Alignment.CenterStart)
                .offset(x = if (compact) 8.dp else 16.dp, y = ((-20) - floatY).dp)
        )
        // Bottom-Right: Popcorn 🍿
        ReactionPill(
            emoji = "🍿",
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = (-12).dp, y = (if (compact) (-20).dp else (-26).dp) + floatY.dp)
        )
    }
}

@Composable
private fun ReactionPill(emoji: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .shadow(8.dp, RoundedCornerShape(14.dp))
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .padding(horizontal = 9.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(emoji, fontSize = 16.sp)
    }
}

/** Page 4 — Build meaningful bonds: Two prominent paired tilted cards with Yugm Y-badge */
@Composable
private fun BuildBondsIllustration(compact: Boolean) {
    val context = LocalContext.current
    val appIcon = remember {
        runCatching {
            context.packageManager.getApplicationIcon(context.packageName).toBitmap(128, 128).asImageBitmap()
        }.getOrNull()
    }
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Orbit arc line behind paired cards
        Canvas(modifier = Modifier.size(if (compact) 230.dp else 280.dp)) {
            drawCircle(
                color = OnboardingBrandStart.copy(alpha = 0.15f),
                radius = size.width * 0.44f,
                style = Stroke(width = 1.5.dp.toPx())
            )
        }

        // Left Card (Tilted -6 deg)
        Box(
            modifier = Modifier
                .offset(x = (-46).dp, y = (-6).dp)
                .graphicsLayer { rotationZ = -6f }
                .shadow(10.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(2.dp, Color.White, RoundedCornerShape(20.dp))
                .size(width = if (compact) 105.dp else 125.dp, height = if (compact) 135.dp else 160.dp)
        ) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(parts = AvatarParts(background = 20, clothes = 35, head = 30, mouth = 18, eyes = 40, top = 45)),
                size = if (compact) 105.dp else 125.dp,
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxSize()
            )
        }

        // Right Card (Tilted +6 deg)
        Box(
            modifier = Modifier
                .offset(x = 46.dp, y = (-6).dp)
                .graphicsLayer { rotationZ = 6f }
                .shadow(10.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(2.dp, Color.White, RoundedCornerShape(20.dp))
                .size(width = if (compact) 105.dp else 125.dp, height = if (compact) 135.dp else 160.dp)
        ) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(parts = AvatarParts(background = 30, clothes = 3, head = 45, mouth = 32, eyes = 8, top = 12)),
                size = if (compact) 105.dp else 125.dp,
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxSize()
            )
        }

        // Central Yugm Bond badge overlapping between cards (uses the original app icon)
        if (appIcon != null) {
            Image(
                bitmap = appIcon,
                contentDescription = "Yugm",
                modifier = Modifier
                    .offset(y = 52.dp)
                    .shadow(10.dp, CircleShape)
                    .clip(CircleShape)
                    .border(2.5.dp, Color.White, CircleShape)
                    .size(if (compact) 40.dp else 48.dp)
            )
        } else {
            Box(
                modifier = Modifier
                    .offset(y = 52.dp)
                    .shadow(10.dp, CircleShape)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(onboardingBrandGradient))
                    .border(2.5.dp, Color.White, CircleShape)
                    .size(if (compact) 40.dp else 48.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("Y", fontSize = if (compact) 20.sp else 24.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }

        // Top Sparkle Lines
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = if (compact) 10.dp else 18.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text("✨", fontSize = 16.sp)
        }
    }
}

/** Heading & Supporting Description Content Component */
@Composable
private fun OnboardingContent(
    title: String,
    description: String,
    textColor: Color,
    secondaryColor: Color,
    compact: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            color = textColor,
            fontSize = if (compact) 26.sp else 32.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            lineHeight = if (compact) 32.sp else 38.sp,
            modifier = Modifier.semantics { heading() }
        )

        Spacer(modifier = Modifier.height(if (compact) 8.dp else 12.dp))

        Text(
            text = description,
            color = secondaryColor,
            fontSize = if (compact) 14.sp else 16.sp,
            fontWeight = FontWeight.Normal,
            textAlign = TextAlign.Center,
            lineHeight = if (compact) 20.sp else 24.sp,
            modifier = Modifier.padding(horizontal = if (compact) 8.dp else 16.dp)
        )
    }
}

/** Minimal 4-step progress page indicator with smooth active capsule animation */
@Composable
private fun OnboardingPageIndicator(
    pageCount: Int,
    currentPage: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.clearAndSetSemantics { }
    ) {
        repeat(pageCount) { index ->
            val active = currentPage == index
            val dotWidth by animateDpAsState(
                targetValue = if (active) 26.dp else 8.dp,
                animationSpec = tween(durationMillis = 250),
                label = "active_dot_width_$index"
            )

            Box(
                modifier = Modifier
                    .width(dotWidth)
                    .height(8.dp)
                    .clip(CircleShape)
                    .then(
                        if (active) {
                            Modifier.background(Brush.horizontalGradient(onboardingBrandGradient))
                        } else {
                            Modifier.background(OnboardingBrandStart.copy(alpha = 0.2f))
                        }
                    )
            )
        }
    }
}

/** Full-width gradient primary onboarding button */
@Composable
private fun OnboardingPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.horizontalGradient(onboardingBrandGradient))
            .semantics { contentDescription = text }
            .clickable(
                interactionSource = interactionSource,
                role = androidx.compose.ui.semantics.Role.Button,
                onClickLabel = text,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
    }
}

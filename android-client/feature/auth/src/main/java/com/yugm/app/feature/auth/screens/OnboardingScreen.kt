package com.yugm.app.feature.auth.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch
import kotlin.math.sin

data class OnboardingSlide(
    val title: String,
    val description: String,
    val emoji: String,
    val gradient: List<Color>
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(onStart: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    val slides = listOf(
        OnboardingSlide(
            title = "Match the Vibe",
            description = "Meet people through profiles, voice rooms, and live moments.",
            emoji = "⚡",
            gradient = listOf(Color(0xFF25164C), Purple)
        ),
        OnboardingSlide(
            title = "Go Live, Not Lonely",
            description = "Join voice and video rooms where conversations actually happen.",
            emoji = "🎙️",
            gradient = listOf(Color(0xFF12263A), Cyan)
        ),
        OnboardingSlide(
            title = "Find People Around Your Energy",
            description = "Discover people by city, language, interests, and vibe.",
            emoji = "📍",
            gradient = listOf(Color(0xFF1B1A38), Saffron)
        ),
        OnboardingSlide(
            title = "Safe Connections",
            description = "Report, block, verify, and stay in control.",
            emoji = "🛡️",
            gradient = listOf(Color(0xFF101028), Pink)
        )
    )

    val pagerState = rememberPagerState(pageCount = { slides.size })

    val floatY = if (LocalMotionEnabled.current) {
        val infiniteTransition = rememberInfiniteTransition(label = "onboarding-float")
        val animatedFloat by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 12f,
            animationSpec = infiniteRepeatable(
                animation = tween(2500, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "float-offset"
        )
        animatedFloat
    } else 0f

    Box(modifier = Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.7f)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AnimatedEntrance(delay = 100) {
                Box(modifier = Modifier.padding(top = 18.dp)) {
                    BrandHeader(compact = true)
                }
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) { page ->
                AnimatedEntrance(delay = page * 100) {
                val slide = slides[page]
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(vertical = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(150.dp)
                            .clip(RoundedCornerShape(40.dp))
                            .background(Brush.linearGradient(slide.gradient))
                            .scale(1f + (sin(page * 1.5f).toFloat() * 0.02f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(slide.emoji, fontSize = 62.sp)
                    }
                    Spacer(modifier = Modifier.height(36.dp))

                    GlassCard(
                        cornerRadius = 24.dp,
                        borderGradient = Brush.horizontalGradient(
                            listOf(slide.gradient.last().copy(alpha = 0.3f), Color.Transparent)
                        ),
                        contentPadding = PaddingValues(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = slide.title,
                            color = Color.White,
                            fontSize = 28.sp,
                            lineHeight = 34.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = slide.description,
                            color = TextMuted,
                            fontSize = 15.sp,
                            lineHeight = 22.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
                }
            }

            AnimatedEntrance(delay = 300) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 32.dp)
                ) {
                    repeat(slides.size) { index ->
                        val active = pagerState.currentPage == index
                        Box(
                            modifier = Modifier
                                .size(if (active) 24.dp else 8.dp, 8.dp)
                                .clip(CircleShape)
                                .then(
                                    if (active)
                                        Modifier.background(Brush.horizontalGradient(auroraGradientPrimary))
                                    else
                                        Modifier.background(Color(0x33FFFFFF))
                                )
                        )
                    }
                }

                val isLastPage = pagerState.currentPage == slides.size - 1
                GlassButton(
                    text = if (isLastPage) "Start matching the vibe" else "Next",
                    onClick = {
                        if (isLastPage) onStart()
                        else coroutineScope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                    gradient = if (isLastPage)
                        Brush.horizontalGradient(auroraGradientWarm)
                    else
                        Brush.horizontalGradient(auroraGradientPrimary),
                )
                Spacer(modifier = Modifier.height(10.dp))
            }
            }
        }
    }
}

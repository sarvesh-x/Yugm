package com.yugm.app.feature.auth.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch

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
    val colors = LocalYugmColors.current
    val slides = remember {
        listOf(
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
    }

    val pagerState = rememberPagerState(pageCount = { slides.size })

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        val compactLayout = maxHeight < 680.dp
        val outerPadding = if (compactLayout) 16.dp else 24.dp

        AuroraBackground(modifier = Modifier.fillMaxSize())

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = outerPadding),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top row: brand header + Skip button
            AnimatedEntrance(delay = 100) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = if (compactLayout) 8.dp else 18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BrandHeader(compact = true)
                    TextButton(onClick = onStart) {
                        Text(
                            text = "Skip",
                            color = colors.textSecondary,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp
                        )
                    }
                }
            }

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
                    val useVerticalScroll = maxHeight < 420.dp || LocalDensity.current.fontScale >= 1.3f
                    val artworkSize = if (compactLayout) 112.dp else 150.dp
                    val verticalGap = if (compactLayout) 18.dp else 36.dp
                    val cardPadding = if (compactLayout) 16.dp else 20.dp
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (useVerticalScroll) {
                                    Modifier.heightIn(max = maxHeight).verticalScroll(rememberScrollState())
                                } else {
                                    Modifier.fillMaxHeight()
                                }
                            )
                            .padding(vertical = if (compactLayout) 8.dp else 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = if (useVerticalScroll) Arrangement.Top else Arrangement.Center,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(artworkSize)
                                .clip(RoundedCornerShape(40.dp))
                                .background(Brush.linearGradient(slide.gradient))
                                .semantics { contentDescription = "${slide.title} illustration" },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(slide.emoji, fontSize = if (compactLayout) 48.sp else 62.sp)
                        }
                        Spacer(modifier = Modifier.height(verticalGap))

                        GlassCard(
                            cornerRadius = 24.dp,
                            borderGradient = Brush.horizontalGradient(
                                listOf(slide.gradient.last().copy(alpha = 0.3f), Color.Transparent)
                            ),
                            contentPadding = PaddingValues(cardPadding),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = slide.title,
                                color = colors.textPrimary,
                                style = MaterialTheme.typography.headlineMedium,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.semantics { heading() },
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = slide.description,
                                color = colors.textSecondary,
                                style = MaterialTheme.typography.bodyLarge,
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
                    // Dot indicator with animated width
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .padding(bottom = if (compactLayout) 16.dp else 32.dp)
                            .clearAndSetSemantics { }
                    ) {
                        repeat(slides.size) { index ->
                            val active = pagerState.currentPage == index
                            val dotWidth by animateFloatAsState(
                                targetValue = if (active) 24f else 8f,
                                animationSpec = tween(durationMillis = 250),
                                label = "dot_width_$index"
                            )
                            Box(
                                modifier = Modifier
                                    .width(dotWidth.dp)
                                    .height(8.dp)
                                    .clip(CircleShape)
                                    .then(
                                        if (active)
                                            Modifier.background(Brush.horizontalGradient(auroraGradientPrimary))
                                        else
                                            Modifier.background(
                                                if (colors.isDark) Color(0x66FFFFFF) else Color(0x66000000)
                                            )
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
                    Spacer(modifier = Modifier.height(if (compactLayout) 8.dp else 16.dp))
                }
            }
        }
    }
}

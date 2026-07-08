package com.example.yugm.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.theme.*
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Brand Header Compact
        Box(modifier = Modifier.padding(top = 18.dp)) {
            BrandHeader(compact = true)
        }

        // Horizontal Slide Pager
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) { page ->
            val slide = slides[page]
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(vertical = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Feature Visual / Emoji Box
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .clip(RoundedCornerShape(36.dp))
                        .background(Brush.linearGradient(slide.gradient)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(slide.emoji, fontSize = 58.sp)
                }
                Spacer(modifier = Modifier.height(40.dp))
                Text(
                    text = slide.title,
                    color = Color.White,
                    fontSize = 28.sp,
                    lineHeight = 34.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = slide.description,
                    color = TextMuted,
                    fontSize = 15.sp,
                    lineHeight = 22.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp)
                )
            }
        }

        // Indicators & Buttons
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Slide Indicators (Dots)
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 32.dp)
            ) {
                repeat(slides.size) { index ->
                    val active = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .size(if (active) 20.dp else 8.dp, 8.dp)
                            .clip(CircleShape)
                            .background(if (active) Gold else Color(0x33FFFFFF))
                    )
                }
            }

            // Get Started / Continue button
            val isLastPage = pagerState.currentPage == slides.size - 1
            PrimaryButton(
                text = if (isLastPage) "Start matching the vibe" else "Next",
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
            Spacer(modifier = Modifier.height(10.dp))
        }
    }
}

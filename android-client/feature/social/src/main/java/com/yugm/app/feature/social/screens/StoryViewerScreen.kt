package com.yugm.app.feature.social.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.rememberAsyncImagePainter
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.StoryItem
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.RoundAction
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.feature.social.viewmodel.StoryViewModel
import kotlinx.coroutines.delay

@Composable
fun StoryViewerScreen(
    token: String,
    userId: String,
    onBack: () -> Unit
) {
    var currentIndex by remember { mutableIntStateOf(0) }
    var showControls by remember { mutableStateOf(true) }
    val viewModel: StoryViewModel = hiltViewModel()

    LaunchedEffect(userId) {
        viewModel.loadUserStories(token, userId)
    }

    LaunchedEffect(currentIndex) {
        if (viewModel.userStories.isNotEmpty() && currentIndex in viewModel.userStories.indices) {
            val story = viewModel.userStories[currentIndex]
            viewModel.viewStory(token, story._id)
        }
    }

    LaunchedEffect(currentIndex, viewModel.userStories) {
        if (viewModel.userStories.isNotEmpty()) {
            delay(5000)
            if (currentIndex < viewModel.userStories.lastIndex) {
                currentIndex++
            } else {
                onBack()
            }
        }
    }

    if (viewModel.isLoading && viewModel.userStories.isEmpty()) {
        YugmAmbientBackground {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                LoadingState("Loading story…")
            }
        }
        return
    }

    if (viewModel.userStories.isEmpty()) {
        YugmAmbientBackground {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No stories", color = TextMuted, fontSize = 16.sp)
                    Spacer(Modifier.height(12.dp))
                    RoundAction("←", onClick = onBack)
                }
            }
        }
        return
    }

    val story = viewModel.userStories[currentIndex]

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Image(
            painter = rememberAsyncImagePainter(model = story.mediaUrl),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )

        Box(
            Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Black.copy(alpha = 0.65f), Color.Transparent)
                    )
                )
                .align(Alignment.TopCenter)
        )

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 44.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            viewModel.userStories.forEachIndexed { index, _ ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            if (index <= currentIndex) Color.White.copy(alpha = 0.9f)
                            else Color.White.copy(alpha = 0.3f)
                        )
                )
            }
        }

        Row(
            Modifier
                .align(Alignment.TopStart)
                .padding(start = 16.dp, top = 58.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Avatar(initial = story.userName.firstOrNull()?.toString() ?: "?", size = 36, imageUrl = story.userAvatar)
            Spacer(Modifier.width(10.dp))
            Text(story.userName, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }

        val caption = story.caption
        if (!caption.isNullOrBlank()) {
            Text(
                caption,
                color = Color.White,
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 24.dp, vertical = 80.dp)
                    .fillMaxWidth()
            )
        }

        Row(Modifier.fillMaxSize()) {
            Box(Modifier.weight(1f).fillMaxHeight().clickable {
                if (currentIndex > 0) currentIndex--
                else onBack()
            })
            Box(Modifier.weight(1f).fillMaxHeight().clickable {
                showControls = !showControls
            })
            Box(Modifier.weight(1f).fillMaxHeight().clickable {
                if (currentIndex < viewModel.userStories.lastIndex) currentIndex++
                else onBack()
            })
        }

        if (showControls) {
            RoundAction(
                glyph = "✕",
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
                    .padding(top = 34.dp),
                onClick = onBack
            )

            GradientAction(
                label = if (story.isLiked) "♥ Liked" else "♡ Like",
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 40.dp)
                    .width(140.dp),
                onClick = {
                    viewModel.likeStory(token, story._id)
                }
            )
        }
    }
}

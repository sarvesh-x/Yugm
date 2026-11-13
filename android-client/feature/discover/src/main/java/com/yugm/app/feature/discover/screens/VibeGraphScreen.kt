package com.yugm.app.feature.discover.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.yugm.app.core.model.VibeDimensionInfo
import com.yugm.app.core.model.VibeMatchUser
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SaffronGold
import com.yugm.app.core.ui.theme.SuccessGreen
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.discover.viewmodel.VibeGraphUiState
import com.yugm.app.feature.discover.viewmodel.VibeGraphViewModel
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun VibeGraphScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    viewModel: VibeGraphViewModel = hiltViewModel()
) {
    LaunchedEffect(token) {
        viewModel.loadVibeData(token)
    }

    val state by viewModel.uiState.collectAsState()

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.6f)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Background.copy(alpha = 0.93f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 18.dp)
            ) {
                Spacer(Modifier.height(16.dp))

                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(SurfaceElevated)
                            .clickable { onBack() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("←", color = TextPrimary, fontSize = 20.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("AI Vibe Graph", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                        Text("8-dimensional compatibility radar", color = TextMuted, fontSize = 12.sp)
                    }
                }

                Spacer(Modifier.height(16.dp))

                when (val current = state) {
                    is VibeGraphUiState.Loading -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = SaffronGold)
                        }
                    }
                    is VibeGraphUiState.Error -> {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text(current.message, color = Color.Red, fontSize = 14.sp)
                            Spacer(Modifier.height(12.dp))
                            Button(
                                onClick = { viewModel.loadVibeData(token) },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                            ) {
                                Text("Retry")
                            }
                        }
                    }
                    is VibeGraphUiState.Success -> {
                        val dims = current.dimensions
                        val trend = current.trend
                        val matches = current.topMatches

                        LazyColumn(
                            contentPadding = PaddingValues(bottom = 32.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Trend Banner
                            item {
                                GlassCard(Modifier.fillMaxWidth()) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            when (trend) {
                                                "up" -> "📈"
                                                "down" -> "📉"
                                                else -> "⚖️"
                                            },
                                            fontSize = 24.sp
                                        )
                                        Spacer(Modifier.width(12.dp))
                                        Column(Modifier.weight(1f)) {
                                            Text(
                                                when (trend) {
                                                    "up" -> "Your vibe score is rising!"
                                                    "down" -> "Vibe activity cooling down"
                                                    else -> "Stable Vibe Energy"
                                                },
                                                color = TextPrimary,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 15.sp
                                            )
                                            Text("Keep chatting & joining live rooms to boost your graph", color = TextMuted, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }

                            // Canvas Radar Chart
                            item {
                                GlassCard(Modifier.fillMaxWidth()) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                                    ) {
                                        Text("Vibe Dimension Radar", color = Gold, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                        Spacer(Modifier.height(12.dp))
                                        VibeRadarCanvas(dimensions = dims, modifier = Modifier.size(240.dp))
                                    }
                                }
                            }

                            // Dimension Breakdown List
                            item {
                                Text("Dimension Breakdown", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                                Spacer(Modifier.height(6.dp))
                                dims.forEach { dim ->
                                    DimensionBarItem(dim)
                                }
                            }

                            // Top Vibe Matches Carousel
                            if (matches.isNotEmpty()) {
                                item {
                                    Text("Top Vibe Matches", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                                    Spacer(Modifier.height(8.dp))
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        items(matches) { match ->
                                            VibeMatchCard(match = match, onClick = { onOpenProfile(match.user.id) })
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
}

@Composable
private fun VibeRadarCanvas(dimensions: List<VibeDimensionInfo>, modifier: Modifier = Modifier) {
    val scores = dimensions.map { it.score.toFloat() / 100f }.ifEmpty { listOf(0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f) }
    val animatedScores = scores.map { score ->
        val anim by animateFloatAsState(targetValue = score, animationSpec = tween(1200))
        anim
    }

    Canvas(modifier = modifier) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = (size.minDimension / 2f) * 0.78f
        val count = animatedScores.size.coerceAtLeast(3)
        val angleStep = (2 * Math.PI / count).toFloat()

        // Draw background concentric webs
        for (level in 1..4) {
            val levelRadius = radius * (level / 4f)
            val webPath = Path()
            for (i in 0 until count) {
                val angle = i * angleStep - Math.PI.toFloat() / 2f
                val x = center.x + levelRadius * cos(angle)
                val y = center.y + levelRadius * sin(angle)
                if (i == 0) webPath.moveTo(x, y) else webPath.lineTo(x, y)
            }
            webPath.close()
            drawPath(webPath, color = Color.White.copy(alpha = 0.08f), style = Stroke(width = 1.dp.toPx()))
        }

        // Draw radial spoke lines
        for (i in 0 until count) {
            val angle = i * angleStep - Math.PI.toFloat() / 2f
            val x = center.x + radius * cos(angle)
            val y = center.y + radius * sin(angle)
            drawLine(color = Color.White.copy(alpha = 0.12f), start = center, end = Offset(x, y), strokeWidth = 1.dp.toPx())
        }

        // Draw filled radar polygon
        val polygonPath = Path()
        for (i in 0 until count) {
            val score = animatedScores[i]
            val angle = i * angleStep - Math.PI.toFloat() / 2f
            val x = center.x + radius * score * cos(angle)
            val y = center.y + radius * score * sin(angle)
            if (i == 0) polygonPath.moveTo(x, y) else polygonPath.lineTo(x, y)
        }
        polygonPath.close()

        drawPath(
            path = polygonPath,
            brush = Brush.radialGradient(
                colors = listOf(Pink.copy(alpha = 0.45f), PrimaryPurple.copy(alpha = 0.25f)),
                center = center,
                radius = radius
            )
        )
        drawPath(
            path = polygonPath,
            color = Pink,
            style = Stroke(width = 2.dp.toPx())
        )

        // Draw points on vertices
        for (i in 0 until count) {
            val score = animatedScores[i]
            val angle = i * angleStep - Math.PI.toFloat() / 2f
            val x = center.x + radius * score * cos(angle)
            val y = center.y + radius * score * sin(angle)
            drawCircle(color = SaffronGold, radius = 4.dp.toPx(), center = Offset(x, y))
        }
    }
}

@Composable
private fun DimensionBarItem(dim: VibeDimensionInfo) {
    GlassCard(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(dim.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(Modifier.weight(1f))
                Text(
                    "${dim.score}%",
                    color = when {
                        dim.score >= 70 -> SuccessGreen
                        dim.score >= 40 -> SaffronGold
                        else -> Color(0xFFFF5252)
                    },
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp
                )
            }
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (dim.score.toFloat() / 100f).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = when {
                    dim.score >= 70 -> SuccessGreen
                    dim.score >= 40 -> SaffronGold
                    else -> Color(0xFFFF5252)
                },
                trackColor = SurfaceElevated
            )
            if (dim.description.isNotBlank()) {
                Text(dim.description, color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

@Composable
private fun VibeMatchCard(match: VibeMatchUser, onClick: () -> Unit) {
    GlassCard(
        modifier = Modifier.width(130.dp).clickable(onClick = onClick)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Avatar(
                initial = match.user.name.firstOrNull()?.toString() ?: "?",
                size = 52,
                imageUrl = match.user.avatar
            )
            Spacer(Modifier.height(6.dp))
            Text(match.user.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1)
            Text("${match.scores.overall}% Match", color = Pink, fontWeight = FontWeight.Black, fontSize = 11.sp)
        }
    }
}

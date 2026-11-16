package com.yugm.app.feature.roommodes.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.foundation.BorderStroke
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.RoomModeInfo
import com.yugm.app.core.ui.components.AnimatedEntrance
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
fun ModePickerScreen(
    modes: List<RoomModeInfo>,
    isLoading: Boolean,
    error: String? = null,
    onSelectMode: (String) -> Unit,
    onBack: () -> Unit,
    onRandomMode: () -> Unit
) {
    val colors = LocalYugmColors.current
    Column(
        modifier = Modifier.fillMaxSize().background(colors.background).padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("←", color = colors.textPrimary, fontSize = 24.sp, modifier = Modifier.size(48.dp).clickable(role = Role.Button, onClickLabel = "Go back", onClick = onBack))
            Text("Room Modes", color = colors.textPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.size(24.dp))
        }

        Spacer(Modifier.height(8.dp))
        Text("Choose a game mode for your room", color = colors.textSecondary, fontSize = 14.sp)
        Text("Quick prompts and games make it easier for everyone to join the conversation.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        error?.let { Text(it, color = colors.danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }

        Spacer(Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                GlassButton(
                    text = "🎲 Random Mode",
                    onClick = onRandomMode,
                    gradient = Brush.horizontalGradient(listOf(colors.primary, colors.secondary)),
                    height = 56.dp
                )
            }
            itemsIndexed(modes) { index, mode ->
                AnimatedEntrance(delay = index * 80) {
                    ModeCard(
                        mode = mode,
                        onClick = { onSelectMode(mode.key) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ModeCard(
    mode: RoomModeInfo,
    onClick: () -> Unit
) {
    val colors = LocalYugmColors.current

    Surface(
        modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = "Select ${mode.name} mode", onClick = onClick),
        color = colors.surface,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, colors.border)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(colors.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                    Text(mode.icon, fontSize = 29.sp)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(mode.name, color = colors.textPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text("${mode.minParticipants}–${mode.maxParticipants} players · ${mode.durationSeconds / 60} min", color = colors.textSecondary, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(mode.description, color = colors.textSecondary, fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}

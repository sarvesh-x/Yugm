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
import com.yugm.app.core.ui.theme.*

@Composable
fun ModePickerScreen(
    modes: List<RoomModeInfo>,
    isLoading: Boolean,
    onSelectMode: (String) -> Unit,
    onBack: () -> Unit,
    onRandomMode: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().background(Background).padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("←", color = TextPrimary, fontSize = 24.sp, modifier = Modifier.size(48.dp).clickable(role = Role.Button, onClickLabel = "Go back", onClick = onBack))
            Text("Room Modes", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.size(24.dp))
        }

        Spacer(Modifier.height(8.dp))
        Text("Choose a game mode for your room", color = TextMuted, fontSize = 14.sp)

        Spacer(Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                GlassButton(
                    text = "🎲 Random Mode",
                    onClick = onRandomMode,
                    gradient = Brush.horizontalGradient(listOf(Gold, Saffron)),
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
    val cardColors = listOf(
        listOf(Color(0xFF1A0533), Color(0xFF2D1B69)),
        listOf(Color(0xFF1B0A2E), Color(0xFF3D1B40)),
        listOf(Color(0xFF0F1B2D), Color(0xFF1A3A5C)),
        listOf(Color(0xFF1A0F0A), Color(0xFF3C2415)),
        listOf(Color(0xFF0D1B1A), Color(0xFF1A3C3A))
    )
    val gradientIndex = mode.key.hashCode().let { (it and Int.MAX_VALUE) % cardColors.size }
    val gradient = cardColors[gradientIndex]

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.verticalGradient(gradient))
            .border(1.dp, Line.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
            .clickable(role = Role.Button, onClickLabel = "Select ${mode.name} mode", onClick = onClick)
            .padding(16.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(mode.icon, fontSize = 32.sp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(mode.name, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text("${mode.minParticipants}-${mode.maxParticipants} players · ${mode.durationSeconds / 60}min", color = TextMuted, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(mode.description, color = TextMuted.copy(alpha = 0.8f), fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}

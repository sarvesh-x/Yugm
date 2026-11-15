package com.yugm.app.feature.room.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.cosmetics.CosmeticArtwork
import kotlinx.coroutines.delay

@Composable
internal fun RoomEntryCosmeticOverlay(event: RoomActivityItem?) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(event?.id) {
        visible = event != null
        if (event != null) {
            delay(3_200)
            visible = false
        }
    }
    AnimatedVisibility(
        visible = visible && event != null,
        enter = fadeIn() + scaleIn(initialScale = 0.78f),
        exit = fadeOut() + scaleOut(targetScale = 1.08f)
    ) {
        val entrance = event?.roomEntry?.ifBlank { event.entranceEffect }.orEmpty()
        if (entrance.isNotBlank()) {
            Box(
                Modifier.padding(horizontal = 28.dp).clip(RoundedCornerShape(28.dp))
                    .background(Brush.linearGradient(listOf(Color(0xF02B1655), Color(0xEC101324))))
                    .border(1.dp, Color(0x99C084FC), RoundedCornerShape(28.dp)).padding(22.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CosmeticArtwork(entrance, "ROOM_ENTRY", modifier = Modifier.size(104.dp), animate = true, showBackdrop = true)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(event?.userName?.take(1)?.uppercase() ?: "?", 38, event?.avatar)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(event?.userName?.ifBlank { "Someone" } ?: "Someone", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1)
                            Text("made an entrance", color = Color(0xFFD9C8FF), fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

package com.example.yugm.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Room
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomShell(
    room: Room,
    chat: List<ChatMessage>,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    giftOpen: Boolean,
    gifts: List<GiftItem>,
    balance: Int,
    onGiftOpen: (Boolean) -> Unit,
    onGift: (GiftItem) -> Unit,
    controls: @Composable RowScope.() -> Unit,
    roomContent: @Composable ColumnScope.() -> Unit
) {
    var message by rememberSaveable { mutableStateOf("") }
    GiftPanel(open = giftOpen, gifts = gifts, balance = balance, onDismiss = { onGiftOpen(false) }, onSend = onGift)

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RoundAction("⌄", onClick = onBack)
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(room.title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("● LIVE", color = Danger, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Text("  ·  ${room.participants} people", color = TextMuted, fontSize = 10.sp)
                    }
                }
                ReferenceChip(if (room.type.name.equals("Voice", true)) "Voice" else "Video", glyph = if (room.type.name.equals("Voice", true)) "◖" else "▣")
                Spacer(Modifier.width(8.dp))
                RoundAction("⋯", onClick = {})
            }

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f).fillMaxWidth()
            ) {
                item { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { roomContent() } }
                if (chat.isNotEmpty()) {
                    item { ReferenceSectionHeader("Live chat") }
                    items(chat.takeLast(8), key = { it.author + it.text }) { item ->
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SurfaceElevated.copy(alpha = 0.8f)).border(1.dp, BorderColor, RoundedCornerShape(16.dp)).padding(11.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(Modifier.size(34.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple, Pink))), contentAlignment = Alignment.Center) {
                                Text(item.author.take(1).uppercase(), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                            }
                            Column(Modifier.weight(1f).padding(start = 9.dp)) {
                                Text(item.author, color = if (item.author == "System") Pink else TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text(item.text, color = TextPrimary, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                            Text("♡", color = Pink, fontSize = 16.sp)
                        }
                    }
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).background(Background.copy(alpha = 0.92f)).padding(horizontal = 10.dp, vertical = 8.dp)
            ) { controls() }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().background(Color(0xF516192A)).border(1.dp, BorderColor).padding(10.dp).navigationBarsPadding()
            ) {
                Box(
                    Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(17.dp)).background(Background).border(1.dp, BorderColor, RoundedCornerShape(17.dp)).padding(horizontal = 13.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    BasicTextField(
                        value = message,
                        onValueChange = { message = it.take(500) },
                        textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 13.sp),
                        modifier = Modifier.fillMaxWidth(),
                        decorationBox = { inner -> if (message.isBlank()) Text("Say something…", color = TextMuted, fontSize = 12.sp) else inner() }
                    )
                }
                Box(Modifier.size(48.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple, Pink))).clickable {
                    val value = message.trim(); if (value.isNotBlank()) { onSendMessage(value); message = "" }
                }, contentAlignment = Alignment.Center) { Text("➤", color = Color.White, fontSize = 20.sp) }
            }
        }
    }
}

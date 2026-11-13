package com.yugm.app.core.ui.components

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Room
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.util.cosmeticDisplayName
import kotlinx.coroutines.launch

private val roomThemeGradients = mapOf(
  "room_theme_neon_club" to listOf(Color(0xFF0D0221), Color(0xFF1A0533)),
  "room_theme_festive" to listOf(Color(0xFF2D0A0A), Color(0xFF5C1A1A)),
  "theme_cozy" to listOf(Color(0xFF1A120B), Color(0xFF3C2415)),
  "theme_beach" to listOf(Color(0xFF0D1B2A), Color(0xFF1B3A5C))
)

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
    val chatListState = rememberLazyListState()
    LaunchedEffect(chat.size) {
        if (chat.isNotEmpty()) chatListState.animateScrollToItem(2 + chat.takeLast(8).lastIndex)
    }
    val themeGradient = roomThemeGradients[room.theme]
    GiftPanel(open = giftOpen, gifts = gifts, balance = balance, onDismiss = { onGiftOpen(false) }, onSend = onGift)

    YugmAmbientBackground(themeOverride = themeGradient, ambienceId = room.ambience) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RoundAction("", imageVector = Icons.AutoMirrored.Filled.ArrowBack, accessibilityLabel = "Leave room", onClick = onBack)
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(room.title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("● LIVE", color = Danger, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Text("  ·  ${room.participants} listening", color = TextMuted, fontSize = 12.sp)
                    }
                }
                ReferenceChip(if (room.type.name.equals("Voice", true)) "Voice room" else "Video room")
            }

            LazyColumn(
                state = chatListState,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f).fillMaxWidth()
            ) {
                item { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { roomContent() } }
                if (chat.isNotEmpty()) {
                    item { ReferenceSectionHeader("Live chat") }
                    itemsIndexed(chat.takeLast(8), key = { index, item -> "$index-${item.author}-${item.text.hashCode()}" }) { _, item ->
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Color(0xC51A2440)).border(1.dp, BorderColor.copy(alpha = 0.55f), RoundedCornerShape(15.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(Modifier.size(28.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple, Pink))), contentAlignment = Alignment.Center) {
                                Text(item.author.take(1).uppercase(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                            }
                            Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                Text(item.author.ifBlank { "Yugm user" }, color = if (item.author == "System") Pink else Color(0xFFB9A6FF), fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                Text(item.text, color = TextPrimary, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
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
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(PrimaryPurple),
                        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Write a room message" },
                        decorationBox = { inner ->
                            Box {
                                if (message.isBlank()) Text("Say something…", color = TextMuted, fontSize = 12.sp)
                                inner()
                            }
                        }
                    )
                }
                Box(Modifier.size(48.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple, Pink))).semantics {
                    contentDescription = "Send message"
                }.clickable(role = Role.Button, onClickLabel = "Send message") {
                    val value = message.trim(); if (value.isNotBlank()) { onSendMessage(value); message = "" }
                }, contentAlignment = Alignment.Center) { Icon(Icons.Filled.Send, contentDescription = null, modifier = Modifier.size(21.dp), tint = Color.White) }
            }
        }
    }
}

package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmMediaRoom
import com.example.yugm.api.YugmSocket
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Room
import com.example.yugm.ui.components.ControlButton
import com.example.yugm.ui.components.RoomShell
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.VideoGrid
import com.example.yugm.ui.theme.TextMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveVideoRoomScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem) -> Unit,
    onToast: (String) -> Unit,
    onJoin: () -> Unit,
    isHost: Boolean = false,
    onEndRoom: () -> Unit = {},
    onMuteUser: (String) -> Unit = {},
    onRemoveUser: (String) -> Unit = {},
    onReportUser: (String) -> Unit = {}
) {
    DisposableEffect(room.id) {
        onJoin()
        onDispose {
            YugmSocket.disconnect()
            YugmMediaRoom.disconnect()
        }
    }
    var mic by rememberSaveable { mutableStateOf(true) }
    var camera by rememberSaveable { mutableStateOf(true) }
    var giftOpen by rememberSaveable { mutableStateOf(false) }
    RoomShell(
        room = room,
        chat = chat,
        onBack = onBack,
        onSendMessage = onSendMessage,
        giftOpen = giftOpen,
        gifts = gifts,
        balance = balance,
        onGiftOpen = { giftOpen = it },
        onGift = onGift,
        controls = {
            ControlButton(if (mic) "Mic on" else "Mic off", active = mic) { mic = !mic }
            ControlButton(if (camera) "Cam on" else "Cam off", active = camera) { camera = !camera }
            ControlButton("Flip") { onToast("Camera switched") }
            ControlButton("Gift") { giftOpen = true }
            if (isHost) {
                Spacer(Modifier.width(8.dp))
                ControlButton("End", danger = true) { onEndRoom() }
                room.host?.let { host ->
                    ControlButton("Mute user") { onMuteUser(host.id) }
                    ControlButton("Remove user", danger = true) { onRemoveUser(host.id) }
                }
            }
            room.host?.let { host ->
                ControlButton("Report", danger = true) { onReportUser(host.id) }
            }
        }
    ) {
        VideoGrid(room = room, camera = camera)
        Text("Audience mode supported / Host highlighted / Video seats limit ${room.maxSpeakers}", color = TextMuted, fontSize = 12.sp)
    }
}

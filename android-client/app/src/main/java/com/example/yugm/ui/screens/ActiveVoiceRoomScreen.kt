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
import com.example.yugm.ui.components.HostCard
import com.example.yugm.ui.components.RoomShell
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.SpeakerGrid
import com.example.yugm.ui.theme.TextMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveVoiceRoomScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem) -> Unit,
    onToast: (String) -> Unit,
    onJoin: () -> Unit,
    onRequestSpeaker: () -> Unit = {},
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
    var muted by rememberSaveable { mutableStateOf(false) }
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
            ControlButton(if (muted) "Unmute" else "Mute", active = !muted) {
                muted = !muted
                YugmMediaRoom.setMicEnabled(!muted)
            }
            ControlButton("Request mic") { onRequestSpeaker() }
            ControlButton("Gift") { giftOpen = true }
            ControlButton("React") { onToast("Reaction sent") }
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
        room.host?.let { HostCard(it) }
        SectionTitle("Speaker seats")
        SpeakerGrid(room = room)
        SectionTitle("Audience")
        Text("${room.participants} people listening / LiveKit token ready / Socket chat ready", color = TextMuted, fontSize = 12.sp)
    }
}

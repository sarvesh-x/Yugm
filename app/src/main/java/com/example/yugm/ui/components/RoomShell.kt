package com.example.yugm.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Room
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Ink2
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
    GiftPanel(open = giftOpen, gifts = gifts, balance = balance, onDismiss = { onGiftOpen(false) }) {
        onGift(it)
    }
    Column(Modifier.fillMaxSize()) {
        RoomTopBar(room = room, onBack = onBack)
        LazyColumn(
            contentPadding = PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    roomContent()
                }
            }
            item { SectionTitle("Live chat") }
            items(chat.takeLast(8), key = { it.author + it.text }) { item ->
                androidx.compose.material3.Text(
                    text = "${item.author}: ${item.text}",
                    color = if (item.author == "System") Gold else TextPrimary,
                    fontSize = 13.sp
                )
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            controls()
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .background(Ink2)
                .padding(10.dp)
                .navigationBarsPadding()
        ) {
            YugmTextField(
                value = message,
                onValueChange = { message = it },
                label = "Say something live",
                modifier = Modifier.weight(1f)
            )
            SmallAction("Send") {
                if (message.isNotBlank()) {
                    onSendMessage(message)
                    message = ""
                }
            }
        }
    }
}

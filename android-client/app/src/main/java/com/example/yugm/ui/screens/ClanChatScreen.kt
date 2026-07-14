package com.example.yugm.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.ClanMessage
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmPageHeader
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.ui.theme.TextSecondary
import kotlinx.coroutines.launch

private val reactionTypes = listOf("heart", "fire", "laugh", "clap", "wow")

@Composable
fun ClanChatScreen(
    token: String,
    clanId: String,
    currentUserId: String,
    clanName: String = "",
    onBack: () -> Unit = {}
) {
    var messages by remember { mutableStateOf<List<ClanMessage>>(emptyList()) }
    var input by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    fun refresh() {
        scope.launch {
            loading = true
            messages = runCatching { YugmApi.getClanMessages(token, clanId) }.getOrDefault(emptyList())
            loading = false
        }
    }

    fun send() {
        val text = input.trim()
        if (text.isBlank()) return
        scope.launch {
            runCatching { YugmApi.sendClanMessage(token, clanId, text) }
                .onSuccess { input = ""; refresh() }
                .onFailure { status = it.message ?: "Failed to send" }
        }
    }

    LaunchedEffect(clanId) { refresh() }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Yugm", clanName.ifBlank { "Clan Chat" }, onBack = onBack)
            if (status.isNotBlank()) {
                Text(status, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp))
            }
            if (loading) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { LoadingState("Loading messages…") }
            } else {
                LazyColumn(
                    Modifier.weight(1f).padding(horizontal = 16.dp),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    if (messages.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                                Text("No messages yet. Say hi!", color = TextMuted, fontSize = 14.sp)
                            }
                        }
                    } else {
                        items(messages) { msg ->
                            val isMine = msg.senderId?.id == currentUserId
                            Column(
                                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalAlignment = if (isMine) Alignment.End else Alignment.Start
                            ) {
                                if (!isMine && msg.senderId != null) {
                                    Text(msg.senderId!!.name, color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(bottom = 2.dp))
                                }
                                Row(verticalAlignment = Alignment.Bottom) {
                                    if (isMine) Spacer(Modifier.weight(1f))
                                    Column(
                                        Modifier.background(
                                            if (isMine) Pink else Color(0x2AFFFFFF),
                                            RoundedCornerShape(12.dp)
                                        ).padding(horizontal = 14.dp, vertical = 8.dp)
                                    ) {
                                        Text(msg.message, color = TextPrimary, fontSize = 14.sp)
                                        if (msg.reactions.isNotEmpty()) {
                                            Spacer(Modifier.height(4.dp))
                                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                msg.reactions.groupBy { it.type }.forEach { (type, reactions) ->
                                                    Text("${reactionEmoji(type)} ${reactions.size}", color = TextMuted, fontSize = 11.sp)
                                                }
                                            }
                                        }
                                    }
                                    if (!isMine) Spacer(Modifier.weight(1f))
                                }
                                Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    reactionTypes.forEach { type ->
                                        Text(
                                            reactionEmoji(type),
                                            fontSize = 12.sp,
                                            modifier = Modifier.clip(CircleShape).clickable {
                                                scope.launch {
                                                    runCatching { YugmApi.reactToClanMessage(token, clanId, msg.id, type) }
                                                        .onSuccess { refresh() }
                                                }
                                            }.padding(4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier.weight(1f).background(Color(0x1AFFFFFF), RoundedCornerShape(20.dp)).padding(horizontal = 16.dp, vertical = 2.dp)
                ) {
                    androidx.compose.foundation.text.BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                        decorationBox = { innerTextField ->
                            Box {
                                if (input.isEmpty()) Text("Type a message…", color = TextMuted, fontSize = 14.sp)
                                innerTextField()
                            }
                        }
                    )
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    Modifier.size(40.dp).clip(CircleShape).background(Pink).clickable(enabled = input.isNotBlank()) { send() },
                    contentAlignment = Alignment.Center
                ) {
                    Text("\u27A4", color = Color.White, fontSize = 18.sp)
                }
            }
        }
    }
}

private fun reactionEmoji(type: String): String = when (type) {
    "heart" -> "\u2764\uFE0F"
    "fire" -> "\uD83D\uDD25"
    "laugh" -> "\uD83D\uDE02"
    "clap" -> "\uD83D\uDC4F"
    "wow" -> "\uD83D\uDE2E"
    else -> "\u2764\uFE0F"
}

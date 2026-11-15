package com.yugm.app.feature.social.screens

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.TextSecondary
import com.yugm.app.feature.social.viewmodel.ClanViewModel

private val reactionTypes = listOf("heart", "fire", "laugh", "clap", "wow")

@Composable
fun ClanChatScreen(
    token: String,
    clanId: String,
    currentUserId: String,
    clanName: String = "",
    onBack: () -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var input by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    fun send() {
        val text = input.trim()
        if (text.isBlank()) return
        viewModel.sendMessage(token, clanId, text)
        input = ""
    }

    LaunchedEffect(clanId) {
        viewModel.loadMessages(token, clanId)
        viewModel.loadDetail(token, clanId)
    }
    LaunchedEffect(viewModel.messages.size) {
        if (viewModel.messages.isNotEmpty()) listState.animateScrollToItem(viewModel.messages.lastIndex)
    }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Clan", clanName.ifBlank { viewModel.clanDetail?.name ?: "Clan Chat" }, onBack = onBack)
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                    .background(Color(0x1AFFFFFF), RoundedCornerShape(16.dp)).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Avatar((clanName.ifBlank { viewModel.clanDetail?.name ?: "C" }).take(1).uppercase(), 42, viewModel.clanDetail?.avatar)
                Column(Modifier.weight(1f)) {
                    Text("${viewModel.clanDetail?.memberCount ?: 0} members", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("Messages are shared with your clan", color = TextMuted, fontSize = 11.sp)
                }
                Text("●  Live", color = Color(0xFF65D69A), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            if (status.isNotBlank()) {
                Text(status, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp))
            }
            if (viewModel.isLoading) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { LoadingState("Loading messages…") }
            } else {
                LazyColumn(
                    Modifier.weight(1f).padding(horizontal = 16.dp),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    if (viewModel.messages.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                                Text("No messages yet. Say hi!", color = TextMuted, fontSize = 14.sp)
                            }
                        }
                    } else {
                        items(viewModel.messages) { msg ->
                            val sender = msg.senderId
                            val isMine = sender?.id == currentUserId
                            Column(
                                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalAlignment = if (isMine) Alignment.End else Alignment.Start
                            ) {
                                if (!isMine && sender != null) {
                                    Text(sender.name, color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 38.dp, bottom = 3.dp))
                                }
                                Row(verticalAlignment = Alignment.Bottom) {
                                    if (isMine) Spacer(Modifier.weight(1f))
                                    if (!isMine && sender != null) {
                                        Avatar(sender.name.take(1).uppercase(), 30, sender.avatar)
                                        Spacer(Modifier.width(7.dp))
                                    }
                                    Column(
                                        Modifier.background(
                                            if (isMine) Pink else Color(0xFF292536),
                                            RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = if (isMine) 18.dp else 5.dp, bottomEnd = if (isMine) 5.dp else 18.dp)
                                        ).padding(horizontal = 14.dp, vertical = 10.dp).widthIn(max = 290.dp)
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
                                                viewModel.reactToMessage(token, clanId, msg.id, type)
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
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)
                    .background(Color(0xFF201C2B), RoundedCornerShape(24.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier.weight(1f).heightIn(min = 42.dp).padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    androidx.compose.foundation.text.BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(Pink),
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

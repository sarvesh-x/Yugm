package com.example.yugm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.EmptyRoomsScreen
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Ink
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.Panel
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun ChatScreen(
    partner: Host?,
    currentUserId: String,
    messages: List<DirectMessage>,
    relationship: RelationshipStatus?,
    gifts: List<GiftItem>,
    balance: Int,
    loading: Boolean = false,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String) -> Unit = {},
    onGift: (GiftItem) -> Unit = {}
) {
    var draft by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = onBack) { Text("Back", color = TextMuted, fontWeight = FontWeight.Bold) }
                if (partner != null) {
                    Avatar(partner.name.firstOrNull()?.toString() ?: "?", 42, imageUrl = partner.avatar, cosmetics = partner.activeCosmetics)
                    Column(Modifier.weight(1f)) {
                        Text(partner.name, color = TextPrimary, fontWeight = FontWeight.Black)
                        Text(relationship?.let { "Bond L${it.level} / ${it.title}" } ?: "@${partner.username}", color = TextMuted, fontSize = 12.sp)
                    }
                }
            }
        }
        if (loading) {
            item { LoadingState("Loading chat...") }
        }
        if (error.isNotBlank()) {
            item { EmptyRoomsScreen(message = error, onAction = onRetry, action = "Retry") }
        }
        relationship?.let { bond ->
            item {
                GlassCard {
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text("Relationship Level ${bond.level}", color = TextPrimary, fontWeight = FontWeight.Black)
                        Text(bond.title, color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                            .height(8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Line)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(bond.progress.coerceIn(0f, 1f))
                                .height(8.dp)
                                .background(Gold)
                        )
                    }
                    Text(
                        if (bond.requiredXp > 0) "${bond.progressXp}/${bond.requiredXp} bond XP to level ${bond.nextLevel ?: bond.level}" else "${bond.xp} bond XP total",
                        color = TextMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Text(
                        listOfNotNull(
                            bond.streakDays.takeIf { it > 0 }?.let { "$it-day streak" } ?: "Start a streak",
                            bond.nextPerk.takeIf { it.isNotBlank() }?.let { "Next perk: $it" }
                        ).joinToString(" / "),
                        color = Gold,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
        if (gifts.isNotEmpty()) {
            item {
                GlassCard {
                    Text("Send a gift", color = TextPrimary, fontWeight = FontWeight.Black)
                    Text("$balance coins available", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp, bottom = 8.dp))
                    gifts.take(3).forEach { gift ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Text(gift.name, color = TextPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text("${gift.price} coins", color = Gold, fontSize = 12.sp)
                            OutlinedButton(onClick = { onGift(gift) }, border = BorderStroke(1.dp, Gold), shape = RoundedCornerShape(8.dp)) {
                                Text("Send", color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
        items(messages, key = { it.id.ifBlank { it.createdAt + it.message } }) { message ->
            val isMine = message.senderId == currentUserId
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth(0.82f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isMine) Pink else Panel)
                        .padding(12.dp)
                ) {
                    Text(message.message, color = TextPrimary, fontWeight = FontWeight.Bold)
                    if (message.createdAt.isNotBlank()) {
                        Text(message.createdAt.take(16).replace("T", " "), color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
        item {
            Spacer(Modifier.height(8.dp))
            YugmTextField(draft, { draft = it }, "Message ${partner?.name ?: "user"}")
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = {
                    val message = draft.trim()
                    if (message.isNotBlank()) {
                        draft = ""
                        onSend(message)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Gold),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Send message", color = Ink, fontWeight = FontWeight.Black)
            }
        }
    }
}

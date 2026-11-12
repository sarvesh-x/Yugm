package com.example.yugm.core.ui.components

import java.util.Locale
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.model.GiftItem
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkBattleType
import com.example.yugm.core.model.PkLiveEffect
import com.example.yugm.core.model.PkMediaSession
import com.example.yugm.core.model.PkMode
import com.example.yugm.core.model.PkOpponent
import com.example.yugm.core.model.PkSide
import com.example.yugm.core.model.PkSideType
import com.example.yugm.core.model.PkStatus
import com.example.yugm.core.ui.theme.Background
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.Purple
import com.example.yugm.core.ui.theme.Saffron
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

@Composable
fun PkBattleButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = Pink),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text("Start PK", color = Color.White, fontWeight = FontWeight.Black)
    }
}

@Composable
fun PkMiniBanner(battle: PkBattle?, onClick: () -> Unit) {
    if (battle == null) return
    GlassCard(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            VsBadge()
            Column(Modifier.weight(1f)) {
                Text("PK Battle Live", color = Gold, fontWeight = FontWeight.Black)
                Text("${battle.left.hostName} vs ${battle.right.hostName} / ${formatPkTime(battle.remainingSeconds)}", color = TextPrimary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun PkBattleHeader(battle: PkBattle, isHost: Boolean, onEnd: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LiveBadge()
            Text("PK Battle", color = TextPrimary, fontWeight = FontWeight.Black)
            Text(formatPkTime(battle.remainingSeconds), color = Gold, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            if (isHost && battle.status == PkStatus.ACTIVE) {
                Text("End PK", color = Color(0xFFFF5B6E), fontWeight = FontWeight.Black, modifier = Modifier.clickable(onClick = onEnd))
            }
        }
        Text(battle.title.ifBlank { "${battle.left.hostName} vs ${battle.right.hostName}" }, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
fun PkBattleScoreBar(battle: PkBattle) {
    val total = (battle.left.score + battle.right.score).coerceAtLeast(1)
    val targetLeft = (battle.left.score.toFloat() / total).coerceIn(0.08f, 0.92f)
    val leftWeight by animateFloatAsState(targetLeft, label = "pk-score-ratio")
    GlassCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text(battle.left.score.toLocaleScore(), color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            VsBadge()
            Text(battle.right.score.toLocaleScore(), color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp).height(14.dp).clip(RoundedCornerShape(8.dp))) {
            Box(Modifier.weight(leftWeight).height(14.dp).background(Brush.horizontalGradient(listOf(Pink, Purple))))
            Box(Modifier.weight(1f - leftWeight).height(14.dp).background(Brush.horizontalGradient(listOf(Gold, Saffron))))
        }
        Text("Leader: ${battle.leader?.name ?: "DRAW"}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
fun PkTeamSelector(battle: PkBattle, selectedSide: PkSideType, onSelect: (PkSideType) -> Unit) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Choose your team", color = TextPrimary, fontWeight = FontWeight.Black)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
            ChipButton("Team ${battle.left.hostName}", selected = selectedSide == PkSideType.LEFT) { onSelect(PkSideType.LEFT) }
            ChipButton("Team ${battle.right.hostName}", selected = selectedSide == PkSideType.RIGHT) { onSelect(PkSideType.RIGHT) }
        }
        Text("Gifts and reactions support the selected side.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
fun PkLiveEffectBurst(effect: PkLiveEffect?) {
    AnimatedVisibility(
        visible = effect != null && effect.label.isNotBlank(),
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {
        val color = if (effect?.side == PkSideType.LEFT) Pink else Gold
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Text(
                "${effect?.label ?: ""} +${effect?.points ?: 0}${if ((effect?.combo ?: 0) > 1) " x${effect?.combo}" else ""}",
                color = color,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Panel.copy(alpha = 0.92f)).padding(horizontal = 18.dp, vertical = 10.dp)
            )
        }
    }
}

@Composable
fun PkVideoStage(battle: PkBattle, opponentMedia: PkMediaSession?) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Video PK stage", color = TextPrimary, fontWeight = FontWeight.Black)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
            PkSideCard(battle.left, PkSideType.LEFT, battle.leader == PkSideType.LEFT, modifier = Modifier.weight(1f))
            PkSideCard(battle.right, PkSideType.RIGHT, battle.leader == PkSideType.RIGHT, modifier = Modifier.weight(1f))
        }
        Text(
            if (opponentMedia != null) "Opponent LiveKit subscribe token ready: ${opponentMedia.title.ifBlank { opponentMedia.roomName }}. Track renderer handoff pending."
            else "Preparing opponent LiveKit subscription...",
            color = TextMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 10.dp)
        )
    }
}

@Composable
fun PkSideCard(side: PkSide, sideType: PkSideType, leading: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    val glow = rememberInfiniteTransition(label = "pk-side-glow")
    val alpha by glow.animateFloat(0.25f, 0.65f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "pk-glow-alpha")
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (leading) Gold.copy(alpha = 0.12f) else Panel)
            .clickable(onClick = onClick)
            .padding(12.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (leading) {
                Canvas(Modifier.size(76.dp)) { drawCircle(Gold.copy(alpha = alpha)) }
            }
            Avatar(side.hostName.firstOrNull()?.toString() ?: "?", 52, imageUrl = side.hostAvatar, cosmetics = side.activeCosmetics, isSpeaking = leading, showEntry = true)
        }
        Text(side.hostName, color = TextPrimary, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 1)
        Text(side.roomTitle, color = TextMuted, fontSize = 11.sp, textAlign = TextAlign.Center, maxLines = 1)
        Text("${side.participantCount} live / ${side.score.toLocaleScore()}", color = if (sideType == PkSideType.LEFT) Pink else Gold, fontSize = 12.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
fun PkWaitingState(battle: PkBattle?) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Waiting for opponent...", color = Gold, fontWeight = FontWeight.Black)
        Text(battle?.title?.ifBlank { "PK invite sent. The other host has a minute to respond." } ?: "PK invite sent.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun PkInviteCard(battle: PkBattle, inviterName: String, onAccept: () -> Unit, onReject: () -> Unit) {
    AnimatedVisibility(visible = true, enter = fadeIn() + scaleIn()) {
        GlassCard(Modifier.fillMaxWidth()) {
            Text("$inviterName invited you to PK", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("${battle.durationSeconds / 60} min / ${battle.mode.name.lowercase()} battle", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                Button(onClick = onAccept, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Gold)) {
                    Text("Accept", color = Background, fontWeight = FontWeight.Black)
                }
                Button(onClick = onReject, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5B6E))) {
                    Text("Reject", color = Color.White, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
fun PkResultDialog(battle: PkBattle?, onDismiss: () -> Unit, onRematch: () -> Unit) {
    if (battle == null || battle.status !in listOf(PkStatus.ENDED, PkStatus.FORCE_ENDED)) return
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("PK Result", color = TextPrimary, fontWeight = FontWeight.Black) },
        text = {
            Column {
                Text(
                    when (battle.winnerSide) {
                        PkSideType.LEFT -> "${battle.left.hostName} wins"
                        PkSideType.RIGHT -> "${battle.right.hostName} wins"
                        else -> "It's a draw"
                    },
                    color = Gold,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
                Text("${battle.left.score.toLocaleScore()} - ${battle.right.score.toLocaleScore()}", color = TextMuted, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = { TextButton(onClick = onRematch) { Text("Rematch", color = Gold, fontWeight = FontWeight.Black) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Close", color = TextMuted) } },
        containerColor = Background
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PkSetupBottomSheet(
    onDismiss: () -> Unit,
    onContinue: (PkMode, Int, String) -> Unit,
    onAutoMatch: (PkMode, Int, String) -> Unit = { _, _, _ -> }
) {
    var mode by rememberSaveable { mutableStateOf(PkMode.GIFT) }
    var duration by rememberSaveable { mutableStateOf(180) }
    var title by rememberSaveable { mutableStateOf("Late Night PK") }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Start PK Battle", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            YugmTextField(title, { title = it }, "Battle title")
            Text("Mode", color = TextPrimary, fontWeight = FontWeight.Black)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PkMode.values().forEach { item ->
                    ChipButton(item.name, selected = mode == item) { mode = item }
                }
            }
            Text("Duration", color = TextPrimary, fontWeight = FontWeight.Black)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(180, 300, 600).forEach { seconds ->
                    ChipButton("${seconds / 60} min", selected = duration == seconds) { duration = seconds }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = { onAutoMatch(mode, duration, title) },
                    colors = ButtonDefaults.buttonColors(containerColor = Purple),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Auto match", color = Color.White, fontWeight = FontWeight.Black)
                }
                Button(
                    onClick = { onContinue(mode, duration, title) },
                    colors = ButtonDefaults.buttonColors(containerColor = Gold),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Choose host", color = Background, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PkOpponentSearchSheet(
    opponents: List<PkOpponent>,
    search: String,
    onSearchChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onInvite: (PkOpponent) -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Choose opponent", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            YugmTextField(search, onSearchChange, "Search live hosts or rooms")
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.height(360.dp)) {
                items(opponents, key = { it.roomId }) { opponent ->
                    GlassCard(Modifier.fillMaxWidth().clickable { onInvite(opponent) }) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Avatar(opponent.hostName.firstOrNull()?.toString() ?: "?", 44, imageUrl = opponent.hostAvatar, cosmetics = opponent.activeCosmetics)
                            Column(Modifier.weight(1f)) {
                                Text(opponent.hostName, color = TextPrimary, fontWeight = FontWeight.Black)
                                Text("${opponent.roomTitle} / ${opponent.participantCount} live", color = TextMuted, fontSize = 12.sp)
                            }
                            Text("Invite", color = Gold, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PkGiftPanel(
    gifts: List<GiftItem>,
    balance: Int,
    selectedSide: PkSideType,
    onSideChange: (PkSideType) -> Unit,
    onSend: (GiftItem, PkSideType) -> Unit
) {
    GlassCard(Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ChipButton("Team Left", selected = selectedSide == PkSideType.LEFT) { onSideChange(PkSideType.LEFT) }
            ChipButton("Team Right", selected = selectedSide == PkSideType.RIGHT) { onSideChange(PkSideType.RIGHT) }
            Text("Balance $balance", color = TextMuted, fontSize = 12.sp, modifier = Modifier.align(Alignment.CenterVertically))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
            gifts.take(4).forEach { gift ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(Panel).clickable { if (balance >= gift.price) onSend(gift, selectedSide) }.padding(8.dp)
                ) {
                    Text(gift.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1)
                    Text("${gift.price}", color = if (balance >= gift.price) Gold else TextMuted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun PkReactionPanel(onReact: (String, PkSideType) -> Unit, side: PkSideType) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("heart", "fire", "clap", "wow").forEach { reaction ->
            ChipButton(reaction.uppercase(), selected = false) { onReact(reaction, side) }
        }
    }
}

@Composable
fun PkLeaderboard(entries: List<com.example.yugm.core.model.PkLeaderboardEntry>) {
    if (entries.isEmpty()) return
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Top supporters", color = TextPrimary, fontWeight = FontWeight.Black)
        entries.take(5).forEachIndexed { index, entry ->
            Text("${index + 1}. ${entry.name} / ${entry.totalPoints.toLocaleScore()}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
fun PkHistoryCard(title: String, subtitle: String) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
        Text(subtitle, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun ChipButton(text: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) Gold else Panel)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(text, color = if (selected) Background else TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun VsBadge() {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(42.dp).clip(RoundedCornerShape(21.dp)).background(Brush.linearGradient(listOf(Pink, Gold)))
    ) {
        Text("VS", color = Color.White, fontWeight = FontWeight.Black)
    }
}

fun formatPkTime(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    return "%02d:%02d".format(Locale.US, safe / 60, safe % 60)
}

private fun Int.toLocaleScore(): String = "%,d".format(Locale.US, this)

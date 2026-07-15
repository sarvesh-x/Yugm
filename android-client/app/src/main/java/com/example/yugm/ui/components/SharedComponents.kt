package com.example.yugm.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.ActiveCosmetics
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.ui.theme.*

@Composable
fun BrandHeader(compact: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            modifier = Modifier
                .size(if (compact) 38.dp else 54.dp)
                .clip(RoundedCornerShape(if (compact) 12.dp else 18.dp))
                .background(Brush.linearGradient(listOf(Saffron, Pink, Purple))),
            contentAlignment = Alignment.Center
        ) {
            Canvas(Modifier.fillMaxSize().padding(9.dp)) {
                val stroke = Stroke(width = 4.dp.toPx())
                drawLine(Color.White, Offset(size.width * 0.1f, size.height * 0.08f), Offset(size.width * 0.5f, size.height * 0.52f), strokeWidth = stroke.width)
                drawLine(Color.White, Offset(size.width * 0.9f, size.height * 0.08f), Offset(size.width * 0.5f, size.height * 0.52f), strokeWidth = stroke.width)
                drawLine(Color.White, Offset(size.width * 0.5f, size.height * 0.52f), Offset(size.width * 0.5f, size.height * 0.95f), strokeWidth = stroke.width)
            }
        }
        Column {
            Text("Yugm", color = TextPrimary, fontSize = if (compact) 22.sp else 32.sp, fontWeight = FontWeight.Black)
            if (!compact) Text("Match the vibe.", color = Gold, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun AuthShell(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        BrandHeader(compact = true)
        Column {
            Text(title, color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = TextMuted, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
            content()
        }
        Spacer(Modifier.height(1.dp))
    }
}

@Composable
fun FeatureRow(title: String, detail: String) {
    GlassCard(modifier = Modifier.padding(bottom = 10.dp)) {
        Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
        Text(detail, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
    }
}

@Composable
fun SearchBar(onSearch: () -> Unit = {}) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 18.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.horizontalGradient(listOf(SurfaceElevated, Surface)))
            .border(1.dp, Line, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 16.dp)
            .clickable { onSearch() }
    ) {
        Text("Search rooms, hosts, tags", color = TextMuted)
    }
}

@Composable
fun CategoryChips() {
    Row(
        modifier = Modifier
            .padding(top = 14.dp)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        listOf("Voice", "Music", "Gaming", "Chill", "Dating", "Learning", "Talk", "Debate").forEach { Chip(it) }
    }
}

@Composable
fun ChipWrap(items: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            items.forEach { Chip(it) }
        }
    }
}

@Composable
fun Chip(text: String) {
    Surface(color = SurfaceElevated, shape = RoundedCornerShape(13.dp), border = BorderStroke(1.dp, Line)) {
        Text(text, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

@Composable
fun RoomCarousel(rooms: List<Room>, onOpenRoom: (Room) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        items(rooms, key = { it.id }) { room -> RoomCard(room = room, wide = false, onClick = { onOpenRoom(room) }) }
    }
}

@Composable
fun RoomCard(room: Room, wide: Boolean, onClick: () -> Unit) {
    val entryScale = remember(room.id) { Animatable(0.97f) }
    val entryAlpha = remember(room.id) { Animatable(0f) }
    LaunchedEffect(room.id) {
        entryAlpha.animateTo(1f, tween(180))
        entryScale.animateTo(1f, spring(dampingRatio = 0.7f, stiffness = 420f))
    }
    val shimmer = rememberInfiniteTransition(label = "room-shimmer")
    val shimmerX by shimmer.animateFloat(
        initialValue = -0.45f,
        targetValue = 1.45f,
        animationSpec = infiniteRepeatable(tween(2400), RepeatMode.Restart),
        label = "room-shimmer-x"
    )
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Line),
        modifier = Modifier
            .then(if (wide) Modifier.fillMaxWidth().height(178.dp) else Modifier.width(230.dp).height(214.dp))
            .graphicsLayer {
                scaleX = entryScale.value
                scaleY = entryScale.value
                alpha = entryAlpha.value
            }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(room.gradient))
                .padding(14.dp)
        ) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                LiveBadge()
                Chip(room.type.name.uppercase())
            }
            Column(modifier = Modifier.align(Alignment.BottomStart)) {
                Text(room.title, color = TextPrimary, fontSize = 20.sp, lineHeight = 23.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    room.host?.let { Avatar(initial = it.name.firstOrNull()?.toString() ?: "?", size = 34, imageUrl = it.avatar, cosmetics = it.activeCosmetics, isSpeaking = room.type == RoomType.Voice) }
                    Text(room.host?.name ?: "", color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text("${room.participants} live / ${room.language}", color = TextMuted, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    Chip(room.category)
                    if (room.tags.isNotEmpty()) Chip(room.tags.first())
                }
            }
            Canvas(Modifier.fillMaxSize()) {
                val x = size.width * shimmerX
                drawRect(
                    brush = Brush.linearGradient(
                        colors = listOf(Color.Transparent, Color.White.copy(alpha = 0.13f), Color.Transparent),
                        start = Offset(x - size.width * 0.28f, 0f),
                        end = Offset(x + size.width * 0.28f, size.height)
                    )
                )
            }
        }
    }
}

@Composable
fun HostRow(host: Host, onFollow: ((String) -> Unit)? = null, onClick: ((Host) -> Unit)? = null) {
    val rowColor by animateColorAsState(
        targetValue = if (host.isFollowing) Gold.copy(alpha = 0.12f) else Panel,
        label = "host-row-color"
    )
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(rowColor)
            .then(if (onClick != null) Modifier.clickable { onClick(host) } else Modifier)
            .padding(12.dp)
    ) {
        Avatar(initial = host.name.firstOrNull()?.toString() ?: "?", size = 48, imageUrl = host.avatar, cosmetics = host.activeCosmetics)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(host.name, color = TextPrimary, fontWeight = FontWeight.Black)
                if (host.isOnline) {
                    Canvas(Modifier.size(8.dp)) {
                        drawCircle(Success)
                    }
                }
            }
            Text("${host.vibe} / ${host.city}", color = TextMuted, fontSize = 12.sp)
        }
        if (onFollow != null) {
            Text(
                if (host.isFollowing) "Following" else "Follow",
                color = if (host.isFollowing) TextPrimary else Gold,
                fontWeight = FontWeight.Black,
                modifier = Modifier.clickable { onFollow(host.id) }
            )
        }
    }
}

@Composable
fun HostCard(host: Host) {
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Avatar(host.name.firstOrNull()?.toString() ?: "?", 58, imageUrl = host.avatar, cosmetics = host.activeCosmetics, isSpeaking = true, showEntry = true)
            Column(Modifier.weight(1f)) {
                Text(host.name, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("${host.username} / ${host.city}", color = TextMuted, fontSize = 12.sp)
            }
            Text("HOST", color = Gold, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun SpeakerGrid(room: Room) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        repeat((room.maxSpeakers + 2) / 3) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                repeat(3) { col ->
                    val index = row * 3 + col
                    if (index < room.maxSpeakers) {
                        SeatCard(
                            name = when (index) {
                                0 -> room.host?.name ?: ""
                                1 -> "Open seat"
                                2 -> "Moderator"
                                else -> "Open seat"
                            },
                            cosmetics = if (index == 0) room.host?.activeCosmetics ?: ActiveCosmetics() else ActiveCosmetics(),
                            isSpeaking = index == 0,
                            showEntry = index == 0,
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
fun SeatCard(name: String, cosmetics: ActiveCosmetics = ActiveCosmetics(), isSpeaking: Boolean = false, showEntry: Boolean = false, modifier: Modifier = Modifier) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = modifier
            .height(104.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Panel)
            .padding(8.dp)
    ) {
        Avatar(initial = name.firstOrNull()?.toString() ?: "?", size = 42, cosmetics = cosmetics, isSpeaking = isSpeaking, showEntry = showEntry)
        Text(name, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 7.dp))
    }
}

@Composable
fun VideoGrid(room: Room, camera: Boolean, participants: List<com.example.yugm.model.RoomParticipant> = emptyList()) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        repeat(2) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                repeat(2) { col ->
                    val index = row * 2 + col
                    val participant = participants.getOrNull(index)
                    VideoTile(
                        label = participant?.user?.name ?: if (index == 0) (room.host?.name ?: "") else if (camera) "Open video" else "Camera off",
                        highlighted = index == 0,
                        cosmetics = participant?.user?.activeCosmetics ?: if (index == 0) room.host?.activeCosmetics ?: ActiveCosmetics() else ActiveCosmetics(),
                        imageUrl = participant?.user?.avatar ?: if (index == 0) room.host?.avatar else null,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
fun VideoTile(label: String, highlighted: Boolean, cosmetics: ActiveCosmetics = ActiveCosmetics(), imageUrl: String? = null, modifier: Modifier = Modifier) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .aspectRatio(0.82f)
            .clip(RoundedCornerShape(8.dp))
            .background(if (highlighted) Brush.linearGradient(listOf(Purple, Pink)) else Brush.linearGradient(listOf(Color(0xFF11172C), Color(0xFF18223A))))
            .padding(10.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Avatar(initial = label.firstOrNull()?.toString() ?: "?", size = 76, imageUrl = imageUrl, cosmetics = cosmetics, isSpeaking = highlighted, showEntry = highlighted)
            Text(label, color = TextPrimary, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp))
        }
    }
}

@Composable
fun RoomTopBar(room: Room, onBack: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(Ink2)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        TextButton(onClick = onBack) { Text("Close", color = TextMuted) }
        Column(Modifier.weight(1f)) {
            Text(room.title, color = TextPrimary, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("LIVE / ${room.participants} people / ${room.language}", color = TextMuted, fontSize = 12.sp)
        }
        LiveBadge()
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(text, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
}

@Composable
fun LiveBadge() {
    val pulse = rememberInfiniteTransition(label = "live-pulse")
    val alpha by pulse.animateFloat(
        initialValue = 0.42f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(620), RepeatMode.Reverse),
        label = "live-alpha"
    )
    val scale by pulse.animateFloat(
        initialValue = 0.72f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(620), RepeatMode.Reverse),
        label = "live-scale"
    )
    Surface(
        color = Ink.copy(alpha = 0.82f),
        shape = RoundedCornerShape(11.dp),
        border = BorderStroke(1.dp, Danger.copy(alpha = 0.7f))
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Canvas(
                Modifier
                    .size(7.dp)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                    }
            ) {
                drawCircle(Color.White.copy(alpha = alpha))
            }
            Text("LIVE", color = Danger, fontSize = 11.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun GlassCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(SurfaceElevated.copy(alpha = 0.92f), Surface.copy(alpha = 0.92f))))
            .border(1.dp, Line, RoundedCornerShape(20.dp))
            .padding(16.dp),
        content = content
    )
}

@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(),
        shape = RoundedCornerShape(18.dp),
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.horizontalGradient(listOf(Purple, Pink, Saffron)))
    ) {
        Text(text, color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp)
    }
}

@Composable
fun SmallAction(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .height(46.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Purple)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = Color.White, fontWeight = FontWeight.Black)
    }
}

@Composable
fun SegmentButton(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        color = if (selected) Gold.copy(alpha = 0.18f) else Panel,
        border = BorderStroke(1.dp, if (selected) Gold else Line),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
            .height(58.dp)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text, color = TextPrimary, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun YugmTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    minLines: Int = 1,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        minLines = minLines,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary,
            focusedLabelColor = Gold,
            unfocusedLabelColor = TextMuted,
            focusedBorderColor = Gold,
            unfocusedBorderColor = Line,
            cursorColor = Gold,
            focusedContainerColor = Panel,
            unfocusedContainerColor = Panel
        ),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
fun ToggleRow(text: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Panel)
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Text(text, color = TextPrimary, fontWeight = FontWeight.Bold)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier) {
        Text(value, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 19.sp)
        Text(label, color = TextMuted, fontSize = 12.sp)
    }
}

@Composable
fun LedgerRow(title: String, subtitle: String, amount: String, amountColor: Color, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Panel)
            .padding(12.dp)
    ) {
        Avatar(title.firstOrNull()?.toString() ?: "?", 42)
        Column(Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
            Text(subtitle, color = TextMuted, fontSize = 12.sp)
        }
        Text(amount, color = amountColor, fontWeight = FontWeight.Black)
    }
}

@Composable
fun SettingsRow(title: String, subtitle: String) {
    GlassCard {
        Text(title, color = TextPrimary, fontWeight = FontWeight.Black)
        Text(subtitle, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun LoadingState(message: String) {
    GlassCard {
        Text(message, color = TextPrimary, fontWeight = FontWeight.Black)
    }
}

@Composable
fun EmptyRoomsScreen(message: String, onAction: () -> Unit, action: String) {
    GlassCard {
        Text(message, color = TextPrimary, fontWeight = FontWeight.Black, lineHeight = 21.sp)
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onAction, border = BorderStroke(1.dp, Gold), shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
            Text(action, color = Gold, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String = "Confirm",
    isDestructive: Boolean = true,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, color = TextPrimary, fontWeight = FontWeight.Black) },
        text = { Text(message, color = TextMuted) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmLabel, color = if (isDestructive) Danger else Gold, fontWeight = FontWeight.Black)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextMuted, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = Ink2,
        shape = RoundedCornerShape(16.dp)
    )
}

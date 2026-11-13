package com.yugm.app.feature.chat.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.feature.chat.R
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Background = Color(0xFF060714)
private val SurfaceElevated = Color(0xFF171A2C)
private val BorderColor = Color(0x24FFFFFF)
private val TextPrimary = Color(0xFFF8FAFC)
private val TextMuted = Color(0xFF9EA3B9)
private val PrimaryPurple = Color(0xFF8D35F6)
private val Pink = Color(0xFFF6378B)
private val Danger = Color(0xFFFF3B4F)
private val Success = Color(0xFF3BE477)
private val ChatSurface = Color(0xFF0E1121)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    partner: Host?,
    currentUserId: String,
    messages: List<DirectMessage>,
    relationship: RelationshipStatus?,
    gifts: List<GiftItem> = emptyList(),
    balance: Int = 0,
    loading: Boolean = false,
    isPartnerTyping: Boolean = false,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String) -> Unit = {},
    onGift: (GiftItem) -> Unit = {},
    onReactMessage: (DirectMessage) -> Unit = {},
    onTyping: (Boolean) -> Unit = {},
    onAudioCall: () -> Unit = {},
    onVideoCall: () -> Unit = {},
    onAttachmentSelected: (ByteArray, String, String) -> Unit = { _, _, _ -> },
    onReport: () -> Unit = {},
    onBlock: () -> Unit = {}
) {
    var draft by rememberSaveable { mutableStateOf("") }
    var showGiftSheet by rememberSaveable { mutableStateOf(false) }
    var showEmojiBar by rememberSaveable { mutableStateOf(false) }
    var showMore by rememberSaveable { mutableStateOf(false) }
    var showSafety by rememberSaveable { mutableStateOf(true) }
    var typingSent by remember { mutableStateOf(false) }
    val reactions = remember { mutableStateMapOf<String, Int>() }
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val messageFieldLabel = stringResource(R.string.a11y_message_field)
    val attachPhotoLabel = stringResource(R.string.a11y_attach_photo)
    val sendGiftLabel = stringResource(R.string.a11y_send_gift)
    val sendMessageLabel = stringResource(R.string.a11y_send_message)
    val defaultMatchName = stringResource(R.string.a11y_default_match)
    val scope = rememberCoroutineScope()
    val attachmentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            scope.launch {
                val payload = withContext(Dispatchers.IO) {
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    Triple(bytes, mime, uri.lastPathSegment ?: "message-media")
                }
                val bytes = payload.first
                if (bytes != null && bytes.size <= 25 * 1024 * 1024) onAttachmentSelected(bytes, payload.second, payload.third)
            }
        }
    }

    LaunchedEffect(draft) {
        if (draft.isNotBlank()) {
            if (!typingSent) { typingSent = true; onTyping(true) }
            kotlinx.coroutines.delay(1500)
            typingSent = false
            onTyping(false)
        } else if (typingSent) {
            typingSent = false
            onTyping(false)
        }
    }
    LaunchedEffect(messages.size, isPartnerTyping, showSafety, relationship, error) {
        if (messages.isNotEmpty()) {
            val headerCount = 2 + (if (showSafety) 1 else 0) + (if (relationship != null) 1 else 0) + (if (error.isNotBlank()) 1 else 0)
            listState.animateScrollToItem(headerCount + messages.lastIndex + if (isPartnerTyping) 1 else 0)
        }
    }

    Box(Modifier.fillMaxSize().background(Background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    gradient = Brush.linearGradient(listOf(SurfaceElevated, ChatSurface)),
                    borderGradient = Brush.horizontalGradient(listOf(BorderColor, BorderColor)),
                    cornerRadius = 0.dp,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        LightChatAction("‹", stringResource(R.string.a11y_back), onBack)
                        Spacer(Modifier.width(10.dp))
                        Avatar(partner?.name?.take(1) ?: "?", 44, partner?.avatar, partner?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(partner?.name ?: "Loading match…", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                if (partner?.isVip == true) Text("  ✦", color = Pink, fontSize = 15.sp)
                            }
                            Text(
                                if (partner?.isOnline == true) "Online" else partner?.username?.let { "@$it" } ?: "Your conversation",
                                color = if (partner?.isOnline == true) Success else TextMuted,
                                fontSize = 12.sp
                            )
                        }
                        LightChatAction("⋮", stringResource(R.string.a11y_conversation_options)) { showMore = !showMore }
                    }
                }

                if (showMore) {
                    Row(Modifier.fillMaxWidth().background(SurfaceElevated).padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.End) {
                        Text("Report", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_report_conversation)) { showMore = false; onReport() }.padding(10.dp))
                        Text("Block", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_block_person)) { showMore = false; onBlock() }.padding(10.dp))
                    }
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (loading && messages.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                androidx.compose.material3.CircularProgressIndicator(color = PrimaryPurple)
                                Text("Loading conversation…", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                            }
                        }
                    } else {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            item { MatchedBanner(partner?.name ?: "your match") }
                            if (showSafety) item { SafetyTip(onDismiss = { showSafety = false }) }
                            relationship?.let { bond -> item { BondStrip(bond) } }
                            item { ConversationDivider("Today") }
                            if (error.isNotBlank()) item {
                                Text("$error · Retry", color = Pink, fontSize = 12.sp, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_retry_messages), onClick = onRetry).padding(vertical = 12.dp))
                            }
                            if (messages.isEmpty() && !loading && error.isBlank()) {
                                item {
                                    Box(Modifier.fillParentMaxHeight(0.62f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                                        EmptyConversationState(partner?.name ?: "your match")
                                    }
                                }
                            }
                            itemsIndexed(messages, key = { index, message -> message.id.ifBlank { "$index-${message.createdAt}-${message.message}" } }) { index, message ->
                                if (messages.size > 2 && index == messages.size - 2) ConversationDivider("New Messages", highlight = true)
                                MessageBubble(
                                    message = message,
                                    mine = message.senderId == currentUserId,
                                    reactionCount = message.reactionCount + (reactions[message.id.ifBlank { index.toString() }] ?: 0),
                                    onReact = {
                                        val key = message.id.ifBlank { index.toString() }
                                        reactions[key] = (reactions[key] ?: 0) + 1
                                        if (message.id.isNotBlank()) onReactMessage(message)
                                    }
                                )
                            }
                            if (isPartnerTyping) item {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Avatar(partner?.name?.take(1) ?: "?", 30, partner?.avatar, partner?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                                    Column(Modifier.padding(start = 8.dp)) {
                                        TypingBubble()
                                        Text("${partner?.name ?: "Your match"} is typing…", color = TextMuted, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    }
                }

                AnimatedVisibility(showEmojiBar) {
                    Row(
                        Modifier.fillMaxWidth().background(SurfaceElevated).horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(18.dp)
                    ) {
                        listOf("😊", "😂", "❤️", "✨", "🔥", "👋", "🎧", "🌙").forEach { emoji ->
                            val insertEmojiLabel = stringResource(R.string.a11y_insert_emoji, emoji)
                            Text(emoji, fontSize = 24.sp, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).semantics { contentDescription = insertEmojiLabel }.clickable(role = Role.Button, onClickLabel = insertEmojiLabel) { draft += emoji })
                        }
                    }
                }

                GlassCard(
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding(),
                    gradient = Brush.linearGradient(listOf(SurfaceElevated, ChatSurface)),
                    borderGradient = Brush.horizontalGradient(listOf(BorderColor, BorderColor)),
                    cornerRadius = 0.dp,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LightChatAction("☺", stringResource(R.string.a11y_toggle_emoji_picker)) { showEmojiBar = !showEmojiBar }
                        Row(
                            Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(18.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = draft,
                                onValueChange = { draft = it.take(1000) },
                                textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                                modifier = Modifier.weight(1f).semantics { contentDescription = messageFieldLabel },
                                decorationBox = { inner -> if (draft.isBlank()) Text("Message…", color = TextMuted, fontSize = 14.sp) else inner() }
                            )
                            Box(Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).semantics { contentDescription = attachPhotoLabel }.clickable(role = Role.Button, onClickLabel = attachPhotoLabel) { attachmentPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                                Text("⌕", color = TextMuted, fontSize = 20.sp)
                            }
                            Box(Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).semantics { contentDescription = sendGiftLabel }.clickable(role = Role.Button, onClickLabel = sendGiftLabel) { showGiftSheet = true }, contentAlignment = Alignment.Center) {
                                Text("♢", color = TextMuted, fontSize = 20.sp)
                            }
                        }
                        Box(
                            Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple, Pink))).semantics { contentDescription = sendMessageLabel }.clickable(role = Role.Button, onClickLabel = sendMessageLabel) {
                                val text = draft.trim()
                                if (text.isNotBlank()) { draft = ""; onSend(text) }
                            },
                            contentAlignment = Alignment.Center
                        ) { Text("➤", color = Color.White, fontSize = 21.sp) }
                    }
                }
            }
        if (showGiftSheet) {
            ModalBottomSheet(onDismissRequest = { showGiftSheet = false }, containerColor = ChatSurface) {
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Send a Gift", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        Text("● $balance", color = Color(0xFFFFC52F), fontWeight = FontWeight.Bold)
                    }
                    Row(Modifier.padding(top = 14.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        gifts.forEach { gift ->
                            Column(
                                Modifier.width(105.dp).height(132.dp).clip(RoundedCornerShape(18.dp)).background(Background).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).clickable(enabled = balance >= gift.price) { onGift(gift); showGiftSheet = false }.padding(10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(chatGiftEmoji(gift.name), fontSize = 36.sp)
                                Text(gift.name, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("● ${gift.price}", color = if (balance >= gift.price) Color(0xFFFFC52F) else Danger, fontSize = 10.sp)
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun LightChatAction(glyph: String, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(SurfaceElevated)
            .semantics { contentDescription = label }
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(glyph, color = TextPrimary, fontSize = 21.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MatchedBanner(name: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.4f), Pink.copy(alpha = 0.3f)))).border(1.dp, Pink.copy(alpha = 0.4f), RoundedCornerShape(18.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(Pink, PrimaryPurple))), contentAlignment = Alignment.Center) { Text("♡", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black) }
        Column(Modifier.padding(start = 12.dp)) {
            Text("You're Matched!", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text("Say hello to $name and start your story ✨", color = TextMuted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun EmptyConversationState(name: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            Modifier.size(56.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple.copy(alpha = 0.75f), Pink.copy(alpha = 0.75f)))),
            contentAlignment = Alignment.Center
        ) { Text("♡", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
        Text("Start the conversation", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("Send ${name.substringBefore(' ')} a message and see where the conversation goes.", color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun SafetyTip(onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("✦", color = Pink, fontSize = 28.sp)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Safety Tip", color = PrimaryPurple, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("Be kind, respectful and keep the conversation safe. Report or block anything that feels off.", color = TextMuted, fontSize = 10.sp, lineHeight = 14.sp)
        }
        Text("×", color = TextMuted, fontSize = 22.sp, modifier = Modifier.clickable(onClick = onDismiss))
    }
}

@Composable
private fun BondStrip(bond: RelationshipStatus) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SurfaceElevated).padding(12.dp)) {
        Row { Text("Bond Level ${bond.level}", color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text(bond.title, color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
        Box(Modifier.fillMaxWidth().padding(top = 7.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.08f))) {
            Box(Modifier.fillMaxWidth(bond.progress.coerceIn(0f, 1f)).height(4.dp).background(Brush.horizontalGradient(listOf(PrimaryPurple, Pink))))
        }
    }
}

@Composable
private fun ConversationDivider(label: String, highlight: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(if (highlight) Pink.copy(alpha = 0.6f) else BorderColor))
        Text(label, color = if (highlight) Pink else TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp))
        Box(Modifier.weight(1f).height(1.dp).background(if (highlight) Pink.copy(alpha = 0.6f) else BorderColor))
    }
}

@Composable
private fun MessageBubble(message: DirectMessage, mine: Boolean, reactionCount: Int, onReact: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            Box(
                Modifier.widthIn(max = 290.dp).clip(RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp, bottomStart = if (mine) 19.dp else 5.dp, bottomEnd = if (mine) 5.dp else 19.dp))
                    .background(if (mine) Brush.horizontalGradient(listOf(PrimaryPurple, Pink, Color(0xFFFF5866))) else Brush.horizontalGradient(listOf(SurfaceElevated, Color(0xFF1A1D31))))
                    .border(1.dp, if (mine) Pink.copy(alpha = 0.35f) else BorderColor, RoundedCornerShape(19.dp))
                    .clickable(onClick = onReact).padding(horizontal = 14.dp, vertical = 11.dp)
            ) {
                Column {
                    if (message.mediaUrl.isNotBlank()) {
                        AsyncImage(
                            model = message.mediaUrl,
                            contentDescription = "Shared media",
                            modifier = Modifier.width(230.dp).height(150.dp).clip(RoundedCornerShape(13.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(Modifier.height(7.dp))
                    }
                    Text(message.message, color = if (mine) Color.White else TextPrimary, fontSize = 14.sp, lineHeight = 19.sp)
                    Row(Modifier.align(Alignment.End).padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(messageTime(message.createdAt), color = if (mine) Color.White.copy(alpha = 0.76f) else TextMuted, fontSize = 9.sp)
                        if (mine) Text(
                            if (message.read) "  ✓✓" else "  ✓",
                            color = if (message.read) Color(0xFF80D8FF) else Color.White.copy(alpha = 0.8f),
                            fontSize = 9.sp
                        )
                    }
                }
            }
            if (reactionCount > 0) Box(Modifier.offset(y = (-5).dp).clip(CircleShape).background(SurfaceElevated).border(1.dp, BorderColor, CircleShape).padding(horizontal = 7.dp, vertical = 3.dp)) {
                Text("💗 $reactionCount", color = TextPrimary, fontSize = 9.sp)
            }
        }
    }
}

@Composable
fun TypingIndicatorDot(delay: Int) {
    val offsetY = if (LocalMotionEnabled.current) {
        val transition = rememberInfiniteTransition(label = "typing")
        val animatedOffset by transition.animateFloat(0f, -6f, infiniteRepeatable(tween(300, delayMillis = delay, easing = LinearEasing), RepeatMode.Reverse), label = "typing-dot")
        animatedOffset
    } else 0f
    Box(Modifier.size(5.dp).offset(y = offsetY.dp).clip(CircleShape).background(PrimaryPurple))
}

@Composable
fun TypingBubble() {
    Row(Modifier.clip(RoundedCornerShape(14.dp)).background(SurfaceElevated).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        TypingIndicatorDot(0); TypingIndicatorDot(100); TypingIndicatorDot(200)
    }
}

private fun messageTime(value: String) = if (value.length >= 16) value.substring(11, 16) else "now"
private fun chatGiftEmoji(name: String) = when {
    name.contains("rose", true) -> "🌹"
    name.contains("crown", true) -> "👑"
    name.contains("lotus", true) -> "🪷"
    name.contains("diya", true) -> "🪔"
    else -> "🎁"
}

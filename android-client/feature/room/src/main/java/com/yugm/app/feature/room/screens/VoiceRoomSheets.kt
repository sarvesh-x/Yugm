package com.yugm.app.feature.room.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomReactionAccess
import com.yugm.app.core.ui.components.ReactionArtwork
import com.yugm.app.core.ui.components.YugmLoadingSpinner

private val SheetBackground = Color(0xFF121525)
internal val RoomSheetTile = Color(0xFF1C2034)
internal val RoomSheetBorder = Color(0xFF30364E)
internal val RoomSheetText = Color(0xFFF5F3FF)
internal val RoomSheetMuted = Color(0xFFB5BCD4)
internal val RoomSheetAccent = Color(0xFFC8B2FF)
internal val RoomSheetAction = Color(0xFF6D48DF)
private val SheetGold = Color(0xFFFFD583)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun VoiceRoomSheet(
    onDismiss: () -> Unit,
    canDismiss: Boolean = true,
    content: @Composable ColumnScope.() -> Unit
) {
    val dismissEnabled by rememberUpdatedState(canDismiss)
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true) {
        it != SheetValue.Hidden || dismissEnabled
    }
    ModalBottomSheet(
        onDismissRequest = { if (dismissEnabled) onDismiss() },
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        containerColor = SheetBackground,
        contentColor = RoomSheetText,
        scrimColor = Color(0xAB070A17),
        dragHandle = {
            Box(
                Modifier.padding(top = 10.dp, bottom = 6.dp)
                    .size(width = 34.dp, height = 4.dp)
                    .background(RoomSheetBorder, RoundedCornerShape(50))
            )
        },
        content = content
    )
}

@Composable
internal fun VoiceRoomSheetHeader(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    trailing: @Composable () -> Unit = {}
) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Surface(color = RoomSheetAction.copy(alpha = 0.22f), shape = RoundedCornerShape(13.dp)) {
            Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = RoomSheetAccent, modifier = Modifier.size(22.dp))
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, color = RoomSheetText, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) Text(subtitle, color = RoomSheetMuted, fontSize = 13.sp)
        }
        trailing()
    }
}

private enum class ReactionCategory(val label: String, val icon: ImageVector, val access: RoomReactionAccess) {
    Free("Free", Icons.Filled.SentimentSatisfiedAlt, RoomReactionAccess.EVERYONE),
    Vip("VIP Exclusive", Icons.Filled.EmojiEvents, RoomReactionAccess.VIP_EXCLUSIVE)
}

@Composable
internal fun VoiceRoomReactionSheet(
    reactions: List<RoomReaction>,
    loading: Boolean,
    error: String?,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
    onReact: (String) -> Unit
) {
    var category by rememberSaveable { mutableStateOf(ReactionCategory.Free) }
    val visibleReactions = reactions.filter { it.access == category.access }
    val vipLocked = category == ReactionCategory.Vip &&
        visibleReactions.isNotEmpty() && visibleReactions.none { it.usable }

    VoiceRoomSheet(onDismiss = onDismiss) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().heightIn(max = maxHeight * 0.56f)) {
                VoiceRoomSheetHeader(
                    title = "Live reactions",
                    icon = Icons.Filled.SentimentSatisfiedAlt,
                    modifier = Modifier.padding(start = 16.dp, end = 8.dp)
                ) {
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = "Close reactions", tint = RoomSheetMuted)
                    }
                }
                if (vipLocked) {
                    Text(
                        "Unlock exclusive reactions at VIP 3",
                        color = SheetGold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp)
                    )
                }
                Box(Modifier.weight(1f, fill = false).fillMaxWidth().heightIn(min = 100.dp), contentAlignment = Alignment.Center) {
                    when {
                        visibleReactions.isNotEmpty() -> key(category) {
                            LazyVerticalGrid(
                                columns = GridCells.Fixed(4),
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(visibleReactions, key = { it.id }) { reaction ->
                                    ReactionTile(reaction) {
                                        onReact(reaction.id)
                                        onDismiss()
                                    }
                                }
                            }
                        }
                        loading -> YugmLoadingSpinner(size = 28.dp, modifier = Modifier.semantics { stateDescription = "Loading reactions" })
                        error != null -> Column(
                            modifier = Modifier.padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("Couldn’t load reactions", color = RoomSheetMuted, textAlign = TextAlign.Center)
                            TextButton(onClick = onRetry) { Text("Try again", color = RoomSheetAccent) }
                        }
                        else -> Text(
                            if (category == ReactionCategory.Vip) "No VIP reactions available" else "No free reactions available",
                            color = RoomSheetMuted,
                            modifier = Modifier.padding(16.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
                HorizontalDivider(color = RoomSheetBorder)
                Row(
                    modifier = Modifier.fillMaxWidth().selectableGroup().padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ReactionCategory.entries.forEach { tab ->
                        val selected = category == tab
                        val tint = when {
                            !selected -> RoomSheetMuted
                            tab == ReactionCategory.Vip -> SheetGold
                            else -> RoomSheetAccent
                        }
                        Row(
                            modifier = Modifier.weight(1f)
                                .clip(RoundedCornerShape(13.dp))
                                .background(if (selected) RoomSheetTile else Color.Transparent)
                                .selectable(selected = selected, role = Role.Tab, onClick = { category = tab })
                                .heightIn(min = 48.dp)
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(tab.icon, contentDescription = null, tint = tint, modifier = Modifier.size(19.dp))
                            Text(tab.label, color = tint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReactionTile(reaction: RoomReaction, onClick: () -> Unit) {
    val locked = !reaction.usable
    Surface(
        onClick = onClick,
        enabled = !locked,
        modifier = Modifier.fillMaxWidth().semantics {
            if (locked) stateDescription = "Unlocks at VIP 3"
        },
        shape = RoundedCornerShape(15.dp),
        color = RoomSheetTile,
        border = BorderStroke(1.dp, RoomSheetBorder)
    ) {
        Box {
            Column(
                Modifier.padding(horizontal = 3.dp, vertical = 9.dp).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Box(
                    Modifier.size(43.dp).alpha(if (locked) 0.55f else 1f).clearAndSetSemantics {},
                    contentAlignment = Alignment.Center
                ) {
                    ReactionArtwork(
                        emoji = reaction.emoji.ifBlank { "✨" },
                        assetUrl = reaction.assetUrl,
                        label = reaction.label,
                        emojiSize = 31.sp
                    )
                }
                Text(
                    reaction.label,
                    color = RoomSheetMuted,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (locked) {
                Icon(
                    Icons.Filled.Lock,
                    contentDescription = null,
                    tint = SheetGold,
                    modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(12.dp)
                )
            }
        }
    }
}

internal data class VoiceRoomTool(val label: String, val icon: ImageVector, val onClick: () -> Unit)

@Composable
internal fun VoiceRoomToolsSheet(tools: List<VoiceRoomTool>, onDismiss: () -> Unit) {
    VoiceRoomSheet(onDismiss = onDismiss) {
        VoiceRoomSheetHeader("Room tools", Icons.Filled.GridView, Modifier.padding(start = 16.dp, end = 8.dp)) {
            IconButton(onClick = onDismiss) {
                Icon(Icons.Filled.Close, contentDescription = "Close room tools", tint = RoomSheetMuted)
            }
        }
        LazyVerticalGrid(
            columns = GridCells.Adaptive(69.dp),
            modifier = Modifier.fillMaxWidth().heightIn(max = 350.dp),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(tools, key = { it.label }) { tool ->
                Surface(
                    onClick = {
                        onDismiss()
                        tool.onClick()
                    },
                    shape = RoundedCornerShape(15.dp),
                    color = RoomSheetTile,
                    border = BorderStroke(1.dp, RoomSheetBorder)
                ) {
                    Column(
                        modifier = Modifier.heightIn(min = 78.dp).padding(horizontal = 3.dp, vertical = 9.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically)
                    ) {
                        Icon(tool.icon, contentDescription = null, tint = RoomSheetAccent, modifier = Modifier.size(22.dp))
                        Text(tool.label, color = RoomSheetText, fontSize = 11.sp, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}

@Composable
internal fun VoiceRoomWheelPreviewSheet(onDismiss: () -> Unit) {
    var spun by rememberSaveable { mutableStateOf(false) }
    VoiceRoomSheet(onDismiss = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            VoiceRoomSheetHeader("Lucky wheel", Icons.Filled.Casino, subtitle = "Preview")
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = RoomSheetTile,
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, RoomSheetBorder)
            ) {
                Column(
                    Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = SheetGold, modifier = Modifier.size(34.dp))
                    Text(
                        if (spun) "Sample prize · 50 bonus coins" else "Frames, badges and bonus coins",
                        color = RoomSheetText,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text("Preview spins are free and award no prizes.", color = RoomSheetMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                }
            }
            Button(
                onClick = { if (spun) onDismiss() else spun = true },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RoomSheetAction, contentColor = Color.White)
            ) {
                Text(if (spun) "Done" else "Preview spin", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun VoiceRoomSeatSheet(
    seatIndex: Int,
    locked: Boolean,
    canManage: Boolean,
    onDismiss: () -> Unit,
    onTakeSeat: () -> Unit,
    onToggleLock: () -> Unit
) {
    VoiceRoomSheet(onDismiss = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            VoiceRoomSheetHeader(
                title = "Mic seat ${seatIndex + 1}",
                icon = if (locked) Icons.Filled.Lock else Icons.Filled.Mic,
                subtitle = if (locked) "Locked by a host or admin" else "Open to join the stage"
            )
            if (!locked) {
                Button(
                    onClick = onTakeSeat,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RoomSheetAction, contentColor = Color.White)
                ) {
                    Text("Take seat", fontWeight = FontWeight.Bold)
                }
            }
            if (canManage) {
                OutlinedButton(
                    onClick = onToggleLock,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    border = BorderStroke(1.dp, RoomSheetBorder),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = RoomSheetAccent)
                ) {
                    Icon(
                        if (locked) Icons.Filled.LockOpen else Icons.Filled.Lock,
                        contentDescription = null,
                        modifier = Modifier.padding(end = 6.dp).size(21.dp)
                    )
                    Text(if (locked) "Unlock seat" else "Lock seat")
                }
            }
        }
    }
}

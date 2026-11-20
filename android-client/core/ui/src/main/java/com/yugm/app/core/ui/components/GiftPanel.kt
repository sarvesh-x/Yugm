package com.yugm.app.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.InventoryItem
import com.yugm.app.core.model.RoomParticipant

private val GiftInk = Color(0xFFF8F7FC)
private val GiftMuted = Color(0xFF9C98A8)
private val GiftViolet = Color(0xFF8547FF)
private val GiftSurface = Color(0xFF17171D)
private val GiftTile = Color(0xFF222129)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GiftPanel(
    open: Boolean,
    gifts: List<GiftItem>,
    balance: Int,
    onDismiss: () -> Unit,
    onSend: (GiftItem) -> Unit,
    diamondBalance: Int = 0,
    onSendWithCurrency: ((GiftItem, String) -> Unit)? = null,
    participants: List<RoomParticipant> = emptyList(),
    currentUserId: String = "",
    inventory: List<InventoryItem> = emptyList(),
    onSendToRecipients: ((GiftItem, String, List<String>) -> Unit)? = null,
    onSendInventory: ((InventoryItem, List<String>) -> Unit)? = null,
    currentUserVipLevel: Int = 0,
    onOpenBondGifts: ((String) -> Unit)? = null
) {
    if (!open) return
    var currency by remember { mutableStateOf("COINS") }
    var tab by remember { mutableStateOf("Gift") }
    var selectedGift by remember { mutableStateOf<GiftItem?>(null) }
    var selectedInventory by remember { mutableStateOf<InventoryItem?>(null) }
    val availableRecipients = remember(participants, currentUserId) { participants.filter { it.user.id.isNotBlank() && it.user.id != currentUserId } }
    var selectedRecipientIds by remember(availableRecipients) {
        mutableStateOf(setOfNotNull(availableRecipients.firstOrNull { it.role == "HOST" }?.user?.id ?: availableRecipients.firstOrNull()?.user?.id))
    }
    val displayedBalance = if (currency == "DIAMONDS") diamondBalance else balance
    val selectedPrice = selectedGift?.let { if (currency == "DIAMONDS") it.diamondPrice else it.price } ?: 0
    val recipientCount = selectedRecipientIds.size.coerceAtLeast(if (availableRecipients.isEmpty()) 1 else 0)
    val selectedGiftLocked = selectedGift?.category?.contains("vip", ignoreCase = true) == true && currentUserVipLevel < 1
    val canSend = !selectedGiftLocked && (selectedRecipientIds.isNotEmpty() || availableRecipients.isEmpty()) &&
        (selectedInventory?.quantity?.let { it >= recipientCount } ?: (selectedGift != null && selectedPrice * recipientCount <= displayedBalance))
    val selectedItems = when (tab) {
        "Backpack" -> emptyList()
        else -> gifts.filter { currency == "COINS" || it.diamondPrice > 0 }.filter { gift -> gift.matchesGiftTab(tab) }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = GiftSurface,
        contentColor = GiftInk,
        dragHandle = { Box(Modifier.padding(top = 10.dp).width(38.dp).height(4.dp).clip(CircleShape).background(Color(0xFF55525E))) }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.91f).padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 7.dp, bottom = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Send a gift", color = GiftInk, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("✦  Gift room moments", color = GiftMuted, fontSize = 11.sp)
            }

            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                LazyRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(end = 8.dp)) {
                    items(availableRecipients, key = { it.user.id }) { participant ->
                        val id = participant.user.id
                        val selected = id in selectedRecipientIds
                        Column(
                            Modifier.width(48.dp).clickable {
                                selectedRecipientIds = if (selected) selectedRecipientIds - id else selectedRecipientIds + id
                            },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Box {
                                Avatar(participant.user.name, 38, participant.user.avatar, participant.user.activeCosmetics, avatarType = participant.user.avatarType, avatarParts = participant.user.avatarParts)
                                if (selected) Box(Modifier.align(Alignment.BottomEnd).size(14.dp).clip(CircleShape).background(Color(0xFFFFBB36)), contentAlignment = Alignment.Center) {
                                    Text("✓", color = Color(0xFF251A00), fontSize = 9.sp, fontWeight = FontWeight.Black)
                                }
                            }
                            Text(participant.user.name.ifBlank { "User" }.take(7), color = if (selected) GiftInk else GiftMuted, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Spacer(Modifier.width(5.dp))
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    RecipientAction(Icons.Filled.Mic, "Mic", selectedRecipientIds.size == availableRecipients.count { it.role in setOf("HOST", "SPEAKER", "MODERATOR") }) {
                        selectedRecipientIds = availableRecipients.filter { it.role in setOf("HOST", "SPEAKER", "MODERATOR") }.map { it.user.id }.toSet()
                    }
                    RecipientAction(Icons.Filled.Groups, "Everyone", selectedRecipientIds.size == availableRecipients.size) {
                        selectedRecipientIds = availableRecipients.map { it.user.id }.toSet()
                    }
                }
            }
            Text("${selectedRecipientIds.size} recipient${if (selectedRecipientIds.size == 1) "" else "s"} selected", color = GiftMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp, bottom = 9.dp))

            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(GiftTile).padding(horizontal = 13.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(if (currency == "COINS") "🪙" else "💎", fontSize = 19.sp)
                Column(Modifier.weight(1f).padding(start = 9.dp)) {
                    Text("${displayedBalance}", color = GiftInk, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text(if (currency == "COINS") "Coin balance" else "Diamond balance", color = GiftMuted, fontSize = 10.sp)
                }
                listOf("COINS", "DIAMONDS").filter { it == "COINS" || diamondBalance > 0 }.forEach { option ->
                    Text(
                        if (option == "COINS") "Coins" else "Diamonds",
                        color = if (currency == option) GiftInk else GiftMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 5.dp).clip(RoundedCornerShape(20.dp))
                            .background(if (currency == option) GiftViolet else Color.Transparent)
                            .clickable { currency = option; selectedGift = null }.padding(horizontal = 9.dp, vertical = 7.dp)
                    )
                }
            }

            LazyRow(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 7.dp), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                items(listOf("Backpack", "Gift", "Goods", "Intimacy", "VIP")) { category ->
                    Column(Modifier.clickable { tab = category; selectedGift = null; selectedInventory = null }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(category, color = if (tab == category) GiftInk else GiftMuted, fontSize = 13.sp, fontWeight = if (tab == category) FontWeight.Bold else FontWeight.Medium)
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.width(if (tab == category) 22.dp else 8.dp).height(3.dp).clip(CircleShape).background(if (tab == category) GiftViolet else Color.Transparent))
                    }
                }
            }

            if (tab == "Intimacy" && onOpenBondGifts != null) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TextButton(onClick = { onOpenBondGifts(selectedRecipientIds.singleOrNull().orEmpty()) }) {
                        Text("Open Bond gifts", color = GiftInk)
                    }
                }
            } else if (tab == "Backpack") {
                if (inventory.isEmpty()) {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("🎒", fontSize = 34.sp)
                            Text("Your backpack is empty", color = GiftMuted, fontSize = 13.sp)
                        }
                    }
                } else {
                    LazyVerticalGrid(columns = GridCells.Fixed(4), modifier = Modifier.weight(1f), contentPadding = PaddingValues(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(inventory, key = { it.id }) { item ->
                            val active = selectedInventory?.id == item.id
                            val gift = item.gift
                            GiftTile(
                                name = gift?.name.orEmpty(), icon = gift?.icon.orEmpty(), priceLabel = "x${item.quantity}", selected = active,
                                badge = "×${item.quantity}", onClick = { selectedInventory = item; selectedGift = null }
                            )
                        }
                    }
                }
            } else {
                if (selectedItems.isEmpty()) {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { Text("No gifts in this category yet", color = GiftMuted, fontSize = 12.sp) }
                } else {
                    LazyVerticalGrid(columns = GridCells.Fixed(4), modifier = Modifier.weight(1f), contentPadding = PaddingValues(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(selectedItems, key = { it.id }) { gift ->
                            val active = selectedGift?.id == gift.id
                            val price = if (currency == "DIAMONDS") gift.diamondPrice else gift.price
                            GiftTile(
                                name = gift.name, icon = gift.icon, priceLabel = "$price", selected = active,
                                badge = if (gift.rarity.equals("rare", true) || gift.rarity.equals("legendary", true)) "✦" else null,
                                onClick = { selectedGift = gift; selectedInventory = null }
                            )
                        }
                    }
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(top = 7.dp, bottom = 18.dp).clip(RoundedCornerShape(28.dp)).background(Color(0xFF29272F)).padding(5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                    Text(selectedInventory?.gift?.name ?: selectedGift?.name ?: "Choose a gift", color = GiftInk, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(if (selectedInventory != null) "From backpack · ${selectedRecipientIds.size} recipient(s)" else if (selectedGift != null) "${selectedPrice} ${currency.lowercase()} · ${selectedRecipientIds.size} recipient(s)" else "Select recipients and a gift", color = GiftMuted, fontSize = 9.sp, maxLines = 1)
                }
                Button(
                    onClick = {
                        val recipients = selectedRecipientIds.toList()
                        val owned = selectedInventory
                        if (owned != null && recipients.isNotEmpty()) onSendInventory?.invoke(owned, recipients)
                        else selectedGift?.let { gift ->
                            if (onSendToRecipients != null) onSendToRecipients.invoke(gift, currency, recipients)
                            else if (currency == "COINS") onSend(gift) else onSendWithCurrency?.invoke(gift, currency) ?: onSend(gift)
                        }
                        selectedGift = null
                        selectedInventory = null
                    },
                    enabled = canSend && (selectedInventory == null || onSendInventory != null),
                    modifier = Modifier.width(112.dp).height(42.dp),
                    shape = RoundedCornerShape(24.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = GiftViolet, disabledContainerColor = Color(0xFF45424C)),
                    contentPadding = PaddingValues(0.dp)
                ) { Text(if (selectedGiftLocked) "VIP 1 to unlock" else "Send", color = if (canSend) Color.White else GiftMuted, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun RecipientAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(20.dp)).background(if (active) GiftViolet else GiftTile).clickable(onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = null, tint = GiftInk, modifier = Modifier.size(13.dp))
        Text(label, color = GiftInk, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun GiftTile(name: String, icon: String, priceLabel: String, selected: Boolean, badge: String?, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0xFF2A203B) else Color.Transparent)
            .border(if (selected) 1.dp else .5.dp, if (selected) GiftViolet else Color(0xFF37353E), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick).padding(horizontal = 5.dp, vertical = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(Modifier.fillMaxWidth().height(74.dp).clip(RoundedCornerShape(10.dp)).background(GiftTile), contentAlignment = Alignment.Center) {
            GiftArtwork(icon, Modifier.fillMaxSize())
            badge?.let { Box(Modifier.align(Alignment.TopEnd).padding(4.dp).clip(RoundedCornerShape(5.dp)).background(Color(0xFFFFB345)).padding(horizontal = 4.dp, vertical = 2.dp)) { Text(it, color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold) } }
        }
        Text(name, color = GiftInk, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("💎 $priceLabel", color = GiftMuted, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun GiftArtwork(icon: String, modifier: Modifier = Modifier) {
    if (icon.startsWith("http", true)) {
        AsyncImage(model = icon, contentDescription = null, modifier = modifier.padding(4.dp))
    } else {
        Box(modifier, contentAlignment = Alignment.Center) { Text(icon.ifBlank { "🎁" }, fontSize = 38.sp) }
    }
}

private fun GiftItem.matchesGiftTab(tab: String): Boolean = when (tab) {
    "Goods" -> category.contains("good", true) || category.contains("item", true) || category.contains("vehicle", true)
    "Intimacy" -> category.contains("intimacy", true) || category.contains("relationship", true)
    "VIP" -> category.contains("vip", true) || rarity.contains("vip", true)
    else -> !category.contains("good", true) && !category.contains("item", true) && !category.contains("vehicle", true) &&
        !category.contains("intimacy", true) && !category.contains("relationship", true) && !category.contains("vip", true)
}

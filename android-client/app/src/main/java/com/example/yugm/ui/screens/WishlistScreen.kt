package com.example.yugm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.WishlistGift
import com.example.yugm.model.WishlistItem
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.GradientAction
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmPageHeader
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.Panel
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import kotlinx.coroutines.launch

@Composable
fun WishlistScreen(
    token: String,
    userId: String? = null,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var loading by remember { mutableStateOf(true) }
    var items by remember { mutableStateOf<List<WishlistItem>>(emptyList()) }
    var showForm by remember { mutableStateOf(false) }
    var giftId by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(true) }
    var adding by remember { mutableStateOf(false) }

    fun load() {
        scope.launch {
            loading = true
            runCatching {
                if (userId != null) YugmApi.userWishlist(token, userId) else YugmApi.myWishlist(token)
            }.onSuccess { items = it }
                .onFailure { Toast.makeText(context, it.message ?: "Failed to load wishlist", Toast.LENGTH_SHORT).show() }
            loading = false
        }
    }

    LaunchedEffect(token, userId) { load() }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader(if (userId != null) "Wishlist" else "My Wishlist", onBack = onBack)
            }
            if (loading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading wishlist...") } }
            } else {
                if (items.isEmpty()) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp)) {
                            GlassCard {
                                Text(if (userId != null) "This wishlist is empty." else "Your wishlist is empty.", color = TextPrimary, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                } else {
                    items(items, key = { it._id }) { item ->
                        WishlistItemRow(item = item, onDelete = {
                            scope.launch {
                                runCatching { YugmApi.deleteWishlistItem(token, item._id) }
                                    .onSuccess { load() }
                                    .onFailure { Toast.makeText(context, it.message ?: "Failed to delete", Toast.LENGTH_SHORT).show() }
                            }
                        })
                    }
                }
                if (userId == null) {
                    item {
                        GradientAction(
                            label = if (showForm) "Cancel" else "Add Item",
                            modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                            onClick = { showForm = !showForm }
                        )
                    }
                    if (showForm) {
                        item {
                            Column(
                                modifier = Modifier
                                    .padding(horizontal = 20.dp)
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(SurfaceElevated)
                                    .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                OutlinedTextField(
                                    value = giftId,
                                    onValueChange = { giftId = it },
                                    label = { Text("Gift ID") },
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
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = message,
                                    onValueChange = { message = it },
                                    label = { Text("Message (optional)") },
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
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Public", color = TextPrimary, fontWeight = FontWeight.Bold)
                                    Switch(checked = isPublic, onCheckedChange = { isPublic = it })
                                }
                                GradientAction(
                                    label = if (adding) "Adding..." else "Add to Wishlist",
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !adding && giftId.isNotBlank(),
                                    onClick = {
                                        adding = true
                                        scope.launch {
                                            runCatching { YugmApi.addWishlistItem(token, giftId, message.ifBlank { null }, isPublic) }
                                                .onSuccess {
                                                    giftId = ""
                                                    message = ""
                                                    isPublic = true
                                                    showForm = false
                                                    load()
                                                }
                                                .onFailure { Toast.makeText(context, it.message ?: "Failed to add item", Toast.LENGTH_SHORT).show() }
                                            adding = false
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WishlistItemRow(item: WishlistItem, onDelete: () -> Unit) {
    val gift = item.giftId
    val name = gift?.name ?: "Unknown Gift"
    val icon = gift?.icon ?: "🎁"

    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated)
            .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
            .clickable { }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)).background(Panel),
            contentAlignment = Alignment.Center
        ) {
            Text(if (icon.length <= 2) icon else "🎁", fontSize = 24.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!item.message.isNullOrBlank()) {
                Text(item.message, color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
            Text("● ${gift?.coinPrice ?: 0}", color = Gold, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        }
        Spacer(Modifier.width(8.dp))
        Text(
            "✕",
            color = Pink,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onDelete).padding(8.dp)
        )
    }
}

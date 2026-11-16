package com.yugm.app.feature.social.screens

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.TextButton
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.WishlistItem
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Line
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.feature.social.viewmodel.SocialViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun WishlistScreen(
    token: String,
    userId: String? = null,
    onBack: () -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()
    val context = LocalContext.current
    var showForm by remember { mutableStateOf(false) }
    var giftId by remember { mutableStateOf("") }
    var giftName by remember { mutableStateOf("") }
    var gifts by remember { mutableStateOf<List<GiftItem>>(emptyList()) }
    var giftsLoading by remember { mutableStateOf(false) }
    var giftLoadAttempt by remember { mutableStateOf(0) }
    var giftsError by remember { mutableStateOf<String?>(null) }
    var showGiftPicker by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(true) }
    var adding by remember { mutableStateOf(false) }

    LaunchedEffect(token) { viewModel.loadWishlist(token) }
    LaunchedEffect(showForm, token, giftLoadAttempt) {
        if (showForm && gifts.isEmpty() && !giftsLoading) {
            giftsLoading = true
            giftsError = null
            runCatching { withContext(Dispatchers.IO) { YugmApi.gifts(token) } }
                .onSuccess { gifts = it }
                .onFailure { giftsError = it.message ?: "Could not load gifts." }
            giftsLoading = false
        }
    }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader(if (userId != null) "Wishlist" else "My Wishlist", onBack = onBack)
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading wishlist...") } }
            } else {
                if (viewModel.wishlist.isEmpty()) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp)) {
                            GlassCard {
                                Text("Your wishlist is empty.", color = TextPrimary, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                } else {
                    items(viewModel.wishlist, key = { it._id }) { item ->
                        WishlistItemRow(
                            item = item,
                            onDelete = { viewModel.deleteWishlistItem(token, item._id) }
                        )
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
                                OutlinedButton(
                                    onClick = { showGiftPicker = true },
                                    enabled = !giftsLoading && gifts.isNotEmpty(),
                                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)
                                ) {
                                    Text(if (giftName.isBlank()) "Choose a gift" else "🎁  $giftName")
                                }
                                giftsError?.let { message ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(message, color = Danger, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                        TextButton(onClick = { giftLoadAttempt++ }) { Text("Retry") }
                                    }
                                }
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
                                        viewModel.addWishlistItem(token, giftId.trim(), message.trim().ifBlank { null }, isPublic) { success ->
                                            adding = false
                                            if (success) {
                                                giftId = ""
                                                giftName = ""
                                                message = ""
                                                isPublic = true
                                                showForm = false
                                            } else {
                                                Toast.makeText(context, viewModel.error ?: "Could not add this gift.", Toast.LENGTH_SHORT).show()
                                            }
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

    if (showGiftPicker) {
        AlertDialog(
            onDismissRequest = { showGiftPicker = false },
            title = { Text("Choose a gift", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                when {
                    giftsLoading -> CircularProgressIndicator()
                    gifts.isEmpty() -> Text(giftsError ?: "No gifts are available right now.", color = TextMuted)
                    else -> LazyColumn(Modifier.heightIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(gifts, key = { it.id }) { gift ->
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable {
                                    giftId = gift.id
                                    giftName = gift.name
                                    showGiftPicker = false
                                }.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(gift.icon.ifBlank { "🎁" }, fontSize = 22.sp)
                                Column(Modifier.padding(start = 10.dp).weight(1f)) {
                                    Text(gift.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                                    Text("${gift.price} coins", color = TextMuted, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showGiftPicker = false }) { Text("Close") }
            }
        )
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
            val message = item.message
            if (!message.isNullOrBlank()) {
                Text(message, color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
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

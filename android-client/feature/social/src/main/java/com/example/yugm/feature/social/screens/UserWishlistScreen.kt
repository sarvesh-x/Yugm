package com.example.yugm.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.WishlistItem
import com.example.yugm.feature.social.viewmodel.SocialViewModel
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.GradientAction
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.core.ui.theme.BorderColor
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import kotlinx.coroutines.launch

@Composable
fun UserWishlistScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onSendGift: (String) -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var sending by remember { mutableStateOf<Set<String>>(emptySet()) }

    LaunchedEffect(token, userId) {
        viewModel.loadUserWishlist(token, userId)
    }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Wishlist", onBack = onBack)
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading wishlist...") } }
            } else if (viewModel.userWishlistItems.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        GlassCard {
                            Text("This wishlist is empty.", color = TextPrimary, fontWeight = FontWeight.Black)
                        }
                    }
                }
            } else {
                items(viewModel.userWishlistItems, key = { it._id }) { item ->
                    WishlistGiftRow(
                        item = item,
                        isSending = item._id in sending,
                        onSend = {
                            sending = sending + item._id
                            scope.launch {
                                runCatching {
                                    viewModel.sendWishlistGift(token, item._id)
                                }.onSuccess {
                                    Toast.makeText(context, "Gift sent!", Toast.LENGTH_SHORT).show()
                                    onSendGift(item._id)
                                }.onFailure {
                                    Toast.makeText(context, it.message ?: "Failed to send gift", Toast.LENGTH_SHORT).show()
                                }
                                sending = sending - item._id
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun WishlistGiftRow(item: WishlistItem, isSending: Boolean, onSend: () -> Unit) {
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
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Panel),
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
        GradientAction(
            label = if (isSending) "Sending..." else "Send",
            modifier = Modifier.width(96.dp),
            enabled = !isSending,
            onClick = onSend
        )
    }
}

package com.yugm.app.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Ink2
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GiftPanel(
    open: Boolean,
    gifts: List<GiftItem>,
    balance: Int,
    onDismiss: () -> Unit,
    onSend: (GiftItem) -> Unit,
    diamondBalance: Int = 0,
    onSendWithCurrency: ((GiftItem, String) -> Unit)? = null
) {
    if (open) {
        var currency by remember { mutableStateOf("COINS") }
        val diamondAvailable = diamondBalance > 0 && gifts.any { it.diamondPrice > 0 }
        val displayedBalance = if (currency == "DIAMONDS") diamondBalance else balance
        ModalBottomSheet(
            onDismissRequest = onDismiss,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Ink2
        ) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Gifts", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp, bottom = 10.dp)) {
                    listOf("COINS", "DIAMONDS").filter { it == "COINS" || diamondAvailable }.forEach { option ->
                        Text(
                            if (option == "COINS") "🪙 Coins" else "💎 Diamonds",
                            color = if (currency == option) TextPrimary else TextMuted,
                            modifier = Modifier.clip(RoundedCornerShape(18.dp)).background(if (currency == option) Panel else Ink2)
                                .clickable { currency = option }.padding(horizontal = 14.dp, vertical = 9.dp)
                        )
                    }
                }
                Text("Balance: $displayedBalance ${currency.lowercase()}", color = TextMuted, modifier = Modifier.padding(bottom = 12.dp))
                gifts.filter { currency == "COINS" || it.diamondPrice > 0 }.forEach { gift ->
                    val price = if (currency == "DIAMONDS") gift.diamondPrice else gift.price
                    val canAfford = displayedBalance >= price
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Panel)
                            .padding(12.dp)
                            .clickable(enabled = canAfford) {
                                onSendWithCurrency?.invoke(gift, currency) ?: onSend(gift)
                                onDismiss()
                            }
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(gift.name, color = TextPrimary, fontWeight = FontWeight.Black)
                            Text("$price ${currency.lowercase()}", color = TextMuted, fontSize = 12.sp)
                        }
                        Text(if (canAfford) "Send" else "Not enough", color = if (canAfford) Gold else TextMuted, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

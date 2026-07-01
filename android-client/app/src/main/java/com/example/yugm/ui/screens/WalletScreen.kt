package com.example.yugm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.GiftItem
import com.example.yugm.model.WalletTransaction
import com.example.yugm.ui.components.EmptyRoomsScreen
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LedgerRow
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.theme.*

@Composable
fun WalletScreen(balance: Int, onRecharge: () -> Unit, loading: Boolean = false, gifts: List<GiftItem> = emptyList(), transactions: List<WalletTransaction> = emptyList()) {
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        if (loading && balance == 0) {
            item { LoadingState("Loading wallet...") }
        }
        item {
            Text("Wallet", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.linearGradient(listOf(Saffron, Pink, Purple)))
                    .padding(20.dp)
            ) {
                Column {
                    Text("Coin balance", color = Color.White.copy(alpha = 0.78f), fontWeight = FontWeight.Bold)
                    Text("$balance", color = Color.White, fontSize = 48.sp, fontWeight = FontWeight.Black)
                    Button(
                        onClick = onRecharge,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Black.copy(alpha = 0.25f)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Dev recharge")
                    }
                }
            }
        }
        if (gifts.isNotEmpty()) {
            item { SectionTitle("Gift catalog") }
            items(gifts, key = { it.id }) { gift ->
                LedgerRow(title = gift.name, subtitle = "${gift.price} coins", amount = "-${gift.price}", amountColor = Danger)
            }
        }
        if (transactions.isNotEmpty()) {
            item { SectionTitle("Transaction history") }
            items(transactions, key = { it.createdAt + it.type }) { txn ->
                val sign = if (txn.amount >= 0) "+" else ""
                LedgerRow(title = txn.description.ifBlank { txn.type }, subtitle = txn.createdAt.take(10), amount = "$sign${txn.amount}", amountColor = if (txn.amount >= 0) Success else Danger)
            }
        }
        if (!loading && transactions.isEmpty()) {
            item { Spacer(Modifier.height(16.dp)) }
            item { EmptyRoomsScreen(message = "No transactions yet", onAction = onRecharge, action = "Recharge") }
        }
    }
}

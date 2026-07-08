package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.WalletTransaction
import com.example.yugm.ui.components.LedgerRow
import com.example.yugm.ui.components.StatCard
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun WalletScreen(
    balance: Int,
    transactions: List<WalletTransaction>
) {
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Wallet", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("Your earnings, spendings and rewards.", color = TextMuted, modifier = Modifier.padding(top = 8.dp, bottom = 10.dp))
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(label = "Coins", value = balance.toString(), modifier = Modifier.weight(1f))
                StatCard(label = "Rewards", value = "0", modifier = Modifier.weight(1f))
            }
        }
        item {
            Text("Recent Transactions", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(top = 10.dp))
        }
        if (transactions.isEmpty()) {
            item {
                Text("No transactions yet.", color = TextMuted, fontSize = 14.sp)
            }
        }
        items(transactions) { tx ->
            LedgerRow(
                title = tx.type.replace("_", " ").capitalize(),
                subtitle = tx.createdAt,
                amount = "${if (tx.amount > 0) "+" else ""}${tx.amount}",
                amountColor = if (tx.amount > 0) Color.Green else Gold
            )
        }
    }
}

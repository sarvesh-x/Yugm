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
    onSend: (GiftItem) -> Unit
) {
    if (open) {
        ModalBottomSheet(
            onDismissRequest = onDismiss,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Ink2
        ) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Gifts", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("Balance: $balance coins", color = TextMuted, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                gifts.forEach { gift ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Panel)
                            .padding(12.dp)
                            .clickable { onSend(gift); onDismiss() }
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(gift.name, color = TextPrimary, fontWeight = FontWeight.Black)
                            Text("${gift.price} coins", color = TextMuted, fontSize = 12.sp)
                        }
                        Text("Send", color = Gold, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

package com.example.yugm.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.PanelStrong
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun ControlButton(text: String, active: Boolean = false, danger: Boolean = false, onClick: () -> Unit) {
    Surface(
        color = when {
            danger -> Danger.copy(alpha = 0.20f)
            active -> Gold.copy(alpha = 0.20f)
            else -> PanelStrong
        },
        border = BorderStroke(1.dp, when {
            danger -> Danger
            active -> Gold
            else -> Line
        }),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .height(54.dp)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 14.dp)) {
            Text(text, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
    }
}

package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.MiniGameChallenge
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

@Composable
fun ChallengeCard(
    challenge: MiniGameChallenge,
    onAccept: () -> Unit,
    onView: () -> Unit,
    modifier: Modifier = Modifier
) {
    GlassCard(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Game: ${challenge.gameId}",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(8.dp))

            challenge.challenger?.let { challenger ->
                Text(
                    "From: ${challenger.name}",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            }

            challenge.targetUser?.let { target ->
                Text(
                    "To: ${target.name}",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            }

            if (challenge.message.isNotBlank()) {
                Text(
                    "\"${challenge.message}\"",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            }

            Text(
                "Score: ${challenge.score}",
                color = TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )

            if (challenge.expiresAt.isNotBlank()) {
                Text(
                    "Expires: ${challenge.expiresAt.take(10)}",
                    color = Gold,
                    fontSize = 12.sp
                )
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onAccept,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                ) {
                    Text("Accept", fontWeight = FontWeight.SemiBold)
                }
                Button(
                    onClick = onView,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Panel)
                ) {
                    Text("View", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

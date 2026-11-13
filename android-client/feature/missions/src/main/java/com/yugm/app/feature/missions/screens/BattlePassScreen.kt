package com.yugm.app.feature.missions.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.BattlePass
import com.yugm.app.core.model.BattlePassResponse
import com.yugm.app.core.model.Season
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun BattlePassScreen(
    token: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<BattlePassResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            data = YugmApi.battlePass(token)
        } catch (e: Exception) {
            error = e.message
        } finally {
            isLoading = false
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Background).padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("←", color = TextPrimary, fontSize = 24.sp, modifier = Modifier.clickable { onBack() })
            Text("Battle Pass", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.size(24.dp))
        }

        Spacer(Modifier.height(12.dp))

        when {
            isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Gold)
            }
            error != null -> Text(error ?: "Error", color = Color.Red, modifier = Modifier.fillMaxWidth())
            message != null -> Text(message!!, color = Gold, modifier = Modifier.fillMaxWidth())
            data != null -> BattlePassContent(data!!, token, scope, onMessage = { message = it })
        }
    }
}

@Composable
private fun BattlePassContent(
    response: BattlePassResponse,
    token: String,
    scope: kotlinx.coroutines.CoroutineScope,
    onMessage: (String) -> Unit
) {
    val bp = response.battlePass
    val season = response.season

    if (season != null) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(season.name, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("${season.startDate} — ${season.endDate}", color = TextMuted, fontSize = 12.sp)

                Spacer(Modifier.height(16.dp))

                if (bp != null) {
                    val levelProgress = if (season.xpPerLevel > 0) bp.xp.toFloat() / season.xpPerLevel else 0f
                    Text("Level ${bp.level}", color = Gold, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { levelProgress },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = Gold,
                        trackColor = Color(0xFF333333),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text("${bp.xp} / ${season.xpPerLevel} XP", color = TextSecondary, fontSize = 12.sp)
                }

                Spacer(Modifier.height(12.dp))

                if (bp != null && !bp.premium) {
                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    YugmApi.purchaseBattlePass(token)
                                    onMessage("Battle Pass purchased!")
                                } catch (e: Exception) {
                                    onMessage(e.message ?: "Purchase failed")
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Gold)
                    ) {
                        Text("Purchase Premium (${season.premiumPrice})", fontWeight = FontWeight.Bold)
                    }
                } else if (bp != null) {
                    Text("✓ Premium Active", color = Gold, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth())
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        Text("Rewards", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            itemsIndexed(season.rewards) { index, reward ->
                val claimed = bp?.rewards?.find { it.level == reward.level }?.claimed ?: false
                val unlocked = bp != null && reward.level <= bp.level

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (unlocked) Color(0xFF2A2A3E) else Panel
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Level ${reward.level}", color = if (unlocked) Gold else TextMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text(reward.description, color = if (unlocked) TextPrimary else TextMuted, fontSize = 12.sp)
                        }
                        if (claimed) {
                            Text("✓", color = Gold, fontSize = 16.sp)
                        } else if (reward.premium && (bp?.premium != true)) {
                            Text("Premium", color = Saffron, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

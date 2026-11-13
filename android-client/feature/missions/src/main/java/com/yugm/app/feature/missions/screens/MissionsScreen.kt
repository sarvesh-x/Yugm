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
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.Mission
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun MissionsScreen(
    token: String,
    onBack: () -> Unit,
    onBattlePass: () -> Unit
) {
    var missions by remember { mutableStateOf<ActiveMissionsResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            missions = YugmApi.activeMissions(token)
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
            Text("Missions", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.size(24.dp))
        }

        Spacer(Modifier.height(8.dp))

        Button(
            onClick = onBattlePass,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6C3FC5))
        ) {
            Text("★ Battle Pass", color = TextPrimary, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(16.dp))

        when {
            isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Gold)
            }
            error != null -> Text(error ?: "Error", color = Color.Red, modifier = Modifier.fillMaxWidth())
            missions != null -> {
                MissionSection("Daily", missions!!.daily, token)
                Spacer(Modifier.height(12.dp))
                MissionSection("Weekly", missions!!.weekly, token)
                Spacer(Modifier.height(12.dp))
                MissionSection("Monthly", missions!!.monthly, token)
                Spacer(Modifier.height(12.dp))
                MissionSection("Seasonal", missions!!.seasonal, token)
            }
        }
    }
}

@Composable
private fun MissionSection(title: String, list: List<Mission>, token: String) {
    if (list.isEmpty()) return
    Text(title, color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(6.dp))
    list.forEach { mission -> MissionCard(mission, token) }
}

@Composable
private fun MissionCard(mission: Mission, token: String) {
    var claiming by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val progress = if (mission.requirements.target > 0) mission.progress.toFloat() / mission.requirements.target else 0f

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Panel)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(mission.title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    if (mission.description.isNotBlank()) {
                        Text(mission.description, color = TextMuted, fontSize = 12.sp)
                    }
                }
                if (mission.completed && !mission.claimed) {
                    Button(
                        onClick = {
                            claiming = true
                            scope.launch {
                                try {
                                    YugmApi.claimMission(token, mission.id)
                                } catch (_: Exception) { }
                                claiming = false
                            }
                        },
                        enabled = !claiming,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Gold)
                    ) {
                        Text("Claim", fontSize = 12.sp)
                    }
                } else if (mission.claimed) {
                    Text("✓ Claimed", color = TextMuted, fontSize = 12.sp)
                }
            }

            Spacer(Modifier.height(6.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(6.dp),
                color = Gold,
                trackColor = Color(0xFF333333),
            )

            Spacer(Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("${mission.progress}/${mission.requirements.target}", color = TextSecondary, fontSize = 11.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (mission.rewards.xp > 0) Text("+${mission.rewards.xp} XP", color = Saffron, fontSize = 11.sp)
                    if (mission.rewards.coins > 0) Text("+${mission.rewards.coins} coins", color = Gold, fontSize = 11.sp)
                }
            }
        }
    }
}

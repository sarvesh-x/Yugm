package com.example.yugm.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.ui.components.GlassButton
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.PrimaryPink
import com.example.yugm.core.ui.theme.Purple
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

val moodOptions = listOf(
    "Happy" to "\uD83D\uDE04", "Sad" to "\uD83D\uDE22", "Chill" to "\uD83D\uDE0C",
    "Excited" to "\uD83E\uDD29", "Lonely" to "\uD83D\uDE1E", "Romantic" to "\uD83D\uDE0D",
    "Playful" to "\uD83D\uDE1C", "Anxious" to "\uD83D\uDE30", "Grateful" to "\uD83D\uDE4F",
    "Silly" to "\uD83E\uDD23", "Sleepy" to "\uD83D\uDE34", "Energetic" to "\u26A1",
    "Focused" to "\uD83C\uDFAF", "Creative" to "\uD83C\uDFA8", "Confident" to "\uD83D\uDCAA"
)

val activityOptions = listOf(
    "Listening to music", "Gaming", "Working out", "Cooking", "Reading",
    "Watching a movie", "Studying", "Meditating", "Dancing", "Singing",
    "Drawing", "Walking", "Traveling", "Eating", "Shopping"
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MoodActivityScreen(
    token: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var currentMood by remember { mutableStateOf<Pair<String, String>?>(null) }
    var currentActivity by remember { mutableStateOf<String?>(null) }
    var selectedMood by remember { mutableStateOf<Pair<String, String>?>(null) }
    var selectedActivity by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        runCatching {
            val mood = YugmApi.SocialApi.getMood(token)
            if (mood.mood.isNotBlank()) currentMood = mood.mood to mood.emoji
            if (mood.activity.isNotBlank()) currentActivity = mood.activity
        }
        isLoading = false
    }

    YugmAmbientBackground {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Mood & Activity", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Let others know how you're feeling", color = TextMuted, fontSize = 14.sp)

            if (currentMood != null || currentActivity != null) {
                GlassCard {
                    Text("Current status", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    currentMood?.let { (m, e) ->
                        Text("$e  $m", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                    currentActivity?.let {
                        Text(it, color = TextMuted, fontSize = 14.sp)
                    }
                }
            }

            GlassCard {
                Text("Mood", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                Spacer(Modifier.height(12.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    moodOptions.forEach { (mood, emoji) ->
                        val isSelected = selectedMood?.first == mood
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Purple.copy(alpha = 0.3f) else Panel)
                                .clickable { selectedMood = if (isSelected) null else mood to emoji }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text("$emoji  $mood", color = if (isSelected) Gold else TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            }

            GlassCard {
                Text("Activity", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                Spacer(Modifier.height(12.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    activityOptions.forEach { activity ->
                        val isSelected = selectedActivity == activity
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Purple.copy(alpha = 0.3f) else Panel)
                                .clickable { selectedActivity = if (isSelected) null else activity }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(activity, color = if (isSelected) Gold else TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            GlassButton(
                text = "Set Status",
                enabled = selectedMood != null || selectedActivity != null,
                onClick = {
                    val mood = selectedMood
                    val activity = selectedActivity
                    if (mood != null) {
                        runCatching {
                            YugmApi.SocialApi.setMood(token, mood.first, mood.second)
                            currentMood = mood
                        }
                    }
                    if (activity != null) {
                        runCatching {
                            YugmApi.SocialApi.setActivity(token, activity)
                            currentActivity = activity
                        }
                    }
                    android.widget.Toast.makeText(context, "Status updated", android.widget.Toast.LENGTH_SHORT).show()
                }
            )

            GlassButton(
                text = "Clear Status",
                gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(com.example.yugm.core.ui.theme.Danger, PrimaryPink)),
                onClick = {
                    runCatching { YugmApi.SocialApi.clearMood(token) }
                    currentMood = null
                    currentActivity = null
                    selectedMood = null
                    selectedActivity = null
                    android.widget.Toast.makeText(context, "Status cleared", android.widget.Toast.LENGTH_SHORT).show()
                }
            )

            com.example.yugm.core.ui.components.GlassOutlinedButton(
                text = "Back",
                onClick = onBack
            )
        }
    }
}

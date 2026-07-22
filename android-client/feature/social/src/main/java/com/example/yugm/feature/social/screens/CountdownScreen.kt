package com.example.yugm.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.SocialApi
import com.example.yugm.core.model.CountdownEvent
import com.example.yugm.core.ui.components.GlassButton
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.theme.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun CountdownScreen(
    token: String,
    onBack: () -> Unit
) {
    var events by remember { mutableStateOf<List<CountdownEvent>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        try { events = SocialApi.getCountdowns(token) } catch (_: Exception) { }
        isLoading = false
    }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text("Countdowns", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(16.dp))

            if (isLoading) {
                com.example.yugm.core.ui.components.LoadingState("Loading...")
            } else if (events.isEmpty()) {
                GlassCard {
                    Text("No upcoming events", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text("Countdown events will appear here", color = TextMuted, fontSize = 13.sp)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(events, key = { it.id }) { event ->
                        CountdownCard(event)
                    }
                }
            }

            Spacer(Modifier.weight(1f))
            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}

@Composable
private fun CountdownCard(event: CountdownEvent) {
    var remainingMillis by remember { mutableLongStateOf(0L) }

    LaunchedEffect(event.targetDate) {
        while (true) {
            try {
                val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                fmt.timeZone = TimeZone.getTimeZone("UTC")
                val target = fmt.parse(event.targetDate.take(19))?.time ?: 0L
                remainingMillis = target - System.currentTimeMillis()
            } catch (_: Exception) { remainingMillis = 0L }
            delay(1000)
        }
    }

    val eventColor = try {
        Color(android.graphics.Color.parseColor(event.color))
    } catch (_: Exception) { PrimaryPink }

    GlassCard(
        gradient = androidx.compose.ui.graphics.Brush.linearGradient(
            listOf(eventColor.copy(alpha = 0.15f), SurfaceElevated.copy(alpha = 0.88f))
        ),
        borderGradient = androidx.compose.ui.graphics.Brush.horizontalGradient(
            listOf(eventColor.copy(alpha = 0.4f), Color.Transparent)
        )
    ) {
        Text(event.title, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
        if (event.description.isNotBlank()) {
            Text(event.description, color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Spacer(Modifier.height(12.dp))

        if (remainingMillis > 0) {
            val totalSecs = remainingMillis / 1000
            val days = totalSecs / 86400
            val hours = (totalSecs % 86400) / 3600
            val mins = (totalSecs % 3600) / 60
            val secs = totalSecs % 60

            Row(
                horizontalArrangement = Arrangement.SpaceEvenly,
                modifier = Modifier.fillMaxWidth()
            ) {
                TimeBlock("Days", days.toInt())
                TimeBlock("Hours", hours.toInt())
                TimeBlock("Mins", mins.toInt())
                TimeBlock("Secs", secs.toInt())
            }
        } else {
            Text("Event has passed", color = Danger, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun TimeBlock(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value.toString().padStart(2, '0'),
            color = TextPrimary,
            fontWeight = FontWeight.Black,
            fontSize = 28.sp
        )
        Text(label, color = TextMuted, fontSize = 11.sp)
    }
}

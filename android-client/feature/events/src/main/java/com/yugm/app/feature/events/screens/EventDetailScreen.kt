package com.yugm.app.feature.events.screens

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.YugmEvent
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Line
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.Success
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    event: YugmEvent,
    token: String,
    currentUserId: String,
    onBack: () -> Unit,
    onJoin: () -> Unit,
    onLeave: () -> Unit,
    onCancel: () -> Unit
) {
    val isHost = currentUserId.isNotBlank() && event.hostId == currentUserId
    val hasJoined = event.participantIds.contains(currentUserId)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(event.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(initial = event.hostName.firstOrNull()?.toString() ?: "?", size = 48, imageUrl = event.hostAvatar)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(event.hostName, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    Text("Host", color = TextMuted, fontSize = 12.sp)
                }
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (event.featured) {
                        FeaturedBadge()
                    }
                    if (event.festival != "none") {
                        FestivalBadge(event.festival)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            if (event.status == "UPCOMING") {
                CountdownCard(event.eventDate)
                Spacer(Modifier.height(12.dp))
            }

            val description = event.description
            if (description != null) {
                Text(description, color = TextPrimary, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
            }

            Text("Category: ${event.category}", color = TextMuted, fontSize = 14.sp)
            Text("Type: ${event.type}", color = TextMuted, fontSize = 14.sp)
            Text("Date: ${formatFullDate(event.eventDate)}", color = TextMuted, fontSize = 14.sp)

            if (event.maxParticipants != null) {
                Text("Max Participants: ${event.maxParticipants}", color = TextMuted, fontSize = 14.sp)
            }

            Text("Participants: ${event.participantIds.size}", color = TextMuted, fontSize = 14.sp)

            Spacer(Modifier.height(8.dp))

            Text(
                "Status: ${event.status}",
                color = when (event.status) {
                    "UPCOMING" -> Gold
                    "LIVE" -> Success
                    "ONGOING" -> Success
                    "CANCELLED" -> Danger
                    "COMPLETED" -> TextMuted
                    else -> TextMuted
                },
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )

            if (event.tags.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text(event.tags.joinToString(", ") { "#$it" }, color = PrimaryPurple, fontSize = 13.sp)
            }

            Spacer(Modifier.height(24.dp))

            when (event.status) {
                "UPCOMING" -> {
                    if (isHost) {
                        OutlinedButton(
                            onClick = onCancel,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, Danger),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Danger)
                        ) {
                            Text("Cancel Event", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    } else if (hasJoined) {
                        OutlinedButton(
                            onClick = onLeave,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, TextMuted),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextMuted)
                        ) {
                            Text("Leave Event", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = onJoin,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                        ) {
                            Text("Join Event", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                "LIVE" -> {
                    Button(
                        onClick = onJoin,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Success)
                    ) {
                        Text("Join Live Room", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
                "CANCELLED" -> {
                    Text(
                        "This event has been cancelled",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                }
                "COMPLETED" -> {
                    Text(
                        "This event has ended",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun CountdownCard(isoDate: String) {
    var remainingMillis by remember(isoDate) { mutableLongStateOf(parseMillis(isoDate) - System.currentTimeMillis()) }

    LaunchedEffect(isoDate) {
        while (remainingMillis > 0) {
            delay(1000)
            remainingMillis = parseMillis(isoDate) - System.currentTimeMillis()
        }
    }

    val positive = remainingMillis.coerceAtLeast(0)
    val days = positive / 86_400_000
    val hours = (positive % 86_400_000) / 3_600_000
    val minutes = (positive % 3_600_000) / 60_000
    val seconds = (positive % 60_000) / 1000

    Surface(
        color = Gold.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, Gold.copy(alpha = 0.4f)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Starts in", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CountdownUnit(if (days > 0) days.toString() else "00", "days")
                CountdownSeparator()
                CountdownUnit(hours.toString().padStart(2, '0'), "hrs")
                CountdownSeparator()
                CountdownUnit(minutes.toString().padStart(2, '0'), "min")
                CountdownSeparator()
                CountdownUnit(seconds.toString().padStart(2, '0'), "sec")
            }
        }
    }
}

@Composable
private fun CountdownUnit(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(52.dp)) {
        Text(value, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 24.sp)
        Text(label, color = Gold, fontSize = 10.sp)
    }
}

@Composable
private fun CountdownSeparator() {
    Text(":", color = Gold, fontWeight = FontWeight.Black, fontSize = 20.sp)
}

@Composable
private fun FeaturedBadge() {
    Surface(
        color = Gold.copy(alpha = 0.2f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            "★ Featured",
            color = Gold,
            fontWeight = FontWeight.Black,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun FestivalBadge(festival: String) {
    val accent = Color(festivalAccent(festival))
    Surface(
        color = accent.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            "${festivalEmoji(festival)} ${festivalLabel(festival)}",
            color = accent,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

private fun parseMillis(isoDate: String): Long {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        inputFormat.parse(isoDate)?.time ?: 0L
    } catch (_: Exception) {
        try {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(isoDate)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }
}

private fun formatFullDate(isoDate: String): String {
    if (isoDate.isBlank()) return ""
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(isoDate)
        val outputFormat = SimpleDateFormat("EEE, MMM dd yyyy · hh:mm a", Locale.US)
        outputFormat.format(date!!)
    } catch (_: Exception) {
        isoDate.take(10)
    }
}

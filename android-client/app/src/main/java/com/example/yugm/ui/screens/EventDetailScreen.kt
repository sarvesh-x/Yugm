package com.example.yugm.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.YugmEvent
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.theme.Background
import androidx.compose.material3.ExperimentalMaterial3Api
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.Success
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    event: YugmEvent,
    token: String,
    onBack: () -> Unit,
    onJoin: () -> Unit,
    onCancel: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(event.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    androidx.compose.material3.TextButton(onClick = onBack) {
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
            }

            Spacer(Modifier.height(16.dp))

            if (event.description != null) {
                Text(event.description, color = TextPrimary, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
            }

            Text("Category: ${event.category}", color = TextMuted, fontSize = 14.sp)
            Text("Type: ${event.type}", color = TextMuted, fontSize = 14.sp)
            Text("Date: ${event.eventDate}", color = TextMuted, fontSize = 14.sp)

            if (event.maxParticipants != null) {
                Text("Max Participants: ${event.maxParticipants}", color = TextMuted, fontSize = 14.sp)
            }

            Text("Participants: ${event.participantIds.size}", color = TextMuted, fontSize = 14.sp)

            Spacer(Modifier.height(8.dp))

            Text(
                "Status: ${event.status}",
                color = when (event.status) {
                    "UPCOMING" -> Gold
                    "ACTIVE" -> Success
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
                    Button(
                        onClick = onJoin,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                    ) {
                        Text("Join Event", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
                "ACTIVE" -> {
                    Button(
                        onClick = onCancel,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Danger)
                    ) {
                        Text("Cancel Event", fontSize = 16.sp, fontWeight = FontWeight.Bold)
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

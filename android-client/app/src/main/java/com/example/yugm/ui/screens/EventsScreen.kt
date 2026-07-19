package com.example.yugm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.EventPagination
import com.example.yugm.model.MyEvents
import com.example.yugm.model.YugmEvent
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.SegmentedTabs
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.Panel
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.Success
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    token: String,
    onBack: () -> Unit,
    onCreateEvent: () -> Unit,
    onEventDetail: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableStateOf(0) }
    var upcomingEvents by remember { mutableStateOf<List<YugmEvent>>(emptyList()) }
    var myEventsData by remember { mutableStateOf<MyEvents?>(null) }
    var loading by remember { mutableStateOf(true) }

    fun loadUpcoming() {
        scope.launch {
            loading = true
            runCatching {
                val (events, _) = YugmApi.listEvents(token, limit = 20, upcoming = true)
                upcomingEvents = events
            }.onFailure {
                Toast.makeText(context, it.message ?: "Failed to load events", Toast.LENGTH_SHORT).show()
            }
            loading = false
        }
    }

    fun loadMyEvents() {
        scope.launch {
            loading = true
            runCatching {
                myEventsData = YugmApi.myEvents(token)
            }.onFailure {
                Toast.makeText(context, it.message ?: "Failed to load my events", Toast.LENGTH_SHORT).show()
            }
            loading = false
        }
    }

    LaunchedEffect(selectedTab) {
        when (selectedTab) {
            0 -> loadUpcoming()
            1 -> loadMyEvents()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Events", color = TextPrimary, fontWeight = FontWeight.Black) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            SegmentedTabs(
                items = listOf("" to "Upcoming", "" to "My Events"),
                selectedIndex = selectedTab,
                onSelected = { selectedTab = it },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
            )

            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading events...")
                }
            } else {
                when (selectedTab) {
                    0 -> UpcomingTab(
                        events = upcomingEvents,
                        onEventDetail = onEventDetail,
                        onCreateEvent = onCreateEvent
                    )
                    1 -> MyEventsTab(
                        myEvents = myEventsData,
                        onEventDetail = onEventDetail,
                        onCreateEvent = onCreateEvent
                    )
                }
            }
        }
    }
}

@Composable
private fun UpcomingTab(
    events: List<YugmEvent>,
    onEventDetail: (String) -> Unit,
    onCreateEvent: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (events.isEmpty()) {
            item {
                GlassCard {
                    Text("No upcoming events.", color = TextMuted)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onCreateEvent,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Create Event", color = Color.White, fontWeight = FontWeight.Black)
                    }
                }
            }
        } else {
            items(events, key = { it.id }) { event ->
                EventCard(event = event, onClick = { onEventDetail(event.id) })
            }
            item {
                Button(
                    onClick = onCreateEvent,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Create Event", color = Color.White, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun MyEventsTab(
    myEvents: MyEvents?,
    onEventDetail: (String) -> Unit,
    onCreateEvent: () -> Unit
) {
    val hosting = myEvents?.hosting ?: emptyList()
    val joined = myEvents?.joined ?: emptyList()

    if (hosting.isEmpty() && joined.isEmpty()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                GlassCard {
                    Text("No events yet. Create or join one!", color = TextMuted)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onCreateEvent,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Create Event", color = Color.White, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (hosting.isNotEmpty()) {
                item {
                    Text("Hosting", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(hosting, key = { it.id }) { event ->
                    EventCard(event = event, onClick = { onEventDetail(event.id) })
                }
            }
            if (joined.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text("Joined", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(joined, key = { it.id }) { event ->
                    EventCard(event = event, onClick = { onEventDetail(event.id) })
                }
            }
            item {
                Button(
                    onClick = onCreateEvent,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Create Event", color = Color.White, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun EventCard(event: YugmEvent, onClick: () -> Unit) {
    Surface(
        color = Panel,
        border = BorderStroke(1.dp, Line),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    event.title,
                    color = TextPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(8.dp))
                CategoryBadge(event.category)
            }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Avatar(
                    initial = event.hostName.firstOrNull()?.toString() ?: "?",
                    size = 32,
                    imageUrl = event.hostAvatar
                )
                Text(event.hostName, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(formatDate(event.eventDate), color = TextMuted, fontSize = 12.sp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${event.participantIds.size}", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Text("participants", color = TextMuted, fontSize = 12.sp)
                }
            }
            if (event.status.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                StatusBadge(event.status)
            }
        }
    }
}

@Composable
private fun CategoryBadge(category: String) {
    Surface(
        color = PrimaryPurple.copy(alpha = 0.2f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            category.ifBlank { "General" },
            color = PrimaryPurple,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val color = when (status.uppercase()) {
        "UPCOMING" -> Gold
        "ONGOING" -> Success
        "COMPLETED" -> TextMuted
        "CANCELLED" -> com.example.yugm.ui.theme.Danger
        else -> TextMuted
    }
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            status,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

private fun formatDate(isoDate: String): String {
    if (isoDate.isBlank()) return ""
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(isoDate)
        val outputFormat = SimpleDateFormat("MMM dd, yyyy", Locale.US)
        outputFormat.format(date!!)
    } catch (_: Exception) {
        try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val date = inputFormat.parse(isoDate)
            val outputFormat = SimpleDateFormat("MMM dd, yyyy", Locale.US)
            outputFormat.format(date!!)
        } catch (_: Exception) {
            isoDate.take(10)
        }
    }
}

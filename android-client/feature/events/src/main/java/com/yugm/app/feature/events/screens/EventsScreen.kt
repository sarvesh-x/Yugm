package com.yugm.app.feature.events.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.MyEvents
import com.yugm.app.core.model.YugmEvent
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.feature.events.viewmodel.EventViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    token: String,
    currentUserId: String,
    onBack: () -> Unit,
    onCreateEvent: () -> Unit,
    onEventDetail: (String) -> Unit
) {
    val viewModel: EventViewModel = hiltViewModel()
    val colors = LocalYugmColors.current
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(selectedTab) {
        when (selectedTab) {
            0 -> viewModel.loadEvents(token)
            1 -> viewModel.loadMyEvents(token)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Events", color = colors.textPrimary, fontWeight = FontWeight.Black) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = colors.primary, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        },
        containerColor = colors.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            FestivalFilterRow(
                selected = viewModel.selectedFestival,
                onSelected = { festival ->
                    viewModel.selectFestival(festival)
                    viewModel.loadEvents(token)
                },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            PrimaryTabRow(
                selectedTabIndex = selectedTab,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                containerColor = colors.background,
                contentColor = colors.textPrimary
            ) {
                listOf("Upcoming", "My Events").forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        selectedContentColor = colors.primary,
                        unselectedContentColor = colors.textSecondary,
                        text = { Text(title, fontWeight = FontWeight.SemiBold) }
                    )
                }
            }

            if (viewModel.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading events...")
                }
            } else if (viewModel.error != null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(viewModel.error!!, color = colors.danger, modifier = Modifier.padding(24.dp))
                }
            } else {
                when (selectedTab) {
                    0 -> UpcomingTab(
                        events = viewModel.events,
                        onEventDetail = onEventDetail,
                        onCreateEvent = onCreateEvent
                    )
                    1 -> MyEventsTab(
                        myEvents = viewModel.myEvents,
                        currentUserId = currentUserId,
                        onEventDetail = onEventDetail,
                        onCreateEvent = onCreateEvent
                    )
                }
            }
        }
    }
}

@Composable
private fun FestivalFilterRow(
    selected: String?,
    onSelected: (String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalYugmColors.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ALL_FESTIVALS.forEach { festival ->
            val isSelected = selected == festival.key.ifBlank { null }
            Surface(
                color = if (isSelected) Color(festival.accent).copy(alpha = 0.16f) else colors.surface,
                border = if (isSelected) BorderStroke(1.dp, Color(festival.accent)) else BorderStroke(1.dp, colors.border),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.clickable { onSelected(festival.key.ifBlank { null }) }
            ) {
                Text(
                    "${festival.emoji} ${festival.label}",
                    color = if (isSelected) Color(festival.accent) else colors.textSecondary,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
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
    val colors = LocalYugmColors.current
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (events.isEmpty()) {
            item {
                GlassCard {
                    Text("No upcoming events.", color = colors.textSecondary)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onCreateEvent,
                        colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
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
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
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
    currentUserId: String,
    onEventDetail: (String) -> Unit,
    onCreateEvent: () -> Unit
) {
    val colors = LocalYugmColors.current
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
                    Text("No events yet. Create or join one!", color = colors.textSecondary)
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onCreateEvent,
                        colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
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
                    Text("Hosting", color = colors.textPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(hosting, key = { it.id }) { event ->
                    EventCard(event = event, onClick = { onEventDetail(event.id) })
                }
            }
            if (joined.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text("Joined", color = colors.textPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(joined, key = { it.id }) { event ->
                    EventCard(event = event, currentUserId = currentUserId, onClick = { onEventDetail(event.id) })
                }
            }
            item {
                Button(
                    onClick = onCreateEvent,
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
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
private fun EventCard(
    event: YugmEvent,
    onClick: () -> Unit,
    currentUserId: String = ""
) {
    val colors = LocalYugmColors.current
    Surface(
        color = colors.surface,
        border = BorderStroke(1.dp, colors.border),
        shape = RoundedCornerShape(18.dp),
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
                    color = colors.textPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (event.featured) {
                        FeaturedBadge()
                    }
                    CategoryBadge(event.category)
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Avatar(
                    initial = event.hostName.firstOrNull()?.toString() ?: "?",
                    size = 32,
                    imageUrl = event.hostAvatar
                )
                Text(event.hostName, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (event.festival != "none") {
                    FestivalBadge(event.festival)
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(formatDate(event.eventDate), color = colors.textSecondary, fontSize = 12.sp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${event.participantIds.size}", color = colors.accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Text("participants", color = colors.textSecondary, fontSize = 12.sp)
                }
            }
            if (event.status.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusBadge(event.status)
                    if (currentUserId.isNotBlank() && event.participantIds.contains(currentUserId)) {
                        Surface(
                            color = colors.success.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                "Joined",
                                color = colors.success,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FeaturedBadge() {
    val colors = LocalYugmColors.current
    Surface(
        color = colors.accent.copy(alpha = 0.18f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            "★ Featured",
            color = colors.accent,
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

@Composable
private fun CategoryBadge(category: String) {
    val colors = LocalYugmColors.current
    Surface(
        color = colors.primary.copy(alpha = 0.14f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            category.ifBlank { "General" },
            color = colors.primary,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val colors = LocalYugmColors.current
    val color = when (status.uppercase()) {
        "UPCOMING" -> colors.accent
        "LIVE" -> colors.success
        "ONGOING" -> colors.success
        "COMPLETED" -> colors.textSecondary
        "CANCELLED" -> colors.danger
        else -> colors.textSecondary
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
        val outputFormat = SimpleDateFormat("MMM dd, yyyy · hh:mm a", Locale.US)
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

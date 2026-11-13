package com.yugm.app.feature.settings.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.SupportTicket
import com.yugm.app.core.model.TicketMessage
import com.yugm.app.core.ui.theme.*
import com.yugm.app.feature.settings.viewmodel.SupportViewModel
import com.yugm.app.core.util.UiState
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketDetailScreen(
    token: String,
    ticketId: String,
    onBack: () -> Unit,
    viewModel: SupportViewModel = hiltViewModel()
) {
    var ticket by remember { mutableStateOf<SupportTicket?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var replyText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadTicket() {
        scope.launch {
            isLoading = true
            viewModel.getTicket(token, ticketId)
            ticket = (viewModel.currentTicketState as? UiState.Success)?.data
            if (ticket == null) errorMessage = "Failed to load ticket"
            isLoading = false
        }
    }

    LaunchedEffect(ticketId) { loadTicket() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ticket", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                actions = {
                    ticket?.let { t ->
                        if (t.status != "CLOSED") {
                            TextButton(onClick = {
                                viewModel.closeTicket(token, ticketId)
                                loadTicket()
                            }) {
                                Text("Close", color = Color(0xFFFF4444), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        when {
            isLoading -> Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = PrimaryPink)
            }
            ticket == null -> Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text(errorMessage ?: "Ticket not found", color = Color(0xFFFF4444))
            }
            else -> {
                val t = ticket!!
                val statusColor = when (t.status) {
                    "OPEN" -> Color(0xFF4CAF50)
                    "IN_PROGRESS" -> Color(0xFFFFC107)
                    "RESOLVED" -> Color(0xFF2196F3)
                    "CLOSED" -> Color(0xFF9E9E9E)
                    else -> TextMuted
                }

                Column(Modifier.fillMaxSize().padding(innerPadding)) {
                    // Header
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(t.subject, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                            Surface(color = statusColor.copy(alpha = 0.2f), shape = RoundedCornerShape(6.dp)) {
                                Text(t.status, color = statusColor, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(t.category, color = TextMuted.copy(alpha = 0.6f), fontSize = 12.sp)
                            Text("Priority: ${t.priority}", color = TextMuted.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                    }

                    HorizontalDivider(color = BorderColor)

                    // Messages
                    LazyColumn(
                        modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        item {
                            // Initial message
                            MessageBubble(message = t.message, isAdmin = false, createdAt = t.createdAt)
                        }

                        items(t.messages) { msg ->
                            MessageBubble(message = msg.message, isAdmin = msg.senderRole == "ADMIN", createdAt = msg.createdAt)
                        }
                    }

                    // Reply box
                    if (t.status != "CLOSED") {
                        HorizontalDivider(color = BorderColor)
                        Row(
                            modifier = Modifier.padding(12.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = replyText,
                                onValueChange = { replyText = it.take(2000) },
                                placeholder = { Text("Type your reply...", color = TextMuted.copy(alpha = 0.5f)) },
                                modifier = Modifier.weight(1f),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = PrimaryPink, unfocusedBorderColor = BorderColor,
                                    focusedTextColor = Color.White, unfocusedTextColor = Color.White, cursorColor = PrimaryPink
                                ),
                                shape = RoundedCornerShape(12.dp),
                                minLines = 1, maxLines = 3
                            )
                            Button(
                                onClick = {
                                    if (replyText.isBlank()) return@Button
                                    isSending = true
                                    scope.launch {
                                        runCatching { viewModel.addMessage(token, ticketId, replyText) }
                                            .onSuccess { replyText = ""; loadTicket() }
                                            .onFailure { errorMessage = it.message }
                                        isSending = false
                                    }
                                },
                                enabled = !isSending && replyText.isNotBlank(),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                            ) {
                                if (isSending) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                } else {
                                    Text("Send", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: String, isAdmin: Boolean, createdAt: String) {
    val bgColor = if (isAdmin) PrimaryPink.copy(alpha = 0.15f) else SurfaceColor
    val align = if (isAdmin) Alignment.End else Alignment.Start
    val shape = RoundedCornerShape(
        topStart = 12.dp, topEnd = 12.dp,
        bottomStart = if (isAdmin) 12.dp else 4.dp,
        bottomEnd = if (isAdmin) 4.dp else 12.dp
    )

    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalAlignment = if (isAdmin) Alignment.End else Alignment.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(shape)
                .background(bgColor)
                .padding(12.dp)
        ) {
            Column {
                if (isAdmin) {
                    Text("Support Agent", color = PrimaryPink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(2.dp))
                }
                Text(message, color = Color.White, fontSize = 14.sp)
            }
        }
        Text(
            text = createdAt.take(16).replace("T", " "),
            color = TextMuted.copy(alpha = 0.5f),
            fontSize = 10.sp,
            modifier = Modifier.padding(top = 2.dp, start = if (isAdmin) 0.dp else 8.dp, end = if (isAdmin) 8.dp else 0.dp)
        )
    }
}

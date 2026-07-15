package com.example.yugm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.SupportTicket
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

private val statusColors = mapOf(
    "OPEN" to Color(0xFF4CAF50),
    "IN_PROGRESS" to Color(0xFFFFC107),
    "RESOLVED" to Color(0xFF2196F3),
    "CLOSED" to Color(0xFF9E9E9E)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(
    token: String,
    onBack: () -> Unit,
    onTicketClick: (String) -> Unit = {}
) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Support", color = Color.White, fontWeight = FontWeight.Bold) },
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
        Column(Modifier.fillMaxSize().padding(innerPadding)) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Background,
                contentColor = PrimaryPink
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Submit", color = if (selectedTab == 0) PrimaryPink else TextMuted, fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("My Tickets", color = if (selectedTab == 1) PrimaryPink else TextMuted, fontWeight = FontWeight.Bold) }
                )
            }

            when (selectedTab) {
                0 -> SubmitTicketTab(token = token)
                1 -> MyTicketsTab(token = token, onTicketClick = onTicketClick)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubmitTicketTab(token: String) {
    val categories = listOf(
        "General" to "General",
        "Account" to "Account Issues",
        "Payment" to "Payments",
        "Technical" to "Technical Issue",
        "Report" to "Report a User",
        "Content" to "Content",
        "Other" to "Other"
    )

    var category by remember { mutableStateOf("General") }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    if (submitted) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                Text("✓", color = Success, fontSize = 48.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(16.dp))
                Text("Ticket Submitted", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(8.dp))
                Text("Our team will get back to you soon.", color = TextMuted, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 20.dp))
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = { submitted = false; subject = ""; message = "" },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Submit Another", color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }
    } else {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("How can we help you?", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("We typically respond within 24 hours.", color = TextMuted, fontSize = 13.sp)

            Text("Category", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            var expanded by remember { mutableStateOf(false) }
            val selectedLabel = categories.find { it.first == category }?.second ?: "Select category"
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(
                    value = selectedLabel,
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink, unfocusedBorderColor = BorderColor,
                        focusedTextColor = Color.White, unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    categories.forEach { (key, label) ->
                        DropdownMenuItem(text = { Text(label) }, onClick = { category = key; expanded = false })
                    }
                }
            }

            OutlinedTextField(
                value = subject,
                onValueChange = { subject = it.take(120) },
                label = { Text("Subject", color = TextMuted) },
                placeholder = { Text("Brief summary of your issue", color = TextMuted.copy(alpha = 0.5f)) },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryPink, unfocusedBorderColor = BorderColor,
                    focusedTextColor = Color.White, unfocusedTextColor = Color.White, cursorColor = PrimaryPink
                ),
                shape = RoundedCornerShape(12.dp), singleLine = true
            )

            OutlinedTextField(
                value = message,
                onValueChange = { message = it.take(1200) },
                label = { Text("Description", color = TextMuted) },
                placeholder = { Text("Describe your issue in detail", color = TextMuted.copy(alpha = 0.5f)) },
                modifier = Modifier.fillMaxWidth().height(180.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryPink, unfocusedBorderColor = BorderColor,
                    focusedTextColor = Color.White, unfocusedTextColor = Color.White, cursorColor = PrimaryPink
                ),
                shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )

            if (errorMessage != null) {
                Text(errorMessage!!, color = Color(0xFFFF4444), fontSize = 13.sp)
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    if (subject.isBlank() || message.isBlank()) {
                        errorMessage = "Subject and description are required"
                        return@Button
                    }
                    isSubmitting = true
                    errorMessage = null
                    scope.launch {
                        runCatching {
                            YugmApi.createSupportTicket(token, subject, message, category)
                        }.onSuccess {
                            submitted = true
                        }.onFailure {
                            errorMessage = it.message ?: "Failed to submit. Try again."
                        }
                        isSubmitting = false
                    }
                },
                enabled = !isSubmitting && subject.isNotBlank() && message.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("Submit Ticket", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun MyTicketsTab(token: String, onTicketClick: (String) -> Unit) {
    var tickets by remember { mutableStateOf<List<SupportTicket>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadTickets() {
        scope.launch {
            isLoading = true
            errorMessage = null
            runCatching {
                YugmApi.listSupportTickets(token)
            }.onSuccess { (list, _, _) ->
                tickets = list
            }.onFailure {
                errorMessage = it.message ?: "Failed to load tickets"
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { loadTickets() }

    when {
        isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = PrimaryPink)
        }
        errorMessage != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                Text(errorMessage!!, color = Color(0xFFFF4444), fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                Button(onClick = { loadTickets() }, colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink)) {
                    Text("Retry")
                }
            }
        }
        tickets.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                Text("No tickets yet", color = TextMuted, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("Submit your first ticket above", color = TextMuted.copy(alpha = 0.7f), fontSize = 14.sp)
            }
        }
        else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(tickets) { ticket ->
                val statusColor = statusColors[ticket.status] ?: TextMuted
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { onTicketClick(ticket._id) },
                    colors = CardDefaults.cardColors(containerColor = SurfaceColor),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(ticket.subject, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                            Surface(color = statusColor.copy(alpha = 0.2f), shape = RoundedCornerShape(6.dp)) {
                                Text(ticket.status, color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(ticket.message.take(100) + if (ticket.message.length > 100) "..." else "", color = TextMuted, fontSize = 13.sp, maxLines = 2)
                        Spacer(Modifier.height(6.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(ticket.category, color = TextMuted.copy(alpha = 0.6f), fontSize = 11.sp)
                            Text(ticket.createdAt.take(10), color = TextMuted.copy(alpha = 0.6f), fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

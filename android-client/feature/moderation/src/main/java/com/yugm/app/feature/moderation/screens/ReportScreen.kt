package com.yugm.app.feature.moderation.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.feature.moderation.viewmodel.ModerationAction
import com.yugm.app.feature.moderation.viewmodel.ModerationViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: ModerationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    viewModel.setToken(token)

    var targetUserId by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("harassment") }
    var description by remember { mutableStateOf("") }

    val categories = listOf(
        "harassment" to "Harassment",
        "spam" to "Spam",
        "nudity" to "Nudity / NSFW",
        "hate_speech" to "Hate Speech",
        "violence" to "Violence",
        "scam" to "Scam / Fraud",
        "impersonation" to "Impersonation",
        "other" to "Other",
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Report", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back", color = MaterialTheme.colorScheme.primary) }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Submit a report to our moderation team", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)

            OutlinedTextField(
                value = targetUserId,
                onValueChange = { targetUserId = it },
                label = { Text("Target User ID (optional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Paste user ID to report a specific user") },
            )

            Text("Category", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
            categories.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (key, label) ->
                        FilterChip(
                            selected = category == key,
                            onClick = { category = key },
                            label = { Text(label, fontSize = 12.sp) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                minLines = 4,
                maxLines = 8,
                placeholder = { Text("Provide details about the incident...") },
            )

            Button(
                onClick = {
                    viewModel.onAction(ModerationAction.SubmitReport(
                        targetUserId = targetUserId.ifBlank { null },
                        roomId = null,
                        messageId = null,
                        category = category,
                        description = description.ifBlank { null },
                    ))
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.isLoading && (targetUserId.isNotBlank() || category.isNotBlank()),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFCC3333)),
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Text("Submit Report")
                }
            }

            state.error?.let { error ->
                Text(error, color = Color(0xFFFF6666), fontSize = 13.sp)
            }

            state.reportResult?.let { result ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF003311)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Report Submitted", color = Color(0xFF66FF99), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("Report ID: ${result.reportId}", color = Color(0xFFAAFFCC), fontSize = 12.sp)
                        Text("Status: ${result.status}", color = Color(0xFFAAFFCC), fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("Our moderation team will review your report.", color = Color(0xFF88FFAA), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

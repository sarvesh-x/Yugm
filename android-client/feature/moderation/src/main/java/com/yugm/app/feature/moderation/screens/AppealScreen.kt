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
fun AppealScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: ModerationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    viewModel.setToken(token)

    var actionId by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Appeal", fontWeight = FontWeight.Bold) },
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
            Text(
                "If you believe a moderation action was taken in error, submit an appeal for review.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 14.sp,
            )

            OutlinedTextField(
                value = actionId,
                onValueChange = { actionId = it },
                label = { Text("Action ID") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Paste the action ID from your moderation status") },
            )

            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                label = { Text("Appeal Reason") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp),
                minLines = 5,
                maxLines = 10,
                placeholder = { Text("Explain why this action should be reconsidered...") },
            )

            Text(
                "${reason.length}/2000 characters",
                color = if (reason.length > 2000) Color(0xFFFF6666) else MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
                modifier = Modifier.align(Alignment.End),
            )

            Button(
                onClick = {
                    viewModel.onAction(ModerationAction.SubmitAppeal(
                        actionId = actionId,
                        reason = reason,
                    ))
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.isLoading && actionId.isNotBlank() && reason.length >= 10 && reason.length <= 2000,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFCC8800)),
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Text("Submit Appeal")
                }
            }

            state.error?.let { error ->
                Text(error, color = Color(0xFFFF6666), fontSize = 13.sp)
            }

            state.appealResult?.let { result ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF223300)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Appeal Submitted", color = Color(0xFF99FF66), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("Appeal ID: ${result.appealId}", color = Color(0xFFCCFFAA), fontSize = 12.sp)
                        Text("Status: ${result.status}", color = Color(0xFFCCFFAA), fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("Your appeal has been queued for review.", color = Color(0xFFAAFF88), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

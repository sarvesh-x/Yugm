package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(
    token: String,
    onBack: () -> Unit
) {
    var category by remember { mutableStateOf("OTHER") }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val categories = listOf(
        "LOGIN" to "Login Issues",
        "PAYMENT" to "Payments",
        "ROOM" to "Rooms",
        "CHAT" to "Chat",
        "MATCHING" to "Matching",
        "SAFETY" to "Safety",
        "REPORT" to "Reports",
        "BUG" to "Bug Report",
        "OTHER" to "Other"
    )

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
        if (submitted) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                    Text("✓", color = Success, fontSize = 48.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(16.dp))
                    Text("Ticket Submitted", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(8.dp))
                    Text("Our team will review your request and get back to you.", color = TextMuted, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 20.dp))
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("Done", color = Color.White, fontWeight = FontWeight.Bold) }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
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
                            focusedBorderColor = PrimaryPink,
                            unfocusedBorderColor = BorderColor,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        categories.forEach { (key, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { category = key; expanded = false }
                            )
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
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = PrimaryPink
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it.take(1200) },
                    label = { Text("Description", color = TextMuted) },
                    placeholder = { Text("Describe your issue in detail", color = TextMuted.copy(alpha = 0.5f)) },
                    modifier = Modifier.fillMaxWidth().height(180.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = PrimaryPink
                    ),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
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
                        androidx.compose.runtime.rememberCoroutineScope().launch {
                            runCatching {
                                YugmApi.sendFeedback(token, subject, message, category)
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
}

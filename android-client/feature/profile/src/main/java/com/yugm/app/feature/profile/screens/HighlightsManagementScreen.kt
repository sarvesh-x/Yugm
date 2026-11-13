package com.yugm.app.feature.profile.screens

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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.StoryHighlight
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun HighlightsManagementScreen(
    token: String,
    userId: String,
    onBack: () -> Unit
) {
    var showCreateDialog by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var highlights by remember { mutableStateOf<List<StoryHighlight>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadHighlights() {
        if (token.isBlank() || userId.isBlank()) return
        scope.launch {
            isLoading = true
            error = null
            runCatching {
                highlights = withContext(Dispatchers.IO) { YugmApi.userHighlights(token, userId) }
            }.onFailure {
                error = it.message ?: "Failed to load highlights"
            }
            isLoading = false
        }
    }

    LaunchedEffect(token, userId) { loadHighlights() }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Highlights", onBack = onBack)

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading highlights…")
                }
                return@Column
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    GradientAction(
                        label = "Create Highlight",
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        onClick = { showCreateDialog = true }
                    )
                }

                if (highlights.isEmpty()) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text("No highlights yet", color = TextPrimary, fontWeight = FontWeight.Black)
                            Text("Create a highlight to showcase your best stories", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }

                items(highlights, key = { it.id }) { highlight ->
                    HighlightCard(
                        highlight = highlight,
                        onDelete = {
                            scope.launch {
                                runCatching {
                                    withContext(Dispatchers.IO) { YugmApi.deleteHighlight(token, highlight.id) }
                                }
                                loadHighlights()
                            }
                        }
                    )
                }

                item { Spacer(Modifier.height(80.dp)) }
            }
        }

        if (showCreateDialog) {
            CreateHighlightDialog(
                creating = creating,
                onDismiss = { showCreateDialog = false },
                onCreate = { title, storyIds ->
                    creating = true
                    scope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) { YugmApi.createHighlight(token, title, storyIds) }
                        }
                        showCreateDialog = false
                        creating = false
                        loadHighlights()
                    }
                }
            )
        }
    }
}

@Composable
private fun HighlightCard(
    highlight: StoryHighlight,
    onDelete: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.weight(1f)) {
                Text(highlight.title, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
                Text("${highlight.storyIds.size} stories", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                if (highlight.createdAt.isNotBlank()) {
                    Text(highlight.createdAt.take(10), color = TextMuted.copy(alpha = 0.6f), fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                }
            }
            TextButton(onClick = onDelete) {
                Text("Delete", color = Danger, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CreateHighlightDialog(
    creating: Boolean,
    onDismiss: () -> Unit,
    onCreate: (String, List<String>) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var storyIdsText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = { if (!creating) onDismiss() },
        title = { Text("Create Highlight", color = TextPrimary, fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                YugmTextField(value = title, onValueChange = { title = it }, label = "Title")
                YugmTextField(value = storyIdsText, onValueChange = { storyIdsText = it }, label = "Story IDs (comma-separated)")
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val ids = storyIdsText.split(",").map { it.trim() }.filter { it.isNotBlank() }
                    onCreate(title, ids)
                },
                enabled = title.isNotBlank() && !creating
            ) {
                Text("Create", color = Gold, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !creating) {
                Text("Cancel", color = TextMuted, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = androidx.compose.ui.graphics.Color(0xFF11172C),
        shape = RoundedCornerShape(16.dp)
    )
}

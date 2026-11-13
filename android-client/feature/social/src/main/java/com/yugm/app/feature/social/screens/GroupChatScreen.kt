package com.yugm.app.feature.social.screens

import android.widget.Toast
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.GroupChat
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.Surface
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.social.viewmodel.SocialViewModel

@Composable
fun GroupChatScreen(
    token: String,
    onBack: () -> Unit,
    onOpenGroup: (String) -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()
    var showCreateDialog by remember { mutableStateOf(false) }
    var newGroupName by remember { mutableStateOf("") }
    var newGroupParticipants by remember { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(token) { viewModel.loadGroups(token) }

    YugmAmbientBackground {
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                YugmPageHeader("Group Chats", onBack = onBack)
                if (viewModel.isLoading) {
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        LoadingState("Loading groups…")
                    }
                } else if (viewModel.groups.isEmpty()) {
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No groups yet", color = TextMuted, fontSize = 16.sp)
                            Spacer(Modifier.height(12.dp))
                            GradientAction("Create your first group", onClick = { showCreateDialog = true })
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 90.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(viewModel.groups, key = { it.id }) { group ->
                            GroupCard(group = group, onClick = { onOpenGroup(group.id) })
                        }
                    }
                }
            }
            GradientAction(
                label = "＋ New Group",
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(20.dp)
                    .width(160.dp),
                onClick = { showCreateDialog = true }
            )
        }
    }

    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = {
                showCreateDialog = false
                newGroupName = ""
                newGroupParticipants = ""
            },
            title = { Text("New Group Chat", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    OutlinedTextField(
                        value = newGroupName,
                        onValueChange = { newGroupName = it },
                        label = { Text("Group name", color = TextMuted) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Pink,
                            unfocusedBorderColor = BorderColor,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            cursorColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = newGroupParticipants,
                        onValueChange = { newGroupParticipants = it },
                        label = { Text("Participant IDs (comma-separated)", color = TextMuted) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Pink,
                            unfocusedBorderColor = BorderColor,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            cursorColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val ids = newGroupParticipants.split(",").map { it.trim() }.filter { it.isNotBlank() }
                        viewModel.createGroup(token, newGroupName, ids)
                        showCreateDialog = false
                        newGroupName = ""
                        newGroupParticipants = ""
                    },
                    enabled = newGroupName.isNotBlank()
                ) {
                    Text("Create", color = Pink, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showCreateDialog = false
                    newGroupName = ""
                    newGroupParticipants = ""
                }) {
                    Text("Cancel", color = TextMuted, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Surface,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
private fun GroupCard(group: GroupChat, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(initial = group.name.firstOrNull()?.toString() ?: "?", size = 44, imageUrl = null)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(group.name, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${group.createdByName} · ${group.participantCount} members", color = TextMuted, fontSize = 12.sp)
            }
        }
        val lastMessage = group.lastMessage
        val lastMessageAt = group.lastMessageAt
        if (!lastMessage.isNullOrBlank()) {
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(lastMessage, color = TextMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (!lastMessageAt.isNullOrBlank()) {
                    Spacer(Modifier.width(8.dp))
                    Text(formatGroupTime(lastMessageAt), color = TextMuted, fontSize = 10.sp)
                }
            }
        }
    }
}

private fun formatGroupTime(value: String): String = when {
    value.length >= 16 -> value.substring(11, 16)
    value.isNotBlank() -> value
    else -> ""
}

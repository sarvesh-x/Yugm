package com.yugm.app.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.SocialApi
import com.yugm.app.core.model.VoicePoll
import com.yugm.app.core.model.VoicePollListResponse
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GlassTextField
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun VoicePollScreen(
    token: String,
    userId: String = "",
    onBack: () -> Unit,
    onPollDetail: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var polls by remember { mutableStateOf<List<com.yugm.app.core.model.VoicePoll>>(emptyList()) }
    var activeTotal by remember { mutableStateOf(0) }
    var activePage by remember { mutableStateOf(1) }
    var myPolls by remember { mutableStateOf<List<com.yugm.app.core.model.VoicePoll>>(emptyList()) }
    var showMine by remember { mutableStateOf(false) }
    var showCreate by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var isLoadingMore by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    var loadError by remember { mutableStateOf<String?>(null) }

    fun load(refresh: Boolean = true) {
        scope.launch {
            val targetPage = if (!showMine && !refresh) activePage + 1 else 1
            if (refresh) {
                isLoading = true
                loadError = null
            } else {
                isLoadingMore = true
            }
            try {
                if (showMine) {
                    myPolls = SocialApi.getMyVoicePolls(token)
                } else {
                    val resp = SocialApi.getActiveVoicePolls(token, page = targetPage, limit = 20)
                    activeTotal = resp.total
                    activePage = resp.page
                    polls = if (refresh) resp.polls else (polls + resp.polls).distinctBy { it.id }
                }
            } catch (e: Exception) {
                if (refresh) loadError = e.message ?: "Failed to load polls"
            } finally {
                isLoading = false
                isLoadingMore = false
            }
        }
    }

    LaunchedEffect(token, showMine) { load(refresh = true) }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Voice Polls", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    GlassButton(
                        text = if (showMine) "Active" else "Mine",
                        height = 40.dp,
                        gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Panel, Panel)),
                        onClick = { showMine = !showMine; showCreate = false }
                    )
                    GlassButton(
                        text = "Refresh",
                        height = 40.dp,
                        gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Panel, Panel)),
                        onClick = { load(refresh = true) }
                    )
                    GlassButton(
                        text = if (showCreate) "Cancel" else "Create",
                        height = 40.dp,
                        gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)),
                        onClick = { showCreate = !showCreate }
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            if (showCreate) {
                CreatePollSection(token, onCreated = { showCreate = false; showMine = false; load() })
                Spacer(Modifier.height(16.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                when {
                    isLoading -> com.yugm.app.core.ui.components.LoadingState("Loading polls...")
                    loadError != null -> {
                        GlassCard {
                            Text("Couldn't load polls", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                            Text(loadError ?: "Unknown error", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                            Spacer(Modifier.height(12.dp))
                            GlassButton(text = "Retry", onClick = { load(refresh = true) })
                        }
                    }
                    else -> {
                        val displayPolls = if (showMine) myPolls else polls
                        val canLoadMore = !showMine && polls.isNotEmpty() && polls.size < activeTotal
                        if (displayPolls.isEmpty()) {
                            GlassCard {
                                Text(if (showMine) "No polls yet" else "No active polls", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                                Text(
                                    if (showMine) "Polls you create will appear here" else "Create one to start the conversation",
                                    color = TextMuted,
                                    fontSize = 13.sp
                                )
                            }
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(displayPolls, key = { it.id }) { poll ->
                                    val totalVotes = poll.options.sumOf { it.votes }
                                    val expired = runCatching { java.time.Instant.parse(poll.expiresAt).isBefore(java.time.Instant.now()) }.getOrDefault(false)
                                    val selectedIndex = if (userId.isNotBlank()) poll.selectedOptionIndexFor(userId) else null
                                    val hasVoted = selectedIndex != null || (userId.isNotBlank() && poll.voters.contains(userId))
                                    val selectedOptionText = selectedIndex?.let { poll.options.getOrNull(it)?.text }?.takeIf { it.isNotBlank() }
                                    val isOwner = userId.isNotBlank() && poll.userId == userId
                                    val canClose = isOwner && poll.isActive && !expired
                                    val status = when {
                                        !poll.isActive -> "Closed"
                                        expired -> "Expired"
                                        hasVoted -> "Voted"
                                        showMine -> "Active"
                                        else -> null
                                    }
                                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            verticalAlignment = Alignment.Top,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .clickable { onPollDetail(poll.id) }
                                            ) {
                                                Avatar(poll.userName.firstOrNull()?.toString() ?: "?", 36, imageUrl = poll.userAvatar)
                                                Column(Modifier.weight(1f)) {
                                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                                        Text(if (poll.userName.isNotBlank()) poll.userName else "Someone", color = TextMuted, fontSize = 12.sp)
                                                        if (status != null) Text(
                                                            "• $status",
                                                            color = when (status) {
                                                                "Active" -> Cyan
                                                                "Voted" -> Gold
                                                                else -> TextMuted
                                                            },
                                                            fontSize = 12.sp
                                                        )
                                                    }
                                                    Text(poll.question, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 15.sp)
                                                    Text("${poll.options.size} options \u00B7 $totalVotes votes", color = TextMuted, fontSize = 12.sp)
                                                    if (selectedOptionText != null) {
                                                        Text("Your vote: $selectedOptionText", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                                    } else if (hasVoted) {
                                                        Text("You voted", color = Gold.copy(alpha = 0.85f), fontSize = 12.sp)
                                                    }
                                                }
                                            }
                                            if (canClose) {
                                                Text(
                                                    "Close",
                                                    color = Pink,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    modifier = Modifier
                                                        .padding(start = 8.dp, top = 2.dp)
                                                        .clickable {
                                                            scope.launch {
                                                                runCatching { SocialApi.closeVoicePoll(token, poll.id) }
                                                                    .onSuccess { updated ->
                                                                        polls = polls.map { if (it.id == updated.id) updated else it }
                                                                        myPolls = myPolls.map { if (it.id == updated.id) updated else it }
                                                                        Toast.makeText(context, "Poll closed", Toast.LENGTH_SHORT).show()
                                                                    }
                                                                    .onFailure { e ->
                                                                        Toast.makeText(context, e.message ?: "Failed to close poll", Toast.LENGTH_SHORT).show()
                                                                    }
                                                            }
                                                        }
                                                )
                                            }
                                        }
                                    }
                                }
                                if (canLoadMore) {
                                    item("load-more") {
                                        GlassButton(
                                            text = if (isLoadingMore) "Loading..." else "Load more",
                                            enabled = !isLoadingMore,
                                            onClick = { load(refresh = false) }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}

@Composable
private fun CreatePollSection(
    token: String,
    onCreated: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var question by remember { mutableStateOf("") }
    var options by remember { mutableStateOf(listOf("", "")) }
    var expiresInHours by remember { mutableStateOf("24") }
    var isSubmitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val validOptionCount = options.count { it.isNotBlank() }
    val expiryHours = expiresInHours.toIntOrNull()
    val canSubmit = !isSubmitting && question.trim().isNotBlank() && validOptionCount in 2..6 && expiryHours != null && expiryHours in 1..168

    GlassCard {
        Text("New Poll", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(8.dp))
        GlassTextField(value = question, onValueChange = { if (it.length <= 200) question = it }, label = "Your question")
        Spacer(Modifier.height(8.dp))
        options.forEachIndexed { idx, opt ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.weight(1f)) {
                    GlassTextField(
                        value = opt,
                        onValueChange = { v ->
                            if (v.length <= 100) {
                                val copy = options.toMutableList()
                                copy[idx] = v
                                options = copy
                            }
                        },
                        label = "Option ${idx + 1}"
                    )
                }
                if (options.size > 2) {
                    GlassButton(
                        text = "Remove",
                        height = 40.dp,
                        gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Panel, Panel)),
                        onClick = { options = options.toMutableList().also { it.removeAt(idx) } }
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
        }
        if (options.size < 6) {
            GlassButton(
                text = "+ Add Option",
                gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Panel, Panel)),
                height = 42.dp,
                onClick = { options = options + "" }
            )
        }
        Text("Add 2-6 options", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        Spacer(Modifier.height(8.dp))
        GlassTextField(value = expiresInHours, onValueChange = { expiresInHours = it.filter(Char::isDigit).take(3) }, label = "Expires in (hours, 1-168)")
        Spacer(Modifier.height(12.dp))
        GlassButton(
            text = if (isSubmitting) "Creating..." else "Create Poll",
            enabled = canSubmit,
            onClick = {
                scope.launch {
                    val validOptions = options.map { it.trim() }.filter { it.isNotBlank() }.map { it to null as String? }
                    if (question.trim().isBlank()) {
                        Toast.makeText(context, "Question is required", Toast.LENGTH_SHORT).show(); return@launch
                    }
                    if (validOptions.size !in 2..6) {
                        Toast.makeText(context, "Add 2-6 non-empty options", Toast.LENGTH_SHORT).show(); return@launch
                    }
                    val hours = expiresInHours.toIntOrNull()
                    if (hours == null || hours !in 1..168) {
                        Toast.makeText(context, "Expiry must be 1-168 hours", Toast.LENGTH_SHORT).show(); return@launch
                    }
                    isSubmitting = true
                    try {
                        SocialApi.createVoicePoll(token, question.trim(), validOptions, expiresInHours = hours)
                        Toast.makeText(context, "Poll created!", Toast.LENGTH_SHORT).show()
                        question = ""
                        options = listOf("", "")
                        expiresInHours = "24"
                        onCreated()
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message ?: "Failed to create poll", Toast.LENGTH_SHORT).show()
                    } finally {
                        isSubmitting = false
                    }
                }
            }
        )
    }
}

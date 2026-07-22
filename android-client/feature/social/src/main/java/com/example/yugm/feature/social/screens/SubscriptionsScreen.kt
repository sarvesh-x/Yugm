package com.example.yugm.feature.social.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.SubscriberInfo
import com.example.yugm.core.model.Subscription
import com.example.yugm.core.model.SubscribersResponse
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.GradientAction
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.SegmentedTabs
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.core.ui.theme.Background
import com.example.yugm.core.ui.theme.Danger
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Ink2
import com.example.yugm.core.ui.theme.Line
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SubscriptionsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var showSubscribeDialog by remember { mutableStateOf(false) }
    var subscribeCreatorId by remember { mutableStateOf("") }
    var subscribePlan by remember { mutableStateOf("basic") }
    var subscriptions by remember { mutableStateOf<List<Subscription>>(emptyList()) }
    var subscriberList by remember { mutableStateOf<List<SubscriberInfo>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun loadSubscriptions() {
        scope.launch {
            isLoading = true
            runCatching {
                val subs = withContext(Dispatchers.IO) { YugmApi.mySubscriptions(token) }
                val subsResp = withContext(Dispatchers.IO) { YugmApi.mySubscribers(token) }
                Pair(subs, subsResp)
            }.onSuccess { (subs, subsResp) ->
                subscriptions = subs
                subscriberList = subsResp.subscribers
            }
            isLoading = false
        }
    }

    LaunchedEffect(token, selectedTab) { loadSubscriptions() }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Subscriptions", onBack = onBack)

            SegmentedTabs(
                items = listOf("My Subscriptions" to "", "My Subscribers" to ""),
                selectedIndex = selectedTab,
                onSelected = { selectedTab = it },
                modifier = Modifier.padding(horizontal = 20.dp)
            )

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading...")
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    when (selectedTab) {
                            0 -> {
                            if (subscriptions.isEmpty()) {
                                item { GlassCard { Text("You are not subscribed to anyone.", color = TextMuted) } }
                            } else {
                                items(subscriptions, key = { it._id }) { sub ->
                                    val creator = sub.creatorId
                                    if (creator != null) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceElevated).clickable { onOpenProfile(creator._id) }.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            Avatar(initial = creator.name.firstOrNull()?.toString() ?: "?", size = 46, imageUrl = creator.avatar)
                                            Column(Modifier.weight(1f)) {
                                                Text(creator.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                Text("Plan: ${sub.plan}", color = TextMuted, fontSize = 12.sp)
                                                if (sub.expiresAt.isNotBlank()) {
                                                    Text("Expires: ${sub.expiresAt.take(10)}", color = TextMuted, fontSize = 11.sp)
                                                }
                                            }
                                            Button(
                                                onClick = {
                                                    if (busy) return@Button
                                                    busy = true
                                                    scope.launch {
                                                        runCatching {
                                                            withContext(Dispatchers.IO) { YugmApi.cancelSubscription(token, creator._id) }
                                                        }
                                                        loadSubscriptions()
                                                        busy = false
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Danger),
                                                shape = RoundedCornerShape(8.dp)
                                            ) { Text("Cancel", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                                        }
                                    }
                                }
                            }
                            item {
                                Spacer(Modifier.height(8.dp))
                                GradientAction("Subscribe", modifier = Modifier.fillMaxWidth(), onClick = { showSubscribeDialog = true })
                            }
                        }
                            1 -> {
                            if (subscriberList.isEmpty()) {
                                item { GlassCard { Text("No subscribers yet.", color = TextMuted) } }
                            } else {
                                items(subscriberList, key = { it._id }) { info ->
                                    val user = info.subscriber
                                    if (user != null) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(SurfaceElevated).clickable { onOpenProfile(user._id) }.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            Avatar(initial = user.name.firstOrNull()?.toString() ?: "?", size = 46, imageUrl = user.avatar)
                                            Column(Modifier.weight(1f)) {
                                                Text(user.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                Text("Plan: ${info.plan}", color = TextMuted, fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showSubscribeDialog) {
        AlertDialog(
            onDismissRequest = { showSubscribeDialog = false },
            title = { Text("Subscribe", color = TextPrimary, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = subscribeCreatorId,
                        onValueChange = { subscribeCreatorId = it },
                        label = { Text("Creator ID") },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Text),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedLabelColor = Gold,
                            unfocusedLabelColor = TextMuted,
                            focusedBorderColor = Gold,
                            unfocusedBorderColor = Line,
                            cursorColor = Gold,
                            focusedContainerColor = Panel,
                            unfocusedContainerColor = Panel
                        ),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = subscribePlan,
                        onValueChange = { subscribePlan = it },
                        label = { Text("Plan (e.g. basic, premium)") },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Text),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedLabelColor = Gold,
                            unfocusedLabelColor = TextMuted,
                            focusedBorderColor = Gold,
                            unfocusedBorderColor = Line,
                            cursorColor = Gold,
                            focusedContainerColor = Panel,
                            unfocusedContainerColor = Panel
                        ),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (subscribeCreatorId.isBlank()) return@TextButton
                    showSubscribeDialog = false
                    scope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) { YugmApi.subscribeCreator(token, subscribeCreatorId, subscribePlan) }
                        }
                        loadSubscriptions()
                    }
                }) { Text("Subscribe", color = Gold, fontWeight = FontWeight.Black) }
            },
            dismissButton = {
                TextButton(onClick = { showSubscribeDialog = false }) { Text("Cancel", color = TextMuted, fontWeight = FontWeight.Bold) }
            },
            containerColor = Ink2,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

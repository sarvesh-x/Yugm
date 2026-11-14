package com.yugm.app.feature.social.screens

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.Clan
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.social.viewmodel.ClanViewModel

@Composable
fun ClanDetailScreen(
    token: String,
    clanId: String,
    currentUserId: String,
    onBack: () -> Unit = {},
    onChat: (String) -> Unit = {},
    onMemberClick: (String) -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var actionLoading by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var transferTarget by remember { mutableStateOf<com.yugm.app.core.model.Host?>(null) }

    LaunchedEffect(clanId) {
        viewModel.loadDetail(token, clanId)
        if (currentUserId.isNotBlank()) viewModel.loadInviteCandidates(token, currentUserId)
    }

    YugmAmbientBackground {
        val currentClan = viewModel.clanDetail
        if (viewModel.isLoading) {
            Box(Modifier.fillMaxSize()) { LoadingState("Loading clan…") }
        } else if (currentClan == null) {
            Box(Modifier.fillMaxSize()) {
                Text("Clan not found", color = TextMuted, modifier = Modifier.padding(20.dp))
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    YugmPageHeader("Yugm", currentClan.name, onBack = onBack)
                }
                item {
                    Column(
                        Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(Modifier.size(72.dp).clip(CircleShape).background(Pink), contentAlignment = Alignment.Center) {
                            Text(currentClan.name.take(2).uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 28.sp)
                        }
                        Spacer(Modifier.height(10.dp))
                        Text(currentClan.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text("${currentClan.familyLabel} · ${currentClan.memberCount} members", color = TextMuted, fontSize = 13.sp)
                        if (currentClan.description.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(currentClan.description, color = TextMuted, fontSize = 12.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(if (currentClan.privacy == "PRIVATE") "Private Clan" else "Public Clan", color = TextMuted, fontSize = 11.sp)
                    }
                }
                item {
                    Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (currentClan.isMember) {
                            GradientAction("Chat", modifier = Modifier.weight(1f), onClick = { onChat(clanId) })
                            if (currentClan.ownerId == currentUserId) {
                                GradientAction("Invite members", modifier = Modifier.weight(1f), onClick = { viewModel.loadInviteCandidates(token, currentUserId) })
                            } else {
                                GradientAction(
                                    "Leave",
                                    modifier = Modifier.weight(1f),
                                    enabled = !actionLoading,
                                    onClick = {
                                        actionLoading = true
                                        viewModel.leave(token, clanId)
                                        status = "Left clan"
                                        onBack()
                                        actionLoading = false
                                    }
                                )
                            }
                        } else {
                            GradientAction("Join Clan", modifier = Modifier.weight(1f), enabled = !actionLoading, onClick = {
                                actionLoading = true
                                viewModel.join(token, clanId)
                                status = "Joined!"
                                viewModel.loadDetail(token, clanId)
                                actionLoading = false
                            })
                        }
                    }
                }
                if (status.isNotBlank()) {
                    item { Text(status, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                }
                item {
                    Text("Members", color = TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
                }
                if (currentClan.members.isEmpty()) {
                    item { Text("No members yet", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                } else {
                    items(currentClan.members) { member ->
                        Row(
                            Modifier.padding(horizontal = 20.dp).fillMaxWidth().clickable { onMemberClick(member.id) }.padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            com.yugm.app.core.ui.components.Avatar(
                                initial = member.name.firstOrNull()?.toString() ?: "?",
                                size = 40,
                                imageUrl = member.avatar
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(member.name, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                                    if (member.id == currentClan.ownerId) {
                                        Spacer(Modifier.width(6.dp))
                                        Text("Owner", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                                if (member.city.isNotBlank()) {
                                    Text(member.city, color = TextMuted, fontSize = 11.sp)
                                }
                            }
                            if (member.isOnline) {
                                Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF00C853)))
                            }
                            if (currentClan.ownerId == currentUserId && member.id != currentUserId) {
                                TextButton(onClick = { transferTarget = member }) { Text("Make owner", color = Pink, fontSize = 10.sp) }
                            }
                        }
                    }
                }
                if (currentClan.ownerId == currentUserId) {
                    item {
                        Text("Invite people you follow", color = TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
                    }
                    val existingIds = currentClan.members.map { it.id }.toSet()
                    val candidates = viewModel.inviteCandidates.filter { it.id !in existingIds }
                    if (candidates.isEmpty()) {
                        item { Text("No available people to invite right now.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                    } else {
                        items(candidates, key = { "invite-${it.id}" }) { candidate ->
                            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                com.yugm.app.core.ui.components.Avatar(candidate.name.firstOrNull()?.toString() ?: "?", 36, candidate.avatar)
                                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                                    Text(candidate.name, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    if (candidate.username.isNotBlank()) Text("@${candidate.username}", color = TextMuted, fontSize = 10.sp)
                                }
                                TextButton(
                                    enabled = candidate.id !in viewModel.sentInviteIds,
                                    onClick = { viewModel.inviteMember(token, clanId, candidate.id) }
                                ) { Text(if (candidate.id in viewModel.sentInviteIds) "Sent" else "Invite", color = Pink, fontSize = 11.sp) }
                            }
                        }
                    }
                }
            }
        }
    }
    transferTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { transferTarget = null },
            title = { Text("Transfer clan ownership?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("${target.name} will become the owner and you’ll be a regular member.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.transferOwnership(token, clanId, target.id)
                    transferTarget = null
                    status = "Ownership transferred"
                }) { Text("Transfer", color = Pink) }
            },
            dismissButton = { TextButton(onClick = { transferTarget = null }) { Text("Cancel", color = TextMuted) } }
        )
    }
}

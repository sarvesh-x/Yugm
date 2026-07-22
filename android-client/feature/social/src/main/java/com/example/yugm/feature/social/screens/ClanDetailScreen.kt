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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
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
import com.example.yugm.core.model.Clan
import com.example.yugm.core.ui.components.GradientAction
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.feature.social.viewmodel.ClanViewModel

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

    LaunchedEffect(clanId) { viewModel.loadDetail(token, clanId) }

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
                                GradientAction("Members", modifier = Modifier.weight(1f), onClick = {})
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
                            com.example.yugm.core.ui.components.Avatar(
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
                        }
                    }
                }
            }
        }
    }
}

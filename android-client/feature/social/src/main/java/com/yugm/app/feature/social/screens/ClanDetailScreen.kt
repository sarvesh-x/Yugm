package com.yugm.app.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.RoundAction
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.TextSecondary
import com.yugm.app.feature.social.viewmodel.ClanViewModel

// Theme-aware: use LocalYugmColors.current.danger

@Composable
fun ClanDetailScreen(
    token: String,
    clanId: String,
    currentUserId: String,
    onBack: () -> Unit = {},
    onChat: (String, String) -> Unit = { _, _ -> },
    onMemberClick: (String) -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var actionLoading by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var showSettings by remember { mutableStateOf(false) }
    var manageTarget by remember { mutableStateOf<Host?>(null) }
    var confirmKick by remember { mutableStateOf<Host?>(null) }
    var confirmTransfer by remember { mutableStateOf<Host?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }

    var settingsName by remember { mutableStateOf("") }
    var settingsDescription by remember { mutableStateOf("") }
    var settingsFamilyLabel by remember { mutableStateOf("") }
    var settingsAvatar by remember { mutableStateOf("") }
    var settingsPrivate by remember { mutableStateOf(false) }

    LaunchedEffect(clanId, token) {
        viewModel.loadDetail(token, clanId)
        if (currentUserId.isNotBlank()) viewModel.loadInviteCandidates(token, currentUserId)
    }
    LaunchedEffect(clanId, token, viewModel.clanDetail?.canInvite) {
        if (viewModel.clanDetail?.canInvite == true) viewModel.loadSentInvitations(token, clanId)
    }
    LaunchedEffect(viewModel.error) {
        if (!viewModel.error.isNullOrBlank()) status = viewModel.error.orEmpty()
    }

    val currentClan = viewModel.clanDetail

    YugmAmbientBackground {
        if (viewModel.isLoading && currentClan == null) {
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
                    YugmPageHeader("Yugm", currentClan.name, onBack = onBack) {
                        if (currentClan.canManage) {
                            RoundAction("⚙", accessibilityLabel = "Open clan settings") {
                                settingsName = currentClan.name
                                settingsDescription = currentClan.description
                                settingsFamilyLabel = currentClan.familyLabel
                                settingsAvatar = currentClan.avatar.orEmpty()
                                settingsPrivate = currentClan.privacy == "PRIVATE"
                                showSettings = true
                            }
                        }
                    }
                }
                item {
                    Column(
                        Modifier.padding(horizontal = 16.dp).fillMaxWidth()
                            .clip(RoundedCornerShape(26.dp))
                            .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(26.dp))
                            .background(Brush.linearGradient(listOf(LocalYugmColors.current.surfaceElevated, LocalYugmColors.current.surfaceVariant, LocalYugmColors.current.surface)))
                            .padding(20.dp),
                        horizontalAlignment = Alignment.Start
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Avatar(currentClan.name.take(1).uppercase(), 68, currentClan.avatar)
                            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text(currentClan.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text("#${currentClan.slug}", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                if (currentClan.isMember) RoleBadge(roleOf(currentClan, currentUserId))
                            }
                        }
                        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ClanInfoPill(currentClan.familyLabel.ifBlank { "Community" }.take(14))
                            ClanInfoPill("${currentClan.memberCount} members")
                            ClanInfoPill(if (currentClan.privacy == "PRIVATE") "Invite only" else "Public")
                        }
                        if (currentClan.description.isNotBlank()) {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                currentClan.description,
                                color = TextSecondary,
                                fontSize = 13.sp,
                                lineHeight = 18.sp,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                item {
                    Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (currentClan.isMember) {
                            GradientAction("Chat", modifier = Modifier.weight(1f), onClick = { onChat(clanId, currentClan.name) })
                            if (currentClan.canManage) {
                                GradientAction(
                                    "Settings",
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        settingsName = currentClan.name
                                        settingsDescription = currentClan.description
                                        settingsFamilyLabel = currentClan.familyLabel
                                        settingsAvatar = currentClan.avatar.orEmpty()
                                        settingsPrivate = currentClan.privacy == "PRIVATE"
                                        showSettings = true
                                    }
                                )
                            } else {
                                GradientAction(
                                    "Leave",
                                    modifier = Modifier.weight(1f),
                                    enabled = !actionLoading,
                                    onClick = {
                                        actionLoading = true
                                        viewModel.leave(token, clanId)
                                        onBack()
                                        actionLoading = false
                                    }
                                )
                            }
                        } else {
                            GradientAction("Join Clan", modifier = Modifier.weight(1f), enabled = !actionLoading, onClick = {
                                actionLoading = true
                                viewModel.join(token, clanId) { joined ->
                                    if (joined) {
                                        status = "You joined ${currentClan.name}"
                                        viewModel.loadDetail(token, clanId)
                                    }
                                    actionLoading = false
                                }
                            })
                        }
                    }
                }
                if (status.isNotBlank()) {
                    item { Text(status, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                }
                item {
                    Row(Modifier.padding(horizontal = 20.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Members", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(Modifier.width(8.dp))
                        ClanInfoPill(currentClan.memberCount.toString())
                    }
                }
                if (currentClan.members.isEmpty()) {
                    item { Text("No members yet", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                } else {
                    items(currentClan.members, key = { "member-${it.id}" }) { member ->
                        val role = roleOf(currentClan, member.id)
                        Row(
                            Modifier.padding(horizontal = 16.dp).fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp))
                                .clickable { onMemberClick(member.id) }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Avatar(
                                initial = member.name.firstOrNull()?.toString() ?: "?",
                                size = 40,
                                imageUrl = member.avatar
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(member.name, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                                    Spacer(Modifier.width(6.dp))
                                    RoleBadge(role)
                                }
                                if (member.city.isNotBlank()) {
                                    Text(member.city, color = TextMuted, fontSize = 11.sp)
                                }
                            }
                            if (member.isOnline) {
                                Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF00C853)))
                            }
                            if ((currentClan.canManage || currentClan.isOwner) && member.id != currentUserId) {
                                TextButton(onClick = { manageTarget = member }) { Text("Manage", color = Pink, fontSize = 10.sp) }
                            }
                        }
                    }
                }
                if (currentClan.canInvite) {
                    item {
                        Text("Pending invitations", color = TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
                    }
                    if (viewModel.sentInvitations.isEmpty()) {
                        item { Text("No pending invitations.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                    } else {
                        items(viewModel.sentInvitations, key = { "sent-invite-${it.id}" }) { invite ->
                            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Avatar(invite.inviteeName.firstOrNull()?.toString() ?: "?", 36, invite.inviteeAvatar)
                                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                                    Text(invite.inviteeName, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    val sub = when {
                                        invite.inviteeUsername.isNotBlank() -> "@${invite.inviteeUsername}"
                                        invite.expiresAt.isNotBlank() -> "Expires ${invite.expiresAt.take(10)}"
                                        else -> "Pending"
                                    }
                                    Text(sub, color = TextMuted, fontSize = 10.sp)
                                }
                                TextButton(onClick = { viewModel.cancelSentInvitation(token, clanId, invite.id) }) {
                                    Text("Cancel", color = Pink, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                    item {
                        Text("Invite people you follow", color = TextMuted, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
                    }
                    val existingIds = currentClan.members.map { it.id }.toSet()
                    val pendingIds = viewModel.sentInvitations.map { it.inviteeId }.filter { it.isNotBlank() }.toSet()
                    val candidates = viewModel.inviteCandidates.filter { it.id !in existingIds && it.id !in pendingIds }
                    if (candidates.isEmpty()) {
                        item { Text("No available people to invite right now.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                    } else {
                        items(candidates, key = { "invite-${it.id}" }) { candidate ->
                            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Avatar(candidate.name.firstOrNull()?.toString() ?: "?", 36, candidate.avatar)
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

    if (showSettings && currentClan != null) {
        AlertDialog(
            onDismissRequest = { showSettings = false },
            containerColor = LocalYugmColors.current.surface,
            shape = RoundedCornerShape(26.dp),
            title = { Text("Clan settings", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    Modifier.heightIn(max = 430.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                            .background(Brush.horizontalGradient(listOf(LocalYugmColors.current.surfaceVariant, LocalYugmColors.current.surface)))
                            .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Avatar(settingsName.ifBlank { "C" }.take(1).uppercase(), 48, settingsAvatar.trim().ifBlank { null })
                        Column {
                            Text("Make your clan recognizable", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Text("Changes update the clan profile for all members.", color = TextMuted, fontSize = 10.sp)
                        }
                    }
                    Text("IDENTITY", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = settingsName,
                        onValueChange = { settingsName = it.take(48) },
                        label = { Text("Clan name") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = settingsDescription,
                        onValueChange = { settingsDescription = it.take(220) },
                        label = { Text("Description") },
                        maxLines = 3
                    )
                    Text("DISCOVERY", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                    OutlinedTextField(
                        value = settingsFamilyLabel,
                        onValueChange = { settingsFamilyLabel = it.take(32) },
                        label = { Text("Family label") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = settingsAvatar,
                        onValueChange = { settingsAvatar = it.take(500) },
                        label = { Text("Avatar URL") },
                        supportingText = { Text("Paste a publicly accessible image link.") },
                        singleLine = true
                    )
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(LocalYugmColors.current.surfaceVariant).padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Private clan", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            Text("Only invited users can join", color = TextMuted, fontSize = 11.sp)
                        }
                        Switch(
                            checked = settingsPrivate,
                            onCheckedChange = { settingsPrivate = it },
                            colors = SwitchDefaults.colors(checkedTrackColor = Pink)
                        )
                    }
                    Text("Clan ID  ·  #${currentClan.slug}", color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                    if (currentClan.ownerId == currentUserId) {
                        Spacer(Modifier.height(8.dp))
                        Text("DANGER ZONE", color = LocalYugmColors.current.danger, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        TextButton(
                            onClick = {
                                showSettings = false
                                confirmDelete = true
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Delete clan", color = LocalYugmColors.current.danger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Text("Permanently deletes the clan, its chat, and all memberships.", color = TextMuted, fontSize = 10.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = settingsName.trim().length >= 3 && !viewModel.isLoading,
                    onClick = {
                        viewModel.updateClan(
                            token = token,
                            clanId = clanId,
                            name = settingsName.trim(),
                            description = settingsDescription.trim(),
                            privacy = if (settingsPrivate) "PRIVATE" else "PUBLIC",
                            familyLabel = settingsFamilyLabel.trim(),
                            avatar = settingsAvatar.trim().ifBlank { null }
                        )
                        showSettings = false
                    }
                ) { Text("Save", color = Pink) }
            },
            dismissButton = { TextButton(onClick = { showSettings = false }) { Text("Cancel", color = TextMuted) } }
        )
    }

    manageTarget?.let { target ->
        val currentRole = currentClan?.let { roleOf(it, target.id) } ?: "MEMBER"
        AlertDialog(
            onDismissRequest = { manageTarget = null },
            title = { Text("Manage ${target.name}", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Role", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    listOf(
                        "CO_LEADER" to "Co-Leader",
                        "OFFICER" to "Officer",
                        "MEMBER" to "Member"
                    ).forEach { (role, label) ->
                        Row(
                            Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .clickable(enabled = currentRole != role) {
                                    viewModel.setMemberRole(token, clanId, target.id, role)
                                    manageTarget = null
                                }
                                .padding(horizontal = 10.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(label, color = if (currentRole == role) Pink else TextPrimary, fontSize = 14.sp, fontWeight = if (currentRole == role) FontWeight.Bold else FontWeight.Medium)
                            Spacer(Modifier.weight(1f))
                            if (currentRole == role) Text("Current", color = Pink, fontSize = 10.sp)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text("Ownership", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = {
                        confirmTransfer = target
                        manageTarget = null
                    }) { Text("Transfer ownership", color = Pink, fontSize = 12.sp) }
                    TextButton(onClick = {
                        confirmKick = target
                        manageTarget = null
                    }) { Text("Remove from clan", color = LocalYugmColors.current.danger, fontSize = 12.sp) }
                }
            },
            confirmButton = { TextButton(onClick = { manageTarget = null }) { Text("Close", color = TextMuted) } }
        )
    }

    confirmKick?.let { target ->
        AlertDialog(
            onDismissRequest = { confirmKick = null },
            title = { Text("Remove ${target.name}?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("They will lose access to the clan and its chat.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.kickMember(token, clanId, target.id)
                    confirmKick = null
                    status = "${target.name} removed from the clan"
                }) { Text("Remove", color = LocalYugmColors.current.danger) }
            },
            dismissButton = { TextButton(onClick = { confirmKick = null }) { Text("Cancel", color = TextMuted) } }
        )
    }

    confirmTransfer?.let { target ->
        AlertDialog(
            onDismissRequest = { confirmTransfer = null },
            title = { Text("Transfer clan ownership?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("${target.name} will become the leader and you’ll be a co-leader.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.transferOwnership(token, clanId, target.id)
                    confirmTransfer = null
                    status = "Ownership transferred"
                }) { Text("Transfer", color = Pink) }
            },
            dismissButton = { TextButton(onClick = { confirmTransfer = null }) { Text("Cancel", color = TextMuted) } }
        )
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this clan?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("This removes the clan, its chat, and all memberships. This cannot be undone.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    viewModel.deleteClan(token, clanId) { onBack() }
                }) { Text("Delete", color = LocalYugmColors.current.danger) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel", color = TextMuted) } }
        )
    }
}

@Composable
private fun RoleBadge(role: String) {
    val color = roleColor(role)
    Text(
        roleLabel(role),
        color = color,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 7.dp, vertical = 2.dp)
    )
}

private fun roleOf(clan: Clan, userId: String): String =
    clan.memberRoles.firstOrNull { it.userId == userId }?.role
        ?: if (userId == clan.ownerId) "LEADER" else "MEMBER"

@Composable
private fun ClanInfoPill(label: String) {
    Box(
        Modifier.clip(CircleShape)
            .background(LocalYugmColors.current.surfaceVariant)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(label, color = LocalYugmColors.current.textSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

private fun roleLabel(role: String): String = when (role) {
    "LEADER" -> "Leader"
    "CO_LEADER" -> "Co-Leader"
    "OFFICER" -> "Officer"
    else -> "Member"
}

@Composable
private fun roleColor(role: String): Color = when (role) {
    "LEADER" -> Color(0xFFFFC857)
    "CO_LEADER" -> Color(0xFFC9A5FF)
    "OFFICER" -> Color(0xFF62D6C6)
    else -> LocalYugmColors.current.textSecondary
}

package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSocialListScreen(
    token: String,
    userId: String,
    initialList: String,
    isOwnProfile: Boolean,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    var selectedList by remember(userId, initialList) {
        mutableStateOf(if (initialList == "following") "following" else "followers")
    }
    var users by remember(userId, selectedList) { mutableStateOf<List<Host>>(emptyList()) }
    var loading by remember(userId, selectedList) { mutableStateOf(true) }
    var busyUserId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var removeTarget by remember { mutableStateOf<Host?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(userId, selectedList, reloadKey) {
        loading = true
        error = null
        runCatching {
            withContext(Dispatchers.IO) {
                if (selectedList == "followers") YugmApi.getFollowers(userId, token)
                else YugmApi.getFollowing(userId, token)
            }
        }.onSuccess { users = it }
            .onFailure { error = it.message ?: "Could not load this list." }
        loading = false
    }

    fun removeUser(person: Host) {
        if (!isOwnProfile || busyUserId != null) return
        scope.launch {
            busyUserId = person.id
            error = null
            runCatching {
                withContext(Dispatchers.IO) {
                    if (selectedList == "followers") YugmApi.removeFollower(token, person.id)
                    else YugmApi.unfollowUser(token, person.id)
                }
            }.onSuccess {
                users = users.filterNot { it.id == person.id }
            }.onFailure {
                error = it.message ?: "Could not update this relationship."
            }
            busyUserId = null
            removeTarget = null
        }
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        Scaffold(
            containerColor = Background,
            topBar = {
                YugmPageHeader(
                    title = if (selectedList == "followers") "Followers" else "Following",
                    subtitle = "${users.size} people",
                    onBack = onBack
                )
            }
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                TabRow(selectedTabIndex = if (selectedList == "followers") 0 else 1, containerColor = Background) {
                    listOf("followers" to "Followers", "following" to "Following").forEachIndexed { index, (key, label) ->
                        Tab(
                            selected = selectedList == key,
                            onClick = { selectedList = key },
                            text = { Text(label, fontWeight = FontWeight.Bold) }
                        )
                    }
                }
                when {
                    loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Pink) }
                    error != null && users.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(error.orEmpty(), color = Danger)
                            TextButton(onClick = { reloadKey++ }) { Text("Try again", color = Gold) }
                        }
                    }
                    users.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("No ${if (selectedList == "followers") "followers" else "following"} yet", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text("People you connect with will show up here.", color = TextMuted)
                        }
                    }
                    else -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (error != null) item { Text(error.orEmpty(), color = Danger, modifier = Modifier.padding(8.dp)) }
                        items(users, key = { it.id }) { person ->
                            Row(
                                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                                    .background(SurfaceElevated).padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Avatar(
                                    initial = person.name.firstOrNull()?.toString() ?: "?",
                                    size = 48,
                                    imageUrl = person.avatar,
                                    cosmetics = person.activeCosmetics,
                                    accessibilityLabel = "${person.name.ifBlank { person.username }} profile photo"
                                )
                                Column(
                                    Modifier.weight(1f).clickable { onOpenProfile(person.id) },
                                    verticalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    Text(person.name.ifBlank { person.username }, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1)
                                    Text("@${person.username}", color = TextMuted, fontSize = 12.sp, maxLines = 1)
                                    Text("${person.followers} followers", color = TextMuted, fontSize = 11.sp)
                                }
                                if (isOwnProfile) {
                                    OutlinedButton(
                                        onClick = { removeTarget = person },
                                        enabled = busyUserId == null,
                                        shape = RoundedCornerShape(12.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                                    ) {
                                        if (busyUserId == person.id) {
                                            CircularProgressIndicator(Modifier.size(16.dp), color = Pink, strokeWidth = 2.dp)
                                        } else {
                                            Text(if (selectedList == "followers") "Remove" else "Unfollow", color = TextPrimary, fontSize = 12.sp)
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

    removeTarget?.let { person ->
        val isFollower = selectedList == "followers"
        AlertDialog(
            onDismissRequest = { if (busyUserId == null) removeTarget = null },
            title = { Text(if (isFollower) "Remove follower?" else "Unfollow this person?", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text(if (isFollower) "${person.name} will no longer follow you." else "${person.name} will be removed from your following list.", color = TextMuted) },
            confirmButton = {
                TextButton(enabled = busyUserId == null, onClick = { removeUser(person) }) {
                    Text(if (isFollower) "Remove" else "Unfollow", color = Danger)
                }
            },
            dismissButton = {
                TextButton(enabled = busyUserId == null, onClick = { removeTarget = null }) { Text("Cancel", color = TextMuted) }
            },
            containerColor = SurfaceElevated
        )
    }
}

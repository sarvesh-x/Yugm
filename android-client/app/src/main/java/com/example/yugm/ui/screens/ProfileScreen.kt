package com.example.yugm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.EmptyRoomsScreen
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.StatCard
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    host: Host?,
    rooms: List<Room> = emptyList(),
    loading: Boolean = false,
    error: String = "",
    isOwnProfile: Boolean = false,
    isFollowing: Boolean = false,
    isBlocked: Boolean = false,
    onRetry: () -> Unit = {},
    onFollow: () -> Unit = {},
    onUnfollow: () -> Unit = {},
    onBlock: () -> Unit = {},
    onUnblock: () -> Unit = {},
    onEditProfile: (String, String, String, String) -> Unit = { _, _, _, _ -> },
    onEditDone: (String, String, String, String) -> Unit = { _, _, _, _ -> },
    onWallet: () -> Unit = {},
    onOpenRoom: (Room) -> Unit = {}
) {
    var editOpen by rememberSaveable { mutableStateOf(false) }
    var editName by rememberSaveable { mutableStateOf(host?.name ?: "") }
    var editUsername by rememberSaveable { mutableStateOf(host?.username ?: "") }
    var editBio by rememberSaveable { mutableStateOf(host?.bio ?: "") }
    var editCity by rememberSaveable { mutableStateOf(host?.city ?: "") }

    if (editOpen && host != null) {
        ModalBottomSheet(
            onDismissRequest = { editOpen = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = com.example.yugm.ui.theme.Ink2
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Edit Profile", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(16.dp))
                YugmTextField(editName, { editName = it }, "Name")
                Spacer(Modifier.height(10.dp))
                YugmTextField(editUsername, { editUsername = it }, "Username")
                Spacer(Modifier.height(10.dp))
                YugmTextField(editBio, { editBio = it }, "Bio", minLines = 3)
                Spacer(Modifier.height(10.dp))
                YugmTextField(editCity, { editCity = it }, "City")
                Spacer(Modifier.height(16.dp))
                com.example.yugm.ui.components.PrimaryButton("Save") {
                    onEditDone(editName, editUsername, editBio, editCity)
                    editOpen = false
                }
            }
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        if (loading) {
            item { LoadingState("Loading profile...") }
        }
        if (error.isNotBlank()) {
            item { EmptyRoomsScreen(message = error, onAction = onRetry, action = "Retry") }
        }
        if (!loading && error.isBlank() && host != null) {
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Avatar(initial = host.name.firstOrNull()?.toString() ?: "", size = 92, imageUrl = host.avatar)
                    if (isOwnProfile) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { editName = host.name; editUsername = host.username; editBio = host.bio; editCity = host.city; editOpen = true }) {
                                Text("Edit", color = Gold, fontWeight = FontWeight.Black)
                            }
                            TextButton(onClick = onWallet) {
                                Text("Wallet", color = Gold, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
                Text(host.name, color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 18.dp))
                Text("@${host.username}", color = Gold, fontWeight = FontWeight.Bold)
                if (host.bio.isNotBlank()) {
                    Text(host.bio, color = TextMuted, lineHeight = 21.sp, modifier = Modifier.padding(top = 12.dp))
                }
                if (host.city.isNotBlank()) {
                    Text("📍 ${host.city}", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    StatCard("Followers", formatCount(host.followers), Modifier.weight(1f))
                    StatCard("Following", formatCount(host.followingCount), Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    if (!isOwnProfile) {
                        if (isFollowing) {
                            OutlinedButton(
                                onClick = onUnfollow,
                                border = BorderStroke(1.dp, Line),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) { Text("Unfollow", color = TextPrimary, fontWeight = FontWeight.Black) }
                        } else {
                            OutlinedButton(
                                onClick = onFollow,
                                border = BorderStroke(1.dp, Gold),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) { Text("Follow", color = Gold, fontWeight = FontWeight.Black) }
                        }
                        if (isBlocked) {
                            OutlinedButton(
                                onClick = onUnblock,
                                border = BorderStroke(1.dp, Danger),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) { Text("Unblock", color = Danger, fontWeight = FontWeight.Black) }
                        } else {
                            OutlinedButton(
                                onClick = onBlock,
                                border = BorderStroke(1.dp, Danger),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f)
                            ) { Text("Block", color = Danger, fontWeight = FontWeight.Black) }
                        }
                    }
                }
            }
            item { SectionTitle("Hosted rooms") }
            if (rooms.isEmpty()) {
                item {
                    GlassCard {
                        Text("No rooms hosted yet", color = TextMuted)
                    }
                }
            } else {
                items(rooms, key = { it.id }) { room ->
                    RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
                }
            }
        }
    }
}

private fun formatCount(count: Int): String = when {
    count >= 1000 -> "${count / 1000}.${(count % 1000) / 100}k"
    else -> count.toString()
}

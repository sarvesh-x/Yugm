package com.yugm.app.feature.profile.bonds

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun BondInviteSheet(home: BondsHome, state: BondsUiState, slot: Int, target: String, onDismiss: () -> Unit, onSend: (JSONObject) -> Unit) {
    var step by rememberSaveable(slot) { mutableIntStateOf(0) }
    var friendId by rememberSaveable(slot) { mutableStateOf("") }
    var kindId by rememberSaveable(slot) { mutableStateOf("") }
    var giftId by rememberSaveable(slot) { mutableStateOf<String?>(null) }
    var query by rememberSaveable(slot) { mutableStateOf("") }
    var message by rememberSaveable(slot) { mutableStateOf("") }
    var intentKey by rememberSaveable(slot) { mutableStateOf(UUID.randomUUID().toString()) }
    val selectedFriend = state.friends.firstOrNull { it.id == friendId }
    val selectedKind = home.kinds.firstOrNull { it.id == kindId }
    val selectedGift = state.gifts.firstOrNull { it.id == giftId }
    LaunchedEffect(target, state.friends) {
        if (friendId.isBlank() && step == 0 && target.isNotBlank() && state.friends.any { it.id == target }) {
            friendId = target
            step = 1
        }
    }
    ModalBottomSheet(onDismissRequest = { if (!state.busy) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 18.dp, end = 18.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(listOf("Choose a friend", "Choose a bond", "Choose an invitation gift", "Confirm invitation")[step],
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            when (step) {
                0 -> {
                    OutlinedTextField(query, { query = it }, label = { Text("Search friends") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    val matches = state.friends.filter { it.name.contains(query, true) || it.username.contains(query, true) }
                    if (state.busy && matches.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth())
                    if (!state.busy && matches.isEmpty()) Text("No eligible friends match your search.")
                    matches.forEach { friend ->
                        ListItem(headlineContent = { Text(friend.name) }, supportingContent = { Text(friend.username) },
                            leadingContent = { BondAvatar(friend, 40) }, modifier = Modifier.clickable { friendId = friend.id; step = 1 })
                    }
                }
                1 -> home.kinds.forEach { kind ->
                    ElevatedCard(onClick = { kindId = kind.id; giftId = null; step = 2 }, modifier = Modifier.fillMaxWidth()) {
                        ListItem(headlineContent = { Text(kind.name, fontWeight = FontWeight.Bold) },
                            supportingContent = { Text(kind.description) }, leadingContent = { Text(kind.icon) })
                    }
                }
                2 -> {
                    if (home.free) OutlinedButton(onClick = { giftId = ""; step = 3 }, modifier = Modifier.fillMaxWidth()) { Text("Send without a gift") }
                    state.gifts.filter { it.purpose == "INVITATION" && (it.kind.isBlank() || it.kind == kindId) }.forEach { gift ->
                        ListItem(headlineContent = { Text(gift.name) }, trailingContent = { Text("${gift.price} coins") },
                            leadingContent = { Text(gift.icon) }, modifier = Modifier.clickable { giftId = gift.id; step = 3 })
                    }
                }
                3 -> {
                    Text("${selectedKind?.name.orEmpty()} invitation to ${selectedFriend?.name.orEmpty()}", fontWeight = FontWeight.SemiBold)
                    Text(selectedGift?.let { "${it.name} · ${it.price} coins" } ?: "Free invitation")
                    Text("Balance ${home.balance} coins")
                    Text("Expires in ${home.hours} hours. Held coins are returned if the request isn’t accepted.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(message, { message = it.take(160) }, label = { Text("Personal message (optional)") },
                        modifier = Modifier.fillMaxWidth(), maxLines = 3)
                    Button(onClick = {
                        onSend(JSONObject().put("recipient", friendId).put("kind", kindId).put("slot", slot).put("key", intentKey)
                            .put("message", message.trim()).apply { if (!giftId.isNullOrBlank()) put("giftId", giftId) })
                    }, enabled = !state.busy && selectedFriend != null && selectedKind != null && home.balance >= (selectedGift?.price ?: 0),
                        modifier = Modifier.fillMaxWidth()) { Text(if (state.busy) "Sending…" else "Send invitation") }
                    if (home.balance < (selectedGift?.price ?: 0)) Text("You don’t have enough coins for this gift.")
                }
            }
            Row {
                if (step > 0) TextButton(onClick = { step--; intentKey = UUID.randomUUID().toString() }, enabled = !state.busy) { Text("Back") }
                TextButton(onClick = onDismiss, enabled = !state.busy) { Text("Cancel") }
            }
        }
    }
}

@Composable
internal fun BondCenter(home: BondsHome, busy: Boolean, open: (BondCard) -> Unit, goHome: () -> Unit,
    profile: (String) -> Unit, action: (BondInvitation, String) -> Unit) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    Column {
        TabRow(selectedTabIndex = selected) {
            listOf("Applications", "Active bonds", "Ended").forEachIndexed { index, label ->
                Tab(selected == index, onClick = { selected = index }, text = { Text(label) })
            }
        }
        LazyColumn(contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (selected) {
                0 -> {
                    if (home.requests.isEmpty()) item { BondSection("No pending requests") { TextButton(onClick = goHome) { Text("Find an available slot") } } }
                    items(home.requests, key = { it.id }) { request ->
                        val name = request.kind.lowercase().replaceFirstChar(Char::uppercase)
                        BondSection(if (request.incoming) "Incoming request" else "Sent request") {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                BondAvatar(request.partner, 40)
                                Column {
                                    Text(request.partner.name, fontWeight = FontWeight.Bold)
                                    Text(if (request.typeChange) "Change to $name" else name)
                                }
                            }
                            if (request.gift.isNotBlank()) Text("${request.giftIcon} ${request.gift} · ${request.price} coins")
                            if (request.message.isNotBlank()) Text(request.message)
                            Text(bondExpiry(request.expiresAt), color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (request.incoming) {
                                    Button(onClick = { action(request, "accept") }, enabled = !busy) { Text("Accept") }
                                    OutlinedButton(onClick = { action(request, "decline") }, enabled = !busy) { Text("Decline") }
                                } else OutlinedButton(onClick = { action(request, "cancel") }, enabled = !busy) { Text("Cancel request") }
                            }
                            TextButton(onClick = { profile(request.partner.id) }, enabled = request.partner.id.isNotBlank()) {
                                Text("View profile & safety options")
                            }
                        }
                    }
                }
                1, 2 -> {
                    val active = selected == 1
                    val entries = if (active) home.active else home.ended
                    if (entries.isEmpty()) item {
                        BondSection(if (active) "No active bonds" else "No ended bonds") {
                            if (active) TextButton(onClick = goHome) { Text("Invite a friend") }
                            else Text("Ended bonds appear here privately.")
                        }
                    }
                    items(entries, key = { it.id }) { card ->
                        BondSection(card.kindName) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                BondAvatar(card.partner, 42)
                                Column {
                                    Text(card.partner.name, fontWeight = FontWeight.Bold)
                                    Text("${card.days} days together" + if (active) " · Level ${card.level}" else "")
                                }
                            }
                            if (active) TextButton(onClick = { open(card) }) { Text("Manage bond") }
                            else Text("${bondDate(card.activatedAt)} – ${bondDate(card.endedAt)}")
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun BondDetailsScreen(detail: BondDetail, home: BondsHome, state: BondsUiState, token: String, model: BondsViewModel,
    profile: (String) -> Unit, chat: (String) -> Unit, call: (String, Boolean) -> Unit) {
    val card = detail.card
    val active = card.status == "ACTIVE"
    val prefs = detail.preferences
    var showGifts by rememberSaveable(card.id) { mutableStateOf(false) }
    var confirmEnd by rememberSaveable(card.id) { mutableStateOf(false) }
    var confirmType by rememberSaveable(card.id) { mutableStateOf<String?>(null) }
    var selectedGift by rememberSaveable(card.id) { mutableStateOf<String?>(null) }
    var giftKey by rememberSaveable(card.id) { mutableStateOf("") }
    val mutate: (String, JSONObject, String) -> Unit = { suffix, body, method ->
        model.mutate(token, "/${card.id}/$suffix", body, method, card.id)
    }
    LazyColumn(contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            BondSection(card.kindName) {
                Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically) {
                    BondAvatar(detail.self, 64)
                    Text("✦", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium)
                    BondAvatar(card.partner, 64)
                }
                Text("You and ${card.partner.name}", style = MaterialTheme.typography.titleLarge)
                Text("${card.days} days together · Since ${bondDate(card.activatedAt)}")
                if (!active) Text("This bond has ended.")
                Text("Level ${card.level} · ${card.levelName}", fontWeight = FontWeight.SemiBold)
                val progress = card.nextThreshold?.let { (card.points - card.levelStart).toFloat() / (it - card.levelStart).coerceAtLeast(1) } ?: 1f
                LinearProgressIndicator(progress = { progress.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                Text(card.nextThreshold?.let { "${card.points} / $it points" } ?: "${card.points} points")
            }
        }
        if (active) item {
            BondSection("Together") {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(onClick = { chat(card.partner.id) }) { Text("Message") }
                    TextButton(onClick = { call(card.partner.id, false) }) { Text("Voice") }
                    TextButton(onClick = { call(card.partner.id, true) }) { Text("Video") }
                }
                Button(onClick = { mutate("check-in", JSONObject(), "POST") }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                    Text("Check in together")
                }
                Text("Earn shared points once you both check in today.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { showGifts = true; model.loadCatalog(token, includeFriends = false) }, enabled = !state.busy) { Text("Send a bond gift") }
                TextButton(onClick = { profile(card.partner.id) }, enabled = card.partner.id.isNotBlank()) { Text("View profile & safety options") }
            }
        }
        item {
            BondSection("Milestones") {
                Text(if (card.milestones.isEmpty()) "Your first milestone unlocks after one day together." else card.milestones.joinToString { "$it days" })
                if (active && card.nextAnniversaryAt.isNotBlank()) Text("Next anniversary · ${bondDate(card.nextAnniversaryAt)}")
            }
        }
        if (detail.activity.isNotEmpty()) item {
            BondSection("Recent activity") {
                detail.activity.forEach { row ->
                    val label = when (row.kind) {
                        "GIFT" -> "Bond gift exchanged"
                        "ACTIVITY" -> "You both checked in"
                        "MILESTONE" -> "Milestone unlocked"
                        else -> "Bond activity"
                    }
                    Text("$label · +${row.points} · ${bondDate(row.at)}")
                }
            }
        }
        if (active) item {
            BondSection("Visibility & management") {
                Text("Profile visibility follows the more restrictive choice between you.")
                listOf("PRIVATE" to "Private", "FRIENDS" to "Friends only", "PUBLIC" to "Public").forEach { (value, label) ->
                    Row(Modifier.fillMaxWidth().clickable(enabled = !state.busy) {
                        mutate("preferences", JSONObject().put("visibility", value), "PATCH")
                    }, verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = prefs.optString("visibility") == value, onClick = null, modifier = Modifier.padding(10.dp))
                        Text(label)
                    }
                }
                listOf("showDuration" to "Show duration", "showLevel" to "Show level", "showBadge" to "Show badge",
                    "leaderboard" to "Join public rankings", "showRanking" to "Show ranking badge", "reminders" to "Milestone reminders").forEach { (key, label) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(label, Modifier.weight(1f))
                        Switch(checked = prefs.optBoolean(key), enabled = !state.busy, onCheckedChange = { value ->
                            mutate("preferences", JSONObject().put(key, value), "PATCH")
                        })
                    }
                }
                val otherKind = home.kinds.firstOrNull { it.id != card.kind }
                if (otherKind != null) TextButton(onClick = { confirmType = otherKind.id }, enabled = !state.busy) { Text("Request change to ${otherKind.name}") }
                TextButton(onClick = { confirmEnd = true }, enabled = !state.busy) { Text("End bond", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
    if (showGifts) AlertDialog(onDismissRequest = { if (!state.busy) showGifts = false },
        title = { Text("Bond gifts") }, text = {
            Column(Modifier.heightIn(max = 320.dp).verticalScroll(rememberScrollState())) {
                state.gifts.filter { it.purpose != "INVITATION" && (it.kind.isBlank() || it.kind == card.kind) }.forEach { gift ->
                    TextButton(enabled = !state.busy && card.days >= gift.days && home.balance >= gift.price, onClick = {
                        selectedGift = gift.id
                        giftKey = UUID.randomUUID().toString()
                        showGifts = false
                    }) { Text("${gift.icon} ${gift.name} · ${gift.price} coins" + if (card.days < gift.days) " · ${gift.days} days" else "") }
                }
                if (state.gifts.isEmpty()) Text(if (state.busy) "Loading gifts…" else "No gifts are available.")
            }
        }, confirmButton = { TextButton(onClick = { showGifts = false }, enabled = !state.busy) { Text("Close") } })
    val gift = state.gifts.firstOrNull { it.id == selectedGift }
    if (gift != null) AlertDialog(onDismissRequest = { if (!state.busy) selectedGift = null },
        title = { Text("Send ${gift.name}?") }, text = { Text("${gift.price} coins will be deducted from your balance.") },
        confirmButton = { Button(enabled = !state.busy, onClick = {
            model.mutate(token, "/${card.id}/gifts", JSONObject().put("giftId", gift.id).put("key", giftKey), bondId = card.id) { selectedGift = null }
        }) { Text("Send gift") } }, dismissButton = { TextButton(onClick = { selectedGift = null }, enabled = !state.busy) { Text("Cancel") } })
    if (confirmEnd) AlertDialog(onDismissRequest = { confirmEnd = false },
        title = { Text("End this bond?") },
        text = { Text("Both slots will be released and the bond will be removed from your profiles. Earned gifts and permanent rewards stay with their owners. There is no fee.") },
        confirmButton = { TextButton(enabled = !state.busy, onClick = { confirmEnd = false; mutate("end", JSONObject(), "POST") }) { Text("End bond") } },
        dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Cancel") } })
    confirmType?.let { proposed ->
        val name = home.kinds.firstOrNull { it.id == proposed }?.name.orEmpty()
        AlertDialog(onDismissRequest = { confirmType = null }, title = { Text("Change to $name?") },
            text = { Text("Your partner has to accept. Your points and start date stay with the bond.") },
            confirmButton = { Button(onClick = {
                confirmType = null
                mutate("type-change", JSONObject().put("kind", proposed).put("key", UUID.randomUUID().toString()), "POST")
            }, enabled = !state.busy) { Text("Send request") } },
            dismissButton = { TextButton(onClick = { confirmType = null }) { Text("Cancel") } })
    }
}

@Composable
internal fun BondRankings(data: BondRanks?, busy: Boolean, load: (String, Boolean, String, String, String) -> Unit) {
    var category by rememberSaveable { mutableIntStateOf(0) }
    var prior by rememberSaveable { mutableStateOf(false) }
    var window by rememberSaveable { mutableStateOf("WEEK") }
    var kind by rememberSaveable { mutableStateOf("") }
    var scope by rememberSaveable { mutableStateOf("GLOBAL") }
    val types = listOf("ACTIVITY", "SUPPORT", "LONGEST")
    LaunchedEffect(category, prior, window, kind, scope) { load(types[category], prior, window, kind, scope) }
    Column {
        TabRow(selectedTabIndex = category) {
            listOf("Activity", "Gift support", "Longest").forEachIndexed { index, title ->
                Tab(selected = category == index, onClick = { category = index }, enabled = !busy, text = { Text(title) })
            }
        }
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Previous period", Modifier.weight(1f))
            Switch(checked = prior, onCheckedChange = { prior = it }, enabled = !busy)
        }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("WEEK" to "Week", "MONTH" to "Month", "SEASON" to "Season").forEach { (id, label) ->
                FilterChip(selected = window == id, onClick = { window = id }, enabled = !busy, label = { Text(label) })
            }
        }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("" to "All", "BESTIE" to "Bestie", "SOULMATE" to "Soulmate").forEach { (id, label) ->
                FilterChip(selected = kind == id, onClick = { kind = id }, enabled = !busy, label = { Text(label) })
            }
        }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("GLOBAL" to "Global", "FRIENDS" to "Friends", "COMMUNITY" to "Community").forEach { (id, label) ->
                FilterChip(selected = scope == id, onClick = { scope = id }, enabled = !busy, label = { Text(label) })
            }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
            item {
                BondSection(if (prior) "Finalized ranking" else "Current ranking") {
                    Text(if (category == 1) "Confirmed gift support, measured in coins." else if (category == 2) "Days together for public, opted-in bonds." else "Points from shared check-ins.")
                    if (!prior && data != null) Text("Resets ${timeOfReset(data.resetsAt)}")
                    if (scope != "GLOBAL") Text("Shows global positions for people in your ${if (scope == "FRIENDS") "friends list" else "clan"}.")
                    if (data?.entries.isNullOrEmpty() && !busy) Text("No eligible bonds in this period.")
                }
            }
            items(data?.entries.orEmpty(), key = { it.rank }) { rank ->
                BondSection("#${rank.rank} · ${rank.names.joinToString(" & ")}") { Text("${rank.score} ${if (category == 2) "days" else if (category == 1) "coins" else "points"}") }
            }
        }
    }
}


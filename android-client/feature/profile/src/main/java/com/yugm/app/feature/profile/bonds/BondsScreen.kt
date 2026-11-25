package com.yugm.app.feature.profile.bonds

import com.yugm.app.core.ui.components.YugmTopBar

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.yugm.app.core.api.AppSync
import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.api.runAutomaticSync
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.BrandEnd
import com.yugm.app.core.ui.theme.BrandGradients
import com.yugm.app.core.ui.theme.BrandMiddle
import com.yugm.app.core.ui.theme.BrandStart
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.OnBrand
import com.yugm.app.core.ui.theme.YugmColors
import com.yugm.app.feature.profile.R
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import com.yugm.app.core.ui.components.YugmLoadingSpinner

private enum class BondsPage { Home, Center, Detail, Rankings }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun BondsScreen(
    token: String, initialPartner: String, initialCenter: Boolean, onBack: () -> Unit,
    onProfile: (String) -> Unit, onChat: (String) -> Unit, onCall: (String, Boolean) -> Unit,
    onBackpack: () -> Unit
) {
    val viewModel: BondsViewModel = hiltViewModel()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var page by rememberSaveable { mutableStateOf(if (initialCenter) BondsPage.Center else BondsPage.Home) }
    var selectedBond by rememberSaveable { mutableStateOf<String?>(null) }
    var inviteSlot by rememberSaveable { mutableIntStateOf(0) }
    var targetHandled by rememberSaveable { mutableStateOf(false) }
    var help by rememberSaveable { mutableStateOf(false) }
    var celebration by rememberSaveable { mutableStateOf<String?>(null) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(lifecycle, token, selectedBond, page) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            runAutomaticSync(AppSync.changes(setOf(SyncTopic.BONDS)), 60_000, { token.isNotBlank() }, { viewModel.state.value.busy }) {
                viewModel.refresh(token, selectedBond.takeIf { page == BondsPage.Detail })
            }
        }
    }
    val home = state.home
    LaunchedEffect(home, initialPartner) {
        if (home == null || targetHandled || initialPartner.isBlank()) return@LaunchedEffect
        targetHandled = true
        val existing = home.active.firstOrNull { it.partner.id == initialPartner }
        if (existing != null) {
            selectedBond = existing.id
            page = BondsPage.Detail
        } else if (home.requests.any { it.partner.id == initialPartner }) {
            page = BondsPage.Center
        } else {
            val available = (1..home.capacity).firstOrNull { index ->
                home.active.none { it.slot == index } && home.requests.none { !it.incoming && it.slot == index }
            }
            if (available != null && home.eligible) {
                inviteSlot = available
                viewModel.loadCatalog(token, includeFriends = true)
            }
        }
    }
    val back = {
        if (page == BondsPage.Home || (page == BondsPage.Center && initialCenter)) onBack()
        else {
            page = BondsPage.Home
            selectedBond = null
        }
    }
    val openBond: (BondCard) -> Unit = { selectedBond = it.id; page = BondsPage.Detail }
    BackHandler(onBack = back)
    Scaffold(
        topBar = {
            YugmTopBar(
                title = stringResource(when (page) {
                    BondsPage.Center -> R.string.bonds_center
                    BondsPage.Rankings -> R.string.bonds_rankings
                    else -> R.string.bonds_title
                }),
                onBack = back,
                actions = {
                    IconButton(onClick = { help = true }) { Icon(Icons.Default.HelpOutline, stringResource(R.string.bonds_help)) }
                    if (page == BondsPage.Home) {
                        IconButton(onClick = { page = BondsPage.Center }) {
                            BadgedBox(badge = {
                                val count = home?.requests?.count { it.incoming } ?: 0
                                if (count > 0) Badge { Text(count.toString()) }
                            }) { Icon(Icons.Default.Inbox, stringResource(R.string.bonds_center)) }
                        }
                    }
                },
            )
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            if (home == null) {
                Column(Modifier.align(Alignment.Center).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    if (state.error == null) YugmLoadingSpinner(size = 40.dp)
                    else {
                        Text(state.error.orEmpty())
                        TextButton(onClick = { viewModel.clearError(); AppSync.invalidate(SyncTopic.BONDS) }) { Text("Try again") }
                    }
                }
            } else when (page) {
                BondsPage.Home -> BondsDashboard(home, state.gifts, state.busy, openBond, { index ->
                    inviteSlot = index
                    viewModel.loadCatalog(token, includeFriends = true)
                }, { page = BondsPage.Center }, {
                    page = BondsPage.Rankings
                }, { viewModel.loadCatalog(token, includeFriends = false) }, onBackpack, { field, enabled ->
                    viewModel.mutate(token, "/invitation-settings", JSONObject().put(field, enabled), "PUT")
                })
                BondsPage.Center -> BondCenter(home, state.busy, openBond, { page = BondsPage.Home }, onProfile) { request, action ->
                    viewModel.mutate(token, "/invitations/${request.id}/$action") { result ->
                        if (action == "accept" && result.optString("status") == "ACCEPTED") {
                            selectedBond = result.optString("bondId").takeIf { it.isNotBlank() }
                            celebration = request.partner.name
                        } else if (action == "accept") {
                            celebration = ""
                        }
                    }
                }
                BondsPage.Detail -> {
                    val detail = state.detail?.takeIf { it.card.id == selectedBond }
                    if (detail != null) BondDetailsScreen(detail, home, state, token, viewModel, onProfile, onChat, onCall)
                    else YugmLoadingSpinner(size = 40.dp, modifier = Modifier.align(Alignment.Center))
                }
                BondsPage.Rankings -> BondRankings(state.ranking, state.busy) { category, previous, window, kind, scope ->
                    viewModel.rankings(token, category, previous, window, kind, scope)
                }
            }
        }
    }

    if (inviteSlot != 0 && home != null) {
        BondInviteSheet(home, state, inviteSlot, initialPartner, onDismiss = { inviteSlot = 0 }) { body ->
            viewModel.mutate(token, "/invitations", body) {
                inviteSlot = 0
                page = BondsPage.Center
            }
        }
    }
    if (help) AlertDialog(onDismissRequest = { help = false }, title = { Text(stringResource(R.string.bonds_help)) },
        text = { Text("Choose Bestie or Soulmate with an accepted friend. A request expires after ${home?.hours ?: 24} hours and only becomes a bond after acceptance. Coins held for an unaccepted gift are returned. Bonds start private and either person can end one freely. Both people can check in once a day to earn shared points.") },
        confirmButton = { TextButton(onClick = { help = false }) { Text("Done") } })
    celebration?.let { name ->
        AlertDialog(onDismissRequest = { celebration = null }, icon = { Icon(Icons.Default.FavoriteBorder, null) },
            title = { Text(if (name.isBlank()) "Request closed" else "You and $name are connected") },
            text = { Text(if (name.isBlank()) "This request is no longer available." else "Your bond is private until you both choose to share it.") },
            confirmButton = { TextButton(onClick = { celebration = null; if (name.isNotBlank()) page = BondsPage.Detail }) {
                Text(if (name.isBlank()) "Done" else "View bond")
            } })
    }
    if (home != null && state.error != null) {
        AlertDialog(onDismissRequest = viewModel::clearError, title = { Text("Bonds") },
            text = { Text(state.error.orEmpty()) }, confirmButton = { TextButton(onClick = viewModel::clearError) { Text("OK") } })
    }
}

@Composable
private fun BondsDashboard(
    home: BondsHome, gifts: List<BondGift>, busy: Boolean, onBond: (BondCard) -> Unit, onInvite: (Int) -> Unit,
    onCenter: () -> Unit, onRankings: () -> Unit, onGifts: () -> Unit, onBackpack: () -> Unit,
    onSetting: (String, Boolean) -> Unit
) {
    val colors = LocalYugmColors.current
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(210.dp)) {
                Image(painterResource(R.drawable.bonds_garden), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Transparent, colors.background.copy(alpha = 0.9f)))))
                Column(Modifier.align(Alignment.BottomStart).padding(22.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(stringResource(R.string.bonds_title), color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("${home.active.size} of ${home.capacity} slots active", color = colors.textSecondary, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!home.eligible) Text("A profile age of 18 or older is required to invite friends.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                (1..home.capacity).chunked(3).forEach { slots ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        slots.forEach { index ->
                            val active = home.active.firstOrNull { it.slot == index }
                            val pending = home.requests.firstOrNull { it.slot == index && !it.incoming && !it.typeChange }
                            SlotCard(active, pending, index, home.eligible, Modifier.weight(1f)) {
                                when {
                                    active != null -> onBond(active)
                                    pending != null -> onCenter()
                                    else -> onInvite(index)
                                }
                            }
                        }
                        repeat(3 - slots.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        if (home.active.isNotEmpty()) item {
            BondSection("Shared milestones") {
                home.active.forEach { bond ->
                    ListItem(
                        headlineContent = { Text(bond.partner.name) },
                        supportingContent = { Text(if (bond.milestones.isEmpty()) "First milestone after 1 day" else bond.milestones.joinToString { "$it days" }) },
                        trailingContent = { Icon(Icons.Default.Star, null) },
                        modifier = Modifier.clickable { onBond(bond) }
                    )
                }
            }
        }
        item {
            BondSection("Bond gifts") {
                val featured = gifts.filter { it.purpose != "INVITATION" }.take(3)
                if (featured.isEmpty()) TextButton(onClick = onGifts, enabled = !busy) { Text("Browse gifts") }
                featured.forEach { gift ->
                    ListItem(headlineContent = { Text(gift.name) }, leadingContent = { Text(gift.icon) },
                        trailingContent = { Text("${gift.price} coins") },
                        supportingContent = { Text(if (gift.days > 0) "Unlocks after ${gift.days} days" else "+${gift.points} bond points") })
                }
            }
        }
        item {
            BondSection("Manage") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Receive bond invitations", Modifier.weight(1f))
                    Switch(checked = home.allowsRequests, onCheckedChange = { onSetting("enabled", it) }, enabled = !busy)
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Bond push notifications", Modifier.weight(1f))
                    Switch(checked = home.pushEnabled, onCheckedChange = { onSetting("push", it) }, enabled = !busy)
                }
                TextButton(onClick = onCenter) { Text(stringResource(R.string.bonds_center)) }
                TextButton(onClick = onRankings) { Text(stringResource(R.string.bonds_rankings)) }
                TextButton(onClick = onBackpack) { Text("Rewards in Backpack") }
            }
        }
    }
}

@Composable
private fun SlotCard(active: BondCard?, pending: BondInvitation?, slot: Int, eligible: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val colors = LocalYugmColors.current
    val shape = RoundedCornerShape(18.dp)
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .height(148.dp)
            .clip(shape)
            .background(BrandGradients.subtleTint)
            .border(1.dp, colors.border, shape)
            .clickable(
                interactionSource = interactionSource,
                role = Role.Button,
                enabled = eligible || active != null || pending != null,
                onClick = onClick
            )
            .padding(vertical = 12.dp, horizontal = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                active?.kindName ?: if (pending != null) "Pending" else "Slot $slot",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = colors.textPrimary
            )
            Spacer(Modifier.height(6.dp))
            val person = active?.partner ?: pending?.partner
            if (person != null) {
                BondAvatar(person, 46)
            } else {
                Box(
                    Modifier.size(46.dp).clip(CircleShape).background(colors.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.FavoriteBorder, null, tint = colors.primary)
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                person?.name ?: "Available",
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = colors.textSecondary
            )
            Spacer(Modifier.height(2.dp))
            if (active != null) {
                Text("${active.days}d · Lv ${active.level}", style = MaterialTheme.typography.labelSmall, color = colors.textSecondary)
            } else if (pending != null) {
                Text(bondExpiry(pending.expiresAt), style = MaterialTheme.typography.labelSmall, color = colors.textSecondary)
            } else {
                Text(stringResource(R.string.bonds_invite), style = MaterialTheme.typography.labelSmall, color = colors.primary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun BondSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    val colors = LocalYugmColors.current
    Surface(Modifier.padding(horizontal = 16.dp).fillMaxWidth(), color = colors.surface,
        shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, colors.border)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = colors.textPrimary)
            content()
        }
    }
}

@Composable
internal fun BondAvatar(person: BondPerson, size: Int = 48) {
    Avatar(person.name.take(1), size, person.avatar, avatarType = person.avatarType, avatarParts = person.avatarParts)
}

private fun localTime(iso: String): Long? = runCatching {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(iso)?.time
}.getOrNull()

@Composable
internal fun bondExpiry(iso: String): String {
    val end = remember(iso) { localTime(iso) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(end) { while (end != null && now < end) { delay(30_000); now = System.currentTimeMillis() } }
    val minutes = ((end ?: now) - now) / 60_000
    return when {
        end == null -> ""
        minutes <= 0 -> "Expiring"
        minutes >= 60 -> "${minutes / 60}h ${minutes % 60}m left"
        else -> "${minutes}m left"
    }
}

internal fun bondDate(iso: String): String = localTime(iso)?.let {
    java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM).format(it)
}.orEmpty()

internal fun timeOfReset(iso: String): String = localTime(iso)?.let {
    java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.MEDIUM, java.text.DateFormat.SHORT).format(it)
}.orEmpty()

@Composable
internal fun ProfileBondsSection(
    token: String,
    userId: String,
    own: Boolean,
    onManage: (String) -> Unit,
    onProfile: (String) -> Unit
) {
    var home by remember(token, userId, own) { mutableStateOf<BondsHome?>(null) }
    var showcase by remember(token, userId, own) { mutableStateOf<BondsShowcase?>(null) }
    var error by remember(token, userId, own) { mutableStateOf<String?>(null) }
    var loading by remember(token, userId, own) { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        loading = true
        try {
            if (own) home = BondsApi.home(token) else showcase = BondsApi.showcase(token, userId)
            error = null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            error = failure.message?.takeIf { it.isNotBlank() } ?: "Couldn't load Bonds"
        } finally {
            loading = false
        }
    }

    LaunchedEffect(token, userId, own) {
        AppSync.changes(setOf(SyncTopic.BONDS, SyncTopic.PROFILE)).collect { load() }
    }
    val retry = {
        scope.launch { load() }
        Unit
    }

    val title = stringResource(R.string.bonds_profile_section)
    if (own) {
        OwnBondsSection(home, error, loading, retry, onManage)
    } else {
        val data = showcase
        when {
            data == null && error != null -> ProfileBondSectionCard(title) {
                BondsLoadError(error.orEmpty(), retry)
            }
            data == null -> ProfileBondSectionCard(title) { BondsLoading() }
            data.bonds.isEmpty() && !data.canInvite -> Unit
            else -> ProfileBondSectionCard(title) {
                data.bonds.forEach { bond ->
                    ListItem(headlineContent = { Text(bond.partner.name) },
                        supportingContent = { Text(listOfNotNull(bond.kind, bond.days?.let { "$it days" }, bond.level?.let { "Level $it" },
                            bond.weeklyRank?.let { "Weekly #$it" }).joinToString(" · ")) },
                        leadingContent = { BondAvatar(bond.partner, 38) },
                        trailingContent = if (bond.showBadge) {{ Icon(Icons.Default.FavoriteBorder, "${bond.kind} badge", tint = MaterialTheme.colorScheme.primary) }} else null,
                        modifier = Modifier.clickable { onProfile(bond.partner.id) })
                }
                if (data.canInvite) {
                    TextButton(
                        onClick = { onManage(userId) },
                        colors = ButtonDefaults.textButtonColors(contentColor = LocalYugmColors.current.primary)
                    ) {
                        Text("Invite to Bonds")
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileBondSectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
        Text(title, color = LocalYugmColors.current.textPrimary,
            fontWeight = FontWeight.Bold, fontSize = 17.sp)
        content()
    }
}

@Composable
private fun OwnBondsSection(
    home: BondsHome?,
    error: String?,
    loading: Boolean,
    onRetry: () -> Unit,
    onManage: (String) -> Unit
) {
    val colors = LocalYugmColors.current
    val sectionTitle = stringResource(R.string.bonds_profile_section)
    if (home == null) {
        ProfileBondSectionCard(sectionTitle) {
            if (error != null) BondsLoadError(error, onRetry) else BondsLoading()
        }
        return
    }
    val slots = profileBondSlots(home.active, home.requests, home.capacity)
    val count = activeBondCount(slots)
    val hasAny = slots.any { it !is ProfileBondSlot.Empty }

    if (!hasAny && error == null) {
        BondsEmptyCard(count, home.capacity, onAdd = { onManage("") })
        return
    }

    GlassCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(sectionTitle, modifier = Modifier.weight(1f), color = colors.textPrimary,
                fontWeight = FontWeight.Bold, fontSize = 17.sp)
            BondCountPill(count, home.capacity, colors)
            if (hasAny) {
                Spacer(Modifier.width(2.dp))
                TextButton(onClick = { onManage("") }, contentPadding = PaddingValues(horizontal = 8.dp),
                    modifier = Modifier.heightIn(min = 40.dp)) {
                    Text(stringResource(R.string.bonds_manage), color = colors.primary,
                        fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        if (error != null) {
            BondsLoadError(error, onRetry)
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                slots.forEachIndexed { _, slot ->
                    ProfileBondSlotCard(
                        slot = slot,
                        modifier = Modifier.weight(1f),
                        colors = colors,
                        onClick = {
                            when (slot) {
                                is ProfileBondSlot.Active -> onManage(slot.bond.partner.id)
                                is ProfileBondSlot.Pending -> onManage(slot.request.partner.id)
                                is ProfileBondSlot.Empty -> onManage("")
                            }
                        }
                    )
                }
            }
            if (loading) {
                Spacer(Modifier.height(8.dp))
                BondsLoading()
            }
        }
    }
}

@Composable
private fun ProfileBondSlotCard(
    slot: ProfileBondSlot,
    modifier: Modifier,
    colors: YugmColors,
    onClick: () -> Unit
) {
    val person = when (slot) {
        is ProfileBondSlot.Active -> slot.bond.partner
        is ProfileBondSlot.Pending -> slot.request.partner
        is ProfileBondSlot.Empty -> null
    }
    val shape = RoundedCornerShape(15.dp)
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .height(132.dp)
            .clip(shape)
            .background(BrandGradients.subtleTint)
            .border(1.dp, colors.border.copy(alpha = 0.55f), shape)
            .clickable(
                interactionSource = interactionSource,
                role = Role.Button,
                onClick = onClick
            )
            .padding(horizontal = 6.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            if (person != null) {
                BondAvatar(person, 50)
            } else {
                Box(
                    Modifier.size(50.dp).clip(CircleShape).background(colors.primary.copy(alpha = 0.10f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Add, null, tint = colors.primary, modifier = Modifier.size(22.dp))
                }
            }
            Spacer(Modifier.height(7.dp))
            Text(
                when (slot) {
                    is ProfileBondSlot.Active -> slot.bond.kindName.ifBlank { "Bond" }
                    is ProfileBondSlot.Pending -> stringResource(if (slot.request.incoming) R.string.bonds_request_received else R.string.bonds_request_sent)
                    ProfileBondSlot.Empty -> stringResource(R.string.bonds_add)
                },
                color = colors.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(3.dp))
            Text(
                when (slot) {
                    is ProfileBondSlot.Active -> "${slot.bond.days} days · Lv ${slot.bond.level}"
                    is ProfileBondSlot.Pending -> bondExpiry(slot.request.expiresAt)
                    ProfileBondSlot.Empty -> ""
                },
                color = colors.textSecondary, fontSize = 10.sp, maxLines = 1,
                overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun BondsEmptyCard(count: Int, capacity: Int, onAdd: () -> Unit) {
    val colors = LocalYugmColors.current
    val sectionTitle = stringResource(R.string.bonds_profile_section)
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        cornerRadius = 18.dp,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(sectionTitle, color = colors.textPrimary,
                        fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(Modifier.width(8.dp))
                    Text("$count/$capacity", color = colors.textSecondary,
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.bonds_profile_empty), color = colors.textSecondary,
                    fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(12.dp))
            Button(
                onClick = onAdd,
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color.Transparent),
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(BrandGradients.horizontal)
            ) {
                Icon(Icons.Default.Add, null, tint = OnBrand, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.bonds_add), color = OnBrand, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun BondCountPill(count: Int, capacity: Int, colors: YugmColors) {
    Surface(shape = RoundedCornerShape(50), color = colors.primary.copy(alpha = 0.10f),
        border = BorderStroke(1.dp, colors.primary.copy(alpha = 0.18f))) {
        Text("$count/$capacity", modifier = Modifier.padding(horizontal = 9.dp, vertical = 3.dp),
            color = colors.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun BondsLoading() {
    val colors = LocalYugmColors.current
    Row(Modifier.fillMaxWidth().heightIn(min = 100.dp), horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically) {
        YugmLoadingSpinner(size = 22.dp)
        Spacer(Modifier.width(8.dp))
        Text("Loading Bonds…", color = colors.textSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun BondsLoadError(message: String, onRetry: () -> Unit) {
    val colors = LocalYugmColors.current
    Column(Modifier.fillMaxWidth().heightIn(min = 100.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(message, color = colors.textSecondary, fontSize = 12.sp, textAlign = TextAlign.Center,
            maxLines = 3, overflow = TextOverflow.Ellipsis)
        TextButton(onRetry) { Text(stringResource(R.string.bonds_try_again), color = colors.primary, fontSize = 12.sp) }
    }
}


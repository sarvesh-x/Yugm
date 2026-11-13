package com.yugm.app.feature.room.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.BeachAccess
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ColorLens
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.room.viewmodel.RoomViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun CreateRoomScreen(
    token: String,
    host: Host,
    onBack: () -> Unit,
    onCreate: (Room, Boolean, String, Boolean, String?, (String) -> Unit) -> Unit,
    viewModel: RoomViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("Voice") }
    var language by rememberSaveable { mutableStateOf("English") }
    var type by rememberSaveable { mutableStateOf(RoomType.Voice) }
    var maxSpeakers by rememberSaveable { mutableStateOf(8) }
    var tags by rememberSaveable { mutableStateOf<List<String>>(emptyList()) }
    var coverUri by remember { mutableStateOf<Uri?>(null) }
    var isPublic by rememberSaveable { mutableStateOf(true) }
    var allowMicRequests by rememberSaveable { mutableStateOf(true) }
    var scheduleLater by rememberSaveable { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var cosmeticCatalog by remember { mutableStateOf<com.yugm.app.core.model.CosmeticCatalog?>(null) }
    var selectedTheme by remember { mutableStateOf("") }
    var selectedBadge by remember { mutableStateOf("") }
    var selectedAmbience by remember { mutableStateOf("") }
    var vipOnly by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(token) {
        viewModel.loadCosmetics(token)
    }
    LaunchedEffect(viewModel.cosmeticCatalog) {
        cosmeticCatalog = viewModel.cosmeticCatalog
    }

    val catalog = cosmeticCatalog
    val ownedThemes = catalog?.cosmetics?.filter {
        it.type == "ROOM_THEME" && catalog.ownedCosmeticIds.contains(it.id)
    } ?: emptyList()
    val ownedBadges = catalog?.cosmetics?.filter {
        it.type == "ROOM_BADGE" && catalog.ownedCosmeticIds.contains(it.id)
    } ?: emptyList()
    val ownedAmbiences = catalog?.cosmetics?.filter {
        it.type == "ROOM_AMBIENCE" && catalog.ownedCosmeticIds.contains(it.id)
    } ?: emptyList()

    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) coverUri = uri
    }
    val categories = listOf(
        "Voice" to Icons.Filled.Mic,
        "Music" to Icons.Filled.MusicNote,
        "Gaming" to Icons.Filled.SportsEsports,
        "Chill" to Icons.Filled.BeachAccess,
        "Dating" to Icons.Filled.Favorite,
        "Learning" to Icons.Filled.School
    )
    val languages = listOf("English", "Hindi", "Tamil", "Telugu", "Punjabi")
    val suggestedTags = listOf("Deep Talks", "Late Night", "Good Vibes", "New People", "Music Lovers")

    fun submit() {
        if (title.isBlank() || description.isBlank() || submitting) {
            if (title.isBlank() || description.isBlank()) error = "Add a room title and topic first."
            return
        }
        submitting = true
        error = ""
        scope.launch {
            val uploadedCover = coverUri?.let { uri ->
                runCatching {
                    withContext(Dispatchers.IO) {
                        val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("Could not read selected image")
                        require(bytes.size <= 5 * 1024 * 1024) { "Cover image must be 5 MB or smaller" }
                        viewModel.uploadCoverSuspend(token, bytes, mime, "room-cover.${mime.substringAfter('/', "jpg")}")
                    }
                }.getOrElse {
                    error = it.message ?: "Cover upload failed"
                    submitting = false
                    return@launch
                }
            }
            onCreate(
                Room(
                    title = title.trim(),
                    description = description.trim(),
                    bio = description.trim(),
                    type = type,
                    category = category,
                    language = language,
                    maxSpeakers = maxSpeakers,
                    tags = tags,
                    host = host,
                    theme = selectedTheme,
                    badge = selectedBadge,
                    ambience = selectedAmbience,
                    vipOnly = vipOnly
                ),
                scheduleLater,
                if (isPublic) "PUBLIC" else "PRIVATE",
                allowMicRequests,
                uploadedCover
            ) { message ->
                error = message
                submitting = false
            }
        }
    }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Create Room", "Start a conversation that matters.", onBack = onBack)
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    RoomTypeSelector(type = type) { type = it }
                }
                item {
                    Row(
                        Modifier.fillMaxWidth().height(142.dp).clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp)).padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.width(124.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("Room cover", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 15.sp)
                            Text("Optional · up to 5 MB", color = TextMuted, fontSize = 10.sp, lineHeight = 14.sp)
                            RoomCoverButton(label = if (coverUri == null) "Choose image" else "Change image") {
                                coverPicker.launch("image/*")
                            }
                        }
                        Box(Modifier.weight(1f).height(112.dp).clip(RoundedCornerShape(17.dp)).clickable { coverPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                            if (coverUri != null) {
                                AsyncImage(coverUri, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                            } else {
                                Box(Modifier.fillMaxSize().background(Color(0xFF1A1A2E)), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Filled.AddPhotoAlternate, contentDescription = null, tint = TextMuted.copy(alpha = 0.8f), modifier = Modifier.size(34.dp))
                                }
                            }
                            Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(34.dp).clip(CircleShape).background(Background.copy(alpha = 0.8f)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.Edit, contentDescription = "Choose room cover", tint = Color.White, modifier = Modifier.size(17.dp))
                            }
                        }
                    }
                }
                item { RoomTextBlock("Room Title", true, title, 60, "Late Night Talks ✨") { title = it.take(60) } }
                item { RoomTextBlock("Room Bio / Topic", true, description, 180, "Deep conversations, good vibes and new people.", singleLine = false) { description = it.take(180) } }
                item {
                    ChoiceBlock("Category", required = true) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            categories.forEach { (label, icon) ->
                                RoomChoiceChip(label, icon = icon, selected = category == label) { category = label }
                            }
                        }
                    }
                }
                item {
                    ChoiceBlock("Language", required = true) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            languages.forEach { label ->
                                RoomChoiceChip(label, icon = if (label == "English") Icons.Filled.Language else null, selected = language == label) { language = label }
                            }
                        }
                    }
                }
                item {
                    ChoiceBlock("Tags", subtitle = "Optional") {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            suggestedTags.forEach { tag ->
                                RoomChoiceChip(tag, icon = if (tag in tags) Icons.Filled.Check else Icons.Filled.Add, selected = tag in tags) {
                                    tags = if (tag in tags) tags - tag else tags + tag
                                }
                            }
                        }
                    }
                }
                item {
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp))) {
                        SettingRow(Icons.Filled.Public, "Room Privacy", "Choose who can join your room") {
                            RoomChoiceChip(if (isPublic) "Public" else "Private", icon = if (isPublic) Icons.Filled.Public else Icons.Filled.Lock, selected = !isPublic) { isPublic = !isPublic }
                        }
                        DividerLine()
                        SettingRow(Icons.Filled.Groups, "Max Speakers", "Maximum number of speakers") {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                StepperButton("−", "Decrease speaker limit") { maxSpeakers = (maxSpeakers - 1).coerceAtLeast(2) }
                                Text(maxSpeakers.toString(), color = TextPrimary, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 13.dp))
                                StepperButton("+", "Increase speaker limit") { maxSpeakers = (maxSpeakers + 1).coerceAtMost(20) }
                            }
                        }
                        DividerLine()
                        SettingRow(Icons.Filled.Mic, "Allow Speaker Requests", "Let listeners request to speak") {
                            Switch(
                                checked = allowMicRequests,
                                onCheckedChange = { allowMicRequests = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Pink)
                            )
                        }
                        DividerLine()
                        SettingRow(Icons.Filled.Schedule, "Schedule Later", "Start this room in one hour") {
                            Switch(
                                checked = scheduleLater,
                                onCheckedChange = { scheduleLater = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Pink)
                            )
                        }
                        DividerLine()
                        SettingRow(Icons.Filled.WorkspacePremium, "VIP Only Room", "Only VIP members can join") {
                            Switch(
                                checked = vipOnly,
                                onCheckedChange = { vipOnly = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Gold)
                            )
                        }
                    }
                }
                if (ownedThemes.isNotEmpty()) {
                    item {
                        ChoiceBlock("Room Theme", subtitle = "Premium") {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ownedThemes.forEach { cosmetic ->
                                    RoomChoiceChip(cosmetic.name, icon = if (selectedTheme == cosmetic.id) Icons.Filled.Check else Icons.Filled.ColorLens, selected = selectedTheme == cosmetic.id) {
                                        selectedTheme = if (selectedTheme == cosmetic.id) "" else cosmetic.id
                                    }
                                }
                            }
                        }
                    }
                }
                if (ownedBadges.isNotEmpty()) {
                    item {
                        ChoiceBlock("Room Badge", subtitle = "Premium") {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ownedBadges.forEach { cosmetic ->
                                    RoomChoiceChip(cosmetic.name, icon = if (selectedBadge == cosmetic.id) Icons.Filled.Check else Icons.Filled.WorkspacePremium, selected = selectedBadge == cosmetic.id) {
                                        selectedBadge = if (selectedBadge == cosmetic.id) "" else cosmetic.id
                                    }
                                }
                            }
                        }
                    }
                }
                if (ownedAmbiences.isNotEmpty()) {
                    item {
                        ChoiceBlock("Room Ambience", subtitle = "Premium") {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ownedAmbiences.forEach { cosmetic ->
                                    RoomChoiceChip(cosmetic.name, icon = if (selectedAmbience == cosmetic.id) Icons.Filled.Check else Icons.Filled.MusicNote, selected = selectedAmbience == cosmetic.id) {
                                        selectedAmbience = if (selectedAmbience == cosmetic.id) "" else cosmetic.id
                                    }
                                }
                            }
                        }
                    }
                }
                if (error.isNotBlank()) item { Text(error, color = Pink, fontSize = 12.sp) }
                item { Spacer(Modifier.height(4.dp)) }
            }
            GradientAction(
                label = if (submitting) "Preparing room…" else if (scheduleLater) "Schedule Room" else "Go Live",
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp),
                onClick = ::submit
            )
        }
    }
}

@Composable
internal fun RoomTextBlock(label: String, required: Boolean, value: String, maxLength: Int, placeholder: String, singleLine: Boolean = true, onValueChange: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(20.dp)).padding(16.dp)) {
        Row {
            Text(label, color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            if (required) Text("  •", color = Pink)
            Spacer(Modifier.weight(1f))
            Text("${value.length}/$maxLength", color = TextMuted, fontSize = 10.sp)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(Pink),
            modifier = Modifier.fillMaxWidth().padding(top = 9.dp),
            decorationBox = { inner -> if (value.isBlank()) Text(placeholder, color = TextMuted, fontSize = 14.sp) else inner() }
        )
    }
}

@Composable
internal fun ChoiceBlock(title: String, required: Boolean = false, subtitle: String = "", content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(20.dp)).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            val helper = when {
                required -> "Required"
                subtitle.isNotBlank() -> subtitle
                else -> ""
            }
            if (helper.isNotBlank()) {
                Text(helper, color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Medium)
            }
        }
        Box(Modifier.padding(top = 12.dp)) { content() }
    }
}

@Composable
internal fun SettingRow(icon: ImageVector, title: String, subtitle: String, trailing: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            Modifier.size(34.dp).clip(CircleShape).background(PrimaryPurple.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Pink, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, color = TextMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing()
    }
}

@Composable
private fun RoomTypeSelector(type: RoomType, onSelected: (RoomType) -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(58.dp).clip(RoundedCornerShape(18.dp))
            .background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(5.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        listOf(
            Triple(RoomType.Voice, "Voice", Icons.Filled.Mic),
            Triple(RoomType.Video, "Video", Icons.Filled.Videocam)
        ).forEach { (roomType, label, icon) ->
            val selected = type == roomType
            Row(
                Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(14.dp))
                    .background(if (selected) Brush.horizontalGradient(listOf(PrimaryPurple, Pink)) else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent)))
                    .selectable(selected = selected, role = Role.Tab) { onSelected(roomType) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(icon, contentDescription = null, tint = if (selected) Color.White else TextMuted, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp))
                Text(label, color = if (selected) Color.White else TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun RoomChoiceChip(
    label: String,
    icon: ImageVector? = null,
    selected: Boolean,
    onClick: () -> Unit
) {
    val shape = RoundedCornerShape(13.dp)
    Row(
        Modifier.height(42.dp).clip(shape)
            .background(if (selected) PrimaryPurple.copy(alpha = 0.28f) else Background.copy(alpha = 0.42f))
            .border(1.dp, if (selected) Pink.copy(alpha = 0.9f) else BorderColor, shape)
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = if (selected) Pink else TextMuted, modifier = Modifier.size(15.dp))
        Text(label, color = TextPrimary, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

@Composable
private fun RoomCoverButton(label: String, onClick: () -> Unit) {
    Row(
        Modifier.height(38.dp).clip(RoundedCornerShape(12.dp))
            .background(PrimaryPurple.copy(alpha = 0.2f))
            .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(Icons.Filled.CameraAlt, contentDescription = null, tint = Pink, modifier = Modifier.size(16.dp))
        Text(label, color = TextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
internal fun StepperButton(text: String, accessibilityLabel: String, onClick: () -> Unit) {
    Box(Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).clip(RoundedCornerShape(10.dp)).background(Background.copy(alpha = 0.7f)).border(1.dp, BorderColor, RoundedCornerShape(10.dp)).semantics { contentDescription = accessibilityLabel }.clickable(role = Role.Button, onClickLabel = accessibilityLabel, onClick = onClick), contentAlignment = Alignment.Center) {
        Text(text, color = TextPrimary, fontSize = 18.sp)
    }
}

@Composable
internal fun DividerLine() = Box(Modifier.fillMaxWidth().height(1.dp).background(BorderColor))

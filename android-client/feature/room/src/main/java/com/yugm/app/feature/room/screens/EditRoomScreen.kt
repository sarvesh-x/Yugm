package com.yugm.app.feature.room.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Room
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.ReferenceChip
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.room.viewmodel.RoomViewModel
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun EditRoomScreen(
    token: String,
    room: Room,
    host: Host,
    onBack: () -> Unit,
    onUpdate: (Room) -> Unit,
    viewModel: RoomViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by rememberSaveable { mutableStateOf(room.title) }
    var description by rememberSaveable { mutableStateOf(room.description) }
    var category by rememberSaveable { mutableStateOf(room.category.ifBlank { "Voice" }) }
    var language by rememberSaveable { mutableStateOf(room.language.ifBlank { "English" }) }
    var maxSpeakers by rememberSaveable(room.id) { mutableStateOf(room.maxSpeakers.coerceIn(2, 20)) }
    var tags by rememberSaveable { mutableStateOf(room.tags) }
    var coverUri by remember { mutableStateOf<Uri?>(null) }
    var isPublic by rememberSaveable { mutableStateOf(room.status != "PRIVATE") }
    var allowMicRequests by rememberSaveable { mutableStateOf(true) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var cosmeticCatalog by remember { mutableStateOf<com.yugm.app.core.model.CosmeticCatalog?>(null) }
    var selectedTheme by remember { mutableStateOf(room.theme) }
    var selectedBadge by remember { mutableStateOf(room.badge) }
    var selectedAmbience by remember { mutableStateOf(room.ambience) }
    var vipOnly by rememberSaveable { mutableStateOf(room.vipOnly) }

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
    val categories = listOf("Voice" to "◖", "Music" to "♪", "Gaming" to "◆", "Chill" to "●●", "Dating" to "♡", "Learning" to "▰")
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
            submitting = false
            onUpdate(
                room.copy(
                    title = title.trim(),
                    description = description.trim(),
                    bio = description.trim(),
                    category = category,
                    language = language,
                    maxSpeakers = maxSpeakers,
                    tags = tags,
                    theme = selectedTheme,
                    badge = selectedBadge,
                    ambience = selectedAmbience,
                    vipOnly = vipOnly,
                    coverImage = uploadedCover ?: room.coverImage
                )
            )
        }
    }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Edit Room", "Update your room details.", onBack = onBack)
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                item {
                    // Room Avatar / Cover Picker & Unique ID
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(SurfaceElevated)
                            .border(1.dp, BorderColor, RoundedCornerShape(18.dp))
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF28243A))
                                .border(1.dp, Gold, RoundedCornerShape(14.dp))
                                .clickable { coverPicker.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            if (coverUri != null) {
                                AsyncImage(
                                    model = coverUri,
                                    contentDescription = "Room Avatar",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else if (!room.coverImage.isNullOrBlank()) {
                                AsyncImage(
                                    model = room.coverImage,
                                    contentDescription = "Room Avatar",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("📷", fontSize = 20.sp)
                                    Text("Avatar", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text("Room Avatar & Unique ID", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("ID: ${room.id.takeLast(8)}", color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
                            Text("Tap avatar box to change room cover photo", color = TextMuted, fontSize = 11.sp)
                        }
                    }
                }
                item { RoomTextBlock("Room Title", true, title, 60, "Late Night Talks ✨") { title = it.take(60) } }
                item { RoomTextBlock("Room Topic", true, description, 120, "Deep conversations, good vibes and new people.", singleLine = false) { description = it.take(120) } }
                item {
                    ChoiceBlock("Category", required = true) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            categories.forEach { (label, glyph) -> ReferenceChip(label, glyph = glyph, selected = category == label, onClick = { category = label }) }
                        }
                    }
                }
                item {
                    ChoiceBlock("Language", required = true) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            languages.forEach { label -> ReferenceChip(label, glyph = if (label == "English") "◎" else "", selected = language == label, onClick = { language = label }) }
                        }
                    }
                }
                item {
                    ChoiceBlock("Tags", subtitle = "Optional") {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            suggestedTags.forEach { tag -> ReferenceChip(tag, glyph = if (tag in tags) "✓" else "+", selected = tag in tags, onClick = { tags = if (tag in tags) tags - tag else tags + tag }) }
                        }
                    }
                }
                item {
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp))) {
                        SettingRow(Icons.Filled.Public, "Room Privacy", "Choose who can join your room") {
                            ReferenceChip(if (isPublic) "Public" else "Private", glyph = if (isPublic) "◎" else "▣", selected = !isPublic, onClick = { isPublic = !isPublic })
                        }
                        if (room.type == com.yugm.app.core.model.RoomType.Voice) {
                            DividerLine()
                            SettingRow(Icons.Filled.Groups, "Mic Seats", "Choose 2–20 microphones") {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    StepperButton("−", "Decrease speaker limit") { maxSpeakers = (maxSpeakers - 1).coerceAtLeast(2) }
                                    Text(maxSpeakers.toString(), color = TextPrimary, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 13.dp))
                                    StepperButton("+", "Increase speaker limit") { maxSpeakers = (maxSpeakers + 1).coerceAtMost(20) }
                                }
                            }
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
                                    ReferenceChip(cosmetic.name, glyph = if (selectedTheme == cosmetic.id) "✓" else "◖", selected = selectedTheme == cosmetic.id, onClick = { selectedTheme = if (selectedTheme == cosmetic.id) "" else cosmetic.id })
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
                                    ReferenceChip(cosmetic.name, glyph = if (selectedBadge == cosmetic.id) "✓" else "🏷️", selected = selectedBadge == cosmetic.id, onClick = { selectedBadge = if (selectedBadge == cosmetic.id) "" else cosmetic.id })
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
                                    ReferenceChip(cosmetic.name, glyph = if (selectedAmbience == cosmetic.id) "✓" else "♪", selected = selectedAmbience == cosmetic.id, onClick = { selectedAmbience = if (selectedAmbience == cosmetic.id) "" else cosmetic.id })
                                }
                            }
                        }
                    }
                }
                if (error.isNotBlank()) item { Text(error, color = Pink, fontSize = 12.sp) }
                item { Spacer(Modifier.height(4.dp)) }
            }
            GradientAction(
                label = if (submitting) "Saving…" else "Save Changes",
                leading = "▣",
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
                onClick = ::submit
            )
        }
    }
}

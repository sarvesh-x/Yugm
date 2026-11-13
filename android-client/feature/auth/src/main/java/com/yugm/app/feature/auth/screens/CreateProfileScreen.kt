package com.yugm.app.feature.auth.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.BrandHeader
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.*
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import java.util.Locale

data class ProfileSetupData(
    val name: String,
    val username: String,
    val bio: String,
    val vibeLine: String,
    val city: String,
    val interests: List<String>,
    val languages: List<String>,
    val gender: String,
    val age: Int,
    val lookingFor: String,
    val avatar: String,
    val acceptTerms: Boolean
)

@Composable
fun CreateProfileScreen(
    initialName: String,
    initialUsername: String,
    onUploadAvatar: (Uri, (String?, String?) -> Unit) -> Unit,
    onDone: (ProfileSetupData, (String?) -> Unit) -> Unit
) {
    val context = LocalContext.current
    var step by rememberSaveable { mutableStateOf(1) }
    var errorMessage by rememberSaveable { mutableStateOf("") }
    var termsAccepted by rememberSaveable { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var isUploadingAvatar by remember { mutableStateOf(false) }

    var name by rememberSaveable { mutableStateOf(initialName.take(60)) }
    var handle by rememberSaveable { mutableStateOf(initialUsername.take(24)) }
    var ageStr by rememberSaveable { mutableStateOf("") }
    var gender by rememberSaveable { mutableStateOf("") }

    var city by rememberSaveable { mutableStateOf("") }
    var selectedLanguages by rememberSaveable { mutableStateOf(emptyList<String>()) }

    var selectedInterests by rememberSaveable { mutableStateOf(emptyList<String>()) }

    var avatarUrl by rememberSaveable { mutableStateOf("") }
    var bio by rememberSaveable { mutableStateOf("") }
    var vibeLine by rememberSaveable { mutableStateOf("") }

    var lookingFor by rememberSaveable { mutableStateOf("") }

    val availableInterests = listOf(
        "Music", "Gaming", "Movies", "Fitness", "Travel",
        "Late Night Talks", "Friendship", "Dating", "Serious Relationship",
        "Voice Rooms", "Video Rooms", "Anime", "Tech", "Food", "Career", "Study"
    )

    val availableLanguages = listOf("Hindi", "English", "Punjabi", "Bengali", "Marathi", "Telugu", "Tamil", "Kannada")
    val availableGenders = listOf("Male", "Female", "Non-Binary")
    val availablePreferences = listOf("Friends", "Dating", "Serious", "Casual social", "Live community")

    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null && !isUploadingAvatar && !isSubmitting) {
            isUploadingAvatar = true
            errorMessage = ""
            onUploadAvatar(uri) { uploadedUrl, uploadError ->
                isUploadingAvatar = false
                if (!uploadedUrl.isNullOrBlank()) avatarUrl = uploadedUrl
                errorMessage = uploadError.orEmpty()
            }
        }
    }

    fun validateStep(): Boolean {
        errorMessage = ""
        when (step) {
            1 -> {
                val normalizedHandle = handle.trim().lowercase(Locale.ROOT)
                if (name.trim().length !in 2..60) {
                    errorMessage = "Your name must be between 2 and 60 characters."
                    return false
                }
                if (!normalizedHandle.matches(Regex("^[a-z0-9_.]{3,24}$"))) {
                    errorMessage = "Username must be 3–24 characters and use only letters, numbers, dots, or underscores."
                    return false
                }
                val age = ageStr.toIntOrNull()
                if (age == null || age !in 18..80) {
                    errorMessage = "Enter an age between 18 and 80. Yugm is for adults only."
                    return false
                }
            }
            2 -> {
                if (city.trim().length !in 2..60) {
                    errorMessage = "Enter a city between 2 and 60 characters."
                    return false
                }
                if (selectedLanguages.isEmpty()) {
                    errorMessage = "Please select at least one language"
                    return false
                }
            }
            3 -> {
                if (selectedInterests.isEmpty()) {
                    errorMessage = "Please select at least one interest tag"
                    return false
                }
            }
            4 -> {
                if (bio.trim().isBlank() || bio.trim().length > 180) {
                    errorMessage = "Write a bio between 1 and 180 characters."
                    return false
                }
                if (vibeLine.length > 120) {
                    errorMessage = "Your short vibe line can be up to 120 characters."
                    return false
                }
                if (avatarUrl.isNotBlank()) {
                    val uri = runCatching { Uri.parse(avatarUrl.trim()) }.getOrNull()
                    if (uri?.scheme !in listOf("https", "http") || uri?.host.isNullOrBlank()) {
                        errorMessage = "Enter a valid image link, or leave the avatar field empty."
                        return false
                    }
                }
            }
            5 -> {
                if (!termsAccepted) {
                    errorMessage = "Please accept the Terms of Use before continuing."
                    return false
                }
            }
        }
        return true
    }

    LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .background(Background)
    ) {
        item {
            BrandHeader(compact = true)
            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                repeat(5) { index ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (index + 1 <= step) Gold else Color(0x33FFFFFF))
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Step $step of 5",
                color = Gold,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                modifier = Modifier.semantics {
                    progressBarRangeInfo = ProgressBarRangeInfo(step.toFloat(), 1f..5f)
                    contentDescription = "Profile setup, step $step of 5"
                }
            )
        }

        when (step) {
            1 -> {
                item {
                    Text("Basic Identity", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Enter your name, handle, age and gender.", color = TextMuted)
                }
                item { YugmTextField(name, { name = it.take(60); errorMessage = "" }, "Name (2–60 characters)") }
                item { YugmTextField(handle, { handle = it.take(24).filter { char -> char in 'a'..'z' || char in 'A'..'Z' || char in '0'..'9' || char == '_' || char == '.' }; errorMessage = "" }, "Username") }
                item { YugmTextField(ageStr, { ageStr = it.filter(Char::isDigit).take(2); errorMessage = "" }, "Age (18–80)", keyboardType = androidx.compose.ui.text.input.KeyboardType.Number) }
                item {
                    Text("Gender", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                    ) {
                        availableGenders.forEach { g ->
                            val selected = gender == g
                            Surface(
                                color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 48.dp)
                                    .selectable(selected = selected, role = Role.RadioButton) { gender = g }
                            ) {
                                Text(
                                    text = g,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 12.dp)
                                )
                            }
                        }
                    }
                }
            }
            2 -> {
                item {
                    Text("Location & Languages", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Where are you located and what languages do you vibe in?", color = TextMuted)
                }
                item { YugmTextField(city, { city = it }, "City (e.g. Mumbai, Delhi)") }
                item {
                    Text("Languages", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        availableLanguages.forEach { lang ->
                            val selected = selectedLanguages.contains(lang)
                            Surface(
                                color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.heightIn(min = 48.dp).toggleable(
                                    value = selected,
                                    role = Role.Checkbox
                                ) {
                                    selectedLanguages = if (it) selectedLanguages + lang else selectedLanguages - lang
                                }
                            ) {
                                Text(
                                    text = lang,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }
                }
            }
            3 -> {
                item {
                    Text("Select Interests", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Choose at least 1 tag that matches your energy.", color = TextMuted)
                }
                item {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        availableInterests.forEach { interest ->
                            val selected = selectedInterests.contains(interest)
                            Surface(
                                color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.heightIn(min = 48.dp).toggleable(
                                    value = selected,
                                    role = Role.Checkbox
                                ) {
                                    selectedInterests = if (it) selectedInterests + interest else selectedInterests - interest
                                }
                            ) {
                                Text(
                                    text = interest,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }
                }
            }
            4 -> {
                item {
                    Text("Photos & Bio", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Set up your avatar and write a catchy bio.", color = TextMuted)
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        com.yugm.app.core.ui.components.Avatar(
                            initial = name.firstOrNull()?.toString() ?: "?",
                            size = 72,
                            imageUrl = avatarUrl.takeIf(String::isNotBlank)
                        )
                        Column(Modifier.weight(1f)) {
                            Text(if (avatarUrl.isBlank()) "Add a profile photo" else "Profile photo selected", color = TextPrimary, fontWeight = FontWeight.Bold)
                            Text("Optional. You can change it later.", color = TextMuted, fontSize = 12.sp)
                            OutlinedButton(
                                onClick = { avatarPicker.launch("image/*") },
                                enabled = !isUploadingAvatar && !isSubmitting,
                                modifier = Modifier.padding(top = 6.dp)
                            ) { Text(if (isUploadingAvatar) "Uploading…" else if (avatarUrl.isBlank()) "Choose photo" else "Change photo") }
                        }
                    }
                }
                item { YugmTextField(bio, { bio = it.take(180); errorMessage = "" }, "Bio (up to 180 characters)", minLines = 3) }
                item { YugmTextField(vibeLine, { vibeLine = it.take(120); errorMessage = "" }, "Short vibe line (optional)") }
            }
            5 -> {
                item {
                    Text("Preferences", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Who or what are you looking for on Yugm?", color = TextMuted)
                }
                item {
                    Text("Looking For", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        availablePreferences.forEach { pref ->
                            val selected = lookingFor == pref
                            Surface(
                                color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.heightIn(min = 48.dp).selectable(
                                    selected = selected,
                                    role = Role.RadioButton
                                ) { lookingFor = pref }
                            ) {
                                Text(
                                    text = pref,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = termsAccepted, onCheckedChange = { termsAccepted = it })
                        Text("I agree to the Yugm Terms of Use and Community Guidelines.", color = TextMuted, fontSize = 13.sp)
                    }
                    TextButton(onClick = {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yugm.onrender.com/legal/terms"))) }
                    }) {
                        Text("Read Terms of Use", color = Gold, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (errorMessage.isNotBlank()) {
            item {
                Text(errorMessage, color = DangerRed, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
        }

        item {
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (step > 1) {
                    OutlinedButton(
                        onClick = { step--; errorMessage = "" },
                        enabled = !isSubmitting,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(56.dp)
                    ) {
                        Text("Back", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }

                PrimaryButton(
                    text = when { isSubmitting -> "Saving your profile…"; step == 5 -> "Finish & enter Yugm"; else -> "Next" },
                    modifier = Modifier.weight(2f),
                    enabled = !isSubmitting,
                    onClick = {
                        if (!isSubmitting && !isUploadingAvatar && validateStep()) {
                            if (step == 5) {
                                val age = ageStr.toIntOrNull() ?: 18
                                isSubmitting = true
                                errorMessage = ""
                                onDone(ProfileSetupData(
                                    name = name.trim(),
                                    username = handle.trim().lowercase(Locale.ROOT),
                                    bio = bio.trim(),
                                    vibeLine = vibeLine.trim(),
                                    city = city.trim(),
                                    interests = selectedInterests,
                                    languages = selectedLanguages,
                                    gender = gender,
                                    age = age,
                                    lookingFor = lookingFor,
                                    avatar = avatarUrl.trim(),
                                    acceptTerms = termsAccepted
                                )) { submissionError ->
                                    isSubmitting = false
                                    errorMessage = submissionError.orEmpty()
                                }
                            } else {
                                step++
                            }
                        }
                    }
                )
            }
        }
    }
}

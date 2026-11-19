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
import androidx.activity.compose.BackHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.BrandHeader
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.*
import android.content.Intent
import android.net.Uri
import com.yugm.app.core.api.resolveMediaUrl
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
    val acceptTerms: Boolean
)

@Composable
fun CreateProfileScreen(
    initialName: String,
    initialUsername: String,
    isSubmitting: Boolean,
    isUploadingAvatar: Boolean,
    onExit: () -> Unit,
    onUploadAvatar: (Uri, (String?, String?) -> Unit) -> Unit,
    onDone: (ProfileSetupData, (String?) -> Unit) -> Unit
) {
    val context = LocalContext.current
    val profileColors = LocalYugmColors.current
    val profileAccent = profileColors.accent
    var step by rememberSaveable { mutableStateOf(1) }
    var errorMessage by rememberSaveable { mutableStateOf("") }
    var termsAccepted by rememberSaveable { mutableStateOf(false) }
    var showExitConfirmation by rememberSaveable { mutableStateOf(false) }

    var name by rememberSaveable { mutableStateOf(initialName.take(60)) }
    var handle by rememberSaveable { mutableStateOf(initialUsername.take(24)) }
    var ageStr by rememberSaveable { mutableStateOf("") }
    var gender by rememberSaveable { mutableStateOf("") }

    var city by rememberSaveable { mutableStateOf("") }
    var selectedLanguages by rememberSaveable { mutableStateOf(emptyList<String>()) }

    var selectedInterests by rememberSaveable { mutableStateOf(emptyList<String>()) }

    // Avatar uploads are committed immediately by /upload/avatar; don't place
    // the large base64 data URL in the saved-instance Bundle.
    var avatarUrl by remember { mutableStateOf("") }
    var avatarUploadFailed by rememberSaveable { mutableStateOf(false) }
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
    val availablePreferences = listOf("Friendship", "Dating", "Relationship", "Networking")

    BackHandler(enabled = !isSubmitting) {
        if (step > 1) { step--; errorMessage = "" } else showExitConfirmation = true
    }

    if (showExitConfirmation) {
        AlertDialog(
            onDismissRequest = { showExitConfirmation = false },
            title = { Text("Leave profile setup?") },
            text = { Text("Your sign-in will be cleared. You can sign in again and finish your profile later.") },
            confirmButton = {
                TextButton(onClick = { showExitConfirmation = false; onExit() }) { Text("Sign out") }
            },
            dismissButton = {
                TextButton(onClick = { showExitConfirmation = false }) { Text("Continue setup") }
            }
        )
    }

    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null && !isUploadingAvatar && !isSubmitting) {
            errorMessage = ""
            avatarUploadFailed = false
            onUploadAvatar(uri) { uploadedUrl, uploadError ->
                if (!uploadedUrl.isNullOrBlank()) {
                    avatarUrl = uploadedUrl
                    avatarUploadFailed = false
                } else if (!uploadError.isNullOrBlank()) {
                    avatarUploadFailed = true
                }
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
                if (gender !in availableGenders) {
                    errorMessage = "Choose your gender to continue."
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
                    if (!isValidProfileAvatarReference(avatarUrl)) {
                        errorMessage = "The uploaded photo is not in a supported format. Choose it again or continue without a photo."
                        return false
                    }
                }
            }
            5 -> {
                if (lookingFor !in availablePreferences) {
                    errorMessage = "Choose what you are looking for to continue."
                    return false
                }
                if (!termsAccepted) {
                    errorMessage = "Please accept the Terms of Use before continuing."
                    return false
                }
            }
        }
        return true
    }

    Box(Modifier.fillMaxSize().background(Background)) {
      AuroraBackground(Modifier.fillMaxSize())
      LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
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
                            .background(
                                if (index + 1 <= step) profileAccent
                                else MaterialTheme.colorScheme.outline.copy(alpha = if (profileColors.isDark) 0.45f else 0.65f)
                            )
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Step $step of 5",
                color = profileAccent,
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
                    Text("Basic Identity", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Enter your name, handle, age and gender.", color = TextMuted)
                }
                item { ProfileSetupTextField(name, { name = it.take(60); errorMessage = "" }, "Name (2–60 characters)") }
                item { ProfileSetupTextField(handle, { handle = it.take(24).filter { char -> char in 'a'..'z' || char in 'A'..'Z' || char in '0'..'9' || char == '_' || char == '.' }; errorMessage = "" }, "Username") }
                item { ProfileSetupTextField(ageStr, { ageStr = it.filter(Char::isDigit).take(2); errorMessage = "" }, "Age (18–80)", keyboardType = androidx.compose.ui.text.input.KeyboardType.Number) }
                item {
                    Text("Gender", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                    ) {
                        availableGenders.forEach { g ->
                            val selected = gender == g
                            Surface(
                                color = if (selected) profileAccent.copy(alpha = if (profileColors.isDark) 0.2f else 0.12f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) profileAccent else MaterialTheme.colorScheme.outline),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 48.dp)
                                    .selectable(selected = selected, role = Role.RadioButton) { gender = g }
                            ) {
                                Text(
                                    text = g,
                                    color = TextPrimary,
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
                    Text("Location & Languages", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Where are you located and what languages do you vibe in?", color = TextMuted)
                }
                item { ProfileSetupTextField(city, { city = it }, "City (e.g. Mumbai, Delhi)") }
                item {
                    Text("Languages", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        availableLanguages.forEach { lang ->
                            val selected = selectedLanguages.contains(lang)
                            Surface(
                                color = if (selected) profileAccent.copy(alpha = if (profileColors.isDark) 0.2f else 0.12f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) profileAccent else MaterialTheme.colorScheme.outline),
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
                                    color = TextPrimary,
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
                    Text("Select Interests", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
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
                                color = if (selected) profileAccent.copy(alpha = if (profileColors.isDark) 0.2f else 0.12f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) profileAccent else MaterialTheme.colorScheme.outline),
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
                                    color = TextPrimary,
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
                    Text("Photos & Bio", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
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
                            Text(
                                when {
                                    isUploadingAvatar -> "Uploading profile photo…"
                                    avatarUploadFailed -> "Photo upload failed. Choose a photo to retry."
                                    avatarUrl.isNotBlank() -> "Photo uploaded and ready."
                                    else -> "Add a profile photo"
                                },
                                color = if (avatarUploadFailed) profileColors.danger else TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                            )
                            Text("Optional. You can change it later.", color = TextMuted, fontSize = 12.sp)
                            OutlinedButton(
                                onClick = { avatarPicker.launch("image/*") },
                                enabled = !isUploadingAvatar && !isSubmitting,
                                modifier = Modifier.padding(top = 6.dp)
                            ) {
                                Text(when {
                                    isUploadingAvatar -> "Uploading…"
                                    avatarUploadFailed -> "Retry upload"
                                    avatarUrl.isBlank() -> "Choose photo"
                                    else -> "Change photo"
                                })
                            }
                        }
                    }
                }
                item { ProfileSetupTextField(bio, { bio = it.take(180); errorMessage = "" }, "Bio (up to 180 characters)", minLines = 3) }
                item { ProfileSetupTextField(vibeLine, { vibeLine = it.take(120); errorMessage = "" }, "Short vibe line (optional)") }
            }
            5 -> {
                item {
                    Text("Preferences", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Who or what are you looking for on Yugm?", color = TextMuted)
                }
                item {
                    Text("Looking For", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        availablePreferences.forEach { pref ->
                            val selected = lookingFor == pref
                            Surface(
                                color = if (selected) profileAccent.copy(alpha = if (profileColors.isDark) 0.2f else 0.12f) else SurfaceElevated,
                                border = BorderStroke(1.dp, if (selected) profileAccent else MaterialTheme.colorScheme.outline),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.heightIn(min = 48.dp).selectable(
                                    selected = selected,
                                    role = Role.RadioButton
                                ) { lookingFor = pref }
                            ) {
                                Text(
                                    text = pref,
                                    color = TextPrimary,
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
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(resolveMediaUrl("/legal/terms")))) }
                    }) {
                        Text("Read Terms of Use", color = profileAccent, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (errorMessage.isNotBlank()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
                    Text(errorMessage, color = profileColors.danger, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                }
            }
        }

        item {
            if (step == 1) {
                TextButton(onClick = { showExitConfirmation = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Use a different account", color = profileAccent)
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (step > 1) {
                    OutlinedButton(
                        onClick = { step--; errorMessage = "" },
                        enabled = !isSubmitting,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(56.dp)
                    ) {
                        Text("Back", color = TextPrimary, fontWeight = FontWeight.Bold)
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
                                    acceptTerms = termsAccepted
                                )) { submissionError ->
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
}

@Composable
private fun ProfileSetupTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
    minLines: Int = 1,
) {
    YugmTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        keyboardType = keyboardType,
        minLines = minLines,
        accentColor = LocalYugmColors.current.accent,
        borderColor = MaterialTheme.colorScheme.outline,
    )
}

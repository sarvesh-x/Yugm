package com.example.yugm.feature.auth.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.ui.components.BrandHeader
import com.example.yugm.core.ui.components.PrimaryButton
import com.example.yugm.core.ui.components.YugmTextField
import com.example.yugm.core.ui.theme.*
import android.content.Intent
import android.net.Uri

@Composable
fun CreateProfileScreen(
    initialName: String,
    initialUsername: String,
    onDone: (
        name: String,
        username: String,
        bio: String,
        city: String,
        interests: List<String>,
        languages: List<String>,
        gender: String,
        age: Int,
        lookingFor: String,
        avatar: String
    ) -> Unit
) {
    val context = LocalContext.current
    var step by remember { mutableStateOf(1) }
    var errorMessage by remember { mutableStateOf("") }
    var termsAccepted by remember { mutableStateOf(false) }

    var name by remember { mutableStateOf(initialName) }
    var handle by remember { mutableStateOf(initialUsername) }
    var ageStr by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("Male") }

    var city by remember { mutableStateOf("") }
    val selectedLanguages = remember { mutableStateListOf("English") }

    val selectedInterests = remember { mutableStateListOf<String>() }

    var avatarUrl by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var vibeLine by remember { mutableStateOf("") }

    var lookingFor by remember { mutableStateOf("Friends") }

    val availableInterests = listOf(
        "Music", "Gaming", "Movies", "Fitness", "Travel",
        "Late Night Talks", "Friendship", "Dating", "Serious Relationship",
        "Voice Rooms", "Video Rooms", "Anime", "Tech", "Food", "Career", "Study"
    )

    val availableLanguages = listOf("Hindi", "English", "Punjabi", "Bengali", "Marathi", "Telugu", "Tamil", "Kannada")
    val availableGenders = listOf("Male", "Female", "Non-Binary")
    val availablePreferences = listOf("Friends", "Dating", "Serious", "Casual social", "Live community")

    fun validateStep(): Boolean {
        errorMessage = ""
        when (step) {
            1 -> {
                if (name.isBlank() || handle.isBlank()) {
                    errorMessage = "Name and Username are required"
                    return false
                }
                val age = ageStr.toIntOrNull()
                if (age == null || age < 18) {
                    errorMessage = "You must be 18+ to join Yugm"
                    return false
                }
            }
            2 -> {
                if (city.isBlank()) {
                    errorMessage = "Please enter your city"
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
                if (bio.isBlank()) {
                    errorMessage = "Write a short bio to match the vibe!"
                    return false
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
                fontSize = 12.sp
            )
        }

        when (step) {
            1 -> {
                item {
                    Text("Basic Identity", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("Enter your name, handle, age and gender.", color = TextMuted)
                }
                item { YugmTextField(name, { name = it }, "Name") }
                item { YugmTextField(handle, { handle = it }, "Username") }
                item { YugmTextField(ageStr, { ageStr = it }, "Age", keyboardType = androidx.compose.ui.text.input.KeyboardType.Number) }
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
                                    .clickable { gender = g }
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
                                modifier = Modifier.clickable {
                                    if (selected) selectedLanguages.remove(lang) else selectedLanguages.add(lang)
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
                                modifier = Modifier.clickable {
                                    if (selected) selectedInterests.remove(interest) else selectedInterests.add(interest)
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
                item { YugmTextField(avatarUrl, { avatarUrl = it }, "Avatar Image URL (Optional)") }
                item { YugmTextField(bio, { bio = it }, "Vibe Bio", minLines = 3) }
                item { YugmTextField(vibeLine, { vibeLine = it }, "Short Vibe Line (e.g. Late night playlist addict)") }
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
                                modifier = Modifier.clickable { lookingFor = pref }
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
                Text(errorMessage, color = DangerRed, fontWeight = FontWeight.Bold, fontSize = 14.sp)
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
                        onClick = { step-- },
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(56.dp)
                    ) {
                        Text("Back", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }

                PrimaryButton(
                    text = if (step == 5) "Finish & Enter Yugm" else "Next",
                    modifier = Modifier.weight(2f),
                    onClick = {
                        if (validateStep()) {
                            if (step == 5) {
                                val age = ageStr.toIntOrNull() ?: 18
                                onDone(
                                    name, handle, bio, city,
                                    selectedInterests.toList(), selectedLanguages.toList(),
                                    gender, age, lookingFor, avatarUrl
                                )
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

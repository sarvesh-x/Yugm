package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.ChipWrap
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun CreateProfileScreen(initialName: String, initialUsername: String, onDone: (String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf(initialName) }
    var handle by rememberSaveable { mutableStateOf(initialUsername) }
    var city by rememberSaveable { mutableStateOf("") }
    var bio by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            BrandHeader(compact = true)
            Spacer(Modifier.height(24.dp))
            Text("Create your vibe card", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("No matrimonial energy. Just identity, city, language and interests.", color = TextMuted, modifier = Modifier.padding(top = 8.dp, bottom = 12.dp))
        }
        item { YugmTextField(name, { name = it }, "Name") }
        item { YugmTextField(handle, { handle = it }, "Username") }
        item { YugmTextField(city, { city = it }, "City") }
        item { YugmTextField(bio, { bio = it }, "Bio", minLines = 3) }
        item { ChipWrap(listOf("Hindi", "English", "Music", "Gaming", "Chill", "Friends")) }
        item { PrimaryButton("Enter Yugm") { onDone(name.ifBlank { "Yugm User" }, handle.ifBlank { "vibe_user" }) } }
    }
}

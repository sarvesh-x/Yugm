package com.example.yugm.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateRoomScreen(
    host: Host,
    onBack: () -> Unit,
    onCreate: (Room) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Chill") }
    var language by remember { mutableStateOf("English") }
    var type by remember { mutableStateOf(RoomType.Voice) }
    var maxSpeakers by remember { mutableStateOf(6) }

    val categories = listOf("Chill", "Gaming", "Music", "Late Night", "Chitchat", "Dating")
    val languages = listOf("English", "Hindi", "Punjabi", "Marathi", "Tamil")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Start Live Room", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    text = "Room details",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
            }

            item { YugmTextField(title, { title = it }, "Room Title") }
            item { YugmTextField(description, { description = it }, "Description (Optional)") }

            // Room Type Selector
            item {
                Text("Room Type", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                ) {
                    RoomType.values().forEach { t ->
                        val selected = type == t
                        Surface(
                            color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                            border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { type = t }
                        ) {
                            Text(
                                text = if (t == RoomType.Voice) "🎙️ Audio Room" else "🎥 Video Room",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(vertical = 12.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            }

            // Category Selector
            item {
                Text("Category", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    categories.forEach { cat ->
                        val selected = category == cat
                        Surface(
                            color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                            border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.clickable { category = cat }
                        ) {
                            Text(
                                text = cat,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                            )
                        }
                    }
                }
            }

            // Language Selector
            item {
                Text("Primary Language", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    languages.forEach { lang ->
                        val selected = language == lang
                        Surface(
                            color = if (selected) Gold.copy(alpha = 0.2f) else SurfaceElevated,
                            border = BorderStroke(1.dp, if (selected) Gold else Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.clickable { language = lang }
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

            item {
                Spacer(modifier = Modifier.height(20.dp))
                PrimaryButton(
                    text = "Go Live Now",
                    onClick = {
                        if (title.isNotBlank()) {
                            onCreate(
                                Room(
                                    title = title,
                                    description = description,
                                    type = type,
                                    category = category,
                                    language = language,
                                    maxSpeakers = maxSpeakers,
                                    host = host
                                )
                            )
                        }
                    }
                )
            }
        }
    }
}

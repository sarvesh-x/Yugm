package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.*
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun SearchScreen(
    onBack: () -> Unit,
    onOpenRoom: (Room) -> Unit,
    onOpenProfile: (String) -> Unit
) {
    var query by remember { mutableStateOf("") }
    // In a real refactor, this logic would be in a SearchViewModel
    
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Spacer(modifier = Modifier.height(18.dp))
        Text("Search", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
        YugmTextField(
            value = query,
            onValueChange = { query = it },
            label = "Search rooms, users, tags..."
        )
        
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp)
        ) {
            // Placeholder results
            item {
                Text("Search for something to see results", color = TextMuted)
            }
        }
    }
}

package com.yugm.app.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.RoundAction
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.social.viewmodel.ClanViewModel

@Composable
fun ClanListScreen(
    token: String,
    onBack: () -> Unit = {},
    onCreateClan: () -> Unit = {},
    onClanClick: (String) -> Unit = {},
    onMyClanClick: (String) -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(token) {
        viewModel.loadMyClan(token)
        viewModel.loadClans(token, searchQuery)
    }
    LaunchedEffect(searchQuery) {
        if (searchQuery.length >= 2 || searchQuery.isEmpty()) {
            viewModel.loadClans(token, searchQuery)
        }
    }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Yugm", "Clans", onBack = onBack) {
                    RoundAction("+", onClick = onCreateClan)
                }
            }
            item {
                YugmSearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    placeholder = "Search clans…"
                )
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading clans…") } }
            } else {
                if (viewModel.myClan != null) {
                    item {
                        MyClanCard(viewModel.myClan!!) { onMyClanClick(viewModel.myClan!!.id) }
                    }
                }
                if (viewModel.clans.isEmpty() && searchQuery.isBlank()) {
                    item {
                        Text(
                            "No public clans yet. Create one!",
                            color = TextMuted,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 40.dp)
                        )
                    }
                } else if (viewModel.clans.isEmpty()) {
                    item {
                        Text(
                            "No clans matching \"$searchQuery\"",
                            color = TextMuted,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 40.dp)
                        )
                    }
                } else {
                    items(viewModel.clans) { clan ->
                        ClanCard(clan, onClick = { onClanClick(clan.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun MyClanCard(clan: Clan, onClick: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clickable(onClick = onClick)) {
        Text("Your Clan", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 6.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .background(androidx.compose.ui.graphics.Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(Pink),
                contentAlignment = Alignment.Center
            ) {
                Text(clan.name.take(2).uppercase(), color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(clan.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text("${clan.familyLabel} · ${clan.memberCount} members", color = TextMuted, fontSize = 12.sp)
            }
            Text("Open", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun ClanCard(clan: ClanSummary, onClick: () -> Unit) {
    Row(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(44.dp).clip(CircleShape).background(Pink),
            contentAlignment = Alignment.Center
        ) {
            Text(clan.name.take(2).uppercase(), color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(clan.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("${clan.familyLabel} · ${clan.memberCount} members", color = TextMuted, fontSize = 11.sp)
        }
        if (clan.slug.isNotBlank()) {
            Text(clan.slug, color = TextMuted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun YugmSearchBar(query: String, onQueryChange: (String) -> Unit, placeholder: String) {
    Row(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth()
            .background(androidx.compose.ui.graphics.Color(0x1AFFFFFF), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("\uD83D\uDD0D", fontSize = 14.sp)
        Spacer(Modifier.width(8.dp))
        androidx.compose.foundation.text.BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
            decorationBox = { innerTextField ->
                Box {
                    if (query.isEmpty()) Text(placeholder, color = TextMuted, fontSize = 14.sp)
                    innerTextField()
                }
            }
        )
    }
}

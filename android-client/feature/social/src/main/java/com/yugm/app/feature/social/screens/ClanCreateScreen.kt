package com.yugm.app.feature.social.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.TextSecondary
import com.yugm.app.feature.social.viewmodel.ClanViewModel

@Composable
fun ClanCreateScreen(
    token: String,
    onBack: () -> Unit = {},
    onClanCreated: (String) -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var familyLabel by remember { mutableStateOf("Family") }
    var avatar by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(viewModel.myClan?.id) {
        viewModel.myClan?.id?.takeIf { it.isNotBlank() }?.let(onClanCreated)
    }
    LaunchedEffect(viewModel.error) { error = viewModel.error.orEmpty() }

    YugmAmbientBackground {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            YugmPageHeader("Yugm", "Create Clan", onBack = onBack)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFF211932),
                shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, Color(0x35FFFFFF))
            ) {
                androidx.compose.foundation.layout.Row(
                    Modifier.padding(18.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Avatar(name.ifBlank { "?" }.take(1).uppercase(), 58, avatar.trim().ifBlank { null })
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(name.ifBlank { "Your clan name" }, color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Text(familyLabel.ifBlank { "Community" }, color = Pink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(if (isPrivate) "Invite-only clan" else "Open community", color = TextMuted, fontSize = 11.sp)
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Clan Name", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                YugmTextField(value = name, onValueChange = { name = it; error = "" }, placeholder = "e.g. The Vibe Tribe", maxLength = 48)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Description (optional)", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                YugmTextField(value = description, onValueChange = { description = it }, placeholder = "What's your clan about?", maxLength = 220, singleLine = false, maxLines = 3)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Family Label", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                YugmTextField(value = familyLabel, onValueChange = { familyLabel = it }, placeholder = "e.g. Family, Squad, Crew", maxLength = 32)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Avatar URL (optional)", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                YugmTextField(value = avatar, onValueChange = { avatar = it }, placeholder = "https://…", maxLength = 500)
                Text("Paste an image link to personalize your clan. You can change it later.", color = TextMuted, fontSize = 11.sp)
            }
            RowToggle(
                label = "Private Clan",
                description = "Only invited users can join",
                checked = isPrivate,
                onCheckedChange = { isPrivate = it }
            )
            if (error.isNotBlank()) {
                Text(error, color = Pink, fontSize = 12.sp)
            }
            Text("Your clan gets a unique ID automatically. You can invite members and update these details later.", color = TextMuted, fontSize = 11.sp, lineHeight = 16.sp)
            GradientAction(
                label = if (viewModel.isLoading) "Creating…" else "Create Clan",
                enabled = name.isNotBlank() && !viewModel.isLoading,
                onClick = {
                    viewModel.create(
                        token = token,
                        name = name.trim(),
                        description = description.trim(),
                        privacy = if (isPrivate) "PRIVATE" else "PUBLIC",
                        familyLabel = familyLabel.trim(),
                        avatar = avatar.trim().ifBlank { null }
                    )
                }
            )
        }
    }
}

@Composable
private fun RowToggle(label: String, description: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    androidx.compose.foundation.layout.Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(description, color = TextMuted, fontSize = 11.sp)
        }
        androidx.compose.material3.Switch(checked = checked, onCheckedChange = onCheckedChange, colors = androidx.compose.material3.SwitchDefaults.colors(checkedTrackColor = Pink))
    }
}

@Composable
private fun YugmTextField(value: String, onValueChange: (String) -> Unit, placeholder: String, maxLength: Int = Int.MAX_VALUE, singleLine: Boolean = true, maxLines: Int = 1) {
    Column {
        androidx.compose.foundation.text.BasicTextField(
            value = value,
            onValueChange = { if (it.length <= maxLength) onValueChange(it) },
            modifier = Modifier.fillMaxWidth().background(Color(0x1AFFFFFF), RoundedCornerShape(10.dp)).padding(14.dp),
            singleLine = singleLine,
            maxLines = maxLines,
            textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(Pink),
            decorationBox = { innerTextField ->
                Box {
                    if (value.isEmpty()) Text(placeholder, color = TextMuted, fontSize = 14.sp)
                    innerTextField()
                }
            }
        )
        if (maxLength < Int.MAX_VALUE) {
            Text("${value.length}/$maxLength", color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
        }
    }
}



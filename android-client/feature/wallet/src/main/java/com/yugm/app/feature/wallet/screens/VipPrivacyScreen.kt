package com.yugm.app.feature.wallet.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.VipPrivacySettings
import com.yugm.app.core.api.YugmApi
import kotlinx.coroutines.launch
import com.yugm.app.core.ui.components.YugmLoadingSpinner
import com.yugm.app.core.ui.components.YugmTopBar

private val PrivacyBackground = Color(0xFF100D18)
private val PrivacyCard = Color(0xFFF5EEE6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VipPrivacyScreen(token: String, onBack: () -> Unit) {
    var settings by remember { mutableStateOf(VipPrivacySettings()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(token) {
        runCatching { YugmApi.vipPrivacy(token) }
            .onSuccess { settings = it }
            .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load VIP privacy", android.widget.Toast.LENGTH_SHORT).show() }
        loading = false
    }
    Scaffold(
        containerColor = PrivacyBackground,
        topBar = {
            YugmTopBar(
                title = "VIP Privacy",
                onBack = onBack,
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp, vertical = 26.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Your VIP, your boundaries", color = Color(0xFFBEB7C8), fontSize = 14.sp)
            if (loading) YugmLoadingSpinner(size = 40.dp, modifier = Modifier.align(Alignment.CenterHorizontally))
            PrivacySettingCard("Who can chat to me?", if (settings.chatPrivacy == "FOLLOWERS") "Followers" else "Everyone") {
                var expanded by remember { mutableStateOf(false) }
                Box {
                    Text("Change", color = Color(0xFF7B4CFF), fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { expanded = true }.padding(top = 10.dp))
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        listOf("EVERYONE" to "Everyone", "FOLLOWERS" to "Followers").forEach { (value, label) ->
                            DropdownMenuItem(text = { Text(label) }, onClick = {
                                expanded = false
                                scope.launch { saveVipPrivacy(context, token, settings.copy(chatPrivacy = value)) { settings = it } }
                            })
                        }
                    }
                }
            }
            PrivacySettingCard("Mysterious visitor", if (settings.mysteriousVisitors) "Your visits stay private" else "Your visits appear in visitor lists") {
                Switch(checked = settings.mysteriousVisitors, onCheckedChange = { enabled ->
                    scope.launch { saveVipPrivacy(context, token, settings.copy(mysteriousVisitors = enabled)) { settings = it } }
                }, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Color(0xFF8C54FF)))
            }
            Text("You can still block or report anyone. Those safety controls always apply.", color = Color(0xFF888390), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun PrivacySettingCard(title: String, subtitle: String, trailing: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth().background(PrivacyCard, RoundedCornerShape(24.dp)).padding(horizontal = 20.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color(0xFF574940), fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Color(0xFF8A7D74), fontSize = 14.sp, modifier = Modifier.padding(top = 5.dp))
        }
        trailing()
    }
}

private suspend fun saveVipPrivacy(context: android.content.Context, token: String, settings: VipPrivacySettings, onSaved: (VipPrivacySettings) -> Unit) {
    runCatching { YugmApi.updateVipPrivacy(token, settings) }
        .onSuccess(onSaved)
        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not save privacy settings", android.widget.Toast.LENGTH_SHORT).show() }
}

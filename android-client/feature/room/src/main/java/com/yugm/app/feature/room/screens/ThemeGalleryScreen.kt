package com.yugm.app.feature.room.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.EquippedThemes
import com.yugm.app.core.model.ImmersiveTheme
import com.yugm.app.core.ui.components.AnimatedEntrance
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import kotlinx.coroutines.launch

@Composable
fun ThemeGalleryScreen(
    token: String,
    roomId: String,
    onBack: () -> Unit
) {
    var themes by remember { mutableStateOf<List<ImmersiveTheme>>(emptyList()) }
    var owned by remember { mutableStateOf<List<ImmersiveTheme>>(emptyList()) }
    var equipped by remember { mutableStateOf<EquippedThemes?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedTheme by remember { mutableStateOf<ImmersiveTheme?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        try {
            val t = YugmApi.themes(token)
            val u = YugmApi.userThemes(token)
            themes = t
            owned = u.owned
            equipped = u.equipped
        } catch (e: Exception) {
            error = e.message ?: "Failed to load themes"
        } finally {
            isLoading = false
        }
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.5f)
        Column(Modifier.fillMaxSize().padding(top = 18.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
                Text("Immersive Themes", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.size(1.dp))
            }
            if (equipped != null) {
                Text(
                    "Current: ${equipped?.room?.replace("theme_", "")?.replace("_", " ")?.uppercase() ?: "None"}",
                    color = Gold, fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                )
            }
            when {
                isLoading -> LoadingState("Loading themes...")
                error != null -> Text(error ?: "", color = TextMuted, modifier = Modifier.padding(20.dp))
                else -> LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(themes, key = { it.key }) { theme ->
                        ThemeCard(
                            theme = theme,
                            isOwned = owned.any { it.key == theme.key },
                            isEquipped = equipped?.room == theme.key,
                            onClick = { selectedTheme = theme }
                        )
                    }
                }
            }
        }
    }

    selectedTheme?.let { sel ->
        ThemeDetailSheet(
            theme = sel,
            isOwned = owned.any { it.key == sel.key },
            isEquipped = equipped?.room == sel.key,
            onDismiss = { selectedTheme = null },
            onPurchase = {
                scope.launch {
                    try {
                        YugmApi.purchaseTheme(token, sel.key)
                        owned = owned + sel
                        android.widget.Toast.makeText(context, "${sel.name} purchased!", android.widget.Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(context, e.message ?: "Purchase failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    selectedTheme = null
                }
            },
            onEquip = {
                scope.launch {
                    try {
                        val newEquipped = YugmApi.equipTheme(token, "room", sel.key)
                        equipped = newEquipped
                        android.widget.Toast.makeText(context, "${sel.name} equipped!", android.widget.Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(context, e.message ?: "Equip failed", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    selectedTheme = null
                }
            },
            onApplyToRoom = {
                scope.launch {
                    try {
                        YugmApi.setRoomTheme(token, roomId, sel.key)
                        android.widget.Toast.makeText(context, "Room theme updated!", android.widget.Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(context, e.message ?: "Failed to apply", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    selectedTheme = null
                }
            }
        )
    }
}

@Composable
private fun ThemeCard(
    theme: ImmersiveTheme,
    isOwned: Boolean,
    isEquipped: Boolean,
    onClick: () -> Unit
) {
    val gradient = if (theme.colors.size >= 2) {
        Brush.linearGradient(theme.colors.map { colorString ->
            try { Color(android.graphics.Color.parseColor(colorString)) } catch (_: Exception) { Color.Gray }
        })
    } else Brush.linearGradient(listOf(Color.DarkGray, Color.Gray))

    GlassCard(Modifier.fillMaxWidth(), onClick = onClick) {
        Box(
            Modifier.fillMaxWidth().height(80.dp).background(gradient, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(theme.name.take(2), color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
        }
        Text(theme.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
        Text(theme.category, color = TextMuted, fontSize = 10.sp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (isOwned) {
                Text(if (isEquipped) "Equipped" else "Owned", color = if (isEquipped) Gold else TextMuted, fontSize = 10.sp)
            } else {
                Text("${theme.price.coins} coins", color = Gold, fontSize = 10.sp)
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun ThemeDetailSheet(
    theme: ImmersiveTheme,
    isOwned: Boolean,
    isEquipped: Boolean,
    onDismiss: () -> Unit,
    onPurchase: () -> Unit,
    onEquip: () -> Unit,
    onApplyToRoom: () -> Unit
) {
    val gradient = if (theme.colors.size >= 2) {
        Brush.linearGradient(theme.colors.map { colorString ->
            try { Color(android.graphics.Color.parseColor(colorString)) } catch (_: Exception) { Color.Gray }
        })
    } else Brush.linearGradient(listOf(Color.DarkGray, Color.Gray))

    val ambientSoundName = theme.ambientSound
    val animMap = theme.animation

    androidx.compose.material3.ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                Modifier.fillMaxWidth().height(140.dp).background(gradient, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(theme.name, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }
            Text(theme.name, color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(theme.category.uppercase(), color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            if (ambientSoundName != null) {
                Text("♪ Ambient: ${ambientSoundName.replace("ambience_", "").replace("_", " ")}", color = TextMuted, fontSize = 12.sp)
            }
            if (animMap != null) {
                val animType = animMap["type"] as? String ?: "static"
                Text("Effect: $animType", color = TextMuted, fontSize = 12.sp)
            }
            Text(
                if (theme.premium) "Premium theme" else "Standard theme",
                color = if (theme.premium) Gold else TextMuted,
                fontSize = 12.sp
            )
            if (!isOwned) {
                PrimaryButton(text = "Purchase for ${theme.price.coins} coins", onClick = onPurchase)
            }
            if (isOwned && !isEquipped) {
                GlassButton(text = "Equip for room", onClick = onEquip)
            }
            if (isOwned) {
                GlassButton(text = "Apply to this room", onClick = onApplyToRoom)
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

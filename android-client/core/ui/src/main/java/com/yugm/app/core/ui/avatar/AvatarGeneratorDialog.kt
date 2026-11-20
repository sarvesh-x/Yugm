package com.yugm.app.core.ui.avatar

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SentimentSatisfied
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.yugm.app.core.ui.theme.PrimaryPink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SaffronGold

data class AvatarGeneratorUiState(
    val original: AvatarDescriptor,
    val draft: AvatarDescriptor,
    val selectedCategory: AvatarCategory
)

@Composable
fun AvatarGeneratorDialog(
    initialAvatar: AvatarDescriptor?,
    engine: AvatarEngine = remember { MultiavatarEngine() },
    cache: AvatarCache = remember { AvatarCache(maxSize = 384) },
    onConfirm: (AvatarDescriptor) -> Unit,
    onDismiss: () -> Unit
) {
    val original = remember(initialAvatar) { initialAvatar ?: engine.generateRandom() }
    var draft by remember(original) { mutableStateOf(original) }
    var selectedCategory by remember { mutableStateOf(AvatarCategory.TOP) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .heightIn(max = 760.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 8.dp, top = 10.dp, bottom = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "Create your avatar",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            "Make it uniquely yours",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    PrimaryPurple.copy(alpha = 0.20f),
                                    PrimaryPink.copy(alpha = 0.10f),
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
                                )
                            )
                        )
                        .padding(vertical = 18.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(188.dp)
                            .clip(CircleShape)
                            .border(
                                BorderStroke(2.dp, Brush.linearGradient(listOf(PrimaryPink, SaffronGold, PrimaryPurple))),
                                CircleShape
                            )
                            .padding(6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        GeneratedAvatar(
                            descriptor = draft,
                            engine = engine,
                            cache = cache,
                            size = 172.dp
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    androidx.compose.material3.OutlinedButton(
                        onClick = { draft = engine.generateRandom() },
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Shuffle, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Randomize all")
                    }
                }

                Spacer(Modifier.height(10.dp))
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(AvatarCategory.entries) { category ->
                        val selected = selectedCategory == category
                        val container = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                        val border = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent
                        Column(
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(container)
                                .border(BorderStroke(1.dp, border), RoundedCornerShape(14.dp))
                                .clickable { selectedCategory = category }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = category.icon(),
                                contentDescription = null,
                                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                category.displayLabel(),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        selectedCategory.displayLabel(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { draft = engine.randomizePart(draft, selectedCategory) }) {
                        Icon(Icons.Default.Shuffle, contentDescription = "Shuffle ${selectedCategory.displayLabel()}")
                    }
                    IconButton(onClick = { draft = original }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reset")
                    }
                }

                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .heightIn(min = 180.dp)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 8.dp)
                ) {
                    items((0..47).toList(), key = { it }) { variantId ->
                        val selected = partValue(draft.parts, selectedCategory) == variantId
                        val candidate = if (selected) draft else replacePart(draft, selectedCategory, variantId)
                        Box(
                            modifier = Modifier
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = if (selected) 0.55f else 0.35f))
                                .border(
                                    BorderStroke(if (selected) 2.dp else 1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                                    RoundedCornerShape(16.dp)
                                )
                                .clickable { draft = candidate }
                                .padding(6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            GeneratedAvatar(
                                descriptor = candidate,
                                engine = engine,
                                cache = cache,
                                size = 56.dp
                            )
                            if (selected) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primary),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    Button(
                        onClick = { onConfirm(draft) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        )
                    ) {
                        Text("Use this avatar", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

private fun AvatarCategory.displayLabel(): String = when (this) {
    AvatarCategory.TOP -> "Hair"
    AvatarCategory.HEAD -> "Face"
    AvatarCategory.EYES -> "Eyes"
    AvatarCategory.MOUTH -> "Mouth"
    AvatarCategory.CLOTHES -> "Clothes"
    AvatarCategory.BACKGROUND -> "Background"
}

private fun AvatarCategory.icon(): ImageVector = when (this) {
    AvatarCategory.TOP -> Icons.Default.Face
    AvatarCategory.HEAD -> Icons.Default.SentimentSatisfied
    AvatarCategory.EYES -> Icons.Default.Visibility
    AvatarCategory.MOUTH -> Icons.Default.SentimentSatisfied
    AvatarCategory.CLOTHES -> Icons.Default.Checkroom
    AvatarCategory.BACKGROUND -> Icons.Default.Palette
}

private fun partValue(parts: AvatarParts, category: AvatarCategory): Int = when (category) {
    AvatarCategory.BACKGROUND -> parts.background
    AvatarCategory.CLOTHES -> parts.clothes
    AvatarCategory.HEAD -> parts.head
    AvatarCategory.MOUTH -> parts.mouth
    AvatarCategory.EYES -> parts.eyes
    AvatarCategory.TOP -> parts.top
}

private fun replacePart(draft: AvatarDescriptor, category: AvatarCategory, value: Int): AvatarDescriptor {
    val parts = when (category) {
        AvatarCategory.BACKGROUND -> draft.parts.copy(background = value)
        AvatarCategory.CLOTHES -> draft.parts.copy(clothes = value)
        AvatarCategory.HEAD -> draft.parts.copy(head = value)
        AvatarCategory.MOUTH -> draft.parts.copy(mouth = value)
        AvatarCategory.EYES -> draft.parts.copy(eyes = value)
        AvatarCategory.TOP -> draft.parts.copy(top = value)
    }
    return draft.copy(parts = parts)
}

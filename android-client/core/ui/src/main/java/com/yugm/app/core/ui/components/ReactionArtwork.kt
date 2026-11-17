package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.imageLoader
import coil.request.ImageRequest

/**
 * Renders a room reaction.
 *
 * The emoji (or a short label) is always drawn first as a lightweight placeholder, so
 * animated GIF reactions show something immediately while the asset downloads/decodes.
 * The remote artwork is layered on top and replaces the placeholder once it is ready.
 */
@Composable
fun ReactionArtwork(
    emoji: String,
    assetUrl: String,
    label: String = "",
    modifier: Modifier = Modifier,
    emojiSize: TextUnit = 26.sp,
    contentDescription: String? = null
) {
    val placeholder = reactionPlaceholderText(emoji, label)
    if (assetUrl.isBlank()) {
        Text(
            text = placeholder,
            fontSize = emojiSize,
            textAlign = TextAlign.Center,
            modifier = modifier
        )
        return
    }
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        var artworkLoaded by remember(assetUrl) { mutableStateOf(false) }
        if (!artworkLoaded) {
            Text(
                text = placeholder,
                fontSize = emojiSize,
                textAlign = TextAlign.Center
            )
        }
        SubcomposeAsyncImage(
            model = assetUrl,
            contentDescription = contentDescription ?: label.ifBlank { "Reaction" },
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
            loading = {},
            error = {},
            onLoading = { artworkLoaded = false },
            onSuccess = { artworkLoaded = true },
            onError = { artworkLoaded = false }
        )
    }
}

private fun reactionPlaceholderText(emoji: String, label: String): String =
    emoji.ifBlank { label.trim().take(2) }.ifBlank { "✨" }

/**
 * Warms the image cache as soon as a reaction catalog arrives so opening the picker
 * does not have to download every GIF from scratch.
 */
@Composable
fun PrefetchReactionAssets(urls: List<String>) {
    val context = LocalContext.current
    LaunchedEffect(urls) {
        val loader = context.imageLoader
        urls.asSequence()
            .filter { it.isNotBlank() }
            .distinct()
            .forEach { url ->
                loader.enqueue(
                    ImageRequest.Builder(context)
                        .data(url)
                        .build()
                )
            }
    }
}

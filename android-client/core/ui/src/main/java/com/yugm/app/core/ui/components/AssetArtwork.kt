package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import coil.compose.SubcomposeAsyncImage
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.AssetVariant

/**
 * Chooses the URL for a single asset-aware image entry point. A named variant wins,
 * then `full`, then the direct URL. Values that are clearly not URLs (emoji, gift
 * identifiers) are treated as absent so they never trigger a failed image request.
 */
private val ASSET_URL_SCHEME = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*:")
private const val ASSET_FULL_VARIANT = "full"

fun selectAssetArtworkUrl(
    assetUrl: String?,
    variants: List<AssetVariant> = emptyList(),
    preferredVariant: String? = null
): String? {
    val named = preferredVariant?.takeIf { it.isNotBlank() }?.let { name ->
        variants.firstOrNull { it.name.equals(name, ignoreCase = true) && it.url.isNotBlank() }
    }
    val full = variants.firstOrNull {
        it.name.equals(ASSET_FULL_VARIANT, ignoreCase = true) && it.url.isNotBlank()
    }
    val candidate = named?.url ?: full?.url ?: assetUrl
    val value = candidate?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    if (!looksLikeAssetUrl(value)) return null
    return resolveMediaUrl(value)
}

private fun looksLikeAssetUrl(value: String): Boolean =
    value.startsWith("/") || ASSET_URL_SCHEME.containsMatchIn(value) || value.contains('/')

/**
 * The single asset-aware artwork renderer for cosmetics, badges and gifts.
 * It uses the existing `resolveMediaUrl()`/Coil path and draws [fallback] only when
 * there is no usable asset or the image fails to load.
 */
@Composable
fun AssetArtwork(
    assetUrl: String?,
    variants: List<AssetVariant> = emptyList(),
    preferredVariant: String? = null,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.Fit,
    colorFilter: ColorFilter? = null,
    fallback: @Composable () -> Unit
) {
    val url = selectAssetArtworkUrl(assetUrl, variants, preferredVariant)
    Box(modifier, contentAlignment = Alignment.Center) {
        if (url == null) {
            fallback()
        } else {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = contentDescription,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
                colorFilter = colorFilter,
                loading = { fallback() },
                error = { fallback() }
            )
        }
    }
}

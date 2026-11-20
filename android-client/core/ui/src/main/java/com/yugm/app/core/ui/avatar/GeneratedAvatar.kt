package com.yugm.app.core.ui.avatar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer

private val defaultAvatarEngine: AvatarEngine = MultiavatarEngine()
private val defaultAvatarCache: AvatarCache = AvatarCache(maxSize = 256)

@Composable
fun GeneratedAvatar(
    descriptor: AvatarDescriptor,
    engine: AvatarEngine = defaultAvatarEngine,
    cache: AvatarCache = defaultAvatarCache,
    size: Dp = 64.dp,
    shape: Shape = CircleShape,
    contentDescription: String? = "Generated avatar",
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val key = remember(descriptor) { cache.key(descriptor) }
    var svgBytes by remember(key) { mutableStateOf(cache.get(key)) }

    LaunchedEffect(key, descriptor) {
        if (svgBytes != null) return@LaunchedEffect
        val rendered = withContext(Dispatchers.Default) {
            try {
                cache.get(key) ?: engine.renderSvg(descriptor).also { cache.put(key, it) }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Throwable) {
                null
            }
        }
        if (rendered != null) {
            svgBytes = rendered
        }
    }

    val boxModifier = modifier.size(size).clip(shape)
    val bytes = svgBytes
    if (bytes == null) {
        Box(boxModifier.background(Color.Transparent))
        return
    }

    val request = remember(bytes, size, key) {
        val px = with(density) { size.roundToPx().coerceAtLeast(1) }
        ImageRequest.Builder(context)
            .data(ByteBuffer.wrap(bytes))
            .memoryCacheKey("$key:${px}px")
            .diskCachePolicy(CachePolicy.DISABLED)
            .size(px, px)
            .decoderFactory(SvgDecoder.Factory())
            .allowHardware(false)
            .crossfade(false)
            .build()
    }
    Box(boxModifier.background(Color.Transparent)) {
        AsyncImage(
            model = request,
            contentDescription = contentDescription,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}

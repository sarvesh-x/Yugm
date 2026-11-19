package com.yugm.app.feature.auth.screens

import java.net.URI

private const val MAX_AVATAR_BYTES = 220 * 1024
private val DATA_IMAGE_PATTERN = Regex(
    "^data:image/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/]*={0,2})$",
    RegexOption.IGNORE_CASE,
)

internal fun isValidProfileAvatarReference(value: String): Boolean {
    val reference = value.trim()
    if (reference.isBlank()) return true

    if (reference.startsWith("data:", ignoreCase = true)) {
        val payload = DATA_IMAGE_PATTERN.matchEntire(reference)?.groupValues?.getOrNull(1)
            ?: return false
        if (payload.isEmpty() || payload.length % 4 != 0) return false
        val padding = payload.takeLastWhile { it == '=' }.length
        val decodedBytes = (payload.length / 4) * 3 - padding
        return decodedBytes in 1..MAX_AVATAR_BYTES
    }

    return runCatching {
        URI(reference).let { uri ->
            uri.scheme.equals("https", ignoreCase = true) || uri.scheme.equals("http", ignoreCase = true)
        } && URI(reference).host?.isNotBlank() == true
    }.getOrDefault(false)
}

package com.yugm.app.core.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URI

/** Progress event for a managed media upload. The session id enables cancellation. */
data class MediaUploadProgress(
    val sessionId: String,
    val uploadedBytes: Long,
    val totalBytes: Long
)

internal data class MediaUploadGrant(
    val sessionId: String,
    val uploadUrl: String,
    val contentType: String,
    val expiresAt: String
)

/** Pure grant validation so malformed or unsafe storage URLs never reach OkHttp. */
internal fun parseMediaUploadGrant(payload: JSONObject, fallbackContentType: String): MediaUploadGrant {
    val sessionId = payload.optString("sessionId")
    val uploadUrl = payload.optString("uploadUrl")
    if (sessionId.isBlank() || uploadUrl.isBlank()) {
        throw ApiProtocolException("Media upload response is missing a session or grant")
    }
    val uri = runCatching { URI(uploadUrl) }.getOrNull()
    if (uri?.scheme?.lowercase() !in setOf("http", "https") || uri?.host.isNullOrBlank()) {
        throw ApiProtocolException("Media upload returned an invalid storage grant")
    }
    val signedContentType = payload.optJSONObject("requiredHeaders")
        ?.optString("Content-Type")
        ?.takeIf(String::isNotBlank)
        ?: fallbackContentType
    return MediaUploadGrant(
        sessionId = sessionId,
        uploadUrl = uploadUrl,
        contentType = signedContentType,
        expiresAt = payload.optString("expiresAt")
    )
}

/**
 * Client for the centralized R2 upload-session protocol. Storage keys, buckets
 * and public URLs are never constructed here; the server owns all of them.
 */
internal object MediaUploadApi {

    suspend fun createAvatarSession(
        token: String,
        bytes: ByteArray,
        mimeType: String,
        fileName: String
    ): MediaUploadGrant = withContext(Dispatchers.IO) {
        val payload = YugmHttpClient.post(
            "/media/uploads",
            token,
            JSONObject()
                .put("category", "AVATAR")
                .put("contentType", mimeType)
                .put("bytes", bytes.size.toLong())
                .put("fileName", fileName)
        )
        val data = payload.optJSONObject("data")
            ?: throw ApiProtocolException("Media upload response has no data")
        parseMediaUploadGrant(data, mimeType)
    }

    suspend fun uploadToStorage(
        grant: MediaUploadGrant,
        bytes: ByteArray,
        onProgress: (uploaded: Long, total: Long) -> Unit,
        isCancelled: () -> Boolean
    ) {
        YugmHttpClient.uploadToPresignedUrl(grant.uploadUrl, bytes, grant.contentType, onProgress, isCancelled)
    }

    suspend fun completeAvatar(token: String, sessionId: String): String = withContext(Dispatchers.IO) {
        val payload = YugmHttpClient.post(
            "/media/uploads/$sessionId/complete",
            token,
            JSONObject()
        )
        val data = payload.optJSONObject("data")
            ?: throw ApiProtocolException("Media completion response has no data")
        val url = data.optString("avatarUrl")
        if (url.isBlank()) throw ApiProtocolException("Media completion returned no URL")
        resolveMediaUrl(url) ?: throw ApiProtocolException("Media completion returned an invalid URL")
    }

    suspend fun cancel(token: String, sessionId: String) = withContext(Dispatchers.IO) {
        YugmHttpClient.delete("/media/uploads/$sessionId", token)
        Unit
    }
}

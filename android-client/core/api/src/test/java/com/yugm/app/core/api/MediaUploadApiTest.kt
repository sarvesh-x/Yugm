package com.yugm.app.core.api

import okhttp3.MediaType.Companion.toMediaType
import okio.Buffer
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class MediaUploadApiTest {

    @Test
    fun parsesGrantAndPrefersSignedContentType() {
        val payload = JSONObject()
            .put("sessionId", "session-1")
            .put("uploadUrl", "https://storage.example.test/staging/session?X-Amz-Signature=abc")
            .put("requiredHeaders", JSONObject().put("Content-Type", "image/webp"))
            .put("expiresAt", "2026-11-22T12:00:00Z")

        val grant = parseMediaUploadGrant(payload, "image/png")

        assertEquals("session-1", grant.sessionId)
        assertEquals("https://storage.example.test/staging/session?X-Amz-Signature=abc", grant.uploadUrl)
        assertEquals("image/webp", grant.contentType)
        assertEquals("2026-11-22T12:00:00Z", grant.expiresAt)
    }

    @Test
    fun fallsBackToMimeTypeWhenGrantHasNoSignedHeader() {
        val payload = JSONObject()
            .put("sessionId", "session-2")
            .put("uploadUrl", "http://storage.example.test/staging/session")
            .put("expiresAt", "2026-11-22T12:00:00Z")

        assertEquals("image/png", parseMediaUploadGrant(payload, "image/png").contentType)
    }

    @Test
    fun rejectsMissingFieldsAndUnsafeStorageSchemes() {
        assertThrows(ApiProtocolException::class.java) {
            parseMediaUploadGrant(JSONObject(), "image/png")
        }
        assertThrows(ApiProtocolException::class.java) {
            parseMediaUploadGrant(
                JSONObject().put("sessionId", "session-3").put("uploadUrl", "file:///etc/passwd"),
                "image/png"
            )
        }
        assertThrows(ApiProtocolException::class.java) {
            parseMediaUploadGrant(
                JSONObject().put("sessionId", "session-4").put("uploadUrl", "javascript:alert(1)"),
                "image/png"
            )
        }
    }

    @Test
    fun progressBodyWritesChunksAndReportsCompletion() {
        val bytes = ByteArray(100_000) { it.toByte() }
        val progress = mutableListOf<Pair<Long, Long>>()
        val body = ProgressRequestBody(
            bytes = bytes,
            mediaType = "image/png".toMediaType(),
            onProgress = { uploaded, total -> progress += uploaded to total },
            isCancelled = { false }
        )

        assertEquals("image/png", body.contentType().toString())
        assertEquals(bytes.size.toLong(), body.contentLength())

        val sink = Buffer()
        body.writeTo(sink)

        assertEquals(bytes.asList(), sink.readByteArray().toList())
        assertEquals(0L to 100_000L, progress.first())
        assertEquals(100_000L to 100_000L, progress.last())
        assertEquals(listOf(0L, 32_768L, 65_536L, 98_304L, 100_000L), progress.map { it.first })
    }

    @Test
    fun progressBodyStopsBeforeWritingNextChunkWhenCancelled() {
        val bytes = ByteArray(70_000)
        val progress = mutableListOf<Long>()
        var checks = 0
        val body = ProgressRequestBody(
            bytes = bytes,
            mediaType = "image/png".toMediaType(),
            onProgress = { uploaded, _ -> progress += uploaded },
            isCancelled = { ++checks > 1 }
        )

        assertThrows(IOException::class.java) { body.writeTo(Buffer()) }

        assertEquals(listOf(0L, 32_768L), progress)
    }
}

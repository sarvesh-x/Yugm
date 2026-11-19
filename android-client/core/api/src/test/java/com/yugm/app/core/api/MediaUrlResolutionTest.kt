package com.yugm.app.core.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MediaUrlResolutionTest {
    @Test
    fun keepsAbsoluteObjectStorageAndDataUrlsUntouched() {
        assertEquals(
            "https://pub-example.r2.dev/avatars/user_1.jpg",
            resolveMediaUrl("https://pub-example.r2.dev/avatars/user_1.jpg"),
        )
        assertEquals(
            "data:image/jpeg;base64,AAAA",
            resolveMediaUrl("data:image/jpeg;base64,AAAA"),
        )
    }

    @Test
    fun resolvesApiRelativeMediaPathsAgainstTheApiOrigin() {
        val previous = ApiConfig.apiBaseUrl
        try {
            ApiConfig.apiBaseUrl = "https://api.example.test/api"
            assertEquals(
                "https://api.example.test/uploads/avatar.jpg",
                resolveMediaUrl("/uploads/avatar.jpg"),
            )
        } finally {
            ApiConfig.apiBaseUrl = previous
        }
    }

    @Test
    fun treatsBlankAndMissingMediaReferencesAsAbsent() {
        assertNull(resolveMediaUrl(null))
        assertNull(resolveMediaUrl("   "))
    }
}

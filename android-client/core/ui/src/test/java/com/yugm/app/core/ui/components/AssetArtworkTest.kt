package com.yugm.app.core.ui.components

import com.yugm.app.core.api.ApiConfig
import com.yugm.app.core.model.AssetVariant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AssetArtworkTest {
    private val variants = listOf(
        AssetVariant(name = "full", url = "https://cdn.example.test/full.webp"),
        AssetVariant(name = "preview", url = "/assets/preview.webp")
    )

    @Test
    fun prefersNamedVariantThenFullThenDirectUrl() {
        val previous = ApiConfig.apiBaseUrl
        try {
            ApiConfig.apiBaseUrl = "https://api.example.test/api"
            assertEquals(
                "https://api.example.test/assets/preview.webp",
                selectAssetArtworkUrl("/assets/direct.webp", variants, "preview")
            )
            assertEquals(
                "https://cdn.example.test/full.webp",
                selectAssetArtworkUrl("/assets/direct.webp", variants, "missing")
            )
            assertEquals(
                "https://api.example.test/assets/direct.webp",
                selectAssetArtworkUrl("/assets/direct.webp")
            )
        } finally {
            ApiConfig.apiBaseUrl = previous
        }
    }

    @Test
    fun ignoresBlankOrNonUrlValues() {
        assertNull(selectAssetArtworkUrl(null))
        assertNull(selectAssetArtworkUrl("   "))
        assertNull(selectAssetArtworkUrl("🎁"))
        assertNull(selectAssetArtworkUrl("gift_rose"))
    }

    @Test
    fun skipsVariantsWithoutAUrl() {
        val broken = listOf(AssetVariant(name = "preview", url = ""), variants[0])
        assertEquals(
            "https://cdn.example.test/full.webp",
            selectAssetArtworkUrl(null, broken, "preview")
        )
    }
}

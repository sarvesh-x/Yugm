package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toAchievement
import com.yugm.app.core.api.parsers.toCosmeticCatalog
import com.yugm.app.core.api.parsers.toUserFullInventory
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AssetReferenceParserTest {
    private fun cosmeticJson(): JSONObject = JSONObject()
        .put("id", "cosmetic-1")
        .put("type", "AVATAR_FRAME")
        .put("name", "Nova frame")
        .put("assetUrl", "/uploads/cosmetic.png")
        .put("assetId", "asset-1")
        .put("assetVersion", 4)
        .put("assetVariants", JSONArray()
            .put(JSONObject().put("name", "full").put("url", "https://cdn.example.test/full.webp")
                .put("contentType", "image/webp").put("width", 512).put("height", 512))
            .put(JSONObject().put("name", "preview").put("url", "/assets/preview.webp")
                .put("contentType", "image/webp").put("width", 256)))

    @Test
    fun parsesManagedCosmeticAssetFieldsAndVariants() {
        val previous = ApiConfig.apiBaseUrl
        try {
            ApiConfig.apiBaseUrl = "https://api.example.test/api"
            val catalog = JSONObject().put("cosmetics", JSONArray().put(cosmeticJson())).toCosmeticCatalog()
            val cosmetic = catalog.cosmetics.single()
            assertEquals("https://api.example.test/uploads/cosmetic.png", cosmetic.assetUrl)
            assertEquals("asset-1", cosmetic.assetId)
            assertEquals(4, cosmetic.assetVersion)
            assertEquals(2, cosmetic.assetVariants.size)
            assertEquals("https://cdn.example.test/full.webp", cosmetic.assetVariants[0].url)
            assertEquals(512, cosmetic.assetVariants[0].width)
            assertEquals("https://api.example.test/assets/preview.webp", cosmetic.assetVariants[1].url)
            assertEquals(null, cosmetic.assetVariants[1].height)
        } finally {
            ApiConfig.apiBaseUrl = previous
        }
    }

    @Test
    fun legacyCosmeticKeepsEmptyAssetFields() {
        val legacy = JSONObject().put("id", "legacy").put("type", "AVATAR_FRAME")
        val cosmetic = JSONObject().put("cosmetics", JSONArray().put(legacy)).toCosmeticCatalog().cosmetics.single()
        assertEquals("", cosmetic.assetUrl)
        assertEquals("", cosmetic.assetId)
        assertNull(cosmetic.assetVersion)
        assertTrue(cosmetic.assetVariants.isEmpty())
    }

    @Test
    fun parsesManagedInventoryAndBadgeAssetFields() {
        val previous = ApiConfig.apiBaseUrl
        try {
            ApiConfig.apiBaseUrl = "https://api.example.test/api"
            val inventory = JSONObject()
                .put("cosmetics", JSONArray().put(cosmeticJson().put("isEquipped", true)))
                .toUserFullInventory()
            val item = inventory.cosmetics.single()
            assertEquals("asset-1", item.assetId)
            assertEquals(2, item.assetVariants.size)
            assertTrue(item.isEquipped)

            val badge = JSONObject().put("id", "badge-1").put("imageUrl", "/api/badge-art/badge-1/2")
                .put("assetId", "badge-asset").put("assetVersion", 2)
                .put("assetVariants", JSONArray().put(JSONObject().put("name", "preview")
                    .put("url", "https://cdn.example.test/badge-preview.webp")
                    .put("contentType", "image/webp")))
                .toAchievement()
            assertEquals("badge-asset", badge.assetId)
            assertEquals(2, badge.assetVersion)
            assertEquals("https://cdn.example.test/badge-preview.webp", badge.assetVariants.single().url)
        } finally {
            ApiConfig.apiBaseUrl = previous
        }
    }
}

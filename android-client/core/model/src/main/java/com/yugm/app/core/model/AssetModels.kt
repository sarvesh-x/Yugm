package com.yugm.app.core.model

/**
 * A client-safe variant resolved at read time from the published asset registry.
 * Variants are never copied onto cosmetic or badge documents.
 */
data class AssetVariant(
    val name: String = "",
    val url: String = "",
    val contentType: String = "",
    val width: Int? = null,
    val height: Int? = null
)

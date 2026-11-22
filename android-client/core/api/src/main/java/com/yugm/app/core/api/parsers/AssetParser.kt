package com.yugm.app.core.api.parsers

import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.AssetVariant
import org.json.JSONObject

/** Resolves the public asset URL from a cosmetic/badge DTO (absolute URLs pass through). */
fun JSONObject.optAssetUrl(key: String = "assetUrl"): String {
    val raw = optString(key, "")
    return resolveMediaUrl(raw) ?: raw
}

/** Reads the read-time variant projection from a public cosmetic/badge DTO. */
fun JSONObject.optAssetVersion(): Int? =
    if (has("assetVersion") && !isNull("assetVersion")) optInt("assetVersion") else null

/** Parses published asset variants; malformed entries are ignored so legacy data still loads. */
fun JSONObject.optAssetVariants(key: String = "assetVariants"): List<AssetVariant> {
    val array = optJSONArray(key) ?: return emptyList()
    return buildList {
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            val name = item.optString("name", "")
            val rawUrl = item.optString("url", "")
            if (name.isBlank() || rawUrl.isBlank()) continue
            add(AssetVariant(
                name = name,
                url = resolveMediaUrl(rawUrl) ?: rawUrl,
                contentType = item.optString("contentType", ""),
                width = if (item.has("width") && !item.isNull("width")) item.optInt("width") else null,
                height = if (item.has("height") && !item.isNull("height")) item.optInt("height") else null
            ))
        }
    }
}

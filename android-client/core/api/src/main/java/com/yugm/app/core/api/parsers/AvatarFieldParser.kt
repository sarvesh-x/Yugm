package com.yugm.app.core.api.parsers

import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.AvatarPartsPayload
import org.json.JSONObject

fun JSONObject.parseAvatarTypeField(key: String = "avatarType"): String? =
    optString(key, "").ifBlank { null }

fun JSONObject.parseAvatarPartsField(key: String = "avatarParts"): AvatarPartsPayload? =
    optJSONObject(key)?.let { parts ->
        AvatarPartsPayload(
            background = parts.optInt("background", 0),
            clothes = parts.optInt("clothes", 0),
            head = parts.optInt("head", 0),
            mouth = parts.optInt("mouth", 0),
            eyes = parts.optInt("eyes", 0),
            top = parts.optInt("top", 0)
        )
    }

fun JSONObject.parseAvatarUrlField(key: String = "avatar"): String? =
    optString(key, "").ifBlank { null }?.let { resolveMediaUrl(it) ?: it }

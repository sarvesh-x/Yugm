package com.example.yugm.core.api.parsers

import org.json.JSONObject

fun JSONObject.entityId(): String = when {
    has("_id") -> optString("_id", "")
    has("id") -> optString("id", "")
    else -> ""
}

fun JSONObject.toBooleanMap(): Map<String, Boolean> = buildMap {
    val iterator = keys()
    while (iterator.hasNext()) {
        val key = iterator.next()
        put(key, optBoolean(key, false))
    }
}

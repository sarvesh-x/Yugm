package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.EquippedThemes
import com.example.yugm.core.model.ImmersiveTheme
import com.example.yugm.core.model.ThemePrice
import com.example.yugm.core.model.UserThemesResponse
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toImmersiveTheme(): ImmersiveTheme {
    val colorsArr = optJSONArray("colors")
    val priceObj = optJSONObject("price")
    return ImmersiveTheme(
        key = optString("key", ""),
        name = optString("name", ""),
        type = optString("type", ""),
        category = optString("category", ""),
        colors = if (colorsArr != null) {
            val list = mutableListOf<String>()
            for (i in 0 until colorsArr.length()) list.add(colorsArr.optString(i))
            list
        } else emptyList(),
        animation = optJSONObject("animation")?.let { anim ->
            mutableMapOf<String, Any>().apply {
                for (key in anim.keys()) {
                    val value = anim.get(key)
                    if (value is String || value is Number || value is Boolean) put(key, value)
                }
            }
        },
        ambientSound = if (has("ambientSound") && !isNull("ambientSound")) optString("ambientSound") else null,
        price = if (priceObj != null) ThemePrice(
            coins = priceObj.optInt("coins", 0),
            diamonds = priceObj.optInt("diamonds", 0)
        ) else ThemePrice(),
        premium = optBoolean("premium", false),
        available = optBoolean("available", true)
    )
}

fun JSONObject.toUserThemesResponse(): UserThemesResponse {
    val ownedArr = optJSONArray("owned")
    val owned = if (ownedArr != null) {
        val list = mutableListOf<ImmersiveTheme>()
        for (i in 0 until ownedArr.length()) list.add(ownedArr.getJSONObject(i).toImmersiveTheme())
        list
    } else emptyList()
    val equippedObj = optJSONObject("equipped")
    val equipped = if (equippedObj != null) EquippedThemes(
        room = if (equippedObj.has("room") && !equippedObj.isNull("room")) equippedObj.optString("room") else null,
        profile = if (equippedObj.has("profile") && !equippedObj.isNull("profile")) equippedObj.optString("profile") else null,
        entrance = if (equippedObj.has("entrance") && !equippedObj.isNull("entrance")) equippedObj.optString("entrance") else null
    ) else EquippedThemes()
    return UserThemesResponse(owned = owned, equipped = equipped)
}

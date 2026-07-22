package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.toImmersiveTheme
import com.example.yugm.core.api.parsers.toUserThemesResponse
import com.example.yugm.core.model.EquippedThemes
import com.example.yugm.core.model.ImmersiveTheme
import com.example.yugm.core.model.Room
import com.example.yugm.core.api.parsers.toRoom
import com.example.yugm.core.model.UserThemesResponse
import org.json.JSONObject

object ThemesApi {

    suspend fun themes(token: String): List<ImmersiveTheme> {
        val data = YugmHttpClient.get("/themes", token).getJSONObject("data")
        val arr = data.getJSONArray("themes")
        val list = mutableListOf<ImmersiveTheme>()
        for (i in 0 until arr.length()) list.add(arr.getJSONObject(i).toImmersiveTheme())
        return list
    }

    suspend fun purchaseTheme(token: String, themeKey: String): ImmersiveTheme {
        val body = JSONObject().put("themeKey", themeKey)
        val data = YugmHttpClient.post("/themes/purchase", token, body).getJSONObject("data")
        return data.getJSONObject("theme").toImmersiveTheme()
    }

    suspend fun setRoomTheme(token: String, roomId: String, themeKey: String): Room {
        val body = JSONObject().put("themeKey", themeKey)
        val data = YugmHttpClient.post("/rooms/$roomId/theme", token, body).getJSONObject("data")
        return data.getJSONObject("room").toRoom()
    }

    suspend fun userThemes(token: String): UserThemesResponse {
        val data = YugmHttpClient.get("/user/themes", token).getJSONObject("data")
        return data.toUserThemesResponse()
    }

    suspend fun equipTheme(token: String, slot: String, themeKey: String?): EquippedThemes {
        val body = JSONObject().put("slot", slot)
        if (themeKey != null) body.put("themeKey", themeKey) else body.put("themeKey", JSONObject.NULL)
        val data = YugmHttpClient.post("/user/themes/equip", token, body).getJSONObject("data")
        val equippedObj = data.getJSONObject("equipped")
        return EquippedThemes(
            room = if (equippedObj.has("room") && !equippedObj.isNull("room")) equippedObj.optString("room") else null,
            profile = if (equippedObj.has("profile") && !equippedObj.isNull("profile")) equippedObj.optString("profile") else null,
            entrance = if (equippedObj.has("entrance") && !equippedObj.isNull("entrance")) equippedObj.optString("entrance") else null
        )
    }
}

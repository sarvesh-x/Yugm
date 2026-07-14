package com.example.yugm.api

import com.example.yugm.model.Clan
import com.example.yugm.model.ClanMessage
import com.example.yugm.model.ClanSummary
import org.json.JSONArray
import org.json.JSONObject

object ClanApi {
    suspend fun myClan(token: String): Clan? {
        val data = YugmHttpClient.get("/clans/me", token).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan()
    }

    suspend fun listClans(token: String, query: String = ""): List<ClanSummary> {
        val q = if (query.isNotBlank()) "?q=${java.net.URLEncoder.encode(query, "UTF-8")}" else ""
        val data = YugmHttpClient.get("/clans$q", token).getJSONObject("data")
        return data.optJSONArray("clans")?.let { arr ->
            buildList<ClanSummary> { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toClanSummary()) }
        } ?: emptyList()
    }

    suspend fun getClanDetail(token: String, clanId: String): Clan {
        val data = YugmHttpClient.get("/clans/$clanId", token).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun createClan(token: String, name: String, description: String = "", privacy: String = "PUBLIC", familyLabel: String = "Family"): Clan {
        val data = YugmHttpClient.post("/clans", token, JSONObject()
            .put("name", name)
            .put("description", description)
            .put("privacy", privacy)
            .put("familyLabel", familyLabel)
        ).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun joinClan(token: String, clanId: String): Clan {
        val data = YugmHttpClient.post("/clans/$clanId/join", token, JSONObject()).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun leaveClan(token: String, clanId: String) {
        YugmHttpClient.post("/clans/$clanId/leave", token, JSONObject())
    }

    suspend fun getClanMessages(token: String, clanId: String): List<ClanMessage> {
        val data = YugmHttpClient.get("/clans/$clanId/messages", token).getJSONObject("data")
        return data.optJSONArray("messages")?.toClanMessages() ?: emptyList()
    }

    suspend fun sendClanMessage(token: String, clanId: String, message: String): ClanMessage {
        val data = YugmHttpClient.post("/clans/$clanId/messages", token, JSONObject().put("message", message)).getJSONObject("data")
        return data.optJSONObject("message")?.toClanMessage() ?: ClanMessage()
    }

    suspend fun reactToClanMessage(token: String, clanId: String, messageId: String, type: String): JSONObject {
        return YugmHttpClient.post("/clans/$clanId/messages/$messageId/reactions", token, JSONObject().put("type", type))
    }

    suspend fun deleteClanMessage(token: String, clanId: String, messageId: String) {
        YugmHttpClient.delete("/clans/$clanId/messages/$messageId", token)
    }

    suspend fun reportClanMessage(token: String, clanId: String, messageId: String, reason: String = "", description: String = "") {
        YugmHttpClient.post("/clans/$clanId/messages/$messageId/report", token, JSONObject()
            .put("reason", reason)
            .put("description", description)
        )
    }
}

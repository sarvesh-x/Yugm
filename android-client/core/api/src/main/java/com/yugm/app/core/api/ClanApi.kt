package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.ClanInvitation
import com.yugm.app.core.model.ClanRankingEntry
import org.json.JSONArray
import org.json.JSONObject

object ClanApi {
    suspend fun invitations(token: String): List<ClanInvitation> {
        val data = YugmHttpClient.get("/clans/invitations", token).getJSONObject("data")
        val invites = data.optJSONArray("invitations") ?: JSONArray()
        return buildList {
            for (index in 0 until invites.length()) {
                val item = invites.optJSONObject(index) ?: continue
                val clan = item.optJSONObject("clanId")
                val inviter = item.optJSONObject("inviterId")
                add(ClanInvitation(
                    id = item.optString("_id", item.optString("id")),
                    clanId = clan?.optString("_id", clan.optString("id")) ?: item.optString("clanId"),
                    clanName = clan?.optString("name").orEmpty().ifBlank { "Clan" },
                    clanAvatar = clan?.optString("avatar")?.takeIf(String::isNotBlank),
                    inviterName = inviter?.optString("name").orEmpty(),
                    expiresAt = item.optString("expiresAt")
                ))
            }
        }
    }

    suspend fun respondToInvitation(token: String, inviteId: String, accept: Boolean) {
        val action = if (accept) "accept" else "decline"
        YugmHttpClient.post("/clans/invitations/$inviteId/$action", token, JSONObject())
    }

    suspend fun inviteMember(token: String, clanId: String, userId: String) {
        YugmHttpClient.post("/clans/$clanId/invitations", token, JSONObject().put("userId", userId))
    }

    suspend fun transferOwnership(token: String, clanId: String, userId: String) {
        YugmHttpClient.post("/clans/$clanId/transfer-ownership", token, JSONObject().put("userId", userId))
    }

    suspend fun leaderboard(token: String, limit: Int = 20): List<ClanRankingEntry> {
        val data = YugmHttpClient.get("/clans/leaderboard?limit=$limit", token).getJSONObject("data")
        val clans = data.optJSONArray("clans") ?: JSONArray()
        return buildList {
            for (index in 0 until clans.length()) {
                val item = clans.optJSONObject(index) ?: continue
                add(ClanRankingEntry(
                    id = item.optString("id", item.optString("_id")),
                    rank = item.optInt("rank", index + 1),
                    name = item.optString("name", "Clan"),
                    avatar = item.optString("avatar").takeIf(String::isNotBlank),
                    familyLabel = item.optString("familyLabel"),
                    memberCount = item.optInt("memberCount"),
                    totalXp = item.optLong("totalXp")
                ))
            }
        }
    }

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

    suspend fun createClan(token: String, name: String, description: String = "", privacy: String = "PUBLIC", familyLabel: String = "Family", avatar: String? = null): Clan {
        val body = JSONObject()
            .put("name", name)
            .put("description", description)
            .put("privacy", privacy)
            .put("familyLabel", familyLabel)
        if (!avatar.isNullOrBlank()) body.put("avatar", avatar)
        val data = YugmHttpClient.post("/clans", token, body).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun updateClan(
        token: String,
        clanId: String,
        name: String,
        description: String,
        privacy: String,
        familyLabel: String,
        avatar: String?
    ): Clan {
        val body = JSONObject()
            .put("name", name)
            .put("description", description)
            .put("privacy", privacy)
            .put("familyLabel", familyLabel)
            .put("avatar", if (avatar.isNullOrBlank()) JSONObject.NULL else avatar)
        val data = YugmHttpClient.patch("/clans/$clanId", token, body).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun setMemberRole(token: String, clanId: String, userId: String, role: String): Clan {
        val data = YugmHttpClient.patch("/clans/$clanId/members/$userId/role", token, JSONObject().put("role", role))
            .getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun kickMember(token: String, clanId: String, userId: String): Clan {
        val data = YugmHttpClient.delete("/clans/$clanId/members/$userId", token).getJSONObject("data")
        return data.optJSONObject("clan")?.toClan() ?: Clan()
    }

    suspend fun deleteClan(token: String, clanId: String) {
        YugmHttpClient.delete("/clans/$clanId", token)
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

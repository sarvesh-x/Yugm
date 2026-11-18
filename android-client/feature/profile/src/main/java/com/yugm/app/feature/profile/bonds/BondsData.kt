package com.yugm.app.feature.profile.bonds

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.YugmHttpClient
import com.yugm.app.core.api.resolveMediaUrl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject

internal data class BondPerson(val id: String, val name: String, val username: String, val avatar: String)
internal data class BondKind(val id: String, val name: String, val description: String, val icon: String)
internal data class BondGift(val id: String, val name: String, val icon: String, val price: Int, val purpose: String, val kind: String, val days: Int, val points: Int)
internal data class BondCard(
    val id: String, val kind: String, val kindName: String, val partner: BondPerson, val slot: Int,
    val status: String, val days: Int, val points: Int, val level: Int, val levelName: String,
    val levelStart: Int, val nextThreshold: Int?, val activatedAt: String, val endedAt: String, val milestones: List<Int>,
    val nextAnniversaryAt: String
)
internal data class BondInvitation(
    val id: String, val kind: String, val partner: BondPerson, val slot: Int, val incoming: Boolean,
    val typeChange: Boolean, val message: String, val gift: String, val giftIcon: String, val price: Int, val expiresAt: String
)
internal data class BondsHome(
    val capacity: Int, val balance: Int, val eligible: Boolean, val free: Boolean, val hours: Int,
    val allowsRequests: Boolean, val pushEnabled: Boolean, val kinds: List<BondKind>, val active: List<BondCard>,
    val ended: List<BondCard>, val requests: List<BondInvitation>
)
internal data class BondActivity(val kind: String, val points: Int, val at: String)
internal data class BondDetail(val card: BondCard, val self: BondPerson, val preferences: JSONObject, val activity: List<BondActivity>)
internal data class PublicBond(val id: String, val partner: BondPerson, val kind: String, val days: Int?, val level: Int?,
    val showBadge: Boolean, val weeklyRank: Int?)
internal data class BondsShowcase(val bonds: List<PublicBond>, val canInvite: Boolean)
internal data class BondRank(val rank: Int, val score: Int, val names: List<String>, val kind: String)
internal data class BondRanks(val entries: List<BondRank>, val resetsAt: String)

private fun JSONObject.string(key: String) = if (isNull(key)) "" else optString(key)
private fun JSONArray?.objects(): List<JSONObject> = if (this == null) emptyList()
    else (0 until length()).mapNotNull { optJSONObject(it) }
private fun JSONObject.person() = BondPerson(string("id"), string("name").ifBlank { "Unavailable profile" },
    string("username"), resolveMediaUrl(string("avatar")).orEmpty())
private fun JSONObject.person(key: String) = (optJSONObject(key) ?: JSONObject()).person()
private fun JSONObject.card() = BondCard(
    string("id"), string("kind"), string("kindName"), person("partner"), optInt("slot"),
    string("status"), optInt("days"), optInt("points"), optInt("level"), string("levelName"), optInt("levelStart"),
    optInt("nextThreshold").takeIf { !isNull("nextThreshold") }, string("activatedAt"), string("endedAt"),
    optJSONArray("milestoneDays")?.let { days -> (0 until days.length()).map { days.getInt(it) } }.orEmpty(),
    string("nextAnniversaryAt")
)

internal object BondsApi {
    private suspend fun read(token: String, path: String) = YugmHttpClient.get("/bonds$path", token).getJSONObject("data")
    suspend fun home(token: String): BondsHome {
        val data = read(token, "/me")
        return BondsHome(data.optInt("capacity", 3), data.optInt("balance"), data.optBoolean("eligible"),
            data.optBoolean("freeInvitations"), data.optInt("invitationHours", 24), data.optBoolean("allowsRequests"), data.optBoolean("pushEnabled", true),
            data.optJSONArray("kinds").objects().map { BondKind(it.string("id"), it.string("name"), it.string("description"), it.string("icon")) },
            data.optJSONArray("active").objects().map { it.card() }, data.optJSONArray("ended").objects().map { it.card() },
            data.optJSONArray("requests").objects().map { row ->
                BondInvitation(row.string("id"), row.string("kind"), row.person("partner"), row.optInt("slot"), row.optBoolean("incoming"),
                    row.optBoolean("typeChange"), row.string("message"), row.string("giftName"), row.string("giftIcon"),
                    row.optInt("price"), row.string("expiresAt"))
            })
    }
    suspend fun gifts(token: String) = read(token, "/gift-catalog").optJSONArray("gifts").objects().map {
        BondGift(it.string("id"), it.string("name"), it.string("icon"), it.optInt("price"),
            it.string("purpose"), it.string("kind"), it.optInt("minimumDays"), it.optInt("points"))
    }
    suspend fun friends(token: String) = read(token, "/eligible-friends").optJSONArray("friends").objects().map { it.person() }
    suspend fun detail(token: String, id: String): BondDetail {
        val row = read(token, "/$id")
        return BondDetail(row.card(), row.person("self"), row.getJSONObject("preferences"),
            row.optJSONArray("activity").objects().map { BondActivity(it.string("kind"), it.optInt("points"), it.string("createdAt")) })
    }
    suspend fun showcase(token: String, userId: String): BondsShowcase {
        val row = read(token, "/profile/$userId")
        return BondsShowcase(row.optJSONArray("bonds").objects().map {
            PublicBond(it.string("id"), it.person("partner"), it.string("kindName"),
                it.optInt("days").takeIf { _ -> !it.isNull("days") }, it.optInt("level").takeIf { _ -> !it.isNull("level") },
                it.optBoolean("showBadge"), it.optInt("weeklyRank").takeIf { rank -> rank > 0 })
        }, row.optBoolean("canInvite"))
    }
    suspend fun rankings(token: String, category: String, previous: Boolean, window: String, kind: String, scope: String): BondRanks {
        val row = read(token, "/leaderboards?category=$category&period=${if (previous) "previous" else "current"}&window=$window&kind=$kind&scope=$scope")
        return BondRanks(row.optJSONArray("entries").objects().map {
            BondRank(it.optInt("rank"), it.optInt("score"), it.optJSONArray("people").objects().map { actor -> actor.string("name") }, it.string("kind"))
        }, row.optJSONObject("period")?.string("end").orEmpty())
    }

    suspend fun mutate(token: String, path: String, body: JSONObject, method: String): JSONObject {
        val url = "/bonds$path"
        return when (method) {
            "PATCH" -> YugmHttpClient.patch(url, token, body)
            "PUT" -> YugmHttpClient.put(url, token, body)
            else -> YugmHttpClient.post(url, token, body)
        }.getJSONObject("data")
    }
}

internal data class BondsUiState(
    val home: BondsHome? = null, val gifts: List<BondGift> = emptyList(), val detail: BondDetail? = null,
    val friends: List<BondPerson> = emptyList(), val ranking: BondRanks? = null,
    val busy: Boolean = false, val error: String? = null
)

@HiltViewModel
internal class BondsViewModel @Inject constructor() : ViewModel() {
    private val mutable = MutableStateFlow(BondsUiState())
    val state = mutable.asStateFlow()

    suspend fun refresh(token: String, bondId: String? = null) {
        try {
            val home = BondsApi.home(token)
            val detail = bondId?.let { BondsApi.detail(token, it) }
            mutable.update { it.copy(home = home, detail = detail) }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            mutable.update { it.copy(error = error.message ?: "Couldn’t load Bonds") }
        }
    }

    fun loadCatalog(token: String, includeFriends: Boolean) = runAction {
        val gifts = BondsApi.gifts(token)
        val friends = if (includeFriends) BondsApi.friends(token) else mutable.value.friends
        mutable.update { it.copy(gifts = gifts, friends = friends) }
    }

    fun rankings(token: String, type: String, previous: Boolean, window: String, kind: String, scope: String) = runAction {
        val ranks = BondsApi.rankings(token, type, previous, window, kind, scope)
        mutable.update { it.copy(ranking = ranks) }
    }

    fun mutate(token: String, path: String, body: JSONObject = JSONObject(), method: String = "POST",
        bondId: String? = null, onSuccess: (JSONObject) -> Unit = {}) = runAction {
        val result = BondsApi.mutate(token, path, body, method)
        refresh(token, bondId)
        onSuccess(result)
    }

    fun clearError() = mutable.update { it.copy(error = null) }

    private fun runAction(action: suspend () -> Unit) {
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                action()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                mutable.update { it.copy(error = error.message ?: "Couldn’t complete that action") }
            } finally {
                mutable.update { it.copy(busy = false) }
            }
        }
    }
}


package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.GiftLeaderboardResponse
import com.example.yugm.core.model.GroupChat
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.ReferralStatsResponse
import com.example.yugm.core.model.WishlistItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class SocialViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var leaderboard by mutableStateOf<GiftLeaderboardResponse?>(null)
        private set
    var referralCode by mutableStateOf("")
        private set
    var referralStats by mutableStateOf<ReferralStatsResponse?>(null)
        private set
    var suggestedHosts by mutableStateOf<List<Host>>(emptyList())
        private set
    var groups by mutableStateOf<List<GroupChat>>(emptyList())
        private set
    var wishlist by mutableStateOf<List<WishlistItem>>(emptyList())
        private set
    var userWishlistItems by mutableStateOf<List<WishlistItem>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var blockedUsers by mutableStateOf<List<Host>>(emptyList())
        private set
    var trustLabel by mutableStateOf("Good standing")
        private set
    var moderationStrikes by mutableStateOf(0)
        private set
    var safetyChecklist by mutableStateOf<List<Pair<String, Boolean>>>(emptyList())
        private set

    fun clearError() {
        error = null
    }

    fun loadBlockedUsers(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                blockedUsers = withContext(Dispatchers.IO) { yugmApi.getBlockedUsers(token) }
            }.onFailure {
                error = it.message ?: "Failed to load blocked users"
            }
            isLoading = false
        }
    }

    fun followUser(token: String, userId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.followUser(token, userId) }
            }
        }
    }

    fun unfollowUser(token: String, userId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.unfollowUser(token, userId) }
            }
        }
    }

    fun loadGiftLeaderboard(token: String, period: String = "all") {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                leaderboard = withContext(Dispatchers.IO) { yugmApi.giftLeaderboard(token, period) }
            }.onFailure {
                error = it.message ?: "Failed to load leaderboard"
            }
            isLoading = false
        }
    }

    fun loadReferral(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                referralCode = withContext(Dispatchers.IO) { yugmApi.getReferralCode(token) }
                referralStats = withContext(Dispatchers.IO) { yugmApi.referralStats(token) }
            }.onFailure {
                error = it.message ?: "Failed to load referral"
            }
            isLoading = false
        }
    }

    fun generateReferralCode(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.generateReferralCode(token) }
                referralCode = withContext(Dispatchers.IO) { yugmApi.getReferralCode(token) }
                referralStats = withContext(Dispatchers.IO) { yugmApi.referralStats(token) }
            }.onFailure {
                error = it.message ?: "Failed to generate referral code"
            }
            isLoading = false
        }
    }

    fun claimReferral(token: String, code: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.claimReferral(token, code) }
                referralStats = withContext(Dispatchers.IO) { yugmApi.referralStats(token) }
            }.onFailure {
                error = it.message ?: "Failed to claim referral"
            }
            isLoading = false
        }
    }

    fun loadSafetyCenter(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) {
                    com.example.yugm.core.api.YugmHttpClient.get("/experience/safety-center", token)
                }
            }.onSuccess { response ->
                val data = response.optJSONObject("data") ?: org.json.JSONObject()
                val trust = data.optJSONObject("trust") ?: org.json.JSONObject()
                trustLabel = trust.optString("label", "Good standing")
                moderationStrikes = trust.optInt("strikes", 0)
                val items = data.optJSONArray("checklist") ?: org.json.JSONArray()
                safetyChecklist = buildList {
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        add(item.optString("title", "") to item.optBoolean("done", false))
                    }
                }
            }.onFailure {
                error = it.message ?: "Failed to load safety center"
            }
            isLoading = false
        }
    }

    fun loadHosts(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                suggestedHosts = withContext(Dispatchers.IO) { yugmApi.suggestedHosts(token) }
            }.onFailure {
                error = it.message ?: "Failed to load hosts"
            }
            isLoading = false
        }
    }

    fun loadGroups(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                groups = withContext(Dispatchers.IO) { yugmApi.listGroups(token) }
            }.onFailure {
                error = it.message ?: "Failed to load groups"
            }
            isLoading = false
        }
    }

    fun createGroup(token: String, name: String, participantIds: List<String>) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.createGroup(token, name, participantIds) }
                groups = withContext(Dispatchers.IO) { yugmApi.listGroups(token) }
            }.onFailure {
                error = it.message ?: "Failed to create group"
            }
            isLoading = false
        }
    }

    fun loadWishlist(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                wishlist = withContext(Dispatchers.IO) { yugmApi.myWishlist(token) }
            }.onFailure {
                error = it.message ?: "Failed to load wishlist"
            }
            isLoading = false
        }
    }

    fun addWishlistItem(token: String, giftId: String, message: String?, isPublic: Boolean) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.addWishlistItem(token, giftId, message, isPublic) }
                wishlist = withContext(Dispatchers.IO) { yugmApi.myWishlist(token) }
            }.onFailure {
                error = it.message ?: "Failed to add wishlist item"
            }
            isLoading = false
        }
    }

    fun deleteWishlistItem(token: String, itemId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteWishlistItem(token, itemId) }
                wishlist = withContext(Dispatchers.IO) { yugmApi.myWishlist(token) }
            }.onFailure {
                error = it.message ?: "Failed to delete wishlist item"
            }
            isLoading = false
        }
    }

    fun sendWishlistGift(token: String, itemId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.sendWishlistGift(token, itemId) }
            }.onFailure {
                error = it.message ?: "Failed to send gift"
            }
            isLoading = false
        }
    }

    fun loadUserWishlist(token: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                userWishlistItems = withContext(Dispatchers.IO) { yugmApi.userWishlist(token, userId) }
            }.onFailure {
                error = it.message ?: "Failed to load user wishlist"
            }
            isLoading = false
        }
    }

    suspend fun uploadTrustVerification(token: String, bytes: ByteArray, mimeType: String, purpose: String): String {
        return withContext(Dispatchers.IO) { yugmApi.uploadTrustVerificationMedia(token, bytes, mimeType, purpose) }
    }

    suspend fun phoneAuth(fbToken: String, acceptTerms: Boolean): com.example.yugm.core.model.Session {
        return withContext(Dispatchers.IO) { yugmApi.phoneAuth(fbToken, acceptTerms) }
    }
}

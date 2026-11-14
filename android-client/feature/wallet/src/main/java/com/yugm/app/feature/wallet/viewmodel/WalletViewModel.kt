package com.yugm.app.feature.wallet.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.DailyRewardClaimResult
import com.yugm.app.core.model.DailyRewardStatus
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.WalletOverview
import com.yugm.app.core.model.WalletTransaction
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var overview by mutableStateOf<WalletOverview?>(null)
        private set

    var coinPacks by mutableStateOf<List<CoinPack>>(emptyList())
        private set

    var giftItems by mutableStateOf<List<GiftItem>>(emptyList())
        private set

    var transactions by mutableStateOf<List<WalletTransaction>>(emptyList())
        private set

    var balance by mutableStateOf(0)
        private set

    var dailyReward by mutableStateOf(DailyRewardStatus())
        private set

    var isLoading by mutableStateOf(false)
        private set

    var isClaimingReward by mutableStateOf(false)
        private set

    fun loadWallet(token: String) {
        viewModelScope.launch {
            isLoading = true
            runCatching {
                val ov = withContext(Dispatchers.IO) { yugmApi.walletOverview(token) }
                val packs = withContext(Dispatchers.IO) { yugmApi.coinPacks(token) }
                val gifts = withContext(Dispatchers.IO) { yugmApi.gifts(token) }
                val tx = withContext(Dispatchers.IO) { yugmApi.walletTransactions(token) }
                overview = ov
                coinPacks = packs
                giftItems = gifts
                transactions = tx
                balance = ov.balance
                dailyReward = ov.dailyReward
            }.onFailure {
                error = it.message ?: "Failed to load wallet"
            }
            isLoading = false
        }
    }

    fun claimDailyReward(token: String, onResult: (String) -> Unit = {}) {
        if (isClaimingReward || !dailyReward.canClaim) return
        viewModelScope.launch {
            isClaimingReward = true
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.claimDailyReward(token) }
            }.onSuccess { result: DailyRewardClaimResult ->
                balance = result.balance
                dailyReward = result.dailyReward
                overview = overview?.copy(balance = result.balance, level = result.level, dailyReward = result.dailyReward) ?: overview
                transactions = withContext(Dispatchers.IO) { runCatching { yugmApi.walletTransactions(token) }.getOrDefault(transactions) }
                onResult(if (result.claimed) "Daily reward claimed: +${result.rewardCoins} coins" else "Daily reward already claimed")
            }.onFailure {
                onResult(it.message ?: "Failed to claim reward")
            }
            isClaimingReward = false
        }
    }

    fun refreshBalance(token: String) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.wallet(token) } }
                .onSuccess { balance = it }
        }
    }

    var razorpayCheckoutData by mutableStateOf<RazorpayCheckoutData?>(null)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun createRazorpayOrder(token: String, packId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.createRazorpayOrder(token, packId) }
            }.onSuccess {
                razorpayCheckoutData = it
            }.onFailure {
                error = it.message ?: "Failed to create order"
            }
            isLoading = false
        }
    }

    fun verifyRazorpay(token: String, purchaseId: String, orderId: String, paymentId: String, signature: String) {
        viewModelScope.launch {
            isLoading = true
            balance = withContext(Dispatchers.IO) { yugmApi.verifyRazorpayPurchase(token, purchaseId, orderId, paymentId, signature) }
            isLoading = false
        }
    }
}

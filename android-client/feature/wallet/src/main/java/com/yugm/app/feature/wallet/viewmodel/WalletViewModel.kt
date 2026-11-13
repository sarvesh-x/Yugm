package com.yugm.app.feature.wallet.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.CoinPack
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

    var isLoading by mutableStateOf(false)
        private set

    fun loadWallet(token: String) {
        viewModelScope.launch {
            isLoading = true
            overview = withContext(Dispatchers.IO) { yugmApi.walletOverview(token) }
            coinPacks = withContext(Dispatchers.IO) { yugmApi.coinPacks(token) }
            giftItems = withContext(Dispatchers.IO) { yugmApi.gifts(token) }
            transactions = withContext(Dispatchers.IO) { yugmApi.walletTransactions(token) }
            balance = withContext(Dispatchers.IO) { yugmApi.wallet(token) }
            isLoading = false
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

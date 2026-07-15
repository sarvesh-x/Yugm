package com.example.yugm.payments

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.example.yugm.api.YugmApi
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber

object GooglePlayBillingManager {
    private const val TAG = "GooglePlayBilling"

    private var billingClient: BillingClient? = null
    private var isReady = false
    private var pendingPurchaseHandler: (suspend (productId: String, purchaseToken: String, orderId: String?) -> Unit)? = null

    data class ProductInfo(
        val productId: String,
        val title: String,
        val description: String,
        val price: String,
        val priceMicros: Long,
        val currency: String
    )

    fun init(context: Context) {
        if (billingClient != null) return
        billingClient = BillingClient.newBuilder(context)
            .setListener { billingResult, purchases ->
                onPurchasesUpdated(billingResult, purchases)
            }
            .enablePendingPurchases()
            .build()
        startConnection()
    }

    fun setPendingPurchaseHandler(handler: suspend (productId: String, purchaseToken: String, orderId: String?) -> Unit) {
        pendingPurchaseHandler = handler
    }

    private fun startConnection() {
        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    isReady = true
                    Timber.tag(TAG).i("Billing client connected")
                } else {
                    Timber.tag(TAG).e("Billing setup failed: ${billingResult.responseCode}")
                }
            }

            override fun onBillingServiceDisconnected() {
                isReady = false
                Timber.tag(TAG).w("Billing service disconnected")
            }
        })
    }

    suspend fun queryProducts(productIds: List<String>): List<ProductInfo> = withContext(Dispatchers.IO) {
        queryRawProductDetails(productIds).map { details ->
            val oneTimeOffer = details.oneTimePurchaseOfferDetails
            ProductInfo(
                productId = details.productId,
                title = details.title,
                description = details.description,
                price = oneTimeOffer?.formattedPrice ?: "",
                priceMicros = oneTimeOffer?.priceAmountMicros ?: 0L,
                currency = ""
            )
        }
    }

    suspend fun queryRawProductDetails(productIds: List<String>): List<ProductDetails> = withContext(Dispatchers.IO) {
        if (!isReady) return@withContext emptyList()
        val client = billingClient ?: return@withContext emptyList()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                productIds.map { id ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                }
            )
            .build()
        return@withContext suspendCoroutine { continuation ->
            client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    Timber.tag(TAG).e("Query products failed: ${billingResult.responseCode}")
                    continuation.resume(emptyList())
                } else {
                    continuation.resume(productDetailsList)
                }
            }
        }
    }

    fun launchBillingFlow(activity: Activity, productDetails: ProductDetails) {
        val client = billingClient ?: return
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(productDetails)
            .build()
        val billingParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()
        val result = client.launchBillingFlow(activity, billingParams)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            Timber.tag(TAG).e("Launch billing flow failed: ${result.responseCode}")
        }
    }

    private fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && !purchases.isNullOrEmpty()) {
            MainScope().launch {
                for (purchase in purchases) {
                    handlePurchase(purchase)
                }
            }
        }
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        try {
            if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
            val productId = purchase.products.firstOrNull() ?: return
            val purchaseToken = purchase.purchaseToken
            val orderId = purchase.orderId
            pendingPurchaseHandler?.invoke(productId, purchaseToken, orderId)
            acknowledgePurchase(purchase)
        } catch (e: Exception) {
            Timber.tag(TAG).e("Purchase handling failed: ${e.message}")
        }
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient?.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                Timber.tag(TAG).e("Acknowledge failed: ${billingResult.responseCode}")
            }
        }
    }

    fun getBillingClient() = billingClient
}



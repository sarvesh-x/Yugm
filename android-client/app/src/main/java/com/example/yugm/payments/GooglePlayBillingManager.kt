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
import kotlinx.coroutines.Dispatchers
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
        val result = client.queryProductDetails(params)
        if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            Timber.tag(TAG).e("Query products failed: ${result.billingResult.responseCode}")
            return@withContext emptyList()
        }
        result.productDetailsList.orEmpty()
    }

    fun launchBillingFlow(activity: Activity, productDetails: ProductDetails) {
        val client = billingClient ?: return
        val offerToken = productDetails.oneTimePurchaseOfferDetails?.offerToken ?: return
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(productDetails)
            .setOfferToken(offerToken)
            .build()
        val billingParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()
        val result = client.launchBillingFlow(activity, billingParams)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            Timber.tag(TAG).e("Launch billing flow failed: ${result.responseCode}")
        }
    }

    private fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?) {
        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            Timber.tag(TAG).e("Purchase update error: ${billingResult.responseCode}")
            return
        }
        if (purchases.isNullOrEmpty()) return
        for (purchase in purchases) {
            handlePurchase(purchase)
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        if (!purchase.isAcknowledged) {
            acknowledgePurchase(purchase)
        }
        val productId = purchase.products.firstOrNull() ?: return
        val orderId = purchase.orderId
        val handler = pendingPurchaseHandler
        if (handler != null) {
            kotlinx.coroutines.MainScope().launch {
                handler(productId, purchase.purchaseToken, orderId)
            }
        }
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        val acknowledgeParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient?.acknowledgePurchase(acknowledgeParams) { billingResult ->
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                Timber.tag(TAG).e("Acknowledge failed: ${billingResult.responseCode}")
            }
        }
    }

    fun endConnection() {
        billingClient?.endConnection()
        billingClient = null
        isReady = false
    }

    fun isBillingReady(): Boolean = isReady
}

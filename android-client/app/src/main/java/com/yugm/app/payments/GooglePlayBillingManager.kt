package com.yugm.app.payments

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import timber.log.Timber

object GooglePlayBillingManager {
    private const val TAG = "GooglePlayBilling"

    enum class PurchaseHandleResult {
        VERIFIED,
        RETRY
    }

    private var billingClient: BillingClient? = null
    private var isReady = false
    private var connectionRequested = false
    private var billingUnavailable = false
    private var pendingPurchaseHandler: (suspend (productId: String, purchaseToken: String, orderId: String?) -> PurchaseHandleResult)? = null

    fun isBillingReady(): Boolean = isReady

    fun isBillingUnavailable(): Boolean = billingUnavailable
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val processMutex = Mutex()
    private val processedTokens = mutableSetOf<String>()

    data class ProductInfo(
        val productId: String,
        val title: String,
        val description: String,
        val price: String,
        val priceMicros: Long,
        val currency: String
    )

    fun init(context: Context) {
        if (billingClient != null) {
            connect()
            return
        }
        billingClient = BillingClient.newBuilder(context.applicationContext)
            .setListener { billingResult, purchases ->
                onPurchasesUpdated(billingResult, purchases)
            }
            .enablePendingPurchases()
            .build()
        connect()
    }

    fun connect() {
        val client = billingClient ?: return
        if (connectionRequested) return
        connectionRequested = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                connectionRequested = false
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    billingUnavailable = false
                    isReady = true
                    Timber.tag(TAG).i("Billing client connected")
                    scope.launch { restorePurchases() }
                } else {
                    isReady = false
                    val unsupported = billingResult.responseCode == BillingClient.BillingResponseCode.BILLING_UNAVAILABLE ||
                        billingResult.responseCode == BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED
                    if (unsupported) {
                        billingUnavailable = true
                        Timber.tag(TAG).e("Billing unavailable on this device (${billingResult.responseCode}: ${billingResult.debugMessage}). No retry.")
                        return
                    }
                    Timber.tag(TAG).e("Billing setup failed: ${billingResult.responseCode} (debugMessage=${billingResult.debugMessage})")
                    scope.launch {
                        delay(2_000)
                        connect()
                    }
                }
            }

            override fun onBillingServiceDisconnected() {
                connectionRequested = false
                isReady = false
                Timber.tag(TAG).w("Billing service disconnected, retrying")
                scope.launch {
                    delay(1_500)
                    connect()
                }
            }
        })
    }

    suspend fun awaitBillingReady(timeoutMs: Long = 8_000L): Boolean {
        if (isReady) return true
        if (billingUnavailable) return false
        connect()
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        while (!isReady && SystemClock.elapsedRealtime() < deadline) {
            delay(200)
        }
        return isReady
    }

    fun setPendingPurchaseHandler(handler: suspend (productId: String, purchaseToken: String, orderId: String?) -> PurchaseHandleResult) {
        pendingPurchaseHandler = handler
        if (isReady) {
            scope.launch { restorePurchases() }
        }
    }

    suspend fun restorePurchases() {
        val client = billingClient ?: return
        if (!isReady) return
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()
        val purchases = suspendCoroutine { continuation ->
            client.queryPurchasesAsync(params, PurchasesResponseListener { billingResult, purchaseList ->
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    continuation.resume(purchaseList)
                } else {
                    Timber.tag(TAG).e("Query purchases failed: ${billingResult.responseCode}")
                    continuation.resume(emptyList())
                }
            })
        }
        if (purchases.isNotEmpty()) {
            purchases.forEach { handlePurchase(it) }
        }
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
                currency = oneTimeOffer?.priceCurrencyCode ?: ""
            )
        }
    }

    suspend fun queryRawProductDetails(productIds: List<String>): List<ProductDetails> = withContext(Dispatchers.IO) {
        if (productIds.isEmpty()) return@withContext emptyList()
        val client = billingClient ?: return@withContext emptyList()
        if (!isReady) {
            Timber.tag(TAG).w("Billing client not ready while querying products")
            return@withContext emptyList()
        }
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
                    continuation.resume(productDetailsList ?: emptyList())
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
            scope.launch {
                for (purchase in purchases) {
                    handlePurchase(purchase)
                }
            }
        } else if (billingResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            Timber.tag(TAG).i("Purchase cancelled by user")
        } else {
            Timber.tag(TAG).w("Purchases update failed: ${billingResult.responseCode}")
        }
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        val token = purchase.purchaseToken
        if (token.isBlank()) return
        val handler = pendingPurchaseHandler ?: return
        processMutex.withLock {
            if (token in processedTokens) return
            val productId = purchase.products.firstOrNull() ?: return
            val orderId = purchase.orderId
            val result = runCatching { handler(productId, token, orderId) }.getOrElse {
                Timber.tag(TAG).e("Purchase handler failed: ${it.message}")
                PurchaseHandleResult.RETRY
            }
            if (result == PurchaseHandleResult.VERIFIED) {
                val acked = acknowledgePurchase(purchase)
                if (acked) processedTokens.add(token)
            }
        }
    }

    private suspend fun acknowledgePurchase(purchase: Purchase): Boolean {
        if (purchase.isAcknowledged) return true
        val client = billingClient ?: return false
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        return suspendCoroutine { continuation ->
            client.acknowledgePurchase(params) { billingResult ->
                val ok = billingResult.responseCode == BillingClient.BillingResponseCode.OK
                if (!ok) Timber.tag(TAG).e("Acknowledge failed: ${billingResult.responseCode}")
                continuation.resume(ok)
            }
        }
    }

    fun getBillingClient() = billingClient
}



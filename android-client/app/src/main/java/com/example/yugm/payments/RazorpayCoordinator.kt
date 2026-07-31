package com.example.yugm.payments

import android.app.Activity
import android.content.Context
import androidx.core.content.edit
import com.example.yugm.core.model.RazorpayCheckoutData
import com.razorpay.Checkout
import org.json.JSONObject
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

object RazorpayCoordinator {
    private const val PREFS = "yugm_razorpay"
    private const val PURCHASE_ID = "pending_purchase_id"
    var latestBalance by mutableStateOf<Int?>(null)
        private set

    fun start(activity: Activity, checkoutData: RazorpayCheckoutData) {
        require(checkoutData.purchaseId.isNotBlank() && checkoutData.orderId.isNotBlank() && checkoutData.key.isNotBlank()) {
            "Checkout configuration is incomplete"
        }
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            putString(PURCHASE_ID, checkoutData.purchaseId)
        }

        Checkout.preload(activity.applicationContext)
        val checkout = Checkout()
        checkout.setKeyID(checkoutData.key)
        val options = JSONObject()
            .put("name", checkoutData.name)
            .put("description", checkoutData.description)
            .put("order_id", checkoutData.orderId)
            .put("currency", checkoutData.currency)
            .put("amount", checkoutData.amount)
            .put("theme.color", "#F6378B")
            .put("retry", JSONObject().put("enabled", true).put("max_count", 4))
        checkout.open(activity, options)
    }

    fun pendingPurchaseId(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PURCHASE_ID, "").orEmpty()

    fun clearPending(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            remove(PURCHASE_ID)
        }
    }

    fun notifyVerified(balance: Int) {
        latestBalance = balance
    }
}

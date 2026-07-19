package com.example.yugm.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.MainViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

fun NavGraphBuilder.walletNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
) {
    composable(Screen.Wallet.route) {
        val walletContext = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()

        WalletScreen(
            token = mainViewModel.authToken,
            initialBalance = mainViewModel.balance,
            onBack = { navController.popBackStack() },
            onOpenEarnings = { navController.navigate(Screen.Growth.route) },
            onBalanceChanged = mainViewModel::updateBalance,
            onRechargeOrderReady = { checkoutData ->
                val activity = walletContext as? android.app.Activity
                if (activity != null) {
                    runCatching { com.example.yugm.payments.RazorpayCoordinator.start(activity, checkoutData) }
                        .onFailure { android.widget.Toast.makeText(walletContext, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onStartGooglePlayPurchase = { pack ->
                val activity = walletContext as? android.app.Activity ?: return@WalletScreen
                if (pack.googleProductId.isBlank()) return@WalletScreen
                scope.launch {
                    val rawDetails = com.example.yugm.payments.GooglePlayBillingManager.queryRawProductDetails(listOf(pack.googleProductId))
                    val details = rawDetails.firstOrNull()
                    if (details != null) {
                        com.example.yugm.payments.GooglePlayBillingManager.setPendingPurchaseHandler { productId, purchaseToken, orderId ->
                            val balance = runCatching {
                                com.example.yugm.api.YugmApi.verifyGooglePlayPurchase(
                                    token = mainViewModel.authToken,
                                    packId = pack.id,
                                    productId = productId,
                                    purchaseToken = purchaseToken,
                                    orderId = orderId
                                )
                            }.onFailure { e ->
                                withContext(Dispatchers.Main) {
                                    android.widget.Toast.makeText(walletContext, "Verification failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }.getOrNull()
                            if (balance != null) {
                                withContext(Dispatchers.Main) {
                                    mainViewModel.updateBalance(balance)
                                    android.widget.Toast.makeText(walletContext, "Purchase successful! +${pack.coinAmount} coins", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        com.example.yugm.payments.GooglePlayBillingManager.launchBillingFlow(activity, details)
                    } else {
                        withContext(Dispatchers.Main) {
                            android.widget.Toast.makeText(walletContext, "Product not available in Google Play", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        )
    }

    composable(Screen.Cosmetics.route) {
        CosmeticsStoreScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.Vip.route) {
        VipPlansScreen(
            token = mainViewModel.authToken,
            onBack = { navController.popBackStack() }
        )
    }

    composable(Screen.CreatorPayoutKycIntro.route) {
        CreatorPayoutKycIntroScreen(
            onBack = { navController.popBackStack() },
            onStart = { navController.navigate(Screen.CreatorPayoutKycForm.route) }
        )
    }

    composable(Screen.CreatorPayoutKycForm.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        CreatorPayoutKycFormScreen(
            onBack = { navController.popBackStack() },
            onSubmit = { legalName, pan, upi ->
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.submitCreatorPayoutKyc(mainViewModel.authToken, legalName, pan, upiId = upi) }
                        .onSuccess { navController.navigate(Screen.CreatorPayoutKycStatus.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Payout verification failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.CreatorPayoutKycStatus.route) {
        var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.model.CreatorPayoutKycStatus()) }
        LaunchedEffect(mainViewModel.authToken) {
            runCatching { com.example.yugm.api.YugmApi.creatorPayoutKycStatus(mainViewModel.authToken) }
                .onSuccess { status = it }
        }
        CreatorPayoutKycStatusScreen(status = status, onBack = { navController.popBackStack() })
    }

    composable(Screen.WithdrawalEligibility.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var eligibility by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.model.WithdrawalEligibility()) }
        fun refreshEligibility() {
            scope.launch {
                runCatching { com.example.yugm.api.YugmApi.withdrawalEligibility(mainViewModel.authToken) }
                    .onSuccess { eligibility = it }
                    .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load withdrawals", android.widget.Toast.LENGTH_SHORT).show() }
            }
        }
        LaunchedEffect(mainViewModel.authToken) { refreshEligibility() }
        WithdrawalEligibilityScreen(
            balance = eligibility.balance,
            payoutKyc = eligibility.payoutKyc,
            requirements = eligibility.requirements,
            coinToInrRate = eligibility.coinToInrRate,
            onBack = { navController.popBackStack() },
            onOpenKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
            onWithdraw = { amount ->
                scope.launch {
                    runCatching { com.example.yugm.api.YugmApi.requestWithdrawal(mainViewModel.authToken, amount) }
                        .onSuccess {
                            android.widget.Toast.makeText(context, it.message.ifBlank { "Withdrawal requested" }, android.widget.Toast.LENGTH_SHORT).show()
                            refreshEligibility()
                        }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Withdrawal failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }
}

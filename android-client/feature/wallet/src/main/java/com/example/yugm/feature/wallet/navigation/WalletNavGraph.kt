package com.example.yugm.feature.wallet.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.wallet.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.walletNavGraph(
    navController: NavHostController,
    authToken: String,
    balance: Int,
    currentUserId: String,
) {
    composable(Screen.Wallet.route) {
        WalletScreen(
            token = authToken,
            initialBalance = balance,
            onBack = { navController.popBackStack() },
            onOpenEarnings = { navController.navigate(Screen.Growth.route) },
            onBalanceChanged = { },
            onRechargeOrderReady = { },
            onStartGooglePlayPurchase = { },
        )
    }

    composable(Screen.Vip.route) {
        VipPlansScreen(
            token = authToken,
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
                    runCatching { com.example.yugm.core.api.YugmApi.submitCreatorPayoutKyc(authToken, legalName, pan, upiId = upi) }
                        .onSuccess { navController.navigate(Screen.CreatorPayoutKycStatus.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Payout verification failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.CreatorPayoutKycStatus.route) {
        var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.core.model.CreatorPayoutKycStatus()) }
        LaunchedEffect(authToken) {
            runCatching { com.example.yugm.core.api.YugmApi.creatorPayoutKycStatus(authToken) }
                .onSuccess { status = it }
        }
        CreatorPayoutKycStatusScreen(status = status, onBack = { navController.popBackStack() })
    }

    composable(Screen.WithdrawalEligibility.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var eligibility by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.example.yugm.core.model.WithdrawalEligibility()) }
        fun refreshEligibility() {
            scope.launch {
                runCatching { com.example.yugm.core.api.YugmApi.withdrawalEligibility(authToken) }
                    .onSuccess { eligibility = it }
                    .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load withdrawals", android.widget.Toast.LENGTH_SHORT).show() }
            }
        }
        LaunchedEffect(authToken) { refreshEligibility() }
        WithdrawalEligibilityScreen(
            balance = eligibility.balance,
            payoutKyc = eligibility.payoutKyc,
            requirements = eligibility.requirements,
            coinToInrRate = eligibility.coinToInrRate,
            onBack = { navController.popBackStack() },
            onOpenKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
            onWithdraw = { amount ->
                scope.launch {
                    runCatching { com.example.yugm.core.api.YugmApi.requestWithdrawal(authToken, amount) }
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

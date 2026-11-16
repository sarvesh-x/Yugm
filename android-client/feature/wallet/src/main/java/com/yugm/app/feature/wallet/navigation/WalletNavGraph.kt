package com.yugm.app.feature.wallet.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.TrustVerificationStatus
import com.yugm.app.feature.wallet.screens.*
import kotlinx.coroutines.launch

fun NavGraphBuilder.walletNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    balanceProvider: () -> Int,
    currentUserIdProvider: () -> String,
    onRechargeOrderReady: (RazorpayCheckoutData) -> Unit,
    onStartGooglePlayPurchase: (CoinPack) -> Unit,
) {
    composable(Screen.TrustVerificationIntro.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        TrustVerificationIntroScreen(
            onBack = { navController.popBackStack() },
            onStart = {
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.startTrustVerification(authTokenProvider()) }
                        .onSuccess { navController.navigate(Screen.VerificationConsent.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not start verification", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.VerificationConsent.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        VerificationConsentScreen(
            onBack = { navController.popBackStack() },
            onAccept = {
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.acceptTrustVerificationConsent(authTokenProvider()) }
                        .onSuccess { navController.navigate(Screen.FaceVerification.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not save consent", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.FaceVerification.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        FaceVerificationScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onSubmit = { imageUrl ->
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.submitTrustFace(authTokenProvider(), selfieImageUrl = imageUrl) }
                        .onSuccess { navController.navigate(Screen.VoiceVerification.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not submit face check", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.VoiceVerification.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var prompt by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
        LaunchedEffect(authTokenProvider()) {
            runCatching { com.yugm.app.core.api.YugmApi.trustVoicePrompt(authTokenProvider()) }
                .onSuccess { prompt = it }
                .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load voice prompt", android.widget.Toast.LENGTH_SHORT).show() }
        }
        VoiceVerificationScreen(
            token = authTokenProvider(),
            promptText = prompt,
            onBack = { navController.popBackStack() },
            onSubmit = { audioUrl ->
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.submitTrustVoice(authTokenProvider(), audioUrl, prompt) }
                        .onSuccess { navController.navigate(Screen.TrustVerificationStatus.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not submit voice check", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.TrustVerificationStatus.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(TrustVerificationStatus()) }
        fun refreshStatus() {
            scope.launch {
                runCatching { com.yugm.app.core.api.YugmApi.trustVerificationStatus(authTokenProvider()) }
                    .onSuccess { status = it }
                    .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load verification status", android.widget.Toast.LENGTH_SHORT).show() }
            }
        }
        LaunchedEffect(authTokenProvider()) { refreshStatus() }
        TrustVerificationStatusScreen(
            status = status,
            onBack = { navController.popBackStack() },
            onSubmitReview = {
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.submitTrustReview(authTokenProvider()) }
                        .onSuccess { status = it }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Complete both checks before review", android.widget.Toast.LENGTH_SHORT).show() }
                }
            },
            onRetry = {
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.retryTrustVerification(authTokenProvider()) }
                        .onSuccess { navController.navigate(Screen.FaceVerification.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not restart verification", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.Wallet.route) {
        WalletScreen(
            token = authTokenProvider(),
            initialBalance = balanceProvider(),
            onBack = { navController.popBackStack() },
            onOpenEarnings = { navController.navigate(Screen.Growth.route) },
            onBalanceChanged = { },
            onRechargeOrderReady = onRechargeOrderReady,
            onStartGooglePlayPurchase = onStartGooglePlayPurchase,
            onOpenGiftCatalog = { navController.navigate(Screen.GiftCatalog.route) },
            onOpenGiftInventory = { navController.navigate(Screen.Inventory.route) },
        )
    }

    composable(Screen.Vip.route) {
        VipPlansScreen(
            token = authTokenProvider(),
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
                    runCatching { com.yugm.app.core.api.YugmApi.submitCreatorPayoutKyc(authTokenProvider(), legalName, pan, upiId = upi) }
                        .onSuccess { navController.navigate(Screen.CreatorPayoutKycStatus.route) }
                        .onFailure { android.widget.Toast.makeText(context, it.message ?: "Payout verification failed", android.widget.Toast.LENGTH_SHORT).show() }
                }
            }
        )
    }

    composable(Screen.CreatorPayoutKycStatus.route) {
        var status by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.yugm.app.core.model.CreatorPayoutKycStatus()) }
        LaunchedEffect(authTokenProvider()) {
            runCatching { com.yugm.app.core.api.YugmApi.creatorPayoutKycStatus(authTokenProvider()) }
                .onSuccess { status = it }
        }
        CreatorPayoutKycStatusScreen(status = status, onBack = { navController.popBackStack() })
    }

    composable(Screen.WithdrawalEligibility.route) {
        val scope = rememberCoroutineScope()
        val context = androidx.compose.ui.platform.LocalContext.current
        var eligibility by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.yugm.app.core.model.WithdrawalEligibility()) }
        fun refreshEligibility() {
            scope.launch {
                runCatching { com.yugm.app.core.api.YugmApi.withdrawalEligibility(authTokenProvider()) }
                    .onSuccess { eligibility = it }
                    .onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not load withdrawals", android.widget.Toast.LENGTH_SHORT).show() }
            }
        }
        LaunchedEffect(authTokenProvider()) { refreshEligibility() }
        WithdrawalEligibilityScreen(
            balance = eligibility.balance,
            payoutKyc = eligibility.payoutKyc,
            requirements = eligibility.requirements,
            coinToInrRate = eligibility.coinToInrRate,
            onBack = { navController.popBackStack() },
            onOpenKyc = { navController.navigate(Screen.CreatorPayoutKycIntro.route) },
            onWithdraw = { amount ->
                scope.launch {
                    runCatching { com.yugm.app.core.api.YugmApi.requestWithdrawal(authTokenProvider(), amount) }
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

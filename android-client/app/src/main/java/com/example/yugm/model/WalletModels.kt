package com.example.yugm.model

data class WalletTransaction(
    val type: String = "",
    val amount: Int = 0,
    val description: String = "",
    val balanceAfter: Int = 0,
    val createdAt: String = ""
)

data class CreatorPayoutKycStatus(
    val kycStatus: String = "NOT_SUBMITTED",
    val payoutStatus: String = "DISABLED",
    val legalFullName: String? = null,
    val panLast4: String? = null,
    val upiIdMasked: String? = null,
    val bankAccountLast4: String? = null,
    val rejectionReason: String? = null
)

data class CreatorEarningBalance(
    val earnedCoins: Int = 0,
    val lockedCoins: Int = 0,
    val withdrawnCoins: Int = 0,
    val availableCoins: Int = 0
)

data class PayoutRequirements(
    val creatorAccount: Boolean = false,
    val trustVerified: Boolean = false,
    val creatorTrustEnabled: Boolean = false,
    val payoutKycVerified: Boolean = false,
    val payoutEnabled: Boolean = false
)

data class WithdrawalEligibility(
    val balance: CreatorEarningBalance = CreatorEarningBalance(),
    val payoutKyc: CreatorPayoutKycStatus = CreatorPayoutKycStatus(),
    val requirements: PayoutRequirements = PayoutRequirements(),
    val coinToInrRate: Double = 0.01
)

data class WithdrawalRequestResult(
    val message: String = "",
    val status: String = "PENDING_REVIEW",
    val amountCoins: Int = 0,
    val amountInr: Double = 0.0
)

data class CoinPack(
    val id: String = "",
    val coinAmount: Int = 0,
    val priceInr: Int = 0,
    val googleProductId: String = ""
)

data class RazorpayCheckoutData(
    val purchaseId: String = "",
    val key: String = "",
    val amount: Int = 0,
    val currency: String = "INR",
    val orderId: String = "",
    val name: String = "Yugm",
    val description: String = "Yugm coins"
)

data class VipPlan(
    val id: String = "",
    val name: String = "",
    val durationDays: Int = 0,
    val coinPrice: Int = 0,
    val benefits: List<String> = emptyList()
)

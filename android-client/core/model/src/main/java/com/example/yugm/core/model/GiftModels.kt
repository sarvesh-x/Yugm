package com.example.yugm.core.model

data class GiftV2(
    val id: String = "",
    val name: String = "",
    val icon: String = "",
    val coinPrice: Int = 0,
    val diamondPrice: Int = 0,
    val effect3d: String = "",
    val interactive: Boolean = false,
    val comboMultiplier: Int = 1,
    val category: String = "normal",
    val theme: String = "",
    val rarity: String = "common",
    val tradable: Boolean = false,
    val upgradeable: Boolean = false,
    val achievementGift: Boolean = false,
    val petGift: Boolean = false,
    val vehicleGift: Boolean = false,
    val limitedEdition: LimitedEdition? = null,
    val collectionId: String? = null
)

data class LimitedEdition(
    val active: Boolean = false,
    val total: Int = 0,
    val remaining: Int = 0
)

data class GiftCollection(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val icon: String = "",
    val bonus: CollectionBonus = CollectionBonus(),
    val gifts: List<GiftV2> = emptyList()
)

data class CollectionBonus(
    val description: String = "",
    val xpMultiplier: Int = 1,
    val coinMultiplier: Int = 1
)

data class ComboResult(
    val comboCount: Int = 0,
    val totalValue: Int = 0,
    val perPersonCost: Int = 0,
    val multiplier: Int = 1,
    val transaction: GiftTransactionData? = null
)

data class GiftTransactionData(
    val id: String = "",
    val type: String = "",
    val comboCount: Int = 1,
    val totalValue: Int = 0,
    val effect: String = ""
)

data class RoomWideGiftResult(
    val totalCost: Int = 0,
    val receiverCount: Int = 0,
    val transactions: List<GiftTransactionData> = emptyList()
)

data class SurpriseBoxResult(
    val tier: String = "",
    val price: Int = 0,
    val revealedGift: GiftV2? = null,
    val source: String = ""
)

data class UpgradeResult(
    val upgradeCost: Int = 0,
    val fromGift: GiftV2? = null,
    val upgradedGift: GiftV2? = null
)

data class InventoryItem(
    val id: String = "",
    val gift: GiftV2? = null,
    val quantity: Int = 1,
    val tradable: Boolean = false,
    val source: String = "purchased"
)

data class InventoryResponse(
    val items: List<InventoryItem> = emptyList()
)

data class TradeResult(
    val traded: Boolean = false,
    val offeredCount: Int = 0,
    val receivedCount: Int = 0
)

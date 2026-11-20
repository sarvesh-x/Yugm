package com.yugm.app.core.model

data class ImmersiveTheme(
    val key: String = "",
    val name: String = "",
    val type: String = "",
    val category: String = "",
    val colors: List<String> = emptyList(),
    val animation: Map<String, Any>? = null,
    val ambientSound: String? = null,
    val price: ThemePrice = ThemePrice(),
    val premium: Boolean = false,
    val available: Boolean = true
)

data class ThemePrice(
    val coins: Int = 0,
    val diamonds: Int = 0
)

data class UserThemesResponse(
    val owned: List<ImmersiveTheme> = emptyList(),
    val equipped: EquippedThemes = EquippedThemes()
)

data class EquippedThemes(
    val room: String? = null,
    val profile: String? = null,
    val entrance: String? = null
)

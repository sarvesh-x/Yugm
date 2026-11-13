package com.yugm.app.feature.events.screens

data class Festival(
    val key: String,
    val label: String,
    val emoji: String,
    val accent: Long
)

val ALL_FESTIVALS = listOf(
    Festival("", "All", "\uD83C\uDF1F", 0xFFFFC52F),
    Festival("diwali", "Diwali", "\uD83D\uDD54", 0xFFFF9A3D),
    Festival("holi", "Holi", "\uD83C\uDFA8", 0xFF4D96FF),
    Festival("new_year", "New Year", "\uD83C\uDF89", 0xFFFFD700),
    Festival("valentines", "Valentine's", "\uD83D\uDC98", 0xFFFF6B9D),
    Festival("independence_day", "Independence", "\uD83C\uDDF1\uD83C\uDDF0", 0xFF138808)
)

fun festivalLabel(key: String): String {
    if (key.isBlank() || key == "none") return ""
    return ALL_FESTIVALS.firstOrNull { it.key == key }?.label ?: key
}

fun festivalEmoji(key: String): String {
    if (key.isBlank() || key == "none") return ""
    return ALL_FESTIVALS.firstOrNull { it.key == key }?.emoji ?: ""
}

fun festivalAccent(key: String): Long {
    return ALL_FESTIVALS.firstOrNull { it.key == key }?.accent ?: 0xFFFFC52F
}

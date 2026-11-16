package com.yugm.app.feature.chat

import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal fun parseIsoMillis(value: String?): Long? {
    val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val patterns = arrayOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
        "yyyy-MM-dd'T'HH:mm:ss"
    )
    for (pattern in patterns) {
        val sdf = SimpleDateFormat(pattern, Locale.US).apply {
            isLenient = false
            timeZone = if (pattern.contains("X") || pattern.endsWith("'Z'")) TimeZone.getTimeZone("UTC") else TimeZone.getDefault()
        }
        val parsed = runCatching { sdf.parse(raw, ParsePosition(0)) }.getOrNull()
        if (parsed != null) return parsed.time
    }
    return runCatching {
        // Fallback for variable fractional seconds like 2026-01-02T03:04:05.123456Z
        val normalized = raw.replace(Regex("\\.(\\d+)")) { match ->
            ".${match.groupValues[1].take(3).padEnd(3, '0')}"
        }
        val zulu = if (normalized.endsWith("Z")) normalized.replace("Z", "+00:00") else normalized
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
            isLenient = false
            timeZone = TimeZone.getTimeZone("UTC")
        }.parse(zulu, ParsePosition(0))?.time
    }.getOrNull()
}

internal fun formatChatMessageTime(value: String): String {
    val millis = parseIsoMillis(value) ?: return if (value.length >= 16) value.substring(11, 16) else "now"
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))
}

internal fun formatChatDateLabel(value: String): String {
    val millis = parseIsoMillis(value) ?: return ""
    val cal = Calendar.getInstance().apply { timeInMillis = millis }
    val today = Calendar.getInstance()
    fun Calendar.sameDay(other: Calendar) =
        get(Calendar.YEAR) == other.get(Calendar.YEAR) && get(Calendar.DAY_OF_YEAR) == other.get(Calendar.DAY_OF_YEAR)
    val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
    return when {
        cal.sameDay(today) -> "Today"
        cal.sameDay(yesterday) -> "Yesterday"
        cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) ->
            SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(millis))
        else -> SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(millis))
    }
}

internal fun formatConversationTimeLabel(createdAt: String): String {
    if (createdAt.isBlank()) return ""
    val millis = parseIsoMillis(createdAt) ?: return if (createdAt.length >= 16) createdAt.substring(11, 16) else ""
    val cal = Calendar.getInstance().apply { timeInMillis = millis }
    val today = Calendar.getInstance()
    fun Calendar.sameDay(other: Calendar) =
        get(Calendar.YEAR) == other.get(Calendar.YEAR) && get(Calendar.DAY_OF_YEAR) == other.get(Calendar.DAY_OF_YEAR)
    val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
    return when {
        cal.sameDay(today) -> SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))
        cal.sameDay(yesterday) -> "Yesterday"
        cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(millis))
        else -> SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(millis))
    }
}

internal fun formatMessageInfoTime(createdAt: String): String {
    val millis = parseIsoMillis(createdAt) ?: return createdAt
    return SimpleDateFormat("MMM d, yyyy · HH:mm", Locale.getDefault()).format(Date(millis))
}

internal fun canEditDirectMessage(createdAt: String, windowMinutes: Int = 15): Boolean {
    val created = parseIsoMillis(createdAt) ?: return false
    return System.currentTimeMillis() - created <= windowMinutes * 60_000L
}

internal fun isIsoAfterOrEqual(candidateIso: String, referenceIso: String): Boolean {
    val candidate = parseIsoMillis(candidateIso) ?: return false
    val reference = parseIsoMillis(referenceIso) ?: return true
    return candidate <= reference
}
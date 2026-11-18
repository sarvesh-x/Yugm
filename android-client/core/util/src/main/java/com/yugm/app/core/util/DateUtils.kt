package com.yugm.app.core.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object DateUtils {
    private fun getIsoFormat(): SimpleDateFormat =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    fun nowIso(): String = getIsoFormat().format(Date())

    fun parseIsoToMillis(isoString: String): Long? {
        if (isoString.isBlank()) return null
        return runCatching {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                java.time.Instant.parse(isoString).toEpochMilli()
            } else {
                val clean = isoString.trim()
                val format = if (clean.contains(".")) {
                    getIsoFormat()
                } else {
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                }
                format.parse(clean)?.time
            }
        }.getOrNull()
    }

    fun isIsoBeforeNow(isoString: String): Boolean {
        val millis = parseIsoToMillis(isoString) ?: return false
        return millis < System.currentTimeMillis()
    }

    fun daysUntilIso(isoString: String): Long? {
        val millis = parseIsoToMillis(isoString) ?: return null
        val diff = millis - System.currentTimeMillis()
        return (diff / (1000 * 60 * 60 * 24)).coerceAtLeast(0)
    }
}

package com.yugm.app.core.ui.theme

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

/** False when Android's "Remove animations" / animator duration scale is disabled. */
val LocalMotionEnabled = staticCompositionLocalOf { true }

@Composable
internal fun rememberSystemMotionEnabled(): Boolean {
    val context = LocalContext.current.applicationContext
    var enabled by remember(context) { mutableStateOf(readMotionEnabled(context)) }

    DisposableEffect(context) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                enabled = readMotionEnabled(context)
            }
        }
        val setting = Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE)
        context.contentResolver.registerContentObserver(setting, false, observer)
        onDispose { context.contentResolver.unregisterContentObserver(observer) }
    }

    return enabled
}

private fun readMotionEnabled(context: Context): Boolean = runCatching {
    Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f
    ) > 0f
}.getOrDefault(true)

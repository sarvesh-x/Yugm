package com.yugm.app.core.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.yugm.app.core.api.AppSync
import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.api.YugmHttpClient
import com.yugm.app.core.api.runAutomaticSync

/** Pagers can keep neighboring tabs composed without making them active readers. */
val LocalAutomaticSyncEnabled = staticCompositionLocalOf { true }

/** Read-only synchronization while this destination is visible; restarts on resume. */
@Composable
fun AutomaticSyncEffect(
    vararg keys: Any?,
    topics: Set<SyncTopic> = setOf(SyncTopic.ALL),
    intervalMs: Long = 30_000,
    enabled: Boolean = true,
    isBusy: () -> Boolean = { false },
    onSync: suspend () -> Unit
) {
    val owner = LocalLifecycleOwner.current
    val latestSync by rememberUpdatedState(onSync)
    val latestBusy by rememberUpdatedState(isBusy)
    val active = enabled && LocalAutomaticSyncEnabled.current
    LaunchedEffect(owner, keys.toList(), topics, intervalMs, active) {
        if (!active) return@LaunchedEffect
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            runAutomaticSync(AppSync.changes(topics), intervalMs, { YugmHttpClient.isOnline }, { latestBusy() }) { latestSync() }
        }
    }
}

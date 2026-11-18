package com.yugm.app.feature.room.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yugm.app.core.api.CreatorApi
import com.yugm.app.core.model.Achievement
import com.yugm.app.core.ui.components.WornBadgeRow
import kotlinx.coroutines.CancellationException

@Composable
internal fun RoomProfileBadges(token: String, userId: String) {
    var badges by remember(token, userId) { mutableStateOf<List<Achievement>>(emptyList()) }
    LaunchedEffect(token, userId) {
        if (token.isBlank() || userId.isBlank()) return@LaunchedEffect
        badges = try {
            CreatorApi.getUserBadges(token, userId)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            emptyList()
        }
    }
    if (badges.isNotEmpty()) WornBadgeRow(badges, Modifier.padding(top = 10.dp))
}

package com.yugm.app.core.api

import android.content.Context
import android.widget.Toast
import com.yugm.app.core.model.VoiceRoomPresence
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.UUID

object VoiceRoomJoinCoordinator {
    private val joinMutex = Mutex()
    private val mutableIsJoining = MutableStateFlow(false)
    val isJoining = mutableIsJoining.asStateFlow()

    private val mutableCurrentActiveRoomId = MutableStateFlow<String?>(null)
    val currentActiveRoomId = mutableCurrentActiveRoomId.asStateFlow()

    fun setCurrentActiveRoomId(roomId: String?) {
        mutableCurrentActiveRoomId.value = roomId
    }

    suspend fun joinVoiceParty(
        context: Context,
        token: String,
        targetUserId: String,
        presence: VoiceRoomPresence?,
        currentUserId: String,
        onNavigateToRoom: (roomId: String) -> Unit,
        onShowToast: (message: String) -> Unit = { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    ) {
        if (presence == null || !presence.isLive || presence.roomId.isBlank()) {
            withContext(Dispatchers.Main) {
                onShowToast("This user is no longer in a voice party.")
            }
            return
        }

        if (!presence.canJoin) {
            withContext(Dispatchers.Main) {
                onShowToast("You need an invitation to join this room.")
            }
            return
        }

        if (joinMutex.isLocked) return

        joinMutex.withLock {
            mutableIsJoining.value = true
            try {
                // If viewer is already in the target room
                val activeRoomId = mutableCurrentActiveRoomId.value
                if (activeRoomId == presence.roomId && YugmMediaRoom.isConnected()) {
                    withContext(Dispatchers.Main) {
                        onNavigateToRoom(presence.roomId)
                    }
                    return
                }

                val opId = UUID.randomUUID().toString()
                val result = RoomApi.joinUserVoiceParty(
                    token = token,
                    targetUserId = targetUserId,
                    expectedRoomId = presence.roomId,
                    expectedPresenceVersion = presence.presenceVersion,
                    operationId = opId
                )

                if (result.success && result.roomId.isNotBlank()) {
                    mutableCurrentActiveRoomId.value = result.roomId
                    withContext(Dispatchers.Main) {
                        onNavigateToRoom(result.roomId)
                    }
                } else {
                    val msg = result.errorMessage ?: "Unable to join voice party."
                    withContext(Dispatchers.Main) {
                        onShowToast(msg)
                    }
                }
            } catch (e: Exception) {
                val msg = e.message ?: "Unable to connect. Please try again."
                withContext(Dispatchers.Main) {
                    onShowToast(msg)
                }
            } finally {
                mutableIsJoining.value = false
            }
        }
    }
}

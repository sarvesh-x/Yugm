package com.yugm.app.feature.room.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.yugm.app.core.navigation.Screen
import com.yugm.app.core.navigation.navigateTopLevel
import com.yugm.app.feature.room.screens.*
import com.yugm.app.feature.room.viewmodel.RoomViewModel
import com.yugm.app.core.model.RoomSessionSummary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

fun NavGraphBuilder.roomNavGraph(
    navController: NavHostController,
    authTokenProvider: () -> String,
    currentUserIdProvider: () -> String,
    userNameProvider: () -> String,
    usernameProvider: () -> String,
    balanceProvider: () -> Int,
    onMinimizeRoom: (com.yugm.app.core.model.Room, com.yugm.app.core.model.RoomType) -> Unit = { _, _ -> },
) {
    composable(Screen.FollowedRooms.route) {
        FollowedRoomsScreen(
            token = authTokenProvider(),
            onBack = { navController.popBackStack() },
            onOpenRoom = { room ->
                navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase()))
            }
        )
    }

    composable(Screen.VoiceRooms.route) {
        LaunchedEffect(Unit) {
            navController.navigate(Screen.MainTabs.createRoute("party")) {
                popUpTo(Screen.VoiceRooms.route) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    composable(
        route = Screen.RoomLobby.route,
        arguments = listOf(
            navArgument("roomId") { type = NavType.StringType },
            navArgument("roomType") { type = NavType.StringType }
        )
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val fallbackType = if (backStackEntry.arguments?.getString("roomType") == "VIDEO") {
            com.yugm.app.core.model.RoomType.Video
        } else {
            com.yugm.app.core.model.RoomType.Voice
        }
        RoomLobbyScreen(
            token = authTokenProvider(),
            roomId = roomId,
            fallbackType = fallbackType,
            currentUserId = currentUserIdProvider(),
            onBack = { navController.popBackStack() },
            onJoin = { type ->
                val route = if (type == com.yugm.app.core.model.RoomType.Video) {
                    Screen.VideoRoom.createRoute(roomId)
                } else {
                    Screen.VoiceRoom.createRoute(roomId)
                }
                navController.navigate(route)
            },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
            onEdit = { id -> navController.navigate(Screen.EditRoom.createRoute(id)) },
            onOpenModes = { isHost ->
                navController.navigate(Screen.RoomMode.createRoute(roomId, isHost))
            }
        )
    }

    composable(
        route = Screen.EditRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val context = androidx.compose.ui.platform.LocalContext.current
        val roomViewModel: RoomViewModel = hiltViewModel()

        LaunchedEffect(roomId) {
            roomViewModel.connect(authTokenProvider(), roomId, currentUserIdProvider())
        }

        val roomLoadState = roomViewModel.roomState
        val loadedRoomDetail = roomViewModel.roomDetail ?: when (roomLoadState) {
            is com.yugm.app.core.util.UiState.Success -> roomLoadState.data
            else -> null
        }
        loadedRoomDetail?.let { detail ->
            EditRoomScreen(
                token = authTokenProvider(),
                room = detail.room,
                host = detail.room.host ?: com.yugm.app.core.model.Host(),
                onBack = { navController.popBackStack() },
                onUpdate = { updatedRoom ->
                    roomViewModel.updateRoom(
                        room = updatedRoom,
                        onSuccess = {
                            android.widget.Toast.makeText(context, "Room updated", android.widget.Toast.LENGTH_SHORT).show()
                            navController.popBackStack()
                        },
                        onFailure = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() }
                    )
                }
            )
        } ?: run {
            com.yugm.app.core.ui.components.LoadingState("Loading room details...")
        }
    }

    composable(Screen.CreateRoom.route) {
        val roomViewModel: RoomViewModel = hiltViewModel()
        val context = androidx.compose.ui.platform.LocalContext.current
        CreateRoomScreen(
            token = authTokenProvider(),
            host = com.yugm.app.core.model.Host(
                id = currentUserIdProvider(),
                name = userNameProvider(),
                username = usernameProvider()
            ),
            onBack = { navController.popBackStack() },
            onCreate = { room, scheduleLater, visibility, allowMicRequests, coverImage, onFailure ->
                val scheduledFor = if (scheduleLater) {
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }.format(Date(System.currentTimeMillis() + 60 * 60 * 1000))
                } else null
                roomViewModel.createRoom(
                    token = authTokenProvider(),
                    room = room,
                    visibility = visibility,
                    allowMicRequests = allowMicRequests,
                    scheduledFor = scheduledFor,
                    coverImage = coverImage,
                    onSuccess = { createdRoom ->
                        if (scheduleLater) {
                            navController.navigate(Screen.Growth.route) {
                                popUpTo(Screen.CreateRoom.route) { inclusive = true }
                            }
                            return@createRoom
                        }
                        val route = if (createdRoom.type == com.yugm.app.core.model.RoomType.Voice) {
                            Screen.VoiceRoom.createRoute(createdRoom.id)
                        } else {
                            Screen.VideoRoom.createRoute(createdRoom.id)
                        }
                        navController.navigate(route) {
                            popUpTo(Screen.CreateRoom.route) { inclusive = true }
                        }
                    },
                    onError = { msg ->
                        onFailure(msg)
                        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                    }
                )
            }
        )
    }

    composable(
        route = Screen.VoiceRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val roomViewModel: RoomViewModel = hiltViewModel()
        val context = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()

        LaunchedEffect(roomId) {
            roomViewModel.connect(authTokenProvider(), roomId, currentUserIdProvider(), video = false)
        }
        LaunchedEffect(roomViewModel.actionError) {
            roomViewModel.actionError?.let { message ->
                android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                roomViewModel.clearActionError()
            }
        }
        val roomLoadState = roomViewModel.roomState
        val loadedRoomDetail = roomViewModel.roomDetail ?: when (roomLoadState) {
            is com.yugm.app.core.util.UiState.Success -> roomLoadState.data
            else -> null
        }
        loadedRoomDetail?.let { detail ->
            val room = detail.room
            ActiveVoiceRoomScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                giftInventory = roomViewModel.giftInventory,
                balance = balanceProvider(),
                diamondBalance = roomViewModel.diamondBalance,
                isHost = room.host?.id == currentUserIdProvider(),
                isRoomAdmin = detail.participants.any { it.user.id == currentUserIdProvider() && it.isRoomAdmin },
                currentUserId = currentUserIdProvider(),
                forcedMuteVersion = roomViewModel.forcedMuteVersion,
                forcedRemoveVersion = roomViewModel.forcedRemoveVersion,
                roomEndedVersion = roomViewModel.roomEndedVersion,
                roomReactionEvent = roomViewModel.roomReactionEvent,
                roomGiftEvent = roomViewModel.roomGiftEvent,
                canSpeak = detail.participants.any {
                    it.user.id == currentUserIdProvider() && it.role in listOf("HOST", "SPEAKER", "MODERATOR")
                },
                participants = detail.participants,
                inviteCandidates = roomViewModel.inviteCandidates,
                roomInviteFollowers = roomViewModel.roomInviteFollowers,
                inviteFriends = roomViewModel.inviteFriends,
                roomEvents = roomViewModel.roomEvents,
                isFollowingRoom = roomViewModel.isFollowingRoom,
                onToggleRoomFollow = roomViewModel::toggleRoomFollow,
                pkBattle = roomViewModel.pkBattle,
                pkInviteId = roomViewModel.pkInviteId,
                pkOpponents = roomViewModel.pkOpponents,
                pkLeaderboard = roomViewModel.pkLeaderboard,
                pkLiveEffect = roomViewModel.pkLiveEffect,
                speakerRequests = detail.speakerRequests,
                polls = roomViewModel.polls,
                roomReactions = roomViewModel.roomReactions,
                isCurrentUserVip = detail.participants.firstOrNull { it.user.id == currentUserIdProvider() }?.user?.isVip == true,
                currentUserVipLevel = detail.participants.firstOrNull { it.user.id == currentUserIdProvider() }?.user?.vipLevel ?: 0,
                onSendImage = { uri ->
                    scope.launch {
                        runCatching {
                            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Could not read image")
                            val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                            val (url, _) = com.yugm.app.core.api.YugmApi.uploadMessageMedia(authTokenProvider(), bytes, mime, "room-image.${mime.substringAfter('/', "jpg")}")
                            roomViewModel.sendMessage("", url, "IMAGE")
                        }.onFailure { android.widget.Toast.makeText(context, it.message ?: "Could not send image", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                reactionCatalogLoading = roomViewModel.isReactionCatalogLoading,
                reactionCatalogError = roomViewModel.reactionCatalogError,
                onReloadReactions = roomViewModel::reloadRoomReactions,
                missions = roomViewModel.missions,
                activity = roomViewModel.activity,
                onBack = {
                    val isHost = room.host?.id == currentUserIdProvider()
                    if (isHost) roomViewModel.endRoomAndDisconnect()
                    else roomViewModel.leaveAndDisconnect { navController.returnFromRoom() }
                },
                onSendMessage = roomViewModel::sendMessage,
                onGift = { gift, currency, receiverId -> roomViewModel.sendGift(gift, receiverId.ifBlank { room.host?.id.orEmpty() }, currency) },
                onInventoryGift = { gift, receiverId, inventoryItemId -> roomViewModel.sendGift(gift, receiverId, "COINS", inventoryItemId) },
                onToast = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() },
                onRequestSpeaker = {
                    roomViewModel.requestSpeaker()
                    android.widget.Toast.makeText(context, "Mic request sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onApproveSpeaker = roomViewModel::approveSpeaker,
                onRejectSpeaker = roomViewModel::rejectSpeaker,
                onTakeSeat = roomViewModel::takeSeat,
                onSetMicLocked = roomViewModel::setMicLocked,
                onClearRoomChat = roomViewModel::clearChat,
                onMuteAllRoom = roomViewModel::muteAll,
                onUnmuteAllRoom = roomViewModel::unmuteAll,
                onReportRoom = { roomViewModel.reportRoom() },
                onBlockRoom = { roomViewModel.blockRoomHost() },
                onRoomFeedback = { roomViewModel.sendRoomFeedback(room.title, "Feedback for ${room.title}") },
                onSetSeatLocked = roomViewModel::setSeatLocked,
                onInviteSpeaker = roomViewModel::inviteSpeaker,
                onCreatePoll = { roomViewModel.createPoll("What should we do next?", listOf("Music", "Games", "Q&A", "Chill")) },
                onCreateCustomPoll = { question, options, onSuccess, onFailure ->
                    roomViewModel.createPoll(question, options, onSuccess, onFailure)
                },
                onVotePoll = roomViewModel::votePoll,
                onClosePoll = roomViewModel::closePoll,
                onRefreshRoom = roomViewModel::refresh,
                onInviteFriend = { userIds ->
                    roomViewModel.inviteUsersToRoom(userIds)
                    android.widget.Toast.makeText(context, "${userIds.size} invite${if (userIds.size == 1) "" else "s"} sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onDirectMessage = { receiverId ->
                    val targetId = receiverId ?: room.host?.id
                    roomViewModel.roomDirectMessage(
                        authTokenProvider(), roomId,
                        "Loved this room. Let's continue after the live.", receiverId
                    )
                    if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                },
                onOpenProfile = { targetId -> navController.navigate(Screen.ProfileDetail.createRoute(targetId)) },
                onMinimize = { onMinimizeRoom(room, com.yugm.app.core.model.RoomType.Voice) },
                onReact = roomViewModel::reactToRoom,
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.yugm.app.core.model.PkBattleType.VOICE, search) },
                onCreateRoomPk = { left, right, format, mode, duration, giftId -> roomViewModel.startRoomPk(left, right, format, mode, duration, giftId) },
                onVotePk = roomViewModel::votePk,
                onReadyPk = roomViewModel::readyPk,
                onClosePk = roomViewModel::closePk,
                onInvitePk = { opponent, mode, duration, title ->
                    roomViewModel.invitePk(opponent, mode, duration, title)
                    android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onAutoMatchPk = { mode, duration, title ->
                    roomViewModel.autoMatchPk(mode, duration, title)
                    android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onSendPkGift = { gift, side, quantity -> roomViewModel.sendPkGift(gift.id, side, quantity) },
                onSendPkReaction = roomViewModel::sendPkReaction,
                onAcceptPk = roomViewModel::acceptPk,
                onRejectPk = roomViewModel::rejectPk,
                onEndPk = roomViewModel::endPk,
                onEndRoom = {
                    roomViewModel.endRoomAndDisconnect()
                },
                onMuteUser = roomViewModel::muteUser,
                onOwnMicStateChanged = roomViewModel::setOwnMicState,
                onRemoveUser = roomViewModel::removeUser,
                onRemoveSpeaker = roomViewModel::removeSpeaker,
                onLeaveSeat = roomViewModel::leaveOwnSeat,
                onSetRoomAdmin = roomViewModel::setRoomAdmin,
                onFollowUser = roomViewModel::followRoomUser,
                onUnfollowUser = roomViewModel::unfollowRoomUser,
                onReportUser = { userId -> roomViewModel.reportUser(userId) },
                onJoin = roomViewModel::join,
                onOpenModes = {
                    navController.navigate(Screen.RoomMode.createRoute(roomId, room.host?.id == currentUserIdProvider()))
                },
                onOpenThemes = {
                    navController.navigate(Screen.ThemeGallery.createRoute(roomId))
                },
                onEditRoom = {
                    navController.navigate(Screen.EditRoom.createRoute(roomId))
                }
            )
            roomViewModel.roomEndSummary?.let { summary ->
                RoomSessionSummaryDialog(summary) {
                    roomViewModel.dismissRoomEndSummary()
                    navController.returnFromRoom()
                }
            }
        } ?: RoomConnectionFallback(
            isLoading = roomViewModel.roomState is com.yugm.app.core.util.UiState.Loading || roomViewModel.roomState is com.yugm.app.core.util.UiState.Idle,
            message = roomViewModel.roomError ?: "Room details are unavailable.",
            onRetry = roomViewModel::refresh,
            onExit = { navController.returnFromRoom() }
        )
    }

    composable(
        route = Screen.VideoRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val roomViewModel: RoomViewModel = hiltViewModel()
        val context = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()

        LaunchedEffect(roomId) {
            roomViewModel.connect(authTokenProvider(), roomId, currentUserIdProvider(), video = true)
        }
        LaunchedEffect(roomViewModel.actionError) {
            roomViewModel.actionError?.let { message ->
                android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
                roomViewModel.clearActionError()
            }
        }
        LaunchedEffect(roomViewModel.roomEndedVersion) {
            if (roomViewModel.roomEndedVersion > 0) {
                val current = roomViewModel.roomDetail?.room
                val participant = roomViewModel.roomDetail?.participants?.firstOrNull { it.user.id == currentUserIdProvider() }
                val hostOrAdmin = current?.host?.id == currentUserIdProvider() || participant?.isRoomAdmin == true
                if (!hostOrAdmin) roomViewModel.leaveAndDisconnect { navController.returnFromRoom() }
            }
        }

        val roomLoadState = roomViewModel.roomState
        val loadedRoomDetail = roomViewModel.roomDetail ?: when (roomLoadState) {
            is com.yugm.app.core.util.UiState.Success -> roomLoadState.data
            else -> null
        }
        loadedRoomDetail?.let { detail ->
            val room = detail.room
            VideoLivestreamScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                balance = balanceProvider(),
                diamondBalance = roomViewModel.diamondBalance,
                isHost = room.host?.id == currentUserIdProvider(),
                isRoomAdmin = detail.participants.any { it.user.id == currentUserIdProvider() && it.isRoomAdmin },
                currentUserId = currentUserIdProvider(),
                participants = detail.participants,
                speakerRequests = detail.speakerRequests,
                inviteCandidates = roomViewModel.inviteCandidates,
                roomInviteFollowers = roomViewModel.roomInviteFollowers,
                inviteFriends = roomViewModel.inviteFriends,
                isFollowingRoom = roomViewModel.isFollowingRoom,
                onToggleRoomFollow = roomViewModel::toggleRoomFollow,
                pkBattle = roomViewModel.pkBattle,
                pkInviteId = roomViewModel.pkInviteId,
                pkOpponents = roomViewModel.pkOpponents,
                pkLeaderboard = roomViewModel.pkLeaderboard,
                pkLiveEffect = roomViewModel.pkLiveEffect,
                pkOpponentMedia = roomViewModel.pkOpponentMedia,
                polls = roomViewModel.polls,
                roomReactions = roomViewModel.roomReactions,
                isCurrentUserVip = detail.participants.firstOrNull { it.user.id == currentUserIdProvider() }?.user?.isVip == true,
                roomReactionEvent = roomViewModel.roomReactionEvent,
                reactionCatalogLoading = roomViewModel.isReactionCatalogLoading,
                reactionCatalogError = roomViewModel.reactionCatalogError,
                onReloadReactions = roomViewModel::reloadRoomReactions,
                onBack = {
                    val isHost = room.host?.id == currentUserIdProvider()
                    if (isHost) roomViewModel.endRoomAndDisconnect()
                    else roomViewModel.leaveAndDisconnect { navController.returnFromRoom() }
                },
                onMinimize = { onMinimizeRoom(room, com.yugm.app.core.model.RoomType.Video) },
                requestError = roomViewModel.actionError.orEmpty(),
                onJoin = roomViewModel::joinVideo,
                onSendMessage = roomViewModel::sendMessage,
                onGift = { gift, currency -> roomViewModel.sendGift(gift, room.host?.id ?: "", currency) },
                onToast = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() },
                onRequestSpeaker = roomViewModel::requestSpeaker,
                onApproveSpeaker = roomViewModel::approveSpeaker,
                onRejectSpeaker = roomViewModel::rejectSpeaker,
                onInviteFriend = { userIds ->
                    roomViewModel.inviteUsersToRoom(userIds)
                    android.widget.Toast.makeText(context, "${userIds.size} invite${if (userIds.size == 1) "" else "s"} sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onFollowUser = roomViewModel::followRoomUser,
                onReact = roomViewModel::reactToRoom,
                onReportHost = { reportedId -> roomViewModel.reportUser(reportedId) },
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.yugm.app.core.model.PkBattleType.VIDEO, search) },
                onInvitePk = { opponent, mode, duration, title -> roomViewModel.invitePk(opponent, mode, duration, title) },
                onAutoMatchPk = { mode, duration, title -> roomViewModel.autoMatchPk(mode, duration, title) },
                onSendPkGift = { gift, side, quantity -> roomViewModel.sendPkGift(gift.id, side, quantity) },
                onSendPkReaction = roomViewModel::sendPkReaction,
                onAcceptPk = roomViewModel::acceptPk,
                onRejectPk = roomViewModel::rejectPk,
                onEndPk = roomViewModel::endPk,
                onReadyPk = roomViewModel::readyPk,
                onClosePk = roomViewModel::closePk,
                onCreatePoll = { roomViewModel.createPoll("What should we do?", listOf("Music", "Games")) },
                onCreateCustomPoll = { question, options, onSuccess, onFailure ->
                    roomViewModel.createPoll(question, options, onSuccess, onFailure)
                },
                onVotePoll = roomViewModel::votePoll,
                onClosePoll = roomViewModel::closePoll,
                onEndRoom = {
                    roomViewModel.endRoomAndDisconnect { }
                }
            )
            roomViewModel.roomEndSummary?.let { summary ->
                RoomSessionSummaryDialog(summary) {
                    roomViewModel.dismissRoomEndSummary()
                    navController.returnFromRoom()
                }
            }
        } ?: RoomConnectionFallback(
            isLoading = roomViewModel.roomState is com.yugm.app.core.util.UiState.Loading || roomViewModel.roomState is com.yugm.app.core.util.UiState.Idle,
            message = roomViewModel.roomError ?: "Room details are unavailable.",
            onRetry = roomViewModel::refresh,
            onExit = { navController.returnFromRoom() }
        )
    }

    composable(
        route = Screen.ThemeGallery.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        ThemeGalleryScreen(
            token = authTokenProvider(),
            roomId = roomId,
            onBack = { navController.popBackStack() }
        )
    }
}

@androidx.compose.runtime.Composable
private fun RoomSessionSummaryDialog(summary: RoomSessionSummary, onDismiss: () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        androidx.compose.material3.Surface(
            modifier = Modifier.fillMaxWidth(0.92f),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(26.dp),
            color = Color.White,
            shadowElevation = 16.dp
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    Modifier.padding(bottom = 14.dp).size(72.dp)
                        .background(Color(0xFFE9DFFF), androidx.compose.foundation.shape.CircleShape),
                    contentAlignment = Alignment.Center
                ) { Text("🎙️", fontSize = 34.sp) }
                Text("Session ended", color = Color(0xFF171421), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Here’s how your live room went", color = Color(0xFF777487), fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp, bottom = 24.dp))
                androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionStat("◷", "${summary.durationMinutes} min", "Duration", Color(0xFF54B9EA), Modifier.weight(1f))
                    SessionStat("●", "${summary.joined}", "Joined", Color(0xFF42C787), Modifier.weight(1f))
                }
                androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionStat("▣", "${summary.messages}", "Messages", Color(0xFFBD64DC), Modifier.weight(1f))
                    SessionStat("◆", "${summary.gifts}", "Gifts", Color(0xFFEE6D9C), Modifier.weight(1f))
                }
                androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SessionStat("♥", "${summary.newFans}", "New fans", Color(0xFF40CDA5), Modifier.weight(1f))
                    SessionStat("♦", "${summary.diamondGifts}", "Diamonds gift", Color(0xFF8E61E9), Modifier.weight(1f))
                }
                androidx.compose.material3.Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth().padding(top = 30.dp),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
                ) { Text("Done") }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun SessionStat(icon: String, value: String, label: String, tint: Color, modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Box(Modifier.size(34.dp).background(tint.copy(alpha = 0.18f), androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
            Text(icon, color = tint, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
        Column {
            Text(value, color = Color(0xFF171421), fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(label, color = Color(0xFF89879A), fontSize = 12.sp)
        }
    }
}

@androidx.compose.runtime.Composable
private fun RoomConnectionFallback(
    isLoading: Boolean,
    message: String?,
    onRetry: () -> Unit,
    onExit: () -> Unit
) {
    Box(
        Modifier.fillMaxSize().background(Color(0xFF100D1B)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(24.dp)
        ) {
            if (isLoading) CircularProgressIndicator()
            Text(
                if (isLoading) "Opening room…" else message ?: "Couldn't open this room.",
                color = Color.White,
                fontWeight = FontWeight.SemiBold
            )
            if (!isLoading) TextButton(onClick = onRetry) { Text("Try again") }
            TextButton(onClick = onExit) { Text("Back to Home") }
        }
    }
}

private fun NavHostController.returnFromRoom() {
    if (!popBackStack()) {
        navigate(Screen.MainTabs.createRoute("discover")) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }
}

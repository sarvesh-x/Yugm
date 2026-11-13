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
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
    onMinimizeRoom: (String) -> Unit = {},
) {
    composable(Screen.VoiceRooms.route) {
        VoiceRoomsScreen(
            onOpenRoom = { room -> navController.navigate(Screen.RoomLobby.createRoute(room.id, room.type.name.uppercase())) },
            onCreateRoom = { navController.navigate(Screen.CreateRoom.route) },
            onDiscover = { navController.navigateTopLevel(Screen.Discover.route) },
            onChat = { navController.navigateTopLevel(Screen.ChatList.route) },
            onWallet = { navController.navigateTopLevel(Screen.Wallet.route) },
            onProfile = {
                if (currentUserIdProvider().isNotBlank()) navController.navigateTopLevel(Screen.ProfileDetail.createRoute(currentUserIdProvider()))
                else navController.navigate(Screen.ProfileSetup.route)
            },
            onSearch = { navController.navigate(Screen.Search.route) }
        )
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
            onOpenModes = {
                val isHost = true
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

        roomViewModel.roomDetail?.let { detail ->
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

        roomViewModel.roomDetail?.let { detail ->
            val room = detail.room
            ActiveVoiceRoomScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                balance = balanceProvider(),
                isHost = room.host?.id == currentUserIdProvider(),
                currentUserId = currentUserIdProvider(),
                isRoomAdmin = detail.participants.any { it.user.id == currentUserIdProvider() && it.isRoomAdmin },
                forcedMuteVersion = roomViewModel.forcedMuteVersion,
                forcedRemoveVersion = roomViewModel.forcedRemoveVersion,
                roomEndedVersion = roomViewModel.roomEndedVersion,
                roomReactionEvent = roomViewModel.roomReactionEvent,
                canSpeak = room.host?.id == currentUserIdProvider() || detail.participants.any {
                    it.user.id == currentUserIdProvider() && it.role in listOf("SPEAKER", "MODERATOR")
                },
                participants = detail.participants,
                inviteCandidates = roomViewModel.inviteCandidates,
                pkBattle = roomViewModel.pkBattle,
                pkInviteId = roomViewModel.pkInviteId,
                pkOpponents = roomViewModel.pkOpponents,
                pkLeaderboard = roomViewModel.pkLeaderboard,
                pkLiveEffect = roomViewModel.pkLiveEffect,
                speakerRequests = detail.speakerRequests,
                polls = roomViewModel.polls,
                missions = roomViewModel.missions,
                activity = roomViewModel.activity,
                onBack = { roomViewModel.leaveAndDisconnect { navController.returnFromRoom() } },
                onSendMessage = roomViewModel::sendMessage,
                onGift = { gift -> roomViewModel.sendGift(gift, room.host?.id ?: "") },
                onToast = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() },
                onRequestSpeaker = {
                    roomViewModel.requestSpeaker()
                    android.widget.Toast.makeText(context, "Mic request sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onApproveSpeaker = roomViewModel::approveSpeaker,
                onRejectSpeaker = roomViewModel::rejectSpeaker,
                onTakeSeat = roomViewModel::takeSeat,
                onSetMicLocked = roomViewModel::setMicLocked,
                onSetSeatLocked = roomViewModel::setSeatLocked,
                onInviteSpeaker = roomViewModel::inviteSpeaker,
                onCreatePoll = { roomViewModel.createPoll("What should we do next?", listOf("Music", "Games", "Q&A", "Chill")) },
                onCreateCustomPoll = roomViewModel::createPoll,
                onVotePoll = roomViewModel::votePoll,
                onInviteFriend = { userId ->
                    roomViewModel.inviteToRoom(userId)
                    android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show()
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
                onMinimize = { onMinimizeRoom(roomId) },
                onReact = roomViewModel::reactToRoom,
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.yugm.app.core.model.PkBattleType.VOICE, search) },
                onInvitePk = { opponent, mode, duration, title ->
                    roomViewModel.invitePk(opponent, mode, duration, title)
                    android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onAutoMatchPk = { mode, duration, title ->
                    roomViewModel.autoMatchPk(mode, duration, title)
                    android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onSendPkGift = { gift, side -> roomViewModel.sendPkGift(gift.id, side) },
                onSendPkReaction = roomViewModel::sendPkReaction,
                onAcceptPk = roomViewModel::acceptPk,
                onRejectPk = roomViewModel::rejectPk,
                onEndPk = roomViewModel::endPk,
                onEndRoom = {
                    roomViewModel.endRoomAndDisconnect { navController.returnFromRoom() }
                },
                onMuteUser = roomViewModel::muteUser,
                onOwnMicStateChanged = roomViewModel::setOwnMicState,
                onRemoveUser = roomViewModel::removeUser,
                onFollowUser = roomViewModel::followRoomUser,
                onUnfollowUser = roomViewModel::unfollowRoomUser,
                onRemoveSpeaker = roomViewModel::removeSpeaker,
                onSetRoomAdmin = roomViewModel::setRoomAdmin,
                onReportUser = { userId -> roomViewModel.reportUser(userId) },
                onJoin = roomViewModel::join,
                onOpenModes = {
                    navController.navigate(Screen.RoomMode.createRoute(roomId, room.host?.id == currentUserIdProvider()))
                },
                onOpenThemes = {
                    navController.navigate(Screen.ThemeGallery.createRoute(roomId))
                }
            )
        } ?: RoomConnectionFallback(
            isLoading = roomViewModel.roomState !is com.yugm.app.core.util.UiState.Error,
            message = roomViewModel.roomError,
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

        roomViewModel.roomDetail?.let { detail ->
            val room = detail.room
            ActiveVideoRoomScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                balance = balanceProvider(),
                isHost = room.host?.id == currentUserIdProvider(),
                participants = detail.participants,
                inviteCandidates = roomViewModel.inviteCandidates,
                pkBattle = roomViewModel.pkBattle,
                pkInviteId = roomViewModel.pkInviteId,
                pkOpponents = roomViewModel.pkOpponents,
                pkLeaderboard = roomViewModel.pkLeaderboard,
                pkLiveEffect = roomViewModel.pkLiveEffect,
                pkOpponentMedia = roomViewModel.pkOpponentMedia,
                polls = roomViewModel.polls,
                missions = roomViewModel.missions,
                activity = roomViewModel.activity,
                onBack = { roomViewModel.leaveAndDisconnect { navController.returnFromRoom() } },
                onSendMessage = roomViewModel::sendMessage,
                onGift = { gift -> roomViewModel.sendGift(gift, room.host?.id ?: "") },
                onToast = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() },
                onRequestSpeaker = {
                    roomViewModel.requestSpeaker()
                    android.widget.Toast.makeText(context, "Speaker request sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onCreatePoll = { roomViewModel.createPoll("What should we do next?", listOf("Music", "Games", "Q&A", "Chill")) },
                onCreateCustomPoll = roomViewModel::createPoll,
                onVotePoll = roomViewModel::votePoll,
                onInviteFriend = { userId ->
                    roomViewModel.inviteToRoom(userId)
                    android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onDirectMessage = { receiverId ->
                    val targetId = receiverId ?: room.host?.id
                    roomViewModel.roomDirectMessage(
                        authTokenProvider(), roomId,
                        "Loved this room. Let's continue after the live.", receiverId
                    )
                    if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                },
                onReact = roomViewModel::reactToRoom,
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.yugm.app.core.model.PkBattleType.VIDEO, search) },
                onInvitePk = { opponent, mode, duration, title ->
                    roomViewModel.invitePk(opponent, mode, duration, title)
                    android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onAutoMatchPk = { mode, duration, title ->
                    roomViewModel.autoMatchPk(mode, duration, title)
                    android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onSendPkGift = { gift, side -> roomViewModel.sendPkGift(gift.id, side) },
                onSendPkReaction = roomViewModel::sendPkReaction,
                onAcceptPk = roomViewModel::acceptPk,
                onRejectPk = roomViewModel::rejectPk,
                onEndPk = roomViewModel::endPk,
                onEndRoom = {
                    roomViewModel.endRoomAndDisconnect { navController.returnFromRoom() }
                },
                onMuteUser = roomViewModel::muteUser,
                onRemoveUser = roomViewModel::removeUser,
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
        } ?: RoomConnectionFallback(
            isLoading = roomViewModel.roomState !is com.yugm.app.core.util.UiState.Error,
            message = roomViewModel.roomError,
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
        navigate(Screen.Discover.route) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }
}

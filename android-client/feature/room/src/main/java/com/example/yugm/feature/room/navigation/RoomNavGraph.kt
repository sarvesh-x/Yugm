package com.example.yugm.feature.room.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.core.navigation.Screen
import com.example.yugm.feature.room.screens.*
import com.example.yugm.feature.room.viewmodel.RoomViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

fun NavGraphBuilder.roomNavGraph(
    navController: NavHostController,
    authToken: String,
    currentUserId: String,
    userName: String,
    username: String,
    balance: Int,
) {
    composable(
        route = Screen.RoomLobby.route,
        arguments = listOf(
            navArgument("roomId") { type = NavType.StringType },
            navArgument("roomType") { type = NavType.StringType }
        )
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val fallbackType = if (backStackEntry.arguments?.getString("roomType") == "VIDEO") {
            com.example.yugm.core.model.RoomType.Video
        } else {
            com.example.yugm.core.model.RoomType.Voice
        }
        RoomLobbyScreen(
            token = authToken,
            roomId = roomId,
            fallbackType = fallbackType,
            currentUserId = currentUserId,
            onBack = { navController.popBackStack() },
            onJoin = { type ->
                val route = if (type == com.example.yugm.core.model.RoomType.Video) {
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
            roomViewModel.connect(authToken, roomId, currentUserId)
        }

        roomViewModel.roomDetail?.let { detail ->
            EditRoomScreen(
                token = authToken,
                room = detail.room,
                host = detail.room.host ?: com.example.yugm.core.model.Host(),
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
            com.example.yugm.core.ui.components.LoadingState("Loading room details...")
        }
    }

    composable(Screen.CreateRoom.route) {
        val roomViewModel: RoomViewModel = hiltViewModel()
        val context = androidx.compose.ui.platform.LocalContext.current
        CreateRoomScreen(
            token = authToken,
            host = com.example.yugm.core.model.Host(
                id = currentUserId,
                name = userName,
                username = username
            ),
            onBack = { navController.popBackStack() },
            onCreate = { room, scheduleLater, visibility, allowMicRequests, coverImage ->
                val scheduledFor = if (scheduleLater) {
                    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }.format(Date(System.currentTimeMillis() + 60 * 60 * 1000))
                } else null
                roomViewModel.createRoom(
                    token = authToken,
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
                        val route = if (createdRoom.type == com.example.yugm.core.model.RoomType.Voice) {
                            Screen.VoiceRoom.createRoute(createdRoom.id)
                        } else {
                            Screen.VideoRoom.createRoute(createdRoom.id)
                        }
                        navController.navigate(route) {
                            popUpTo(Screen.CreateRoom.route) { inclusive = true }
                        }
                    },
                    onError = { msg ->
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
            roomViewModel.connect(authToken, roomId, currentUserId, video = false)
        }

        roomViewModel.roomDetail?.let { detail ->
            val room = detail.room
            ActiveVoiceRoomScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                balance = balance,
                isHost = room.host?.id == currentUserId,
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
                onBack = { roomViewModel.disconnect(); navController.popBackStack() },
                onSendMessage = roomViewModel::sendMessage,
                onGift = { gift -> roomViewModel.sendGift(gift, room.host?.id ?: "") },
                onToast = { msg -> android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() },
                onRequestSpeaker = {
                    roomViewModel.requestSpeaker()
                    android.widget.Toast.makeText(context, "Mic request sent", android.widget.Toast.LENGTH_SHORT).show()
                },
                onApproveSpeaker = roomViewModel::approveSpeaker,
                onRejectSpeaker = roomViewModel::rejectSpeaker,
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
                        authToken, roomId,
                        "Loved this room. Let's continue after the live.", receiverId
                    )
                    if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                },
                onReact = roomViewModel::reactToRoom,
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.example.yugm.core.model.PkBattleType.VOICE, search) },
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
                    roomViewModel.endRoom()
                    navController.popBackStack()
                },
                onMuteUser = roomViewModel::muteUser,
                onRemoveUser = roomViewModel::removeUser,
                onReportUser = { userId -> roomViewModel.reportUser(userId) },
                onJoin = roomViewModel::join,
                onOpenModes = {
                    navController.navigate(Screen.RoomMode.createRoute(roomId, room.host?.id == currentUserId))
                },
                onOpenThemes = {
                    navController.navigate(Screen.ThemeGallery.createRoute(roomId))
                }
            )
        }
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
            roomViewModel.connect(authToken, roomId, currentUserId, video = true)
        }

        roomViewModel.roomDetail?.let { detail ->
            val room = detail.room
            ActiveVideoRoomScreen(
                room = room,
                chat = roomViewModel.chat,
                gifts = roomViewModel.gifts,
                balance = balance,
                isHost = room.host?.id == currentUserId,
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
                onBack = { roomViewModel.disconnect(); navController.popBackStack() },
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
                        authToken, roomId,
                        "Loved this room. Let's continue after the live.", receiverId
                    )
                    if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                },
                onReact = roomViewModel::reactToRoom,
                onLoadPkOpponents = { search -> roomViewModel.loadPkOpponents(com.example.yugm.core.model.PkBattleType.VIDEO, search) },
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
                    roomViewModel.endRoom()
                    navController.popBackStack()
                },
                onMuteUser = roomViewModel::muteUser,
                onRemoveUser = roomViewModel::removeUser,
                onReportUser = { userId -> roomViewModel.reportUser(userId) },
                onJoin = roomViewModel::join,
                onOpenModes = {
                    navController.navigate(Screen.RoomMode.createRoute(roomId, room.host?.id == currentUserId))
                },
                onOpenThemes = {
                    navController.navigate(Screen.ThemeGallery.createRoute(roomId))
                }
            )
        }
    }

    composable(
        route = Screen.ThemeGallery.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        ThemeGalleryScreen(
            token = authToken,
            roomId = roomId,
            onBack = { navController.popBackStack() }
        )
    }
}

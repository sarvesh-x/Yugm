package com.example.yugm.navigation

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.yugm.ui.screens.*
import com.example.yugm.ui.viewmodel.MainViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

fun NavGraphBuilder.roomNavGraph(
    navController: NavHostController,
    mainViewModel: MainViewModel,
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
            com.example.yugm.model.RoomType.Video
        } else {
            com.example.yugm.model.RoomType.Voice
        }
        RoomLobbyScreen(
            token = mainViewModel.authToken,
            roomId = roomId,
            fallbackType = fallbackType,
            currentUserId = mainViewModel.currentUserId,
            onBack = { navController.popBackStack() },
            onJoin = { type ->
                val route = if (type == com.example.yugm.model.RoomType.Video) {
                    Screen.VideoRoom.createRoute(roomId)
                } else {
                    Screen.VoiceRoom.createRoute(roomId)
                }
                navController.navigate(route)
            },
            onOpenProfile = { userId -> navController.navigate(Screen.ProfileDetail.createRoute(userId)) },
            onEdit = { id -> navController.navigate(Screen.EditRoom.createRoute(id)) }
        )
    }

    composable(
        route = Screen.EditRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        val context = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()
        var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }

        LaunchedEffect(roomId) {
            runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                .onSuccess { roomDetail = it }
        }

        roomDetail?.let { detail ->
            EditRoomScreen(
                token = mainViewModel.authToken,
                room = detail.room,
                host = detail.room.host ?: com.example.yugm.model.Host(),
                onBack = { navController.popBackStack() },
                onUpdate = { updatedRoom ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.RoomApi.updateRoom(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                room = updatedRoom
                            )
                        }.onSuccess {
                            android.widget.Toast.makeText(context, "Room updated", android.widget.Toast.LENGTH_SHORT).show()
                            navController.popBackStack()
                        }.onFailure {
                            android.widget.Toast.makeText(context, it.message ?: "Update failed", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            )
        } ?: run {
            com.example.yugm.ui.components.LoadingState("Loading room details...")
        }
    }

    composable(Screen.CreateRoom.route) {
        val scope = rememberCoroutineScope()
        CreateRoomScreen(
            token = mainViewModel.authToken,
            host = com.example.yugm.model.Host(
                id = mainViewModel.currentUserId,
                name = mainViewModel.userName,
                username = mainViewModel.username
            ),
            onBack = { navController.popBackStack() },
            onCreate = { room, scheduleLater, visibility, allowMicRequests, coverImage ->
                scope.launch {
                    runCatching {
                        val scheduledFor = if (scheduleLater) {
                            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                timeZone = TimeZone.getTimeZone("UTC")
                            }.format(Date(System.currentTimeMillis() + 60 * 60 * 1000))
                        } else null
                        com.example.yugm.api.YugmApi.createRoom(
                            token = mainViewModel.authToken,
                            room = room,
                            visibility = visibility,
                            allowAudienceMicRequests = allowMicRequests,
                            scheduledFor = scheduledFor,
                            coverImage = coverImage
                        )
                    }.onSuccess { createdRoom ->
                        if (scheduleLater) {
                            navController.navigate(Screen.Growth.route) {
                                popUpTo(Screen.CreateRoom.route) { inclusive = true }
                            }
                            return@onSuccess
                        }
                        val route = if (createdRoom.type == com.example.yugm.model.RoomType.Voice) {
                            Screen.VoiceRoom.createRoute(createdRoom.id)
                        } else {
                            Screen.VideoRoom.createRoute(createdRoom.id)
                        }
                        navController.navigate(route) {
                            popUpTo(Screen.CreateRoom.route) { inclusive = true }
                        }
                    }
                }
            }
        )
    }

    composable(
        route = Screen.VoiceRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }
        var polls by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomPoll>>(emptyList()) }
        var missions by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomMission>>(emptyList()) }
        var activity by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomActivityItem>>(emptyList()) }
        var pkBattle by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkBattle?>(null) }
        var pkInviteId by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
        var pkOpponents by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkOpponent>>(emptyList()) }
        var pkLeaderboard by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkLeaderboardEntry>>(emptyList()) }
        var pkLiveEffect by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkLiveEffect?>(null) }
        val context = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()
        val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
        val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
        var inviteCandidates by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.Host>>(emptyList()) }

        fun refreshVoiceRoom() {
            scope.launch {
                runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                    .onSuccess { roomDetail = it }
                runCatching { com.example.yugm.api.YugmApi.roomPolls(roomId) }
                    .onSuccess { polls = it }
                runCatching { com.example.yugm.api.YugmApi.roomMissions(mainViewModel.authToken, roomId) }
                    .onSuccess { missions = it }
                runCatching { com.example.yugm.api.YugmApi.roomActivity(roomId) }
                    .onSuccess { activity = it }
                runCatching { com.example.yugm.api.YugmApi.roomMessages(roomId, mainViewModel.authToken) }
                    .onSuccess {
                        chat.clear()
                        chat.addAll(it)
                    }
                runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                    .onSuccess {
                        gifts.clear()
                        gifts.addAll(it)
                    }
                if (mainViewModel.currentUserId.isNotBlank()) {
                    runCatching { com.example.yugm.api.YugmApi.getFollowing(mainViewModel.currentUserId, mainViewModel.authToken) }
                        .onSuccess { inviteCandidates = it }
                }
                runCatching { com.example.yugm.api.YugmApi.activePkWithInvite(mainViewModel.authToken, roomId) }
                    .onSuccess { result ->
                        val battle = result.first
                        pkBattle = battle
                        pkInviteId = result.second?.id
                        if (battle != null) {
                            runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                .onSuccess { pkLeaderboard = it }
                        } else {
                            pkLeaderboard = emptyList()
                        }
                    }
            }
        }

        LaunchedEffect(roomId) { refreshVoiceRoom() }

        roomDetail?.let { detail ->
            val room = detail.room
            ActiveVoiceRoomScreen(
                room = room,
                chat = chat,
                gifts = gifts,
                balance = mainViewModel.balance,
                isHost = room.host?.id == mainViewModel.currentUserId,
                participants = detail.participants,
                inviteCandidates = inviteCandidates,
                pkBattle = pkBattle,
                pkInviteId = pkInviteId,
                pkOpponents = pkOpponents,
                pkLeaderboard = pkLeaderboard,
                pkLiveEffect = pkLiveEffect,
                speakerRequests = detail.speakerRequests,
                polls = polls,
                missions = missions,
                activity = activity,
                onBack = { navController.popBackStack() },
                onSendMessage = { text ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.sendMessage(mainViewModel.authToken, roomId, text)
                            chat.add(com.example.yugm.model.ChatMessage(mainViewModel.userName, text))
                        }
                    }
                },
                onGift = { gift ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.sendGift(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                gift = gift,
                                receiverId = room.host?.id ?: ""
                            )
                        }.onSuccess {
                            runCatching { mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)) }
                            gifts.add(gift)
                        }
                    }
                },
                onToast = { msg ->
                    android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                },
                onRequestSpeaker = {
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.requestSpeaker(mainViewModel.authToken, roomId) }
                            .onSuccess {
                                android.widget.Toast.makeText(context, "Mic request sent", android.widget.Toast.LENGTH_SHORT).show()
                                refreshVoiceRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onApproveSpeaker = { userId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.approveSpeaker(mainViewModel.authToken, roomId, userId) }
                            .onSuccess { refreshVoiceRoom() }
                    }
                },
                onRejectSpeaker = { userId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.rejectSpeaker(mainViewModel.authToken, roomId, userId) }
                            .onSuccess { refreshVoiceRoom() }
                    }
                },
                onCreatePoll = {
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.createPoll(
                                mainViewModel.authToken,
                                roomId,
                                "What should we do next?",
                                listOf("Music", "Games", "Q&A", "Chill")
                            )
                        }.onSuccess { refreshVoiceRoom() }
                    }
                },
                onCreateCustomPoll = { question, options ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.createPoll(mainViewModel.authToken, roomId, question, options)
                        }.onSuccess { refreshVoiceRoom() }
                    }
                },
                onVotePoll = { pollId, optionIndex ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.votePoll(mainViewModel.authToken, roomId, pollId, optionIndex) }
                            .onSuccess { refreshVoiceRoom() }
                    }
                },
                onInviteFriend = { userId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, roomId, userId) }
                            .onSuccess { android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onDirectMessage = { receiverId ->
                    scope.launch {
                        val targetId = receiverId ?: room.host?.id
                        runCatching {
                            com.example.yugm.api.YugmApi.roomDirectMessage(
                                mainViewModel.authToken,
                                roomId,
                                "Loved this room. Let's continue after the live.",
                                receiverId
                            )
                        }.onSuccess {
                            if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onReact = { type ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.reactToRoom(mainViewModel.authToken, roomId, type) }
                    }
                },
                onLoadPkOpponents = { search ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.availablePkOpponents(mainViewModel.authToken, com.example.yugm.model.PkBattleType.VOICE, search) }
                            .onSuccess { pkOpponents = it }
                    }
                },
                onInvitePk = { opponent, mode, duration, title ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.invitePk(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                opponentRoomId = opponent.roomId,
                                opponentHostId = opponent.hostId,
                                battleType = com.example.yugm.model.PkBattleType.VOICE,
                                mode = mode,
                                durationSeconds = duration,
                                title = title
                            )
                        }.onSuccess {
                            pkBattle = it.first
                            android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAutoMatchPk = { mode, duration, title ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.autoMatchPk(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                battleType = com.example.yugm.model.PkBattleType.VOICE,
                                mode = mode,
                                durationSeconds = duration,
                                title = title
                            )
                        }.onSuccess {
                            pkBattle = it.first
                            pkInviteId = it.second?.id
                            android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onSendPkGift = { gift, side ->
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        runCatching { com.example.yugm.api.YugmApi.sendPkGift(mainViewModel.authToken, battleId, gift.id, side) }
                            .onSuccess {
                                pkBattle = it
                                mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onSendPkReaction = { reaction, side ->
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        runCatching { com.example.yugm.api.YugmApi.sendPkReaction(mainViewModel.authToken, battleId, side, reaction) }
                            .onSuccess { pkBattle = it }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAcceptPk = { inviteId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.acceptPk(mainViewModel.authToken, inviteId) }
                            .onSuccess {
                                pkBattle = it
                                pkInviteId = null
                                refreshVoiceRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onRejectPk = { inviteId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.rejectPk(mainViewModel.authToken, inviteId) }
                            .onSuccess {
                                pkBattle = null
                                pkInviteId = null
                                refreshVoiceRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onEndPk = {
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        val battle = pkBattle
                        if (battle?.status == com.example.yugm.model.PkStatus.INVITED || battle?.status == com.example.yugm.model.PkStatus.WAITING) {
                            runCatching { com.example.yugm.api.YugmApi.cancelPk(mainViewModel.authToken, battleId) }
                                .onSuccess {
                                    pkBattle = null
                                    pkInviteId = null
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        } else {
                            runCatching { com.example.yugm.api.YugmApi.endPk(mainViewModel.authToken, battleId) }
                                .onSuccess {
                                    pkBattle = it
                                    pkInviteId = null
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    }
                },
                onEndRoom = {
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.endRoom(roomId, mainViewModel.authToken) }
                            .onSuccess { navController.popBackStack() }
                    }
                },
                onMuteUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.muteUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVoiceRoom() } }
                },
                onRemoveUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.removeUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVoiceRoom() } }
                },
                onReportUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, roomId, userId, "Inappropriate behavior") } }
                },
                onJoin = {
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.joinRoom(mainViewModel.authToken, roomId)
                            val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                            com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                            com.example.yugm.api.YugmSocket.connect(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                onMessage = { author, text -> chat.add(com.example.yugm.model.ChatMessage(author, text)) },
                                onPkState = { battle ->
                                    scope.launch {
                                        pkBattle = battle
                                        if (battle.status == com.example.yugm.model.PkStatus.ACTIVE) pkInviteId = null
                                        runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                            .onSuccess { pkLeaderboard = it }
                                    }
                                },
                                onPkInvite = { battle, invite ->
                                    scope.launch {
                                        pkBattle = battle
                                        pkInviteId = invite.id
                                        android.widget.Toast.makeText(context, "PK invite received", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                },
                                onPkEffect = { effect ->
                                    scope.launch {
                                        pkLiveEffect = effect
                                        delay(1400.milliseconds)
                                        if (pkLiveEffect == effect) pkLiveEffect = null
                                    }
                                },
                                onPkRefresh = { refreshVoiceRoom() },
                                onPkLeadChanged = { leader, leftScore, rightScore ->
                                    scope.launch {
                                        val current = pkBattle ?: return@launch
                                        pkBattle = current.copy(
                                            leader = com.example.yugm.model.PkSideType.valueOf(leader),
                                            left = current.left.copy(score = leftScore),
                                            right = current.right.copy(score = rightScore)
                                        )
                                    }
                                },
                                onPkRematchRequested = { _ ->
                                    scope.launch {
                                        android.widget.Toast.makeText(context, "Opponent wants a rematch!", android.widget.Toast.LENGTH_SHORT).show()
                                        refreshVoiceRoom()
                                    }
                                }
                            )
                            refreshVoiceRoom()
                        }
                    }
                }
            )
        }
    }

    composable(
        route = Screen.VideoRoom.route,
        arguments = listOf(navArgument("roomId") { type = NavType.StringType })
    ) { backStackEntry ->
        val roomId = backStackEntry.arguments?.getString("roomId") ?: ""
        var roomDetail by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.RoomDetail?>(null) }
        var polls by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomPoll>>(emptyList()) }
        var missions by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomMission>>(emptyList()) }
        var activity by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.RoomActivityItem>>(emptyList()) }
        var pkBattle by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkBattle?>(null) }
        var pkInviteId by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
        var pkOpponents by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkOpponent>>(emptyList()) }
        var pkLeaderboard by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.PkLeaderboardEntry>>(emptyList()) }
        var pkLiveEffect by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkLiveEffect?>(null) }
        var pkOpponentMedia by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<com.example.yugm.model.PkMediaSession?>(null) }
        val context = androidx.compose.ui.platform.LocalContext.current
        val scope = rememberCoroutineScope()
        val chat = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.ChatMessage>() }
        val gifts = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateListOf<com.example.yugm.model.GiftItem>() }
        var inviteCandidates by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<List<com.example.yugm.model.Host>>(emptyList()) }

        fun refreshVideoRoom() {
            scope.launch {
                runCatching { com.example.yugm.api.YugmApi.roomDetail(mainViewModel.authToken, roomId) }
                    .onSuccess { roomDetail = it }
                runCatching { com.example.yugm.api.YugmApi.roomPolls(roomId) }
                    .onSuccess { polls = it }
                runCatching { com.example.yugm.api.YugmApi.roomMissions(mainViewModel.authToken, roomId) }
                    .onSuccess { missions = it }
                runCatching { com.example.yugm.api.YugmApi.roomActivity(roomId) }
                    .onSuccess { activity = it }
                runCatching { com.example.yugm.api.YugmApi.roomMessages(roomId, mainViewModel.authToken) }
                    .onSuccess {
                        chat.clear()
                        chat.addAll(it)
                    }
                runCatching { com.example.yugm.api.YugmApi.gifts(mainViewModel.authToken) }
                    .onSuccess {
                        gifts.clear()
                        gifts.addAll(it)
                    }
                if (mainViewModel.currentUserId.isNotBlank()) {
                    runCatching { com.example.yugm.api.YugmApi.getFollowing(mainViewModel.currentUserId, mainViewModel.authToken) }
                        .onSuccess { inviteCandidates = it }
                }
                runCatching { com.example.yugm.api.YugmApi.activePkWithInvite(mainViewModel.authToken, roomId) }
                    .onSuccess { result ->
                        val battle = result.first
                        pkBattle = battle
                        pkInviteId = result.second?.id
                        if (battle != null) {
                            runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                .onSuccess { pkLeaderboard = it }
                            if (battle.status == com.example.yugm.model.PkStatus.ACTIVE && battle.battleType == com.example.yugm.model.PkBattleType.VIDEO) {
                                runCatching { com.example.yugm.api.YugmApi.pkMediaSession(mainViewModel.authToken, battle.id, roomId) }
                                    .onSuccess {
                                        pkOpponentMedia = it
                                        it?.let { com.example.yugm.api.YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                                    }
                            }
                        } else {
                            pkLeaderboard = emptyList()
                            pkOpponentMedia = null
                        }
                    }
            }
        }

        LaunchedEffect(roomId) { refreshVideoRoom() }

        roomDetail?.let { detail ->
            val room = detail.room
            ActiveVideoRoomScreen(
                room = room,
                chat = chat,
                gifts = gifts,
                balance = mainViewModel.balance,
                isHost = room.host?.id == mainViewModel.currentUserId,
                participants = detail.participants,
                inviteCandidates = inviteCandidates,
                pkBattle = pkBattle,
                pkInviteId = pkInviteId,
                pkOpponents = pkOpponents,
                pkLeaderboard = pkLeaderboard,
                pkLiveEffect = pkLiveEffect,
                pkOpponentMedia = pkOpponentMedia,
                polls = polls,
                missions = missions,
                activity = activity,
                onBack = { navController.popBackStack() },
                onSendMessage = { text ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.sendMessage(mainViewModel.authToken, roomId, text)
                            chat.add(com.example.yugm.model.ChatMessage(mainViewModel.userName, text))
                        }
                    }
                },
                onGift = { gift ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.sendGift(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                gift = gift,
                                receiverId = room.host?.id ?: ""
                            )
                        }.onSuccess {
                            runCatching { mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken)) }
                            gifts.add(gift)
                        }
                    }
                },
                onToast = { msg ->
                    android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                },
                onRequestSpeaker = {
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.requestSpeaker(mainViewModel.authToken, roomId) }
                            .onSuccess {
                                android.widget.Toast.makeText(context, "Speaker request sent", android.widget.Toast.LENGTH_SHORT).show()
                                refreshVideoRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onCreatePoll = {
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.createPoll(
                                mainViewModel.authToken,
                                roomId,
                                "What should we do next?",
                                listOf("Music", "Games", "Q&A", "Chill")
                            )
                        }.onSuccess { refreshVideoRoom() }
                    }
                },
                onCreateCustomPoll = { question, options ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.createPoll(mainViewModel.authToken, roomId, question, options)
                        }.onSuccess { refreshVideoRoom() }
                    }
                },
                onVotePoll = { pollId, optionIndex ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.votePoll(mainViewModel.authToken, roomId, pollId, optionIndex) }
                            .onSuccess { refreshVideoRoom() }
                    }
                },
                onInviteFriend = { userId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.inviteToRoom(mainViewModel.authToken, roomId, userId) }
                            .onSuccess { android.widget.Toast.makeText(context, "Invite sent", android.widget.Toast.LENGTH_SHORT).show() }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onDirectMessage = { receiverId ->
                    scope.launch {
                        val targetId = receiverId ?: room.host?.id
                        runCatching {
                            com.example.yugm.api.YugmApi.roomDirectMessage(
                                mainViewModel.authToken,
                                roomId,
                                "Loved this room. Let's continue after the live.",
                                receiverId
                            )
                        }.onSuccess {
                            if (!targetId.isNullOrBlank()) navController.navigate(Screen.Chat.createRoute(targetId))
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onReact = { type ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.reactToRoom(mainViewModel.authToken, roomId, type) }
                    }
                },
                onLoadPkOpponents = { search ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.availablePkOpponents(mainViewModel.authToken, com.example.yugm.model.PkBattleType.VIDEO, search) }
                            .onSuccess { pkOpponents = it }
                    }
                },
                onInvitePk = { opponent, mode, duration, title ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.invitePk(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                opponentRoomId = opponent.roomId,
                                opponentHostId = opponent.hostId,
                                battleType = com.example.yugm.model.PkBattleType.VIDEO,
                                mode = mode,
                                durationSeconds = duration,
                                title = title
                            )
                        }.onSuccess {
                            pkBattle = it.first
                            android.widget.Toast.makeText(context, "PK invite sent", android.widget.Toast.LENGTH_SHORT).show()
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAutoMatchPk = { mode, duration, title ->
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.autoMatchPk(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                battleType = com.example.yugm.model.PkBattleType.VIDEO,
                                mode = mode,
                                durationSeconds = duration,
                                title = title
                            )
                        }.onSuccess {
                            pkBattle = it.first
                            pkInviteId = it.second?.id
                            android.widget.Toast.makeText(context, "Auto-match invite sent", android.widget.Toast.LENGTH_SHORT).show()
                        }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onSendPkGift = { gift, side ->
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        runCatching { com.example.yugm.api.YugmApi.sendPkGift(mainViewModel.authToken, battleId, gift.id, side) }
                            .onSuccess {
                                pkBattle = it
                                mainViewModel.updateBalance(com.example.yugm.api.YugmApi.wallet(mainViewModel.authToken))
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onSendPkReaction = { reaction, side ->
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        runCatching { com.example.yugm.api.YugmApi.sendPkReaction(mainViewModel.authToken, battleId, side, reaction) }
                            .onSuccess { pkBattle = it }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onAcceptPk = { inviteId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.acceptPk(mainViewModel.authToken, inviteId) }
                            .onSuccess {
                                pkBattle = it
                                pkInviteId = null
                                refreshVideoRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onRejectPk = { inviteId ->
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.rejectPk(mainViewModel.authToken, inviteId) }
                            .onSuccess {
                                pkBattle = null
                                pkInviteId = null
                                refreshVideoRoom()
                            }
                            .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                    }
                },
                onEndPk = {
                    scope.launch {
                        val battleId = pkBattle?.id ?: return@launch
                        val battle = pkBattle
                        if (battle?.status == com.example.yugm.model.PkStatus.INVITED || battle?.status == com.example.yugm.model.PkStatus.WAITING) {
                            runCatching { com.example.yugm.api.YugmApi.cancelPk(mainViewModel.authToken, battleId) }
                                .onSuccess {
                                    pkBattle = null
                                    pkInviteId = null
                                    pkOpponentMedia = null
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        } else {
                            runCatching { com.example.yugm.api.YugmApi.endPk(mainViewModel.authToken, battleId) }
                                .onSuccess {
                                    pkBattle = it
                                    pkInviteId = null
                                    pkOpponentMedia = null
                                }
                                .onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_SHORT).show() }
                        }
                    }
                },
                onEndRoom = {
                    scope.launch {
                        runCatching { com.example.yugm.api.YugmApi.endRoom(roomId, mainViewModel.authToken) }
                            .onSuccess { navController.popBackStack() }
                    }
                },
                onMuteUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.muteUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVideoRoom() } }
                },
                onRemoveUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.removeUser(roomId, userId, mainViewModel.authToken) }.onSuccess { refreshVideoRoom() } }
                },
                onReportUser = { userId ->
                    scope.launch { runCatching { com.example.yugm.api.YugmApi.reportUser(mainViewModel.authToken, roomId, userId, "Inappropriate behavior") } }
                },
                onJoin = {
                    scope.launch {
                        runCatching {
                            com.example.yugm.api.YugmApi.joinRoom(mainViewModel.authToken, roomId)
                            val mediaSession = com.example.yugm.api.YugmApi.liveKitToken(mainViewModel.authToken, roomId)
                            com.example.yugm.api.YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                            com.example.yugm.api.YugmSocket.connect(
                                token = mainViewModel.authToken,
                                roomId = roomId,
                                onMessage = { author, text -> chat.add(com.example.yugm.model.ChatMessage(author, text)) },
                                onPkState = { battle ->
                                    scope.launch {
                                        pkBattle = battle
                                        if (battle.status == com.example.yugm.model.PkStatus.ACTIVE) pkInviteId = null
                                        runCatching { com.example.yugm.api.YugmApi.pkLeaderboard(mainViewModel.authToken, battle.id) }
                                            .onSuccess { pkLeaderboard = it }
                                        if (battle.status == com.example.yugm.model.PkStatus.ACTIVE && battle.battleType == com.example.yugm.model.PkBattleType.VIDEO) {
                                            runCatching { com.example.yugm.api.YugmApi.pkMediaSession(mainViewModel.authToken, battle.id, roomId) }
                                                .onSuccess {
                                                    pkOpponentMedia = it
                                                    it?.let { com.example.yugm.api.YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                                                }
                                        }
                                    }
                                },
                                onPkInvite = { battle, invite ->
                                    scope.launch {
                                        pkBattle = battle
                                        pkInviteId = invite.id
                                        android.widget.Toast.makeText(context, "PK invite received", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                },
                                onPkEffect = { effect ->
                                    scope.launch {
                                        pkLiveEffect = effect
                                        delay(1400.milliseconds)
                                        if (pkLiveEffect == effect) pkLiveEffect = null
                                    }
                                },
                                onPkRefresh = { refreshVideoRoom() },
                                onPkLeadChanged = { leader, leftScore, rightScore ->
                                    scope.launch {
                                        val current = pkBattle ?: return@launch
                                        pkBattle = current.copy(
                                            leader = com.example.yugm.model.PkSideType.valueOf(leader),
                                            left = current.left.copy(score = leftScore),
                                            right = current.right.copy(score = rightScore)
                                        )
                                    }
                                },
                                onPkRematchRequested = { _ ->
                                    scope.launch {
                                        android.widget.Toast.makeText(context, "Opponent wants a rematch!", android.widget.Toast.LENGTH_SHORT).show()
                                        refreshVideoRoom()
                                    }
                                }
                            )
                            refreshVideoRoom()
                        }
                    }
                }
            )
        }
    }
}

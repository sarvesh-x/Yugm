package com.yugm.app.feature.roommodes.screens

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.RoomModeState
import com.yugm.app.feature.roommodes.viewmodel.RoomModesViewModel

@Composable
fun RoomModeHostScreen(
    token: String,
    roomId: String,
    currentUserId: String,
    isHost: Boolean,
    onBack: () -> Unit,
    onJoinRoom: () -> Unit,
    viewModel: RoomModesViewModel = hiltViewModel()
) {
    DisposableEffect(roomId) {
        viewModel.connectRoomUpdates(token, roomId)
        onDispose { viewModel.disconnectRoomUpdates() }
    }

    LaunchedEffect(roomId) {
        viewModel.loadModes(token)
        viewModel.loadModeState(token, roomId)
    }

    val modeState = viewModel.currentModeState
    val modeKey = modeState?.mode

    if (modeKey == null || modeState?.status == "WAITING") {
        ModePickerScreen(
            modes = viewModel.availableModes,
            isLoading = viewModel.isLoading,
            onSelectMode = { mode -> viewModel.setMode(token, roomId, mode) },
            onBack = onBack,
            onRandomMode = {
                viewModel.joinRandomModeRoom(token)
                viewModel.currentModeInfo?.let { m ->
                    viewModel.setMode(token, roomId, m.key)
                }
            }
        )
    } else {
        ModeGameScreen(
            modeKey = modeKey,
            modeState = modeState,
            isHost = isHost,
            currentUserId = currentUserId,
            onStart = { viewModel.startMode(token, roomId) },
            onNextRound = { viewModel.nextRound(token, roomId) },
            onSubmitAnswer = { answer -> viewModel.submitAnswer(token, roomId, answer) },
            onSubmitDare = { dare -> viewModel.submitDare(token, roomId, dare) },
            onVote = { userId, value -> viewModel.vote(token, roomId, userId, value) },
            onEnd = { viewModel.endMode(token, roomId) },
            onBack = onBack
        )
    }
}

@Composable
private fun ModeGameScreen(
    modeKey: String,
    modeState: RoomModeState,
    isHost: Boolean,
    currentUserId: String,
    onStart: () -> Unit,
    onNextRound: () -> Unit,
    onSubmitAnswer: (String) -> Unit,
    onSubmitDare: (String) -> Unit,
    onVote: (String, Int) -> Unit,
    onEnd: () -> Unit,
    onBack: () -> Unit
) {
    when (modeKey) {
        "coffee_date" -> CoffeeDateScreen(
            modeState = modeState, isHost = isHost,
            onStart = onStart, onNextRound = onNextRound,
            onSubmitAnswer = onSubmitAnswer, onEnd = onEnd, onBack = onBack
        )
        "blind_date" -> BlindDateScreen(
            modeState = modeState, isHost = isHost,
            onStart = onStart, onNextRound = onNextRound,
            onSubmitAnswer = onSubmitAnswer, onEnd = onEnd, onBack = onBack
        )
        "truth_or_dare" -> TruthOrDareScreen(
            modeState = modeState, currentUserId = currentUserId, isHost = isHost,
            onStart = onStart, onNextRound = onNextRound,
            onSubmitAnswer = onSubmitAnswer, onSubmitDare = onSubmitDare,
            onVote = onVote, onEnd = onEnd, onBack = onBack
        )
        "never_have_i_ever" -> NeverHaveIEverScreen(
            modeState = modeState, isHost = isHost,
            onStart = onStart, onNextRound = onNextRound,
            onSubmitAnswer = onSubmitAnswer, onEnd = onEnd, onBack = onBack
        )
        "would_you_rather" -> WouldYouRatherScreen(
            modeState = modeState, isHost = isHost,
            onStart = onStart, onNextRound = onNextRound,
            onSubmitAnswer = onSubmitAnswer, onEnd = onEnd, onBack = onBack
        )
        else -> ModePickerScreen(
            modes = emptyList(), isLoading = false,
            onSelectMode = {}, onBack = onBack, onRandomMode = {}
        )
    }
}

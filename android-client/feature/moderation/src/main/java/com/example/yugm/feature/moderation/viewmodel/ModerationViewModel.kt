package com.example.yugm.feature.moderation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ModerationAction {
    data class CheckText(val text: String, val context: String = "chat") : ModerationAction
    data class SubmitReport(
        val targetUserId: String?,
        val roomId: String?,
        val messageId: String?,
        val category: String,
        val description: String?,
    ) : ModerationAction
    data class SubmitAppeal(val actionId: String, val reason: String) : ModerationAction
    data object LoadStatus : ModerationAction
    data object ClearError : ModerationAction
    data object ClearCheckResult : ModerationAction
    data object ClearReportResult : ModerationAction
}

data class ModerationUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val checkResult: ModerationCheckTextResponse? = null,
    val reportResult: ModerationReportResponse? = null,
    val appealResult: ModerationAppealResponse? = null,
    val status: ModerationStatusResponse? = null,
)

@HiltViewModel
class ModerationViewModel @Inject constructor() : ViewModel() {

    private val _state = MutableStateFlow(ModerationUiState())
    val state: StateFlow<ModerationUiState> = _state.asStateFlow()

    private var token: String = ""

    fun setToken(t: String) {
        token = t
    }

    fun onAction(action: ModerationAction) {
        when (action) {
            is ModerationAction.CheckText -> checkText(action)
            is ModerationAction.SubmitReport -> submitReport(action)
            is ModerationAction.SubmitAppeal -> submitAppeal(action)
            is ModerationAction.LoadStatus -> loadStatus()
            is ModerationAction.ClearError -> _state.value = _state.value.copy(error = null)
            is ModerationAction.ClearCheckResult -> _state.value = _state.value.copy(checkResult = null)
            is ModerationAction.ClearReportResult -> _state.value = _state.value.copy(reportResult = null)
        }
    }

    private fun checkText(action: ModerationAction.CheckText) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, checkResult = null)
            runCatching {
                YugmApi.moderationCheckText(token, ModerationCheckTextRequest(
                    text = action.text,
                    context = action.context,
                ))
            }.onSuccess { result ->
                _state.value = _state.value.copy(isLoading = false, checkResult = result)
            }.onFailure { e ->
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Check failed")
            }
        }
    }

    private fun submitReport(action: ModerationAction.SubmitReport) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, reportResult = null)
            runCatching {
                YugmApi.moderationReport(token, ModerationReportRequest(
                    targetUserId = action.targetUserId,
                    roomId = action.roomId,
                    messageId = action.messageId,
                    category = action.category,
                    description = action.description,
                ))
            }.onSuccess { result ->
                _state.value = _state.value.copy(isLoading = false, reportResult = result)
            }.onFailure { e ->
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Report failed")
            }
        }
    }

    private fun submitAppeal(action: ModerationAction.SubmitAppeal) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, appealResult = null)
            runCatching {
                YugmApi.moderationAppeal(token, ModerationAppealRequest(
                    actionId = action.actionId,
                    reason = action.reason,
                ))
            }.onSuccess { result ->
                _state.value = _state.value.copy(isLoading = false, appealResult = result)
            }.onFailure { e ->
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Appeal failed")
            }
        }
    }

    private fun loadStatus() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            runCatching {
                YugmApi.moderationStatus(token)
            }.onSuccess { result ->
                _state.value = _state.value.copy(isLoading = false, status = result)
            }.onFailure { e ->
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Failed to load status")
            }
        }
    }
}

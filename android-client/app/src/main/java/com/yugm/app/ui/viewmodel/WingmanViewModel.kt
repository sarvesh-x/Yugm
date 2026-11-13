package com.yugm.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

sealed interface WingmanAction {
    data class GenerateBio(val currentBio: String? = null, val style: String = "warm", val interests: List<String>? = null) : WingmanAction
    data class RateBio(val bio: String) : WingmanAction
    data class GenerateOpeners(val targetContext: WingmanTargetContext, val style: String = "casual") : WingmanAction
    data class GenerateReplies(val conversation: List<WingmanMessage>, val style: String = "friendly") : WingmanAction
    data class AnalyzeConversation(val chatHistory: List<WingmanCoachMessage>) : WingmanAction
    data class DetectGhosting(val conversation: List<WingmanCoachMessage>) : WingmanAction
    data class PlanDate(val preferences: WingmanDatePreferences) : WingmanAction
    data class RecommendGift(val recipientContext: WingmanRecipientContext, val budget: String = "medium") : WingmanAction
    data object LoadAnalytics : WingmanAction
    data object ClearError : WingmanAction
    data class SetActiveTab(val tab: WingmanTab) : WingmanAction
}

enum class WingmanTab {
    BIO, OPENERS, REPLIES, COACH, GHOST, DATES, GIFTS, ANALYTICS
}

data class WingmanState(
    val activeTab: WingmanTab = WingmanTab.BIO,
    val isLoading: Boolean = false,
    val error: String? = null,

    // Bio
    val bioSuggestion: String? = null,
    val bioTips: List<String> = emptyList(),
    val bioScore: WingmanBioRateResponse? = null,

    // Openers
    val openers: List<String> = emptyList(),
    val openersTip: String = "",

    // Replies
    val replySuggestions: List<String> = emptyList(),
    val replyContext: String = "",
    val deliveryTip: String = "",

    // Coach
    val conversationAnalysis: WingmanConversationAnalysis? = null,
    val coachingTips: List<String> = emptyList(),
    val redFlags: List<String>? = null,

    // Ghost
    val ghostDetection: WingmanGhostDetectResponse? = null,

    // Date Plans
    val datePlans: List<WingmanDateIdea> = emptyList(),
    val dateTip: String = "",

    // Gift Recommendations
    val giftRecommendations: List<WingmanGiftRecommendation> = emptyList(),

    // Analytics
    val analytics: WingmanAnalyticsResponse? = null,
)

@HiltViewModel
class WingmanViewModel @Inject constructor() : ViewModel() {
    private val _state = MutableStateFlow(WingmanState())
    val state: StateFlow<WingmanState> = _state.asStateFlow()

    private var token: String = ""

    fun setToken(t: String) {
        token = t
    }

    fun onAction(action: WingmanAction) {
        when (action) {
            is WingmanAction.SetActiveTab -> _state.update { it.copy(activeTab = action.tab) }
            is WingmanAction.ClearError -> _state.update { it.copy(error = null) }
            is WingmanAction.GenerateBio -> generateBio(action)
            is WingmanAction.RateBio -> rateBio(action.bio)
            is WingmanAction.GenerateOpeners -> generateOpeners(action)
            is WingmanAction.GenerateReplies -> generateReplies(action)
            is WingmanAction.AnalyzeConversation -> analyzeConversation(action)
            is WingmanAction.DetectGhosting -> detectGhosting(action)
            is WingmanAction.PlanDate -> planDate(action)
            is WingmanAction.RecommendGift -> recommendGift(action)
            is WingmanAction.LoadAnalytics -> loadAnalytics()
        }
    }

    private fun generateBio(action: WingmanAction.GenerateBio) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanBioGenerate(token, WingmanBioGenerateRequest(
                        currentBio = action.currentBio,
                        style = action.style,
                        interests = action.interests,
                    ))
                }
                _state.update { it.copy(
                    isLoading = false,
                    bioSuggestion = result.suggestion,
                    bioTips = result.tips,
                )}
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to generate bio") }
            }
        }
    }

    private fun rateBio(bio: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanBioRate(token, bio)
                }
                _state.update { it.copy(isLoading = false, bioScore = result) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to rate bio") }
            }
        }
    }

    private fun generateOpeners(action: WingmanAction.GenerateOpeners) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanOpeners(token, WingmanOpenerRequest(
                        targetUserContext = action.targetContext,
                        style = action.style,
                    ))
                }
                _state.update { it.copy(
                    isLoading = false,
                    openers = result.openers,
                    openersTip = result.tip,
                )}
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to generate openers") }
            }
        }
    }

    private fun generateReplies(action: WingmanAction.GenerateReplies) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanReplies(token, WingmanReplyRequest(
                        conversation = action.conversation,
                        style = action.style,
                    ))
                }
                _state.update { it.copy(
                    isLoading = false,
                    replySuggestions = result.suggestions,
                    replyContext = result.context,
                    deliveryTip = result.deliveryTip,
                )}
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to generate replies") }
            }
        }
    }

    private fun analyzeConversation(action: WingmanAction.AnalyzeConversation) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanCoach(token, WingmanCoachRequest(
                        chatHistory = action.chatHistory,
                    ))
                }
                _state.update { it.copy(
                    isLoading = false,
                    conversationAnalysis = result.analysis,
                    coachingTips = result.tips,
                    redFlags = result.redFlags,
                )}
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to analyze conversation") }
            }
        }
    }

    private fun detectGhosting(action: WingmanAction.DetectGhosting) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanGhostDetect(token, WingmanGhostDetectRequest(
                        conversation = action.conversation,
                    ))
                }
                _state.update { it.copy(isLoading = false, ghostDetection = result) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to detect ghosting") }
            }
        }
    }

    private fun planDate(action: WingmanAction.PlanDate) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanDatePlan(token, WingmanDatePlanRequest(
                        preferences = action.preferences,
                    ))
                }
                _state.update { it.copy(
                    isLoading = false,
                    datePlans = result.plan,
                    dateTip = result.tip,
                )}
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to plan date") }
            }
        }
    }

    private fun recommendGift(action: WingmanAction.RecommendGift) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanGiftRecommend(token, WingmanGiftRecommendRequest(
                        recipientContext = action.recipientContext,
                        budget = action.budget,
                    ))
                }
                _state.update { it.copy(isLoading = false, giftRecommendations = result.recommendations) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to get gift recommendations") }
            }
        }
    }

    private fun loadAnalytics() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    YugmApi.wingmanAnalytics(token)
                }
                _state.update { it.copy(isLoading = false, analytics = result) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to load analytics") }
            }
        }
    }
}

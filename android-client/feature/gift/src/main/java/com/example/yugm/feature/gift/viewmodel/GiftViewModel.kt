package com.example.yugm.feature.gift.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.GiftCollection
import com.example.yugm.core.model.GiftV2
import com.example.yugm.core.model.InventoryItem
import com.example.yugm.core.model.SurpriseBoxResult
import com.example.yugm.core.model.UpgradeResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class GiftUiState(
    val gifts: List<GiftV2> = emptyList(),
    val collections: List<GiftCollection> = emptyList(),
    val inventory: List<InventoryItem> = emptyList(),
    val giftTotal: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedCategory: String? = null,
    val selectedRarity: String? = null,
    val currentPage: Int = 1,
    val surpriseResult: SurpriseBoxResult? = null,
    val upgradeResult: UpgradeResult? = null
)

@HiltViewModel
class GiftViewModel @Inject constructor() : ViewModel() {

    private val _state = MutableStateFlow(GiftUiState())
    val state: StateFlow<GiftUiState> = _state.asStateFlow()

    fun loadGifts(token: String, category: String? = null, rarity: String? = null, page: Int = 1) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null, selectedCategory = category, selectedRarity = rarity, currentPage = page)
            runCatching {
                YugmApi.giftsV2(token, category, rarity, page)
            }.onSuccess { (gifts, total) ->
                _state.value = _state.value.copy(gifts = gifts, giftTotal = total, isLoading = false)
            }.onFailure { e ->
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Failed to load gifts")
            }
        }
    }

    fun loadCollections(token: String) {
        viewModelScope.launch {
            runCatching { YugmApi.giftCollections(token) }
                .onSuccess { _state.value = _state.value.copy(collections = it) }
        }
    }

    fun loadInventory(token: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            runCatching { YugmApi.inventory(token) }
                .onSuccess { _state.value = _state.value.copy(inventory = it.items, isLoading = false) }
                .onFailure { _state.value = _state.value.copy(isLoading = false, error = it.message) }
        }
    }

    fun surpriseBox(token: String, tier: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            runCatching { YugmApi.surpriseBox(token, tier) }
                .onSuccess { _state.value = _state.value.copy(surpriseResult = it, isLoading = false) }
                .onFailure { _state.value = _state.value.copy(isLoading = false, error = it.message) }
        }
    }

    fun upgradeGift(token: String, inventoryId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            runCatching { YugmApi.upgradeGift(token, inventoryId) }
                .onSuccess { _state.value = _state.value.copy(upgradeResult = it, isLoading = false) }
                .onFailure { _state.value = _state.value.copy(isLoading = false, error = it.message) }
        }
    }

    fun clearSurpriseResult() {
        _state.value = _state.value.copy(surpriseResult = null)
    }

    fun clearUpgradeResult() {
        _state.value = _state.value.copy(upgradeResult = null)
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}

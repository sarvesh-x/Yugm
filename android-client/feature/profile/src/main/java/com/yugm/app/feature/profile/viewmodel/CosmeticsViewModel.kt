package com.yugm.app.feature.profile.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.CosmeticCatalog
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class CosmeticsViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var catalog by mutableStateOf<CosmeticCatalog?>(null)
        private set
    var balance by mutableStateOf(0)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun refresh(token: String) {
        viewModelScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.cosmetics(token) }.onSuccess { catalog = it }
                runCatching { yugmApi.wallet(token) }.onSuccess { balance = it }
            }
            isLoading = false
        }
    }

    fun purchase(token: String, cosmeticId: String, onResult: (CosmeticCatalog) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.purchaseCosmetic(token, cosmeticId) }
                    .onSuccess { catalog = it; onResult(it) }
                    .onFailure { error = it.message }
            }
        }
    }

    fun purchaseBundle(token: String, bundleId: String, onResult: (CosmeticCatalog) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.purchaseCosmeticBundle(token, bundleId) }
                    .onSuccess { catalog = it; onResult(it) }
                    .onFailure { error = it.message }
            }
        }
    }

    fun equip(token: String, cosmeticId: String, type: String, onResult: (CosmeticCatalog) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.equipCosmetic(token, cosmeticId, type) }
                    .onSuccess { catalog = it; onResult(it) }
                    .onFailure { error = it.message }
            }
        }
    }
}

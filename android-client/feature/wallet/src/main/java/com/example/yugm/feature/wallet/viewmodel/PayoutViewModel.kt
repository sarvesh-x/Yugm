package com.example.yugm.feature.wallet.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.CreatorDashboard
import com.example.yugm.core.model.CreatorPayoutKycStatus
import com.example.yugm.core.model.WithdrawalEligibility
import com.example.yugm.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class PayoutViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var kycState by mutableStateOf<UiState<CreatorPayoutKycStatus>>(UiState.Idle)
        private set

    var withdrawalState by mutableStateOf<UiState<WithdrawalEligibility>>(UiState.Idle)
        private set

    var earningsState by mutableStateOf<UiState<CreatorDashboard>>(UiState.Idle)
        private set

    fun loadKycStatus(token: String) {
        viewModelScope.launch {
            kycState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.creatorPayoutKycStatus(token) }
            }.onSuccess {
                kycState = UiState.Success(it)
            }.onFailure {
                kycState = UiState.Error(it.message ?: "Failed to load KYC status")
            }
        }
    }

    fun submitKyc(
        token: String,
        legalFullName: String,
        panNumber: String,
        upiId: String?,
        bankAccount: String?,
        bankIfsc: String?,
        bankHolderName: String?,
        dateOfBirth: String?
    ) {
        viewModelScope.launch {
            kycState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.submitCreatorPayoutKyc(
                        token, legalFullName, panNumber, upiId, bankAccount,
                        bankIfsc, bankHolderName, dateOfBirth
                    )
                }
            }.onSuccess {
                kycState = UiState.Success(it)
            }.onFailure {
                kycState = UiState.Error(it.message ?: "Failed to submit KYC")
            }
        }
    }

    fun loadWithdrawalEligibility(token: String) {
        viewModelScope.launch {
            withdrawalState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.withdrawalEligibility(token) }
            }.onSuccess {
                withdrawalState = UiState.Success(it)
            }.onFailure {
                withdrawalState = UiState.Error(it.message ?: "Failed to load withdrawal eligibility")
            }
        }
    }

    fun requestWithdrawal(token: String, amountCoins: Int) {
        viewModelScope.launch {
            withdrawalState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.requestWithdrawal(token, amountCoins) }
                withContext(Dispatchers.IO) { yugmApi.withdrawalEligibility(token) }
            }.onSuccess {
                withdrawalState = UiState.Success(it)
            }.onFailure {
                withdrawalState = UiState.Error(it.message ?: "Failed to request withdrawal")
            }
        }
    }

    fun loadEarnings(token: String) {
        viewModelScope.launch {
            earningsState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.creatorDashboard(token) }
            }.onSuccess {
                earningsState = UiState.Success(it)
            }.onFailure {
                earningsState = UiState.Error(it.message ?: "Failed to load earnings")
            }
        }
    }
}

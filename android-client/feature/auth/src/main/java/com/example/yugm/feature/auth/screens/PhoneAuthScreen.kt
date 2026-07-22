package com.example.yugm.feature.auth.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.Session
import com.example.yugm.core.ui.components.AuthShell
import com.example.yugm.core.ui.components.PrimaryButton
import com.example.yugm.core.ui.components.YugmTextField
import com.example.yugm.core.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun PhoneAuthScreen(
    onBack: () -> Unit,
    onAuthSuccess: (Session) -> Unit
) {
    val scope = rememberCoroutineScope()
    var phone by remember { mutableStateOf("+91") }
    var otp by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("phone") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun sendOtp() {
        loading = true
        error = null
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { YugmApi.requestOtp(phone) }
                step = "otp"
            }.onFailure {
                error = it.message ?: "Failed to send OTP"
            }
            loading = false
        }
    }

    fun verifyOtp() {
        loading = true
        error = null
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { YugmApi.verifyOtp(phone, otp) }
            }.onSuccess { session ->
                onAuthSuccess(session)
            }.onFailure {
                error = it.message ?: "Verification failed"
            }
            loading = false
        }
    }

    AuthShell(
        title = if (step == "phone") "Enter phone number" else "Verify OTP",
        subtitle = if (step == "phone") "You will receive a one-time code via SMS." else "Code sent to $phone"
    ) {
        if (step == "phone") {
            YugmTextField(value = phone, onValueChange = { phone = it }, label = "+911234567890", keyboardType = KeyboardType.Phone)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = TextMuted)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Send code", onClick = { sendOtp() })
        } else {
            YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = TextMuted)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Verify", onClick = { verifyOtp() })
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = {
            if (step == "otp") {
                step = "phone"
                error = null
            } else {
                onBack()
            }
        }) {
            Text(if (step == "otp") "Change number" else "Back", color = TextMuted)
        }
    }
}

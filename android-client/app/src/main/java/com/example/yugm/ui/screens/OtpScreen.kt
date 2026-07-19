package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.yugm.ui.components.AuthShell
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField

@Composable
fun OtpScreen(identifier: String, loading: Boolean, onVerified: (String) -> Unit) {
    var otp by rememberSaveable { mutableStateOf("") }
    AuthShell(title = "Verify OTP", subtitle = "Code sent to $identifier.") {
        YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
        Spacer(Modifier.height(18.dp))
        PrimaryButton(text = if (loading) "Verifying..." else "Verify and continue", onClick = { onVerified(otp) })
    }
}

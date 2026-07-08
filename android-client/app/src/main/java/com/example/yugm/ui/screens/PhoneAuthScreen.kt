package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.yugm.ui.components.AuthShell
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted

@Composable
fun PhoneAuthScreen(
    phoneNumber: String,
    onPhoneChange: (String) -> Unit,
    onSendOtp: () -> Unit,
    otp: String,
    onOtpChange: (String) -> Unit,
    onVerify: () -> Unit,
    verificationId: String,
    onBack: () -> Unit,
    toast: (String) -> Unit
) {
    AuthShell(
        title = if (verificationId.isBlank()) "Enter phone number" else "Verify OTP",
        subtitle = if (verificationId.isBlank()) "You will receive a one-time code via SMS." else "Code sent to $phoneNumber"
    ) {
        if (verificationId.isBlank()) {
            YugmTextField(value = phoneNumber, onValueChange = onPhoneChange, label = "+911234567890")
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Send code", onClick = onSendOtp)
        } else {
            YugmTextField(value = otp, onValueChange = onOtpChange, label = "OTP")
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Verify", onClick = onVerify)
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
    }
}

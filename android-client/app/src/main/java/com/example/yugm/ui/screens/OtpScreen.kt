package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.components.AuthShell
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted

@Composable
fun OtpScreen(identifier: String, devOtp: String?, onVerified: (String) -> Unit) {
    val hint = if (devOtp != null) "Dev OTP: $devOtp" else ""
    var otp by rememberSaveable { mutableStateOf("") }
    AuthShell(title = "Verify OTP", subtitle = "Code sent to $identifier.") {
        if (devOtp != null) {
            Text(hint, color = TextMuted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp))
        }
        YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
        Spacer(Modifier.height(18.dp))
        PrimaryButton(text = "Verify and continue", onClick = { onVerified(otp) })
    }
}

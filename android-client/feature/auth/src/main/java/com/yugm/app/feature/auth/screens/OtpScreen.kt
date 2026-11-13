package com.yugm.app.feature.auth.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.AuthShell
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.DangerRed

@Composable
fun OtpScreen(
    identifier: String,
    loading: Boolean,
    error: String? = null,
    onVerified: (String) -> Unit,
    onResend: () -> Unit = {}
) {
    var otp by rememberSaveable { mutableStateOf("") }
    AuthShell(title = "Verify OTP", subtitle = "Code sent to $identifier.") {
        YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = DangerRed, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
        Spacer(Modifier.height(18.dp))
        PrimaryButton(
            text = if (loading) "Verifying..." else "Verify and continue",
            onClick = { onVerified(otp) },
            enabled = !loading && otp.isNotBlank()
        )
    }
}

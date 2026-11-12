package com.example.yugm.feature.auth.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Checkbox
import androidx.compose.ui.Alignment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.Session
import com.example.yugm.core.ui.components.AuthShell
import com.example.yugm.core.ui.components.PrimaryButton
import com.example.yugm.core.ui.components.YugmTextField
import com.example.yugm.core.ui.theme.TextMuted
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

@Composable
fun PhoneAuthScreen(
    onBack: () -> Unit,
    onAuthSuccess: (Session) -> Unit
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val scope = rememberCoroutineScope()
    var phone by remember { mutableStateOf("+91") }
    var otp by remember { mutableStateOf("") }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf("phone") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var acceptTerms by remember { mutableStateOf(false) }

    fun verifyCredential(credential: com.google.firebase.auth.PhoneAuthCredential) {
        loading = true
        error = null
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val result = Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential))
                    val token = Tasks.await(
                            result.user?.getIdToken(false)
                            ?: throw IllegalStateException("Firebase did not return a user")
                    ).token ?: throw IllegalStateException("Firebase did not return an ID token")
                    if (!acceptTerms) throw IllegalStateException("Confirm that you are 18+ and accept the Terms and Privacy Policy.")
                    YugmApi.phoneAuth(token, acceptTerms)
                }
            }.onSuccess(onAuthSuccess).onFailure {
                error = it.message ?: "Phone verification failed"
            }
            loading = false
        }
    }

    fun sendCode() {
        if (activity == null) {
            error = "Phone sign-in is unavailable in this screen."
            return
        }
        val normalizedPhone = phone.trim().replace(" ", "").replace("-", "")
        if (!normalizedPhone.matches(Regex("^\\+[1-9]\\d{7,14}$"))) {
            error = "Enter the full phone number with country code, for example +919876543210."
            return
        }
        loading = true
        error = null
        val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            override fun onVerificationCompleted(credential: com.google.firebase.auth.PhoneAuthCredential) {
                verifyCredential(credential)
            }

            override fun onVerificationFailed(exception: FirebaseException) {
                loading = false
                error = exception.localizedMessage ?: "Could not send the verification code"
            }

            override fun onCodeSent(id: String, token: PhoneAuthProvider.ForceResendingToken) {
                verificationId = id
                step = "otp"
                loading = false
            }
        }
        val options = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
            .setPhoneNumber(normalizedPhone)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(callbacks)
            .build()
        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    fun verifyCode() {
        val id = verificationId ?: return
        if (otp.length < 6) {
            error = "Enter the 6-digit code."
            return
        }
        verifyCredential(PhoneAuthProvider.getCredential(id, otp.trim()))
    }

    AuthShell(
        title = if (step == "phone") "Enter phone number" else "Verify phone number",
        subtitle = if (step == "phone") "Firebase will send a one-time code via SMS." else "Code sent to $phone"
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = acceptTerms, onCheckedChange = { acceptTerms = it })
            Text("I am 18+ and accept the Terms and Privacy Policy", color = TextMuted)
        }
        if (step == "phone") {
            YugmTextField(value = phone, onValueChange = { phone = it }, label = "+911234567890", keyboardType = KeyboardType.Phone)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = TextMuted)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loading) "Sending code..." else "Send code", onClick = { sendCode() }, enabled = !loading && phone.length >= 8 && acceptTerms)
        } else {
            YugmTextField(value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6) }, label = "6-digit code", keyboardType = KeyboardType.Number)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = TextMuted)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loading) "Verifying..." else "Verify and continue", onClick = { verifyCode() }, enabled = !loading && otp.length == 6 && acceptTerms)
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = {
            if (step == "otp") {
                step = "phone"
                verificationId = null
                error = null
            } else {
                onBack()
            }
        }, enabled = !loading) {
            Text(if (step == "otp") "Change number" else "Back", color = TextMuted)
        }
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

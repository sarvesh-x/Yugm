package com.example.yugm.ui.screens

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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Session
import com.example.yugm.ui.components.AuthShell
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
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
    val scope = rememberCoroutineScope()
    var phone by remember { mutableStateOf("+91") }
    var otp by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("phone") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var completing by remember { mutableStateOf(false) }

    fun completePhoneAuth(credential: PhoneAuthCredential) {
        if (completing) return
        completing = true
        scope.launch {
            runCatching {
                val auth = FirebaseAuth.getInstance()
                val authResult = withContext(Dispatchers.IO) {
                    Tasks.await(auth.signInWithCredential(credential))
                }
                val tokenResult = withContext(Dispatchers.IO) {
                    Tasks.await(authResult.user?.getIdToken(true) ?: throw IllegalStateException("No authenticated user"))
                }
                val fbToken = tokenResult.token ?: throw IllegalStateException("No Firebase token")
                YugmApi.phoneAuth(fbToken)
            }.onSuccess { session ->
                onAuthSuccess(session)
            }.onFailure {
                loading = false
                completing = false
                error = it.message ?: "Phone auth failed"
            }
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
            PrimaryButton(text = "Send code", onClick = {
                loading = true
                error = null
                completing = false
                scope.launch {
                    runCatching {
                        val auth = FirebaseAuth.getInstance()
                        val callback = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                                completePhoneAuth(credential)
                            }

                            override fun onVerificationFailed(e: com.google.firebase.FirebaseException) {
                                loading = false
                                error = e.message ?: "Verification failed"
                            }

                            override fun onCodeSent(id: String, token: PhoneAuthProvider.ForceResendingToken) {
                                verificationId = id
                                step = "otp"
                                loading = false
                            }
                        }
                        val activity = context as? android.app.Activity
                            ?: throw IllegalStateException("Phone auth requires an Activity context")
                        val options = PhoneAuthOptions.newBuilder(auth)
                            .setPhoneNumber(phone)
                            .setTimeout(60L, TimeUnit.SECONDS)
                            .setActivity(activity)
                            .setCallbacks(callback)
                            .build()
                        withContext(Dispatchers.IO) {
                            PhoneAuthProvider.verifyPhoneNumber(options)
                        }
                    }.onFailure {
                        loading = false
                        error = it.message ?: "Failed to send OTP"
                    }
                }
            })
        } else {
            YugmTextField(value = otp, onValueChange = { otp = it }, label = "OTP", keyboardType = KeyboardType.Number)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = TextMuted)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = "Verify", onClick = {
                loading = true
                error = null
                scope.launch {
                    runCatching {
                        val auth = FirebaseAuth.getInstance()
                        val credential = PhoneAuthProvider.getCredential(verificationId ?: throw IllegalStateException("No verification ID"), otp)
                        val authResult = withContext(Dispatchers.IO) {
                            Tasks.await(auth.signInWithCredential(credential))
                        }
                        val tokenResult = withContext(Dispatchers.IO) {
                            Tasks.await(authResult.user?.getIdToken(true) ?: throw IllegalStateException("No authenticated user"))
                        }
                        val fbToken = tokenResult.token ?: throw IllegalStateException("No Firebase token")
                        YugmApi.phoneAuth(fbToken)
                    }.onSuccess { session ->
                        onAuthSuccess(session)
                    }.onFailure {
                        loading = false
                        error = it.message ?: "Verification failed"
                    }
                }
            })
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

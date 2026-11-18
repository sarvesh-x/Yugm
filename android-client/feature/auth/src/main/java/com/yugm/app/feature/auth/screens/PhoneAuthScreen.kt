package com.yugm.app.feature.auth.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.clickable
import androidx.compose.material3.Checkbox
import androidx.compose.ui.Alignment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.Session
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.components.AuthShell
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.feature.auth.AppCheckReadiness
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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
    var phone by rememberSaveable { mutableStateOf("+91") }
    var otp by rememberSaveable { mutableStateOf("") }
    var verificationId by rememberSaveable { mutableStateOf<String?>(null) }
    var resendToken by remember { mutableStateOf<PhoneAuthProvider.ForceResendingToken?>(null) }
    var step by rememberSaveable { mutableStateOf("phone") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var acceptTerms by rememberSaveable { mutableStateOf(false) }
    var submittingCredential by remember { mutableStateOf(false) }
    var resendCooldown by remember { mutableStateOf(0) }

    LaunchedEffect(resendCooldown) {
        if (resendCooldown > 0) {
            delay(1_000)
            resendCooldown -= 1
        }
    }

    fun verifyCredential(credential: com.google.firebase.auth.PhoneAuthCredential) {
        if (submittingCredential) return
        if (!acceptTerms) {
            error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."
            return
        }
        submittingCredential = true
        loading = true
        error = null
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val result = Tasks.await(FirebaseAuth.getInstance().signInWithCredential(credential))
                    val token = Tasks.await(
                        result.user?.getIdToken(false)
                            ?: throw IllegalStateException("Firebase did not return a user")
                    ).token ?: throw IllegalStateException("Firebase did not return an ID token")
                    AppCheckReadiness.requireReady(context)
                    YugmApi.phoneAuth(token, acceptTerms)
                }
                    .let(onAuthSuccess)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = phoneAuthError(failure)
            } finally {
                loading = false
                submittingCredential = false
            }
        }
    }

    fun sendCode(forceResend: Boolean = false) {
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
                error = phoneAuthError(exception)
            }

            override fun onCodeSent(id: String, token: PhoneAuthProvider.ForceResendingToken) {
                verificationId = id
                resendToken = token
                otp = ""
                step = "otp"
                resendCooldown = 30
                loading = false
            }
        }
        val builder = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
            .setPhoneNumber(normalizedPhone)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(callbacks)
        if (forceResend) {
            resendToken?.let { builder.setForceResendingToken(it) }
        }
        val options = builder.build()
        scope.launch {
            try {
                PhoneAuthProvider.verifyPhoneNumber(options)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                loading = false
                error = phoneAuthError(failure)
            }
        }
    }

    fun verifyCode() {
        val id = verificationId
        if (id == null) {
            error = "Request a new verification code."
            return
        }
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
            Checkbox(checked = acceptTerms, onCheckedChange = { acceptTerms = it }, enabled = !loading)
            Text("I am 18+ and accept the Terms and Privacy Policy", color = TextMuted)
        }
        Row {
            TextButton(onClick = { openPhoneLegal(context, "terms") }) { Text("Read Terms", color = TextMuted) }
            TextButton(onClick = { openPhoneLegal(context, "privacy") }) { Text("Read Privacy Policy", color = TextMuted) }
        }
        if (step == "phone") {
            YugmTextField(value = phone, onValueChange = { phone = it }, label = "+911234567890", keyboardType = KeyboardType.Phone)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = Danger, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loading) "Sending code..." else "Send code", onClick = { sendCode() }, enabled = !loading && phone.length >= 8 && acceptTerms)
        } else {
            YugmTextField(value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6) }, label = "6-digit code", keyboardType = KeyboardType.Number)
            if (error != null) {
                Spacer(Modifier.height(4.dp))
                Text(error!!, color = Danger, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loading) "Verifying..." else "Verify and continue", onClick = { verifyCode() }, enabled = !loading && otp.length == 6 && acceptTerms)
            TextButton(
                onClick = { sendCode(forceResend = true) },
                enabled = !loading && resendCooldown == 0
            ) {
                Text(
                    if (resendCooldown > 0) "Resend code in ${resendCooldown}s" else "Resend code",
                    color = TextMuted
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = {
            if (step == "otp") {
                step = "phone"
                verificationId = null
                resendToken = null
                resendCooldown = 0
                otp = ""
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

private fun openPhoneLegal(context: Context, path: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(resolveMediaUrl("/legal/$path")))) }
}

private fun phoneAuthError(error: Throwable): String {
    val firebaseError = generateSequence(error) { it.cause }.filterIsInstance<FirebaseAuthException>().firstOrNull()
    val firebaseException = generateSequence(error) { it.cause }.filterIsInstance<FirebaseException>().firstOrNull()
    return when (firebaseError?.errorCode) {
        "ERROR_INVALID_PHONE_NUMBER" -> "Enter a valid phone number with its country code, for example +919876543210."
        "ERROR_MISSING_PHONE_NUMBER" -> "Enter the full phone number with its country code."
        "ERROR_TOO_MANY_REQUESTS", "ERROR_QUOTA_EXCEEDED" -> "Too many SMS attempts. Wait a while, then try again."
        "ERROR_OPERATION_NOT_ALLOWED" -> "Phone sign-in is disabled for this Firebase project. Enable the Phone provider in Firebase Authentication."
        "ERROR_APP_NOT_AUTHORIZED", "ERROR_INVALID_APP_CREDENTIAL" -> "Firebase could not verify this app. Check the Android package name and SHA-1/SHA-256 certificates in Firebase, then retry."
        "ERROR_CAPTCHA_CHECK_FAILED" -> "The security check failed. Check your connection and try again."
        "ERROR_INVALID_VERIFICATION_CODE" -> "That code is incorrect or expired. Check it or request a new one."
        "ERROR_SESSION_EXPIRED" -> "That code has expired. Go back and request a new one."
        "ERROR_NETWORK_REQUEST_FAILED" -> "Check your connection and try again."
        else -> firebaseException?.localizedMessage?.takeIf(String::isNotBlank)
            ?: error.localizedMessage?.takeIf(String::isNotBlank)
            ?: "Phone sign-in failed. Check your connection and try again."
    }
}

package com.yugm.app.feature.auth.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.Session
import com.yugm.app.feature.auth.viewmodel.AuthViewModel
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.ui.components.AuthShell
import com.yugm.app.core.ui.components.PrimaryButton
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

@Composable
fun PhoneAuthScreen(
    onBack: () -> Unit,
    onAuthSuccess: (Session) -> Unit
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val authColors = com.yugm.app.core.ui.theme.LocalYugmColors.current
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
    var resendCooldown by remember { mutableStateOf(0) }
    val authLoading = authViewModel.isLoading
    val loadingNow = loading || authLoading
    val displayedError = error ?: authViewModel.error

    LaunchedEffect(authViewModel.session) {
        authViewModel.consumeSession()?.let(onAuthSuccess)
    }

    LaunchedEffect(resendCooldown) {
        if (resendCooldown > 0) {
            delay(1_000)
            resendCooldown -= 1
        }
    }

    fun verifyCredential(credential: com.google.firebase.auth.PhoneAuthCredential) {
        if (authViewModel.isLoading) return
        if (!acceptTerms) {
            error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."
            return
        }
        error = null
        loading = false
        authViewModel.phoneAuth(credential, acceptTerms)
    }

    fun sendCode(forceResend: Boolean = false) {
        if (!acceptTerms) {
            error = "Confirm that you are 18+ and accept the Terms and Privacy Policy."
            return
        }
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
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable(role = androidx.compose.ui.semantics.Role.Checkbox, onClickLabel = "Accept terms and privacy policy") {
                    if (!loadingNow) acceptTerms = !acceptTerms
                }
                .padding(vertical = 4.dp)
        ) {
            Checkbox(checked = acceptTerms, onCheckedChange = { if (!loadingNow) acceptTerms = it }, enabled = !loadingNow)
            Text("I am 18+ and accept the Terms and Privacy Policy", color = TextPrimary, fontSize = 13.sp, modifier = Modifier.padding(start = 8.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { openPhoneLegal(context, "terms") }, modifier = Modifier.heightIn(min = 40.dp)) { Text("Read Terms", color = authColors.accent) }
            TextButton(onClick = { openPhoneLegal(context, "privacy") }, modifier = Modifier.heightIn(min = 40.dp)) { Text("Read Privacy Policy", color = authColors.accent) }
        }
        if (step == "phone") {
            YugmTextField(value = phone, onValueChange = { phone = it; error = null; authViewModel.clearError() }, label = "Phone number", keyboardType = KeyboardType.Phone,
                accentColor = authColors.accent, borderColor = androidx.compose.material3.MaterialTheme.colorScheme.outline)
            Text("Include your country code, for example +919876543210.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
            if (displayedError != null) {
                Spacer(Modifier.height(4.dp))
                Text(displayedError!!, color = authColors.danger, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loadingNow) "Sending code..." else "Send code", onClick = { sendCode() }, enabled = !loadingNow && phone.length >= 8 && acceptTerms)
        } else {
            YugmTextField(value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6); error = null; authViewModel.clearError() }, label = "Verification code", keyboardType = KeyboardType.Number,
                accentColor = authColors.accent, borderColor = androidx.compose.material3.MaterialTheme.colorScheme.outline)
            Text("Enter the 6-digit code sent to your phone.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
            if (displayedError != null) {
                Spacer(Modifier.height(4.dp))
                Text(displayedError!!, color = authColors.danger, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton(text = if (loadingNow) "Verifying..." else "Verify and continue", onClick = { verifyCode() }, enabled = !loadingNow && otp.length == 6 && acceptTerms)
            TextButton(
                onClick = { sendCode(forceResend = true) },
                enabled = !loadingNow && resendCooldown == 0
            ) {
                Text(
                    if (resendCooldown > 0) "Resend code in ${resendCooldown}s" else "Resend code",
                    color = if (resendCooldown > 0) TextMuted else authColors.accent
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
        }, enabled = !loadingNow) {
            Text(if (step == "otp") "Change number" else "Back", color = authColors.accent)
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

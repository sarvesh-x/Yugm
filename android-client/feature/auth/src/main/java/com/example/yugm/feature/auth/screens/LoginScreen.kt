package com.example.yugm.feature.auth.screens

import android.content.Intent
import android.net.Uri
import android.util.Patterns
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.autofill.ContentType
import com.example.yugm.core.ui.components.*
import com.example.yugm.core.ui.theme.*

@Composable
fun LoginScreen(
    onGoogleSignIn: (Boolean) -> Unit,
    onPhoneSignIn: () -> Unit,
    onEmailAuth: (String, String, Boolean, Boolean) -> Unit,
    onForgotPassword: (String) -> Unit,
    loading: Boolean,
    error: String?,
    googleLoading: Boolean = false
) {
    val context = LocalContext.current
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var createAccount by rememberSaveable { mutableStateOf(false) }
    var acceptTerms by rememberSaveable { mutableStateOf(false) }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var forgotDialog by rememberSaveable { mutableStateOf(false) }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }
    val emailValid = Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
    val passwordStrong = password.length >= 8 && password.any(Char::isLetter) && password.any(Char::isDigit)
    val canSubmit = !loading && acceptTerms && emailValid && passwordStrong && (!createAccount || confirmPassword == password)

    Box(Modifier.fillMaxSize()) {
        AuroraBackground()
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("Yugm", color = Color.White, fontSize = 44.sp, fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
            Text("Find your people. Share your vibe.", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(22.dp))
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 24.dp,
                borderGradient = Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = .35f), PrimaryPink.copy(alpha = .28f))),
                contentPadding = PaddingValues(20.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AuthModeButton("Sign in", selected = !createAccount, Modifier.weight(1f)) { createAccount = false; localError = null }
                    AuthModeButton("Create account", selected = createAccount, Modifier.weight(1f)) { createAccount = true; localError = null }
                }
                Spacer(Modifier.height(16.dp))
                GlassTextField(
                    value = email,
                    onValueChange = { email = it; localError = null },
                    label = "Email address",
                    placeholder = "name@example.com",
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false),
                    modifier = Modifier.semantics { contentDescription = "Email address"; contentType = ContentType.EmailAddress }
                )
                if (email.isNotBlank() && !emailValid) FieldHint("Enter a valid email address.")
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        GlassTextField(
                            value = password,
                            onValueChange = { password = it; localError = null },
                            label = "Password",
                            placeholder = if (createAccount) "8+ characters, letters and numbers" else "Your password",
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            modifier = Modifier.semantics {
                                contentDescription = if (createAccount) "New password" else "Password"
                                contentType = if (createAccount) ContentType.NewPassword else ContentType.Password
                            }
                        )
                    }
                    TextButton(onClick = { passwordVisible = !passwordVisible }) { Text(if (passwordVisible) "Hide" else "Show", color = Gold) }
                }
                if (createAccount && password.isNotBlank() && !passwordStrong) FieldHint("Use at least 8 characters with a letter and a number.")
                if (createAccount) {
                    Spacer(Modifier.height(10.dp))
                    GlassTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it; localError = null },
                        label = "Confirm password",
                        placeholder = "Enter the password again",
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        modifier = Modifier.semantics { contentDescription = "Confirm password"; contentType = ContentType.NewPassword }
                    )
                    if (confirmPassword.isNotBlank() && confirmPassword != password) FieldHint("Passwords do not match.")
                }
                if (!createAccount) {
                    TextButton(onClick = { forgotDialog = true }, enabled = emailValid && !loading, modifier = Modifier.align(Alignment.End)) {
                        Text("Forgot password?", color = Gold)
                    }
                }
                Row(
                    Modifier.fillMaxWidth().semantics { contentDescription = "Confirm you are at least 18 and accept the terms and privacy policy" }.clickable { acceptTerms = !acceptTerms }.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Checkbox(checked = acceptTerms, onCheckedChange = { acceptTerms = it }, enabled = !loading)
                    Column(Modifier.padding(top = 10.dp)) {
                        Text("I am 18+ and accept the", color = TextPrimary, fontSize = 13.sp)
                        Row {
                            Text("Terms of Service", color = Gold, fontSize = 13.sp, modifier = Modifier.clickable { openLegal(context, "terms") })
                            Text("  and  ", color = TextMuted, fontSize = 13.sp)
                            Text("Privacy Policy", color = Gold, fontSize = 13.sp, modifier = Modifier.clickable { openLegal(context, "privacy") })
                        }
                    }
                }
                (localError ?: error)?.let { message ->
                    Text(message, color = Danger, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp).semantics { contentDescription = "Sign-in error: $message" })
                }
                Spacer(Modifier.height(12.dp))
                GlassButton(
                    text = if (createAccount) "Create account" else "Sign in with email",
                    onClick = {
                        if (createAccount && confirmPassword != password) localError = "Passwords do not match."
                        else onEmailAuth(email.trim(), password, createAccount, acceptTerms)
                    },
                    enabled = canSubmit,
                    loading = loading,
                    gradient = Brush.horizontalGradient(auroraGradientPrimary)
                )
                Spacer(Modifier.height(10.dp))
                Text("or continue with", color = TextMuted, fontSize = 12.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    GlassOutlinedButton(
                        text = if (googleLoading) "Connecting…" else "Continue with Google",
                        onClick = { if (acceptTerms) onGoogleSignIn(acceptTerms) else localError = "Accept the terms to continue." },
                        modifier = Modifier.weight(1f), height = 52.dp, cornerRadius = 14.dp,
                        enabled = !loading && !googleLoading && acceptTerms
                    )
                    GlassOutlinedButton(
                        text = "Phone",
                        onClick = onPhoneSignIn,
                        modifier = Modifier.weight(1f), height = 52.dp, cornerRadius = 14.dp,
                        enabled = !loading && !googleLoading
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("Your account is protected with Firebase sign-in.", color = TextMuted, fontSize = 11.sp, textAlign = TextAlign.Center)
        }
    }

    if (forgotDialog) {
        AlertDialog(
            onDismissRequest = { forgotDialog = false },
            title = { Text("Reset your password", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("We’ll send a reset link to ${email.trim()}.", color = TextMuted) },
            confirmButton = {
                TextButton(onClick = { onForgotPassword(email); forgotDialog = false }) {
                    Text("Send reset link", color = Gold)
                }
            },
            dismissButton = { TextButton(onClick = { forgotDialog = false }) { Text("Cancel", color = TextMuted) } },
            containerColor = SurfaceElevated
        )
    }
}

@Composable
private fun AuthModeButton(label: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        color = if (selected) Gold.copy(alpha = .16f) else SurfaceElevated.copy(alpha = .45f),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Gold else Line),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(13.dp),
        modifier = modifier.heightIn(min = 48.dp).clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)) {
            Text(label, color = if (selected) Gold else TextMuted, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun FieldHint(text: String) {
    Text(text, color = Danger, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(start = 4.dp, top = 4.dp))
}

private fun openLegal(context: android.content.Context, path: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://yugm.onrender.com/legal/$path"))) }
}

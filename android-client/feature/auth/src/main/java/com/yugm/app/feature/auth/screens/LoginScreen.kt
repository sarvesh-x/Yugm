package com.yugm.app.feature.auth.screens

import android.content.Intent
import android.net.Uri
import android.util.Patterns
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Public
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.*

@Composable
fun LoginScreen(
    onGoogleSignIn: (Boolean) -> Unit,
    onPhoneSignIn: () -> Unit,
    onEmailAuth: (String, String, Boolean, Boolean) -> Unit,
    onForgotPassword: (String) -> Unit,
    onClearError: () -> Unit = {},
    loading: Boolean,
    error: String?,
    notice: String? = null,
    googleLoading: Boolean = false
) {
    val context = LocalContext.current
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var createAccount by rememberSaveable { mutableStateOf(false) }
    var manualLogin by rememberSaveable { mutableStateOf(false) }
    var acceptTerms by rememberSaveable { mutableStateOf(false) }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var forgotDialog by rememberSaveable { mutableStateOf(false) }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }
    val emailValid = Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
    val passwordStrong = password.length >= 8 && password.any(Char::isLetter) && password.any(Char::isDigit)
    val canSubmit = !loading && !googleLoading && acceptTerms && emailValid && password.isNotEmpty() &&
        (!createAccount || (passwordStrong && confirmPassword == password))

    fun clearErrors() {
        localError = null
        onClearError()
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground()
        Column(
            Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 28.dp),
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
                    AuthModeButton("Sign in", selected = !createAccount, Modifier.weight(1f), enabled = !loading && !googleLoading) {
                        createAccount = false
                        manualLogin = false
                        confirmPassword = ""
                        clearErrors()
                    }
                    AuthModeButton("Create account", selected = createAccount, Modifier.weight(1f), enabled = !loading && !googleLoading) {
                        createAccount = true
                        manualLogin = true
                        clearErrors()
                    }
                }
                Spacer(Modifier.height(18.dp))
                if (manualLogin) {
                    GlassTextField(
                        value = email,
                        onValueChange = { email = it; clearErrors() },
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
                                onValueChange = { password = it; clearErrors() },
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
                            onValueChange = { confirmPassword = it; clearErrors() },
                            label = "Confirm password",
                            placeholder = "Enter the password again",
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            modifier = Modifier.semantics { contentDescription = "Confirm password"; contentType = ContentType.NewPassword }
                        )
                        if (confirmPassword.isNotBlank() && confirmPassword != password) FieldHint("Passwords do not match.")
                    }
                    if (!createAccount) {
                        TextButton(onClick = { clearErrors(); forgotDialog = true }, enabled = emailValid && !loading, modifier = Modifier.align(Alignment.End)) {
                            Text("Forgot password?", color = Gold)
                        }
                    }
                } else {
                    Text("Choose how you want to sign in", color = TextMuted, fontSize = 13.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 12.dp))
                    LoginMethodButton(
                        text = if (googleLoading) "Connecting…" else " Google",
                        icon = Icons.Filled.Public,
                        onClick = { if (acceptTerms) onGoogleSignIn(acceptTerms) else localError = "Accept the terms to continue." },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !loading && !googleLoading && acceptTerms
                    )
                    Spacer(Modifier.height(10.dp))
                    LoginMethodButton(
                        text = " Phone",
                        icon = Icons.Filled.Phone,
                        onClick = onPhoneSignIn,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !loading && !googleLoading && acceptTerms
                    )
                    TextButton(onClick = { manualLogin = true; clearErrors() }, enabled = !loading && !googleLoading, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                        Text("Login manually instead", color = Gold, fontWeight = FontWeight.SemiBold)
                    }
                }
                (localError ?: error)?.let { message ->
                    Text(message, color = Danger, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(top = 8.dp).semantics {
                        contentDescription = "Sign-in error: $message"
                        liveRegion = LiveRegionMode.Polite
                    })
                }
                notice?.let { message ->
                    Text(message, color = Success, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(top = 8.dp).semantics {
                        liveRegion = LiveRegionMode.Polite
                    })
                }
                if (manualLogin) {
                    Spacer(Modifier.height(14.dp))
                    LoginMethodButton(
                        text = if (createAccount) "Create account" else "Sign in with email",
                        icon = Icons.Filled.Email,
                        onClick = {
                            if (createAccount && confirmPassword != password) localError = "Passwords do not match."
                            else onEmailAuth(email.trim(), password, createAccount, acceptTerms)
                        },
                        enabled = canSubmit,
                        isPrimary = true,
                        loading = loading
                    )
                    if (!createAccount) {
                        TextButton(onClick = { manualLogin = false; clearErrors() }, enabled = !loading && !googleLoading, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                            Text("Use Google or phone instead", color = TextMuted)
                        }
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(top = 14.dp, start = 2.dp, end = 2.dp),
                verticalAlignment = Alignment.Top
            ) {
                Checkbox(
                    checked = acceptTerms,
                    onCheckedChange = { acceptTerms = it; clearErrors() },
                    enabled = !loading && !googleLoading,
                    modifier = Modifier.semantics { contentDescription = "I am 18 or older and accept Yugm's terms and privacy policy" }
                )
                Column(Modifier.weight(1f).padding(top = 10.dp)) {
                    Text("I am 18+ and accept the", color = TextPrimary, fontSize = 13.sp)
                    Row {
                        Text("Terms of Service", color = Gold, fontSize = 13.sp, modifier = Modifier
                            .clickable(role = Role.Button, onClickLabel = "Read Terms of Service") { openLegal(context, "terms") })
                        Text("  and  ", color = TextMuted, fontSize = 13.sp)
                        Text("Privacy Policy", color = Gold, fontSize = 13.sp, modifier = Modifier
                            .clickable(role = Role.Button, onClickLabel = "Read Privacy Policy") { openLegal(context, "privacy") })
                    }
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
            text = { Text("If an account uses ${email.trim()}, we’ll send it a secure password reset link.", color = TextMuted) },
            confirmButton = {
                TextButton(enabled = !loading, onClick = { clearErrors(); onForgotPassword(email); forgotDialog = false }) {
                    Text(if (loading) "Sending…" else "Send reset link", color = Gold)
                }
            },
            dismissButton = { TextButton(onClick = { forgotDialog = false }) { Text("Cancel", color = TextMuted) } },
            containerColor = SurfaceElevated
        )
    }
}

@Composable
private fun LoginMethodButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isPrimary: Boolean = false,
    loading: Boolean = false
) {
    val shape = RoundedCornerShape(16.dp)
    val interactionSource = remember { MutableInteractionSource() }
    val borderModifier = if (isPrimary) {
        Modifier
    } else {
        Modifier.border(
            1.dp,
            Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.3f), PrimaryPink.copy(alpha = 0.3f))),
            shape
        )
    }
    val backgroundBrush = if (isPrimary) {
        Brush.horizontalGradient(auroraGradientPrimary)
    } else {
        Brush.linearGradient(listOf(Surface.copy(alpha = 0.4f), Surface.copy(alpha = 0.4f)))
    }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(shape)
            .background(backgroundBrush, alpha = if (enabled) 1f else 0.4f)
            .then(borderModifier)
            .semantics { contentDescription = text }
            .clickable(
                interactionSource = interactionSource,
                role = Role.Button,
                onClickLabel = text,
                enabled = enabled,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Color.White,
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isPrimary) Color.White else Gold,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = text,
                    color = Color.White,
                    fontWeight = if (isPrimary) FontWeight.Black else FontWeight.Medium,
                    fontSize = 15.sp
                )
            }
        }
    }
}

@Composable
private fun AuthModeButton(label: String, selected: Boolean, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Surface(
        color = if (selected) Gold.copy(alpha = .16f) else SurfaceElevated.copy(alpha = .45f),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Gold else Line),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(13.dp),
        modifier = modifier.heightIn(min = 48.dp)
            .selectable(selected = selected, enabled = enabled, role = Role.Tab, onClick = onClick)
            .semantics { selectedSemantics = selected; contentDescription = label }
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

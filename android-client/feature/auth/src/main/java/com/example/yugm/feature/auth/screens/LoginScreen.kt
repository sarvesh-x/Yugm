package com.example.yugm.feature.auth.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.ui.components.*
import com.example.yugm.core.ui.theme.*

@Composable
fun LoginScreen(
    onGoogleSignIn: () -> Unit,
    onPhoneSignIn: () -> Unit,
    onEmailAuth: (String, String, Boolean) -> Unit,
    loading: Boolean,
    error: String?
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize()) {
        AuroraBackground()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            AnimatedEntrance(delay = 0) {
                Text(
                    text = "Yugm",
                    color = Color.White,
                    fontSize = 52.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1).sp,
                    style = androidx.compose.ui.text.TextStyle(
                        shadow = androidx.compose.ui.graphics.Shadow(
                            color = PrimaryPink.copy(alpha = 0.3f),
                            blurRadius = 20f
                        )
                    )
                )
            }

            AnimatedEntrance(delay = 150, slideOffset = 10.dp) {
                Text(
                    text = "Connect with the world",
                    color = TextMuted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            AnimatedEntrance(delay = 300, slideOffset = 30.dp) {
                GlassCard(
                    cornerRadius = 24.dp,
                    borderGradient = Brush.horizontalGradient(
                        listOf(PrimaryPurple.copy(alpha = 0.25f), PrimaryPink.copy(alpha = 0.2f))
                    ),
                    contentPadding = PaddingValues(20.dp)
                ) {
                    Spacer(modifier = Modifier.height(8.dp))

                    GlassTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = "Email address",
                        placeholder = "your@email.com",
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = KeyboardType.Email
                        )
                    )

                    GlassTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = "Password",
                        placeholder = "At least 6 characters",
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = KeyboardType.Password
                        ),
                        visualTransformation = PasswordVisualTransformation()
                    )

                    if (error != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            error,
                            color = Danger,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    GlassButton(
                        text = "Sign in with Email",
                        onClick = { onEmailAuth(email.trim(), password, false) },
                        enabled = !loading && email.isNotBlank() && password.length >= 6,
                        loading = loading,
                        gradient = Brush.horizontalGradient(auroraGradientPrimary)
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    GlassOutlinedButton(
                        text = "Create account",
                        onClick = { onEmailAuth(email.trim(), password, true) },
                        modifier = Modifier.fillMaxWidth(),
                        height = 52.dp,
                        cornerRadius = 14.dp,
                        enabled = !loading && email.isNotBlank() && password.length >= 6
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        GlassOutlinedButton(
                            text = "Google",
                            onClick = onGoogleSignIn,
                            modifier = Modifier.weight(1f),
                            height = 52.dp,
                            cornerRadius = 14.dp,
                            enabled = !loading
                        )
                        GlassOutlinedButton(
                            text = "Phone",
                            onClick = onPhoneSignIn,
                            modifier = Modifier.weight(1f),
                            height = 52.dp,
                            cornerRadius = 14.dp,
                            enabled = !loading
                        )
                    }
                }
            }
        }
    }
}

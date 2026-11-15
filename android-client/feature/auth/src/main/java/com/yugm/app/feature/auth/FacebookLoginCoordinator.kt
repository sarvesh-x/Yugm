package com.yugm.app.feature.auth

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.FacebookSdk
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult

/**
 * Registers a lifecycle-safe Facebook login launcher. The returned callback takes
 * the current terms acceptance value so the token exchange can forward it.
 *
 * The launcher is registered during composition (before the activity is STARTED),
 * which avoids the fragile click-time ActivityResultRegistry registration and makes
 * the flow survive configuration changes.
 */
@Suppress("DEPRECATION")
@Composable
fun rememberFacebookSignIn(
    onToken: (String, Boolean) -> Unit,
    onError: (String) -> Unit,
    onFinished: () -> Unit,
): (Boolean) -> Unit {
    val context = LocalContext.current
    val callbackManager = remember { CallbackManager.Factory.create() }
    val handled = remember { mutableStateOf(false) }
    val inFlight = remember { mutableStateOf(false) }
    val currentOnToken by rememberUpdatedState(onToken)
    val currentOnError by rememberUpdatedState(onError)
    val currentOnFinished by rememberUpdatedState(onFinished)
    val contract = remember(callbackManager) {
        LoginManager.getInstance().createLogInActivityResultContract(callbackManager)
    }
    val launcher = rememberLauncherForActivityResult(contract) {
        // FacebookCallback normally handles completion. This covers results that
        // arrive without a registered callback, such as a retried or restored flow.
        if (!handled.value) currentOnFinished()
        handled.value = false
        inFlight.value = false
    }

    return remember(callbackManager, launcher) {
        { acceptTerms ->
            when {
                inFlight.value -> Unit
                !BuildConfig.FACEBOOK_AUTH_CONFIGURED -> currentOnError(
                    "Facebook sign-in is not configured yet. Add YUGM_FACEBOOK_APP_ID and " +
                        "YUGM_FACEBOOK_CLIENT_TOKEN to android-client/.env."
                )
                else -> {
                    handled.value = false
                    try {
                        FacebookSdk.setApplicationId(BuildConfig.FACEBOOK_APP_ID)
                        FacebookSdk.setClientToken(BuildConfig.FACEBOOK_CLIENT_TOKEN)
                        FacebookSdk.sdkInitialize(context.applicationContext)
                        FacebookSdk.fullyInitialize()
                        LoginManager.getInstance().registerCallback(
                            callbackManager,
                            object : FacebookCallback<LoginResult> {
                                override fun onSuccess(result: LoginResult) {
                                    handled.value = true
                                    inFlight.value = false
                                    LoginManager.getInstance().unregisterCallback(callbackManager)
                                    val token = result.accessToken.token
                                    if (token.isBlank()) {
                                        currentOnFinished()
                                        currentOnError("Facebook did not return an access token. Try again.")
                                    } else {
                                        currentOnToken(token, acceptTerms)
                                    }
                                }

                                override fun onCancel() {
                                    handled.value = true
                                    inFlight.value = false
                                    LoginManager.getInstance().unregisterCallback(callbackManager)
                                    currentOnFinished()
                                }

                                override fun onError(error: FacebookException) {
                                    handled.value = true
                                    inFlight.value = false
                                    LoginManager.getInstance().unregisterCallback(callbackManager)
                                    currentOnFinished()
                                    currentOnError(
                                        error.localizedMessage
                                            ?: "Facebook sign-in failed. Please try again."
                                    )
                                }
                            }
                        )
                        inFlight.value = true
                        launcher.launch(listOf("public_profile", "email"))
                    } catch (error: Exception) {
                        handled.value = true
                        inFlight.value = false
                        LoginManager.getInstance().unregisterCallback(callbackManager)
                        currentOnFinished()
                        currentOnError(
                            error.localizedMessage
                                ?: "Facebook sign-in could not start. Check the Facebook app configuration."
                        )
                    }
                }
            }
        }
    }
}

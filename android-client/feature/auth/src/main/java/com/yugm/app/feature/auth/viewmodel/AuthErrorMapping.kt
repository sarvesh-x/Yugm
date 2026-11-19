package com.yugm.app.feature.auth.viewmodel

internal fun firebaseCredentialErrorMessage(provider: AuthProvider, errorCode: String): String? {
    if (errorCode != "ERROR_INVALID_CREDENTIAL" && errorCode != "ERROR_INVALID_PROVIDER_ID") return null

    return when (provider) {
        AuthProvider.EMAIL -> "That email or password could not be verified. Check your details and try again."
        AuthProvider.GOOGLE -> "Google could not verify that sign-in. Try again or choose another method."
        AuthProvider.FACEBOOK -> "Facebook could not verify that sign-in. Try again or use another method."
        AuthProvider.PHONE -> "That phone credential could not be verified. Request a new code and try again."
        AuthProvider.PASSWORD -> "That request could not be verified. Try again."
    }
}

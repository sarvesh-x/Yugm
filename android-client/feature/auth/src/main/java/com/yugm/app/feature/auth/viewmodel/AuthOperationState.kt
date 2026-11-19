package com.yugm.app.feature.auth.viewmodel

enum class AuthProvider { EMAIL, GOOGLE, FACEBOOK, PHONE, PASSWORD }
enum class AuthPhase { CREDENTIAL, FIREBASE_AUTH, BACKEND_EXCHANGE, PASSWORD_RESET }
data class AuthOperation(val provider: AuthProvider, val phase: AuthPhase)

internal fun beginAuthOperation(current: AuthOperation?, provider: AuthProvider): AuthOperation? =
    if (current == null) AuthOperation(provider, AuthPhase.CREDENTIAL) else null

internal fun startAuthExecution(current: AuthOperation?, provider: AuthProvider): AuthOperation? = when {
    current == null -> AuthOperation(provider, AuthPhase.FIREBASE_AUTH)
    current.provider == provider && current.phase == AuthPhase.CREDENTIAL ->
        AuthOperation(provider, AuthPhase.FIREBASE_AUTH)
    else -> null
}

internal fun advanceAuthOperation(
    current: AuthOperation?,
    provider: AuthProvider,
    phase: AuthPhase,
): AuthOperation? = current?.takeIf { it.provider == provider }?.copy(phase = phase) ?: current

internal fun finishAuthOperation(current: AuthOperation?, provider: AuthProvider): AuthOperation? =
    if (current?.provider == provider) null else current

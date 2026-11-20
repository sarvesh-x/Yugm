package com.yugm.app.core.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = run {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            "yugm_session_encrypted",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * EncryptedSharedPreferences decrypts on every read. Session values are read
     * on every HTTP request, so keep a write-through in-memory snapshot and only
     * touch the encrypted store on the first access.
     */
    private val cache = java.util.concurrent.ConcurrentHashMap<String, Any>()

    private inline fun <T : Any> cached(key: String, read: () -> T): T {
        @Suppress("UNCHECKED_CAST")
        (cache[key] as? T)?.let { return it }
        return read().also { cache[key] = it }
    }

    private fun writeString(key: String, value: String) {
        cache[key] = value
        prefs.edit().putString(key, value).apply()
    }

    private fun writeBoolean(key: String, value: Boolean) {
        cache[key] = value
        prefs.edit().putBoolean(key, value).apply()
    }

    private fun writeInt(key: String, value: Int) {
        cache[key] = value
        prefs.edit().putInt(key, value).apply()
    }

    private fun writeLong(key: String, value: Long) {
        cache[key] = value
        prefs.edit().putLong(key, value).apply()
    }

    var authToken: String
        get() = cached("authToken") { prefs.getString("authToken", "") ?: "" }
        set(value) = writeString("authToken", value)

    var refreshToken: String
        get() = cached("refreshToken") { prefs.getString("refreshToken", "") ?: "" }
        set(value) = writeString("refreshToken", value)

    var sessionId: String
        get() = cached("sessionId") { prefs.getString("sessionId", "") ?: "" }
        set(value) = writeString("sessionId", value)

    var accessTokenExpiresAt: Long
        get() = cached("accessTokenExpiresAt") { prefs.getLong("accessTokenExpiresAt", 0L) }
        set(value) = writeLong("accessTokenExpiresAt", value)

    var emailVerified: Boolean
        get() = cached("emailVerified") { prefs.getBoolean("emailVerified", false) }
        set(value) = writeBoolean("emailVerified", value)

    /** Older installed sessions predate this flag, so treat them as complete once a user ID exists. */
    var profileCompleted: Boolean
        get() = cached("profileCompleted") { prefs.getBoolean("profileCompleted", userId.isNotBlank()) }
        set(value) = writeBoolean("profileCompleted", value)

    var onboardingCompleted: Boolean
        get() = cached("onboardingCompleted") { prefs.getBoolean("onboardingCompleted", false) }
        set(value) = writeBoolean("onboardingCompleted", value)

    var pendingFcmToken: String
        get() = cached("pendingFcmToken") { prefs.getString("pendingFcmToken", "") ?: "" }
        set(value) = writeString("pendingFcmToken", value)

    var userId: String
        get() = cached("userId") { prefs.getString("userId", "") ?: "" }
        set(value) = writeString("userId", value)

    var userName: String
        get() = cached("userName") { prefs.getString("userName", "Yugm User") ?: "Yugm User" }
        set(value) = writeString("userName", value)

    var username: String
        get() = cached("username") { prefs.getString("username", "vibe_user") ?: "vibe_user" }
        set(value) = writeString("username", value)

    var userEmail: String
        get() = cached("userEmail") { prefs.getString("userEmail", "") ?: "" }
        set(value) = writeString("userEmail", value)

    var balance: Int
        get() = cached("balance") { prefs.getInt("balance", 0) }
        set(value) = writeInt("balance", value)

    private val _themeModeFlow = MutableStateFlow(prefs.getString("themeMode", "SYSTEM") ?: "SYSTEM")
    val themeModeFlow: StateFlow<String> = _themeModeFlow.asStateFlow()

    var themeMode: String
        get() = cached("themeMode") { prefs.getString("themeMode", "SYSTEM") ?: "SYSTEM" }
        set(value) {
            writeString("themeMode", value)
            _themeModeFlow.value = value
        }

    fun saveSession(
        token: String,
        refresh: String,
        session: String,
        expiresInSeconds: Long,
        id: String,
        name: String,
        handle: String,
        walletBalance: Int,
        emailVerified: Boolean,
        profileCompleted: Boolean = false,
        email: String = "",
    ) {
        val expiresAt = System.currentTimeMillis() + expiresInSeconds * 1000L
        prefs.edit()
            .putString("authToken", token)
            .putString("refreshToken", refresh)
            .putString("sessionId", session)
            .putLong("accessTokenExpiresAt", expiresAt)
            .putString("userId", id)
            .putString("userName", name)
            .putString("username", handle)
            .putString("userEmail", email)
            .putInt("balance", walletBalance)
            .putBoolean("emailVerified", emailVerified)
            .putBoolean("profileCompleted", profileCompleted)
            .apply()
        cache["authToken"] = token
        cache["refreshToken"] = refresh
        cache["sessionId"] = session
        cache["accessTokenExpiresAt"] = expiresAt
        cache["userId"] = id
        cache["userName"] = name
        cache["username"] = handle
        cache["userEmail"] = email
        cache["balance"] = walletBalance
        cache["emailVerified"] = emailVerified
        cache["profileCompleted"] = profileCompleted
    }

    fun logout() {
        val mode = themeMode
        prefs.edit().clear().apply()
        cache.clear()
        themeMode = mode
    }
}

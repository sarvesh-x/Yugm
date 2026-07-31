package com.example.yugm.core.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

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

    var authToken: String
        get() = prefs.getString("authToken", "") ?: ""
        set(value) = prefs.edit().putString("authToken", value).apply()

    var userId: String
        get() = prefs.getString("userId", "") ?: ""
        set(value) = prefs.edit().putString("userId", value).apply()

    var userName: String
        get() = prefs.getString("userName", "Yugm User") ?: "Yugm User"
        set(value) = prefs.edit().putString("userName", value).apply()

    var username: String
        get() = prefs.getString("username", "vibe_user") ?: "vibe_user"
        set(value) = prefs.edit().putString("username", value).apply()

    var balance: Int
        get() = prefs.getInt("balance", 0)
        set(value) = prefs.edit().putInt("balance", value).apply()

    fun logout() {
        prefs.edit().clear().apply()
    }
}

package com.example.yugm.core.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = context.getSharedPreferences("yugm_session", Context.MODE_PRIVATE)

    var authToken: String
        get() = prefs.getString("authToken", "") ?: ""
        set(value) = prefs.edit { putString("authToken", value) }

    var userId: String
        get() = prefs.getString("userId", "") ?: ""
        set(value) = prefs.edit { putString("userId", value) }

    var userName: String
        get() = prefs.getString("userName", "Yugm User") ?: "Yugm User"
        set(value) = prefs.edit { putString("userName", value) }

    var username: String
        get() = prefs.getString("username", "vibe_user") ?: "vibe_user"
        set(value) = prefs.edit { putString("username", value) }

    var balance: Int
        get() = prefs.getInt("balance", 0)
        set(value) = prefs.edit { putInt("balance", value) }

    fun logout() {
        prefs.edit { clear() }
    }
}

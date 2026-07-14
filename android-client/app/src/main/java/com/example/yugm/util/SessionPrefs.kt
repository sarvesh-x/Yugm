package com.example.yugm.util

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

object SessionPrefs {
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences("yugm_session", Context.MODE_PRIVATE)
    }

    fun save(token: String, userId: String, name: String, username: String, balance: Int) {
        prefs.edit {
            putString("authToken", token)
            putString("userId", userId)
            putString("userName", name)
            putString("username", username)
            putInt("balance", balance)
        }
    }

    fun clear() { prefs.edit { clear() } }
}

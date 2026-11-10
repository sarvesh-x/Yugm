package com.example.yugm

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.example.yugm.core.api.YugmMediaRoom
import com.example.yugm.core.api.ApiConfig
import timber.log.Timber

@HiltAndroidApp
class YugmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiConfig.apiBaseUrl = BuildConfig.API_BASE_URL
        ApiConfig.socketBaseUrl = BuildConfig.SOCKET_BASE_URL
        ApiConfig.lanApiBaseUrl = BuildConfig.LAN_API_BASE_URL
        ApiConfig.lanSocketBaseUrl = BuildConfig.LAN_SOCKET_BASE_URL
        ApiConfig.isDebug = BuildConfig.DEBUG
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        YugmMediaRoom.initialize(this)
    }
}

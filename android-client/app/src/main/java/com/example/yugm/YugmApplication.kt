package com.example.yugm

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.example.yugm.core.api.YugmMediaRoom
import com.example.yugm.core.api.ApiConfig
import com.example.yugm.core.api.YugmHttpClient
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.android.gms.tasks.Tasks
import timber.log.Timber

@HiltAndroidApp
class YugmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        ApiConfig.apiBaseUrl = BuildConfig.API_BASE_URL
        ApiConfig.socketBaseUrl = BuildConfig.SOCKET_BASE_URL
        ApiConfig.lanApiBaseUrl = BuildConfig.LAN_API_BASE_URL
        ApiConfig.lanSocketBaseUrl = BuildConfig.LAN_SOCKET_BASE_URL
        ApiConfig.isDebug = BuildConfig.DEBUG
        val appCheckFactory = if (BuildConfig.DEBUG) {
            Class.forName("com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory")
                .getMethod("getInstance").invoke(null) as AppCheckProviderFactory
        } else PlayIntegrityAppCheckProviderFactory.getInstance()
        FirebaseAppCheck.getInstance().installAppCheckProviderFactory(appCheckFactory)
        YugmHttpClient.appCheckTokenProvider = {
            Tasks.await(FirebaseAppCheck.getInstance().limitedUseAppCheckToken).token
        }
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        YugmMediaRoom.initialize(this)
    }
}

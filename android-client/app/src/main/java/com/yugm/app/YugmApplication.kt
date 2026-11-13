package com.yugm.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.ApiConfig
import com.yugm.app.core.api.YugmHttpClient
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.android.gms.tasks.Tasks
import android.util.Log
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
        val appCheck = FirebaseAppCheck.getInstance()
        appCheck.installAppCheckProviderFactory(appCheckFactory)
        if (BuildConfig.DEBUG) {
            // Warm the debug provider at app start so its allowlist token and any
            // Firebase setup errors are visible in Logcat before the user signs in.
            appCheck.getAppCheckToken(false).addOnFailureListener { failure ->
                Log.e("YugmAppCheck", "Could not acquire a Firebase App Check debug token", failure)
            }
        }
        YugmHttpClient.appCheckTokenProvider = {
            Tasks.await(FirebaseAppCheck.getInstance().limitedUseAppCheckToken).token
        }
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        YugmMediaRoom.initialize(this)
    }
}

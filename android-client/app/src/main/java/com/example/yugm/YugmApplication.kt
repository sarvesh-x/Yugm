package com.example.yugm

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.example.yugm.api.YugmMediaRoom
import timber.log.Timber

@HiltAndroidApp
class YugmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        YugmMediaRoom.initialize(this)
    }
}

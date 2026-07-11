package com.example.yugm

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.example.yugm.api.YugmMediaRoom

@HiltAndroidApp
class YugmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        YugmMediaRoom.initialize(this)
    }
}

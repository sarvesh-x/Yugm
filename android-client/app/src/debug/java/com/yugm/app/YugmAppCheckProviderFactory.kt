package com.yugm.app

import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

internal object YugmAppCheckProviderFactory {
    fun getInstance(): AppCheckProviderFactory = DebugAppCheckProviderFactory.getInstance()
}
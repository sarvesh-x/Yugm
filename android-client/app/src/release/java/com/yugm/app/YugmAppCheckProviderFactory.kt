package com.yugm.app

import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

internal object YugmAppCheckProviderFactory {
    fun getInstance(): AppCheckProviderFactory = PlayIntegrityAppCheckProviderFactory.getInstance()
}
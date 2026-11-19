package com.yugm.app.feature.auth

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.appcheck.FirebaseAppCheck
import com.yugm.app.core.api.ApiConfig
import kotlinx.coroutines.CancellationException
import java.util.concurrent.TimeUnit

internal object AppCheckReadiness {
    fun requireReady(context: Context) {
        if (!ApiConfig.appCheckRequired) return
        try {
            val token = Tasks.await(
                FirebaseAppCheck.getInstance().getAppCheckToken(false),
                TOKEN_TIMEOUT_SECONDS,
                TimeUnit.SECONDS
            ).token
            if (token.isNullOrBlank()) {
                Log.w("YugmAppCheck", "App Check returned an empty token; continuing with auth request")
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            throw CancellationException("App Check preflight was cancelled").also { it.initCause(interrupted) }
        } catch (error: Exception) {
            val appId = context.packageName
            val isDebugBuild = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            if (isDebugBuild) {
                Log.w("YugmAppCheck", "Debug App Check token request failed for $appId: ${error.message}; continuing request to server")
            } else {
                Log.w("YugmAppCheck", "Release App Check token request failed for $appId: ${error.message}; continuing request to server")
            }
        }
    }

    private const val TOKEN_TIMEOUT_SECONDS = 2L
}

internal class AppCheckSetupException(message: String, cause: Throwable) : IllegalStateException(message, cause)

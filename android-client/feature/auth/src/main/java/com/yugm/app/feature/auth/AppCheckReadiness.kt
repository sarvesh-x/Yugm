package com.yugm.app.feature.auth

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.appcheck.FirebaseAppCheck
import kotlinx.coroutines.CancellationException
import java.util.concurrent.TimeUnit

internal object AppCheckReadiness {
    fun requireReady(context: Context) {
        try {
            val token = Tasks.await(
                FirebaseAppCheck.getInstance().getAppCheckToken(false),
                TOKEN_TIMEOUT_SECONDS,
                TimeUnit.SECONDS
            ).token
            if (token.isNullOrBlank()) throw IllegalStateException("App Check returned an empty token")
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            throw CancellationException("App Check preflight was cancelled").also { it.initCause(interrupted) }
        } catch (error: Exception) {
            val appId = context.packageName
            val isDebugBuild = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            if (isDebugBuild) {
                Log.e("YugmAppCheck", "Debug App Check token request failed for $appId", error)
            }
            val setupInstructions = if (isDebugBuild) {
                "Allowlist this debug build's token in Firebase Console → App Check → Apps → $appId → Debug tokens. " +
                    "Find the token in Logcat under DebugAppCheckProvider, then retry."
            } else {
                "Register Android app $appId in Firebase App Check with Play Integrity. Verify this release's signing certificate SHA-256 and distribution settings."
            }
            throw AppCheckSetupException("App verification failed. $setupInstructions", error)
        }
    }

    private const val TOKEN_TIMEOUT_SECONDS = 8L
}

internal class AppCheckSetupException(message: String, cause: Throwable) : IllegalStateException(message, cause)

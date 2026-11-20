package com.yugm.app

import android.app.Application
import android.os.Build
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import coil.decode.SvgDecoder
import dagger.hilt.android.HiltAndroidApp
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.ApiConfig
import com.yugm.app.core.api.shouldRequireAppCheck
import com.yugm.app.core.api.YugmHttpClient
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.android.gms.tasks.Tasks
import android.util.Log
import timber.log.Timber
import com.facebook.FacebookSdk
import com.yugm.app.feature.auth.BuildConfig as AuthBuildConfig
import java.util.concurrent.TimeUnit

@HiltAndroidApp
class YugmApplication : Application(), ImageLoaderFactory {
    @Suppress("DEPRECATION")
    override fun onCreate() {
        super.onCreate()
        // FacebookLoginCoordinator creates its CallbackManager when the login
        // screen enters composition. Initialize the SDK before that only when
        // this build has both required Facebook credentials. Release builds may
        // intentionally omit Facebook sign-in configuration.
        if (AuthBuildConfig.FACEBOOK_AUTH_CONFIGURED) {
            FacebookSdk.setApplicationId(AuthBuildConfig.FACEBOOK_APP_ID)
            FacebookSdk.setClientToken(AuthBuildConfig.FACEBOOK_CLIENT_TOKEN)
            FacebookSdk.sdkInitialize(this)
            FacebookSdk.fullyInitialize()
        }
        FirebaseApp.initializeApp(this)
        val runningOnEmulator = isProbablyEmulator()
        ApiConfig.apiBaseUrl = if (BuildConfig.DEBUG && runningOnEmulator) "http://10.0.2.2:4000/api" else BuildConfig.API_BASE_URL
        ApiConfig.socketBaseUrl = if (BuildConfig.DEBUG && runningOnEmulator) "http://10.0.2.2:4000" else BuildConfig.SOCKET_BASE_URL
        ApiConfig.lanApiBaseUrl = when {
            BuildConfig.DEBUG && runningOnEmulator && BuildConfig.API_BASE_URL != "http://10.0.2.2:4000/api" -> BuildConfig.API_BASE_URL
            else -> BuildConfig.LAN_API_BASE_URL
        }
        ApiConfig.lanSocketBaseUrl = when {
            BuildConfig.DEBUG && runningOnEmulator && BuildConfig.SOCKET_BASE_URL != "http://10.0.2.2:4000" -> BuildConfig.SOCKET_BASE_URL
            else -> BuildConfig.LAN_SOCKET_BASE_URL
        }
        ApiConfig.isDebug = BuildConfig.DEBUG
        ApiConfig.appCheckRequired = shouldRequireAppCheck(ApiConfig.apiBaseUrl, BuildConfig.DEBUG)
        YugmHttpClient.install(this)
        val appCheckFactory: AppCheckProviderFactory = YugmAppCheckProviderFactory.getInstance()
        val appCheck = FirebaseAppCheck.getInstance()
        appCheck.installAppCheckProviderFactory(appCheckFactory)
        if (BuildConfig.DEBUG && ApiConfig.appCheckRequired) {
            // Warm the debug provider at app start so its allowlist token and any
            // Firebase setup errors are visible in Logcat before the user signs in.
            appCheck.getAppCheckToken(false).addOnFailureListener { failure ->
                Log.e("YugmAppCheck", "Could not acquire a Firebase App Check debug token", failure)
            }
        }
        YugmHttpClient.appCheckTokenProvider = {
            // Server-side replay protection consumes limited-use tokens, so each
            // protected request must carry a fresh token rather than a cached one.
            Tasks.await(FirebaseAppCheck.getInstance().limitedUseAppCheckToken, 2, TimeUnit.SECONDS).token
        }
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        YugmMediaRoom.initialize(this)
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .components {
                add(SvgDecoder.Factory())
                if (Build.VERSION.SDK_INT >= 28) add(ImageDecoderDecoder.Factory())
                else add(GifDecoder.Factory())
            }
            .crossfade(true)
            .build()
    }

    private fun isProbablyEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
            || Build.FINGERPRINT.startsWith("unknown")
            || Build.FINGERPRINT.contains("emulator")
            || Build.MODEL.contains("google_sdk")
            || Build.MODEL.contains("Emulator", ignoreCase = true)
            || Build.MODEL.contains("Android SDK built for", ignoreCase = true)
            || Build.MANUFACTURER.contains("Genymotion", ignoreCase = true)
            || Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")
            || Build.PRODUCT.contains("sdk")
            || Build.PRODUCT.contains("emulator")
            || Build.HARDWARE.contains("goldfish")
            || Build.HARDWARE.contains("ranchu"))
    }
}

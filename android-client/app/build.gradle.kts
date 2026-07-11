@file:Suppress("DEPRECATION")

import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
    alias(libs.plugins.hilt.android)
    id("org.jetbrains.kotlin.kapt")
}

fun configValue(name: String): String? {
    return providers.gradleProperty(name).orNull
        ?: providers.environmentVariable(name).orNull
}

fun quoted(value: String): String {
    return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

fun localLanIpv4(): String? {
    return Collections.list(NetworkInterface.getNetworkInterfaces())
        .filter { it.isUp && !it.isLoopback && !it.isVirtual }
        .flatMap { Collections.list(it.inetAddresses) }
        .filterIsInstance<Inet4Address>()
        .map { it.hostAddress }
        .firstOrNull { address: String ->
            address.startsWith("192.168.") || address.startsWith("10.") || address.startsWith("172.")
        }
}

val yugmApiBaseUrl = configValue("YUGM_API_BASE_URL")
val yugmSocketBaseUrl = configValue("YUGM_SOCKET_BASE_URL")
val localLanHost = localLanIpv4()
val isReleaseTaskRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }

if (isReleaseTaskRequested) {
    require(!yugmApiBaseUrl.isNullOrBlank()) {
        "Set YUGM_API_BASE_URL to your deployed API URL, for example https://your-backend.onrender.com/api"
    }
    require(!yugmSocketBaseUrl.isNullOrBlank()) {
        "Set YUGM_SOCKET_BASE_URL to your deployed socket URL, for example https://your-backend.onrender.com"
    }
}

android {
    namespace = "com.example.yugm"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.yugm"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            val apiBaseUrl = yugmApiBaseUrl ?: "http://10.0.2.2:4000/api"
            val socketBaseUrl = yugmSocketBaseUrl ?: "http://10.0.2.2:4000"
            buildConfigField("String", "API_BASE_URL", quoted(apiBaseUrl))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(socketBaseUrl))
            buildConfigField("String", "LAN_API_BASE_URL", quoted(localLanHost?.let { "http://$it:4000/api" }.orEmpty()))
            buildConfigField("String", "LAN_SOCKET_BASE_URL", quoted(localLanHost?.let { "http://$it:4000" }.orEmpty()))
        }

        release {
            isMinifyEnabled = true
            val apiBaseUrl = yugmApiBaseUrl.orEmpty()
            val socketBaseUrl = yugmSocketBaseUrl.orEmpty()
            buildConfigField("String", "API_BASE_URL", quoted(apiBaseUrl))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(socketBaseUrl))
            buildConfigField("String", "LAN_API_BASE_URL", quoted(""))
            buildConfigField("String", "LAN_SOCKET_BASE_URL", quoted(""))
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_11)
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.googleid)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.razorpay.checkout)
    implementation(libs.socketio.client)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.auth)
    implementation(libs.play.services.auth)
    implementation(libs.livekit.android)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}

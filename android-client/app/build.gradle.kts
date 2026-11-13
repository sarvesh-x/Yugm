@file:Suppress("DEPRECATION")

import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }
        ?.inputStream()?.use { load(it) }
}
val fpnvTestToken = System.getenv("FPNV_TEST_TOKEN")?.takeIf { it.isNotEmpty() }
    ?: localProperties.getProperty("fpnv.testToken", "")
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
        ?: localProperties.getProperty(name)
}

fun quoted(value: String): String {
    return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

fun localLanIpv4(): String? {
    return Collections.list(NetworkInterface.getNetworkInterfaces())
        .asSequence()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { network ->
            val interfaceName = network.displayName.lowercase()
            val preference = when {
                network.isVirtual || listOf("virtual", "vmware", "virtualbox", "hyper-v", "docker", "wsl").any(interfaceName::contains) -> 0
                listOf("wi-fi", "wifi", "wireless", "wlan").any(interfaceName::contains) -> 3
                else -> 1
            }
            Collections.list(network.inetAddresses)
                .filterIsInstance<Inet4Address>()
                .mapNotNull { address ->
                    val value = address.hostAddress
                    val isPrivate = value.startsWith("192.168.") || value.startsWith("10.") || value.startsWith("172.")
                    if (isPrivate && preference > 0) preference to value else null
                }
        }
        .sortedByDescending { it.first }
        .map { it.second }
        .firstOrNull()
}

val isReleaseTaskRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
val defaultServerMode = if (isReleaseTaskRequested) "deploy" else "development"
val yugmServerMode = configValue("YUGM_SERVER_MODE")?.trim()?.lowercase()
    ?: defaultServerMode

require(yugmServerMode == "development" || yugmServerMode == "deploy") {
    "YUGM_SERVER_MODE must be either 'development' or 'deploy'"
}
if (isReleaseTaskRequested) {
    require(yugmServerMode == "deploy") {
        "Release builds must use YUGM_SERVER_MODE=deploy"
    }
}

val localLanHost = configValue("YUGM_LAN_HOST")?.trim()?.takeIf(String::isNotBlank) ?: localLanIpv4()
val defaultApiBaseUrl = if (yugmServerMode == "deploy") {
    "https://yugm.onrender.com/api"
} else {
    localLanHost?.let { "http://$it:4000/api" } ?: "http://10.0.2.2:4000/api"
}
val defaultSocketBaseUrl = if (yugmServerMode == "deploy") {
    "https://yugm.onrender.com"
} else {
    localLanHost?.let { "http://$it:4000" } ?: "http://10.0.2.2:4000"
}
val yugmApiBaseUrl = configValue("YUGM_API_BASE_URL") ?: defaultApiBaseUrl
val yugmSocketBaseUrl = configValue("YUGM_SOCKET_BASE_URL") ?: defaultSocketBaseUrl
val uploadKeystoreFile = configValue("YUGM_UPLOAD_KEYSTORE_FILE")
val uploadKeystorePassword = configValue("YUGM_UPLOAD_KEYSTORE_PASSWORD")
val uploadKeyAlias = configValue("YUGM_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = configValue("YUGM_UPLOAD_KEY_PASSWORD")
val hasUploadSigning = listOf(uploadKeystoreFile, uploadKeystorePassword, uploadKeyAlias, uploadKeyPassword)
    .all { !it.isNullOrBlank() }

if (isReleaseTaskRequested) {
    require(!yugmApiBaseUrl.isNullOrBlank()) {
        "Set YUGM_API_BASE_URL to your deployed API URL, for example https://your-backend.onrender.com/api"
    }
    require(!yugmSocketBaseUrl.isNullOrBlank()) {
        "Set YUGM_SOCKET_BASE_URL to your deployed socket URL, for example https://your-backend.onrender.com"
    }
    require(yugmApiBaseUrl.startsWith("https://")) {
        "YUGM_API_BASE_URL must use HTTPS for release builds"
    }
    require(yugmSocketBaseUrl.startsWith("https://")) {
        "YUGM_SOCKET_BASE_URL must use HTTPS for release builds"
    }
    require(hasUploadSigning) {
        "Release builds require YUGM_UPLOAD_KEYSTORE_FILE, YUGM_UPLOAD_KEYSTORE_PASSWORD, YUGM_UPLOAD_KEY_ALIAS, and YUGM_UPLOAD_KEY_PASSWORD. Keep the upload keystore and passwords outside source control."
    }
}

android {
    namespace = "com.yugm.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.yugm.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    lint {
        disable += setOf(
            "LogNotTimber",
            "StringFormatInTimber",
            "ThrowableNotAtBeginning",
            "BinaryOperationInTimber",
            "TimberArgCount",
            "TimberArgTypes",
            "TimberTagLength",
            "TimberExceptionLogging",
        )
    }

    signingConfigs {
        if (hasUploadSigning) {
            create("playUpload") {
                storeFile = file(uploadKeystoreFile!!)
                storePassword = uploadKeystorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
            }
        } else {
            // Debug builds do not need release signing. Release task validation above
            // stops unsigned artifacts from being mistaken for Play-ready bundles.
            create("playUpload")
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", quoted(yugmApiBaseUrl))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(yugmSocketBaseUrl))
            buildConfigField("String", "LAN_API_BASE_URL", quoted(localLanHost?.let { "http://$it:4000/api" }.orEmpty()))
            buildConfigField("String", "FPNV_TEST_TOKEN", "\"$fpnvTestToken\"")
            buildConfigField("String", "LAN_SOCKET_BASE_URL", quoted(localLanHost?.let { "http://$it:4000" }.orEmpty()))
        }

        release {
            signingConfig = signingConfigs.getByName("playUpload")
            isMinifyEnabled = true
            buildConfigField("String", "FPNV_TEST_TOKEN", "\"\"")
            isShrinkResources = true
            buildConfigField("String", "API_BASE_URL", quoted(yugmApiBaseUrl))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(yugmSocketBaseUrl))
            buildConfigField("String", "LAN_API_BASE_URL", quoted(""))
            buildConfigField("String", "LAN_SOCKET_BASE_URL", quoted(""))
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
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
    implementation(libs.androidx.compose.material.icons.extended)
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
    implementation(libs.play.billing)
    implementation(libs.socketio.client)
    implementation(libs.timber)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.auth)
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation(libs.play.services.auth)
    implementation(libs.livekit.android)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.android)

    kapt(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(project(":core:model"))
    implementation(project(":core:api"))
    implementation(project(":core:ui"))
    implementation(project(":core:util"))
    implementation(project(":core:navigation"))
    implementation(project(":core:data"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:discover"))
    implementation(project(":feature:room"))
    implementation(project(":feature:profile"))
    implementation(project(":feature:wallet"))
    implementation(project(":feature:settings"))
    implementation(project(":feature:chat"))
    implementation(project(":feature:missions"))
    implementation(project(":feature:events"))
    implementation(project(":feature:gift"))
    implementation(project(":feature:social"))
    implementation(project(":feature:room-modes"))
    implementation(project(":feature:moderation"))
    implementation(project(":feature:creator"))

    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation("com.google.firebase:firebase-appcheck-debug")
}

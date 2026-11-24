@file:Suppress("DEPRECATION")

import java.net.URI
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
    alias(libs.plugins.ksp)
}

fun configValue(name: String): String? {
    return providers.gradleProperty(name).orNull
        ?: providers.environmentVariable(name).orNull
        ?: localProperties.getProperty(name)
}

fun quoted(value: String): String {
    return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

val debugOrigin = "http://10.0.2.2:4000"
val productionPlaceholder = "https://api.yugm.invalid"
val productionSetting = configValue("YUGM_PRODUCTION_ORIGIN")?.trim()?.trimEnd('/')
    ?.takeIf(String::isNotBlank) ?: productionPlaceholder
val productionUri = runCatching { URI(productionSetting) }.getOrNull()
val productionHost = productionUri?.host.orEmpty().lowercase()
val validProductionOrigin = productionUri?.scheme == "https" && productionHost.contains('.') &&
    !productionHost.all { it.isDigit() || it == '.' } && !productionHost.startsWith("yugm-api-staging.") &&
    productionUri.rawUserInfo == null && productionUri.rawPath.isNullOrEmpty() &&
    productionUri.rawQuery == null && productionUri.rawFragment == null
val productionOrigin = if (validProductionOrigin) productionSetting else productionPlaceholder

val requestsReleaseArtifact = gradle.startParameter.taskNames.any { task ->
    val name = task.substringAfterLast(':').lowercase()
    name in setOf("build", "assemble", "bundle", "assemblerelease", "bundlerelease", "packagerelease",
        "packagereleasebundle", "signreleasebundle", "installrelease") || name.startsWith("publish")
}
val yugmVersionCode = configValue("YUGM_VERSION_CODE")?.toIntOrNull() ?: 1
val yugmVersionName = configValue("YUGM_VERSION_NAME")?.takeIf(String::isNotBlank) ?: "1.0"
val uploadKeystoreFile = configValue("YUGM_UPLOAD_KEYSTORE_FILE")
val uploadKeystorePassword = configValue("YUGM_UPLOAD_KEYSTORE_PASSWORD")
val uploadKeyAlias = configValue("YUGM_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = configValue("YUGM_UPLOAD_KEY_PASSWORD")
val hasUploadSigning = listOf(uploadKeystoreFile, uploadKeystorePassword, uploadKeyAlias, uploadKeyPassword)
    .all { !it.isNullOrBlank() }

if (requestsReleaseArtifact) {
    require(validProductionOrigin && !productionHost.endsWith(".invalid")) {
        "Set YUGM_PRODUCTION_ORIGIN to the live Yugm HTTPS origin without a path, query, or credentials before packaging a release."
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
        versionCode = yugmVersionCode
        versionName = yugmVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    lint {
        // Release builds skip lint entirely; the heavy Compose modules can OOM
        // or stall the release build. Debug lint still runs in CI via :app:lintDebug.
        checkReleaseBuilds = false
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
            buildConfigField("String", "API_BASE_URL", quoted("$debugOrigin/api"))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(debugOrigin))
            buildConfigField("String", "FPNV_TEST_TOKEN", quoted(fpnvTestToken))

            // Debug packaging only. The LiveKit/WebRTC dependency ships ~44 MB of
            // native libraries across four ABIs; a phone plus a desktop emulator
            // only ever need two of them. Trimming the rest makes every
            // mergeDebugNativeLibs/packageDebug/installDebug pass cheaper and the
            // debug APK ~18 MB smaller. Release keeps all ABIs. Override with
            // -PYUGM_DEBUG_ABIS=arm64-v8a (or set YUGM_DEBUG_ABIS in local.properties).
            ndk {
                abiFilters.clear()
                abiFilters.addAll(
                    configValue("YUGM_DEBUG_ABIS")
                        ?.split(',', ' ')
                        ?.map(String::trim)
                        ?.filter(String::isNotBlank)
                        ?.takeIf(List<String>::isNotEmpty)
                        ?: listOf("arm64-v8a", "x86_64"),
                )
            }
        }

        release {
            signingConfig = signingConfigs.getByName("playUpload")
            isMinifyEnabled = true
            // Never ship the local Firebase phone-verification test token in a
            // public artifact; CI release builds have always had it empty.
            buildConfigField("String", "FPNV_TEST_TOKEN", "\"\"")
            isShrinkResources = true
            buildConfigField("String", "API_BASE_URL", quoted("$productionOrigin/api"))
            buildConfigField("String", "SOCKET_BASE_URL", quoted(productionOrigin))
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
    implementation(libs.coil.gif)
    implementation(libs.coil.svg)
    implementation(libs.razorpay.checkout)
    implementation(libs.play.billing)
    implementation(libs.socketio.client)
    implementation(libs.timber)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.auth)
    implementation(libs.facebook.login)
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation(libs.play.services.auth)
    implementation(libs.livekit.android)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.android)

    ksp(libs.hilt.compiler)
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

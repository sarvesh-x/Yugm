import java.util.Properties

plugins {
    id("com.android.library")
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    id("org.jetbrains.kotlin.kapt")
}

val envFile = rootProject.layout.projectDirectory.file(".env")
val envText = runCatching { providers.fileContents(envFile).asText.get() }.getOrDefault("")
val envProperties = Properties().apply {
    if (envText.isNotBlank()) load(envText.reader())
}
val facebookAppId = providers.gradleProperty("YUGM_FACEBOOK_APP_ID").orNull
    ?: providers.environmentVariable("YUGM_FACEBOOK_APP_ID").orNull
    ?: envProperties.getProperty("YUGM_FACEBOOK_APP_ID", "")
val facebookClientToken = providers.gradleProperty("YUGM_FACEBOOK_CLIENT_TOKEN").orNull
    ?: providers.environmentVariable("YUGM_FACEBOOK_CLIENT_TOKEN").orNull
    ?: envProperties.getProperty("YUGM_FACEBOOK_CLIENT_TOKEN", "")
fun buildConfigString(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.yugm.app.feature.auth"
    compileSdk = 37

    defaultConfig {
        minSdk = 24
        buildConfigField("String", "FACEBOOK_APP_ID", buildConfigString(facebookAppId))
        buildConfigField("String", "FACEBOOK_CLIENT_TOKEN", buildConfigString(facebookClientToken))
        buildConfigField("Boolean", "FACEBOOK_AUTH_CONFIGURED", (facebookAppId.isNotBlank() && facebookClientToken.isNotBlank()).toString())
        resValue("string", "facebook_app_id", facebookAppId.ifBlank { "0" })
        resValue("string", "facebook_client_token", facebookClientToken)
        resValue("string", "fb_login_protocol_scheme", facebookAppId.takeIf(String::isNotBlank)?.let { "fb$it" } ?: "fb")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    implementation(project(":core:model"))
    implementation(project(":core:api"))
    implementation(project(":core:ui"))
    implementation(project(":core:util"))
    implementation(project(":core:data"))
    implementation(project(":core:navigation"))

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.timber)
    implementation(libs.coil.compose)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.facebook.login)
    implementation("com.google.firebase:firebase-appcheck")
}

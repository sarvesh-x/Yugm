pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

@Suppress("UnstableApiUsage")
dependencyResolutionManagement {
    defaultLibrariesExtensionName.set("rootLibs")
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
    versionCatalogs {
        create("libs") {
            from(files("android-client/gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "Yugm"

val androidModules = listOf(
    ":app",
    ":core:model",
    ":core:api",
    ":core:ui",
    ":core:util",
    ":core:data",
    ":core:navigation",
    ":feature:auth",
    ":feature:discover",
    ":feature:room",
    ":feature:profile",
    ":feature:social",
    ":feature:wallet",
    ":feature:settings",
    ":feature:chat",
    ":feature:room-modes",
    ":feature:missions",
    ":feature:events",
    ":feature:gift",
    ":feature:moderation",
    ":feature:creator",
)

include(androidModules)
project(":core").projectDir = file("android-client/core")
project(":feature").projectDir = file("android-client/feature")
androidModules.forEach { module ->
    project(module).projectDir = file("android-client/${module.removePrefix(":").replace(":", "/")}")
}

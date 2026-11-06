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
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}

rootProject.name = "Yugm-Android-Client"
include(":app")
include(":core:model")
include(":core:api")
include(":core:ui")
include(":core:util")
include(":core:data")
include(":core:navigation")
include(":feature:auth")
include(":feature:discover")
include(":feature:room")
include(":feature:profile")
include(":feature:social")
include(":feature:wallet")
include(":feature:settings")
include(":feature:chat")
include(":feature:room-modes")
include(":feature:missions")
include(":feature:events")
include(":feature:gift")
include(":feature:moderation")
include(":feature:creator")

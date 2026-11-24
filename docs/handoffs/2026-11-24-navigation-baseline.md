# Android Navigation baseline

Navigation is the active local journey after Auth. The Android source still uses the single root NavHost, the main-tabs pager, and the dock whitelist. [Navigation architecture](../NAVIGATION_ARCHITECTURE.md)

- The 12 core navigation JVM tests cover the five root IDs, legacy top-level mapping, normalized tab IDs, dock hiding on secondary destinations and the clan-chat subtab. The four startup tests cover onboarding, login, profile setup and discovery. [Core navigation tests](../../android-client/core/navigation/src/test/java/com/yugm/app/core/navigation) · [Startup test](../../android-client/feature/auth/src/test/java/com/yugm/app/feature/auth/navigation/StartupDestinationTest.kt)
- Source review traced notification intents through authenticated startup and server-confirmed profile completion before the activity navigates. It also traced tab requests and the saved pager index. The JVM tests exercise pure mapping and visibility rules. Actual back-stack reuse, process recreation, push navigation and dock rendering remain unverified on a device. [Activity](../../android-client/app/src/main/java/com/yugm/app/MainActivity.kt) · [Main tabs host](../../android-client/app/src/main/java/com/yugm/app/ui/screens/MainTabsScreen.kt)

From `android-client` with Android Studio's JBR.

```powershell
.\gradlew.bat :core:navigation:testDebugUnitTest :feature:auth:testDebugUnitTest --tests com.yugm.app.feature.auth.navigation.StartupDestinationTest --max-workers=1 --no-parallel --console=plain
```

Gradle succeeded and the selected result files reported 16 passed tests. The Navigation pass updated the source-backed alias documentation. Android runtime code and Arcade feature work were outside this pass.

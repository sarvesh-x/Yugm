# Navigation on the Android 17 emulator

Navigation remains the active local journey. This pass exercised Android's real `NavHostController`, `SavedStateHandle`, intents and Activity recreation in an isolated test activity. [Navigation test](../../android-client/core/navigation/src/androidTest/java/com/yugm/app/core/navigation/MainTabsBackStackTest.kt)

- Before the fix, explicitly requesting Chat from Settings returned to the existing home entry with no tab request. The same test now observes the Chat request on the original entry. Normal Back restores the saved tab. The main pager writes its selected page to its own entry while dock eligibility follows the current destination. [Tab navigation](../../android-client/core/navigation/src/main/java/com/yugm/app/core/navigation/TopLevelNavigation.kt) · [Main tabs implementation](../../android-client/app/src/main/java/com/yugm/app/ui/screens/MainTabsScreen.kt)
- Push navigation waits for sign-in, startup validation, profile completion and a destination outside Auth. A queued route survives recreation and a consumed route stays consumed. Two deliveries while the same target is visible create one detail entry. The fixture covered the existing room, call, clan, Bonds and chat routes and URI encoding of path arguments. [Push navigation](../../android-client/core/navigation/src/main/java/com/yugm/app/core/navigation/PushNavigation.kt)
- The Compose test rule failed in its Android 17 input setup before executing the initial test. The replacement fixture uses `ActivityScenario` with a plain Compose activity. This also exercises Activity recreation through the Android lifecycle. [ActivityScenario reference](https://developer.android.com/reference/androidx/test/core/app/ActivityScenario)

## Verification

From `android-client`, using Android Studio's JBR and the existing Android 17 emulator.

```powershell
$env:ANDROID_SERIAL = 'emulator-5554'
.\gradlew.bat :core:navigation:connectedDebugAndroidTest :core:navigation:testDebugUnitTest --max-workers=1 --no-parallel --console=plain --offline '-Pkotlin.compiler.execution.strategy=in-process'
.\gradlew.bat :app:compileDebugKotlin --max-workers=1 --no-parallel --console=plain --offline '-Pkotlin.compiler.execution.strategy=in-process'
```

Four connected Android tests and 12 JVM tests passed. The application Kotlin compile passed.

## Remaining Navigation work

The connected tests use a test graph with the production navigation helpers. They verify dock eligibility and saved tab state through the real controller. The follow-up tested process restart, a fixture notification tap and the rendered dock in the debug app. Live FCM remains open. [Full-app evidence](2026-11-24-navigation-process-restart.md)

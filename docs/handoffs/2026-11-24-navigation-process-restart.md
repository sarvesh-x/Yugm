# Full-app Navigation after process death

On the Android 17 emulator, Yugm restored a conversation after process death and requested its history before `/auth/me`. The restored destination skipped Splash, which was the only caller of the startup session check.

`MainActivity` now starts validation after installing the HTTP refresh and expiry handlers. The ViewModel owns the check so it survives Activity recreation. A restored task waits for the startup result before attaching its navigation graph. The saved stack is discarded when the restored account no longer matches the validated session or can no longer enter the main app. A launcher intent without a notification target leaves an already queued push intact. [Activity](../../android-client/app/src/main/java/com/yugm/app/MainActivity.kt) · [Startup validation](../../android-client/app/src/main/java/com/yugm/app/ui/viewmodel/MainViewModel.kt)

## Verified on the emulator

- A tap in the Android notification shade opened the fixture conversation on the running app. The rendered chat and Settings screens hid the dock.
- After Home and `adb shell am kill com.yugm.app`, the launcher resumed the same task in a new process. `/auth/me` reached the loopback fixture before any conversation request. The conversation restored with the dock hidden. One Back press restored the selected Profile tab and its dock. The consumed notification stayed consumed.
- After process death with Settings open, the fixture returned `401` to `/auth/me`. The new process rendered Sign in. The fixture received only that Auth request.

The run used the real debug app, Android task restoration and a system notification with a fixture `PendingIntent`. The fixture seeded encrypted session storage and targeted a loopback HTTP server. It did not deliver a live FCM message or use a Firebase test identity. The Profile tab check verifies Navigation only. Profile data and writes are the next migration slice. [Emulator fixture](../../android-client/app/src/androidTest/java/com/yugm/app/NavigationSessionFixture.kt)

## Commands and results

With Android Studio's JBR, from `android-client`.

```powershell
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :core:navigation:testDebugUnitTest :feature:auth:testDebugUnitTest --max-workers=1 --no-parallel --console=plain --offline '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx1650m -XX:MaxMetaspaceSize=600m -XX:ReservedCodeCacheSize=192m -Dfile.encoding=UTF-8' '-PYUGM_SERVER_MODE=development' '-PYUGM_API_BASE_URL=http://10.0.2.2:4000/api' '-PYUGM_SOCKET_BASE_URL=http://10.0.2.2:4000' '-PYUGM_LAN_HOST=10.0.2.2'
```

Both APKs built successfully. The Gradle reports show 12 core Navigation and 14 Auth JVM checks with zero failures. The local fixture setup passed through AndroidJUnitRunner. On a disposable emulator with the two APKs installed and notifications granted, seed it with `adb -s emulator-5554 shell am instrument -w -e class com.yugm.app.NavigationSessionFixture -e navigationFixture local com.yugm.app.test/androidx.test.runner.AndroidJUnitRunner`. The loopback fixture at `127.0.0.1:4000` served the synthetic self account at `/api/auth/me` and an empty conversation for the synthetic partner. It returned `401` for the revocation scenario. Android UI hierarchy dumps and the fixture request log supplied the before-and-after evidence.

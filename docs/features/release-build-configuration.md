# Android debug and production builds

| Build type | API and socket hosts |
| --- | --- |
| Debug | `http://10.0.2.2:4000/api` for HTTP and `http://10.0.2.2:4000` for app events. Start the [loopback Wrangler Worker](../handoffs/2026-11-24-local-d1-auth-emulator.md) and run the app on the Android emulator. |
| Release | Set `YUGM_PRODUCTION_ORIGIN` to the HTTPS origin of the production Cloudflare Worker. Gradle adds `/api` for HTTP and uses the same origin for app events. |

Both Workers bind a D1 database named `yugm`. Debug applies pending migrations on startup. The hosted D1 schema is applied through `0041`, and public production API acceptance is pending. [Production deployment](../handoffs/2026-11-26-production-d1-r2.md)

The build type selects the environment. Gradle reads the production setting from a Gradle property, an environment variable, or ignored `android-client/local.properties`, in that order. For local artifact testing, a missing or rejected origin resolves to `https://api.yugm.invalid`. The legacy staging Worker and Render hosts are rejected. Tagged GitHub builds read the repository variable of the same name and require a valid production origin and upload signing.

## Local configuration

```properties
# android-client/local.properties
YUGM_PRODUCTION_ORIGIN=https://api.yugm.invalid
YUGM_VERSION_CODE=1
YUGM_VERSION_NAME=1.0.0
YUGM_UPLOAD_KEYSTORE_FILE=<absolute-keystore-path>
YUGM_UPLOAD_KEYSTORE_PASSWORD=<upload-store-password>
YUGM_UPLOAD_KEY_ALIAS=<upload-alias>
YUGM_UPLOAD_KEY_PASSWORD=<upload-key-password>
```

An absolute keystore path avoids Gradle resolving a relative path from `android-client/app`. Keep signing values in ignored local configuration or CI secrets. Firebase remains the identity and App Check provider. Use the Firebase client configuration for the intended environment, and register the production signing certificate for Play Integrity before release verification.

From `android-client`:

```powershell
# Generate both BuildConfig files without a signed artifact.
.\gradlew.bat :app:generateDebugBuildConfig :app:generateReleaseBuildConfig --max-workers=2

# Build after the chosen backend and signing are configured.
.\gradlew.bat :app:assembleDebug --max-workers=2
.\gradlew.bat :app:bundleRelease --max-workers=2
.\gradlew.bat :app:assembleRelease --max-workers=2
```

The release output is under `app/build/outputs/bundle/release` or `app/build/outputs/apk/release`. Follow the [build performance audit](../android-build-performance-audit.md) for bounded verification.

## Managed media on the release API

The production Worker selects D1 and enables native R2 bindings for the five existing hosted buckets. Set `YUGM_R2_ENABLED=false` to pause managed media. Store `MEDIA_GRANT_SECRET` as a Worker secret. The app requests an upload session, sends the bytes to its short-lived URL, then completes the session and loads the committed variant from the production Worker. [Hosted bucket verification](../handoffs/2026-11-24-hosted-r2-d1-endpoint-audit.md)

Before releasing, verify the production hostname, Firebase sign-in and App Check on a signed device, API readiness, and the relevant Android journeys against the live deployment. When hosted media is active, exercise upload, completion, image rendering and cancellation.

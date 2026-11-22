# Google Play release checklist

The repository now targets API 36, signs release artifacts from an external upload keystore, routes coin purchases through Play Billing, records new-user Terms acceptance, and serves the privacy, Terms, child-safety, contact, and account-deletion pages from the API service.

Build verification: `:app:assembleDebug`, `testDebugUnitTest`, `:app:lintDebug`, and `:app:bundleRelease` (R8, resource shrinking, and signing) pass with package `com.yugm.app`.

## Release build configuration

Set these in the ignored `android-client/local.properties` (or the CI secret store) before building a release artifact. Do not commit them.

```properties
YUGM_SERVER_MODE=deploy
YUGM_API_BASE_URL=https://<release-api-host>/api
YUGM_SOCKET_BASE_URL=https://<release-socket-host>
YUGM_VERSION_CODE=<integer>
YUGM_VERSION_NAME=<version>

YUGM_UPLOAD_KEYSTORE_FILE=<absolute-path-to-upload-keystore>
YUGM_UPLOAD_KEYSTORE_PASSWORD=<secret>
YUGM_UPLOAD_KEY_ALIAS=<alias>
YUGM_UPLOAD_KEY_PASSWORD=<secret>
```

- Release tasks require `YUGM_SERVER_MODE=deploy`, both URLs to start with `https://`, and all four signing values.
- `YUGM_API_BASE_URL` must be set explicitly; otherwise the build falls back to the staging Worker URL, which does not publish managed media to R2.
- `YUGM_UPLOAD_KEYSTORE_FILE` is resolved relative to `android-client/app`; use an absolute path and confirm the file exists.
- R2 credentials belong only on the API host. Never put them in the APK, `BuildConfig`, `local.properties` or logs.

Full procedure, verification sequence and failure map: [release APK/AAB configuration](features/release-build-configuration.md).

Complete these account and operator steps before production submission:

- Confirm the permanent Android package ID is `com.yugm.app`. Update Firebase, Google OAuth, `GOOGLE_PLAY_PACKAGE_NAME`, and the native app together before the first Play upload.
- Create a Play upload keystore and provide `YUGM_UPLOAD_KEYSTORE_FILE`, `YUGM_UPLOAD_KEYSTORE_PASSWORD`, `YUGM_UPLOAD_KEY_ALIAS`, and `YUGM_UPLOAD_KEY_PASSWORD` only through a secure local/CI secret store. Enroll in Play App Signing and register the Play app-signing and upload certificate fingerprints in Firebase.
- Configure the production `wss://` LiveKit URL and credentials in Render. Firebase Admin service-account credentials are optional for push notifications, and Google Play credentials are needed only when enabling purchase verification; neither blocks API startup.
- Confirm the release API host has `STORAGE_DRIVER=s3`, all five R2 buckets and both public URLs, then install the signed release artifact and verify an avatar change uses `POST /api/media/uploads` → presigned R2 `PUT` → `/complete`, not the legacy `/upload/avatar` fallback. Check the public-media bucket and the returned `avatarUrl`.
- Create and activate all seven one-time Play products from `backend-server/packages/shared/src/index.ts` (`yugm_coins_290` through `yugm_coins_24990`) with prices matching the app’s coin packs. Add the service account to Play Console with purchase verification access.
- Staff the Support queue and process account-deletion requests from `/legal/account-deletion`, including ownership verification and deletion of associated data subject to legal retention obligations.
- Review the legal pages against the actual deployed data flows and business entity/contact details before publication. The pages are served at `/legal/privacy`, `/legal/terms`, `/legal/child-safety`, `/legal/contact`, and `/legal/account-deletion` on the API host.
- Complete Play Console Data safety, account-deletion URL, app access, content rating, target audience/age restrictions, store listing assets, and payments declarations. Select the appropriate Social/Dating category and Restrict Minor Access setting.
- If this is a personal Play developer account created after November 13, 2023, complete Google Play’s closed-test requirement before requesting production access.

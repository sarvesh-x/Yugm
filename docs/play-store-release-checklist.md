# Google Play release checklist

The repository now targets API 36, signs release artifacts from an external upload keystore, routes coin purchases through Play Billing, records new-user Terms acceptance, and serves the privacy, Terms, child-safety, contact, and account-deletion pages from the API service.

Build verification: `:app:assembleDebug`, `testDebugUnitTest`, `:app:lintDebug`, and `:app:bundleRelease` (R8, resource shrinking, and signing) pass with package `com.yugm.app`.

Complete these account and operator steps before production submission:

- Choose and freeze a permanent Android package ID. The native app currently uses `com.yugm.app`; the Expo client uses `com.yugm.app`. Update Firebase, Google OAuth, `GOOGLE_PLAY_PACKAGE_NAME`, and the native app together before the first Play upload.
- Create a Play upload keystore and provide `YUGM_UPLOAD_KEYSTORE_FILE`, `YUGM_UPLOAD_KEYSTORE_PASSWORD`, `YUGM_UPLOAD_KEY_ALIAS`, and `YUGM_UPLOAD_KEY_PASSWORD` only through a secure local/CI secret store. Enroll in Play App Signing and register the Play app-signing and upload certificate fingerprints in Firebase.
- Configure the production `wss://` LiveKit URL and credentials in Render. Firebase Admin service-account credentials are optional for push notifications, and Google Play credentials are needed only when enabling purchase verification; neither blocks API startup.
- Create and activate all seven one-time Play products from `backend-server/packages/shared/src/index.ts` (`yugm_coins_290` through `yugm_coins_24990`) with prices matching the app’s coin packs. Add the service account to Play Console with purchase verification access.
- Staff the Support queue and process account-deletion requests from `/legal/account-deletion`, including ownership verification and deletion of associated data subject to legal retention obligations.
- Review the legal pages against the actual deployed data flows and business entity/contact details before publication. The pages are served at `/legal/privacy`, `/legal/terms`, `/legal/child-safety`, `/legal/contact`, and `/legal/account-deletion` on the API host.
- Complete Play Console Data safety, account-deletion URL, app access, content rating, target audience/age restrictions, store listing assets, and payments declarations. Select the appropriate Social/Dating category and Restrict Minor Access setting.
- If this is a personal Play developer account created after November 13, 2023, complete Google Play’s closed-test requirement before requesting production access.

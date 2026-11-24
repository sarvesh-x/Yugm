# Auth providers and session mapping

Authentication remains the active journey. Navigation follows the local Auth work. The production capacity and recovery gates remain open. [Migration plan](../migration/implementation-plan.md#journey-order)

## Verified locally

- The existing HTTP routes accepted Firebase ID-token fixtures for email, Google, Facebook and phone. Facebook and phone rejected a token from the wrong provider. A verified phone identity reused its legacy Yugm ID, wallet balance and completed profile on both sign-in and `/auth/me`. [Auth route fixture](../../backend-server/apps/api/src/routes/authJourney.characterization.test.ts)
- With production-mode App Check enabled on loopback, the auth mount rejected missing, invalid and consumed tokens. It requested Firebase token consumption on every presented token. An accepted App Check token reached Yugm's independent user-auth check. The Firebase Admin verifier was stubbed. [App Check fixture](../../backend-server/apps/api/src/routes/authAppCheck.characterization.test.ts)
- Android's sign-in uses Firebase before sending its API token. Splash waits for the startup validation callback and derives the destination from the resulting session and profile state. The JVM tests covered signed-out onboarding and login, incomplete-profile setup, completed-profile discovery and local-versus-remote App Check policy. The ViewModel and full device flow were traced in source. [Startup session validation](../../android-client/app/src/main/java/com/yugm/app/ui/viewmodel/MainViewModel.kt)
- The draft mapper had collapsed an omitted session generation into zero. MongoDB treats field presence as significant when revoking older generations. A fresh local D1 binding accepted one fixture user and three imported sessions. All three source states survived, including explicit null, with zero quarantines. Apply the regenerated draft to fresh local databases before using the changed importer. [D1 mapping](../database/mongo-to-relational-mapping.md)

## Security behavior

- The public-key fallback for direct Google tokens previously verified the signature without an app audience. It now requires `GOOGLE_OAUTH_CLIENT_ID`, checks the audience and issuer, and requires expiration. Direct Google clients using this fallback need the approved client ID configured before rollout. The Android client sends Firebase-issued tokens. [Google verification requirements](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- A warmed HTTP auth context remained usable after persisted logout until the process cache expired. The fixture observed that `/auth/me` returned 200 on the warm path, then 401 after advancing the cache clock by 21 seconds. Refresh had already been revoked. Add acceptance checks for cross-instance revocation and overlapping refresh requests. [HTTP auth cache](../../backend-server/apps/api/src/middleware/auth.ts) · [Refresh sequence](../../backend-server/apps/api/src/services/tokens.ts)

## Verification commands

From `backend-server`.

```powershell
npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/authJourney.characterization.test.ts src/routes/authAppCheck.characterization.test.ts src/services/authSessionRules.test.ts src/services/authProfileContract.test.ts src/middleware/appCheck.test.ts src/migration/mappings.test.ts
npm.cmd run typecheck --workspace @yugm/api --workspace @yugm/cloudflare-worker
npm.cmd run schema:d1 --workspace @yugm/api
```

The 27 focused tests and both typechecks passed. The generator reproduced the draft SQL with zero import failures. A separate one-off Wrangler platform proxy check applied the complete draft schema and verified the three auth session rows using the existing importer. The proxy used in-memory storage and local bindings.

From `android-client` with Android Studio's JBR.

```powershell
.\gradlew.bat :feature:auth:testDebugUnitTest --tests com.yugm.app.feature.auth.navigation.StartupDestinationTest :core:api:testDebugUnitTest --tests com.yugm.app.core.api.AppCheckConfigTest --console=plain --max-workers=1 --no-parallel
```

Six JVM tests passed. The full API suite, live providers, deployed Worker, Android device flow and D1-backed auth API parity were outside this pass. The next local slice is the Auth persistence seam, where account generation, session creation/rotation and revocation must preserve the existing API outcomes. No production account, database, deployment or billing operation was performed.

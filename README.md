# Yugm

Yugm is a production-minded MVP for an Indian live social discovery app.

Tagline: **Match the vibe.**

Yugm uses **Yugm Trust Verification** for user safety, fake-profile prevention, host credibility, and verified badges. **Creator Payout KYC** is required only for real-money creator withdrawals. These systems are separate by design; normal dating/social users are not forced through payout KYC.

## Project Layout

- `backend-server/`: Standalone Node.js server project with the API, admin app, shared TypeScript schemas/constants, npm workspace, and Docker Compose services.
- `android-client/`: Standalone Android project containing the canonical Kotlin/Compose app (`com.yugm.app`).

Each project has its own build configuration and dependency manifests. Open `android-client/` in Android Studio, and run npm commands from `backend-server/`.

## Engineering documentation

Start with [AGENTS.md](AGENTS.md) and the [documentation index](docs/INDEX.md). The index links the project context, design system, feature/contract references, and the detailed source-based production audit.

## Backend Setup

### Android emulator with local D1 and R2

Start the loopback Cloudflare Worker on port 4000. It uses Wrangler's local D1 database and R2 buckets. The current Worker covers Auth, Profile, avatars, player cosmetics, the notification inbox and core clan membership. Follow the [local Worker runbook](docs/handoffs/2026-11-24-local-d1-auth-emulator.md) to apply the local schema and configure the Firebase test project. See the [migration handoff](docs/handoffs/2026-11-24-local-d1-r2-app-expansion.md) for remaining journeys.

### Legacy Node API

```bash
cd backend-server
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```

The backend dev command starts the legacy MongoDB-backed API. Use it for the existing admin workflows and compatibility checks. The Node API and loopback Worker normally use the same port, so run the one needed for the current task.

Legacy Render deployments build from `backend-server/` with `npm ci --include=dev && npm --workspace apps/api run build`.

### Backend Environment

```env
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/yugm
MONGODB_DB_NAME=Yugm
REDIS_URL=
JWT_SECRET=replace-me
PAYOUT_KYC_ENCRYPTION_KEY=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=ws://localhost:7880
```

The legacy Node API uses in-memory presence when `REDIS_URL` is empty. The Android debug and production D1 Workers use Cloudflare Rate Limiting bindings and require no Redis connection. [Redis migration status](docs/handoffs/2026-11-24-d1-database-and-redis-boundary.md)

### Admin And Moderation Backend

The backend exposes a secure admin system under `/api/admin/*` for internal staff operations: dashboard stats, user moderation, report review, live room controls, wallet/payment review, gifts, notifications, support, analytics, app config, fraud review, and audit logs.

Admin auth is separate from normal app users and supports Firebase ID token admin login or backend email/password admin login. Seed the first super admin with:

```bash
cd backend-server
npm run seed:admin
```

The native admin UI lives in `backend-server/apps/admin`. Run it next to the API during local development:

```bash
cd backend-server
npm run dev:api
npm run dev:admin
```

Then open `http://127.0.0.1:5173` and sign in with a seeded admin account. The panel talks to `http://127.0.0.1:4000/api/admin` by default; override that with `VITE_ADMIN_API_URL` in `backend-server/apps/admin/.env` for hosted APIs.

Set these env vars before seeding a real super admin:

```env
ADMIN_JWT_SECRET=
ADMIN_REFRESH_SECRET=
SEED_SUPER_ADMIN_EMAIL=
SEED_SUPER_ADMIN_NAME=
SEED_SUPER_ADMIN_FIREBASE_UID=
SEED_SUPER_ADMIN_PASSWORD=
```

More details:

- `docs/admin-system.md`
- `docs/permissions.md`
- `docs/moderation-workflow.md`
- `docs/wallet-ledger.md`

### Database Options

The legacy Node API requires MongoDB. Use an isolated Atlas database or run MongoDB locally with Docker.

**Option A - MongoDB Atlas:**
1. Create a free M0 cluster at https://cloud.mongodb.com
2. Get your connection string and set `MONGODB_URI` in `backend-server/apps/api/.env`
3. Run `npm run seed` once if you want demo catalog/users/rooms in that database

**Option B - Local Docker MongoDB:**
```bash
cd backend-server
docker compose up -d mongo redis livekit
npm run seed
npm run dev
```

## Android Client Setup

Open `android-client/` in Android Studio. The native Android app module is `android-client/app`.

For Firebase Auth and FCM, download `google-services.json` from Firebase Console and place it at:

```text
android-client/app/google-services.json
```

Debug builds use emulator loopback at `http://10.0.2.2:4000/api` with a local D1 database named `yugm` and simulated R2. Release builds use `YUGM_PRODUCTION_ORIGIN` for API and socket addresses. The production Worker config binds the hosted D1 database `yugm` and five hosted R2 buckets. Full API parity and production rollout are pending. [D1 and Redis migration status](docs/handoffs/2026-11-24-d1-database-and-redis-boundary.md) · [Hosted R2 and endpoint coverage](docs/handoffs/2026-11-24-hosted-r2-d1-endpoint-audit.md)

```bash
./gradlew :app:assembleDebug --max-workers=2
```

Release packaging requires the production origin and the Play upload keystore outside source control. The Android release target is API 36. See the [build and signing configuration](docs/features/release-build-configuration.md).

### Publish an APK to GitHub Releases

Create a signed tag such as `v1.2.3` and push it to GitHub:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The `Android Release` workflow builds a signed production APK, assigns its app version from the tag, and attaches it to the matching GitHub Release. Set the repository Actions variable `YUGM_PRODUCTION_ORIGIN` and add these Actions secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Base64-encoded Play upload `.jks` keystore |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_UPLOAD_KEY_ALIAS` | Upload key alias |
| `ANDROID_UPLOAD_KEY_PASSWORD` | Upload key password |

Encode the keystore locally with `base64 -w 0 yugm-upload.jks` on Linux/macOS, or `[Convert]::ToBase64String([IO.File]::ReadAllBytes('yugm-upload.jks'))` in PowerShell. Keep the keystore and its passwords private. Tags must follow `vMAJOR.MINOR.PATCH`, with the minor and patch numbers below 1000.

Firebase ID tokens are verified using the Firebase project ID. The production Worker requires Firebase Admin credentials to validate and consume App Check tokens. Grant the Firebase App Check Token Verifier role to the service account and register the release signing certificate. The recorded GitHub release APK certificate SHA-256 is `f12c860597aea05a8ffdcce67416b95dc207be707ad821f93c76807679ca426a`. Confirm it against the APK before publishing. For off-Play APK distribution, use Play Integrity settings that support off-Play installs and link the Play Integrity API to the same Google Cloud project. [Firebase's Android provider guide](https://firebase.google.com/docs/app-check/android/play-integrity-provider)

See [the Play Store release checklist](docs/play-store-release-checklist.md) for the remaining Play Console and account setup steps.

Email sign-in and account creation use Firebase Authentication's Email/Password provider; phone sign-in uses Firebase Phone Auth. Enable both providers in the Yugm Firebase project and configure phone verification for the app. The app exchanges the resulting Firebase ID token with the API, which creates a Yugm profile on first sign-in. Google sign-in also creates a profile automatically. Email OTP is reserved for development because the production API does not send email codes.

## Firebase Auth Setup

Google Sign-In and Phone Auth require a Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com) and create or select your project
2. Enable Google and Phone in Authentication > Sign-in method
3. Optional push notification setup: Project Settings > Service Accounts > Generate new private key, then set `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` in the backend environment. Firebase ID-token verification works without this key; `FCM_PROJECT_ID` defaults to `yugm-e985e` and can be overridden if the Firebase project changes.
4. Android app for native Android:
   - Package name: `com.yugm.app`
   - Place `google-services.json` in `android-client/app/`
5. Configure the OAuth client IDs required by the native Android sign-in flow.

## Legacy LiveKit Local Development

```bash
cd backend-server
docker compose up -d livekit
```

For LiveKit Cloud, copy the project WebSocket URL, API key, and API secret into `backend-server/apps/api/.env`. Only the API should know the API secret; the clients receive short-lived room tokens from `/api/livekit/token`.

The D1 Worker does not yet serve room media sessions. The RealtimeKit server client is tested with simulated responses, and Android RTC integration is pending. [Production RTC migration](docs/handoffs/2026-11-24-production-cloudflare-builds.md)

## Useful Scripts

Backend:

```bash
cd backend-server
npm run dev
npm run dev:api
npm run env:check
npm run seed
npm run typecheck
npm run test
```

Native Android:

```bash
cd android-client
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
./gradlew :app:lintDebug
./gradlew :app:bundleRelease
```

## MVP Notes

- Email OTP uses `DEV_BYPASS_OTP` only in development; Firebase Google/Phone auth is the production path.
- Wallets are ledger-based. Coin movement is handled by the API, not the client.
- Socket.IO handles room chat, gifts, reactions, moderation, and presence.
- LiveKit is abstracted behind backend token generation and mobile media client modules so Agora/Twilio/Daily can be added later.

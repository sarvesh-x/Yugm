# Yugm

Yugm is a production-minded MVP for a Gen Z Indian live social discovery app.

Tagline: **Match the vibe.**

## Project Layout

- `backend-server/`: Node.js API server, shared TypeScript schemas/constants, npm workspace, and Docker Compose services.
- `android-client/app/`: Native Android client built with Kotlin, Jetpack Compose, Firebase, Socket.IO, and LiveKit.
- `android-client/expo-mobile/`: Expo React Native client prototype.

## Backend Setup

```bash
cd backend-server
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```

The backend dev command starts the API server.

### Backend Environment

```env
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/yugm
MONGODB_DB_NAME=Yugm
REDIS_URL=
JWT_SECRET=replace-me
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=ws://localhost:7880
CORS_ORIGIN=http://localhost:8081
```

Redis is optional for the MVP; the API uses in-memory presence if `REDIS_URL` is empty.

### Database Options

Yugm requires a real MongoDB database. Use Atlas for hosted development/production, or run MongoDB locally with Docker.

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

Debug builds use the Android emulator backend by default:

```text
http://10.0.2.2:4000/api
```

For production/release builds, provide the deployed backend URLs:

```bash
YUGM_API_BASE_URL=https://your-backend.onrender.com/api \
YUGM_SOCKET_BASE_URL=https://your-backend.onrender.com \
./gradlew :app:assembleRelease
```

Use `https://.../api` for `YUGM_API_BASE_URL` and the same host without `/api` for `YUGM_SOCKET_BASE_URL`.

## Expo Client Setup

```bash
cd android-client/expo-mobile
npm install
cp .env.example .env
npm run android
```

### Expo Environment

```env
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
EXPO_PUBLIC_LIVEKIT_URL=ws://localhost:7880

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

For Android emulator, replace localhost values with `10.0.2.2`.

## Firebase Auth Setup

Google Sign-In and Phone Auth require a Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com) and create or select your project
2. Enable Google and Phone in Authentication > Sign-in method
3. Service account for backend: Project Settings > Service Accounts > Generate new private key, then copy `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` into `backend-server/apps/api/.env`
4. Android app for native Android:
   - Package name: `com.example.yugm`
   - Place `google-services.json` in `android-client/app/`
5. Web client ID for Expo Google Sign-In:
   - Put the web client ID in `android-client/expo-mobile/.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - Put the Android client ID in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## LiveKit Local Development

```bash
cd backend-server
docker compose up -d livekit
```

For LiveKit Cloud, copy the project WebSocket URL, API key, and API secret into `backend-server/apps/api/.env`. Only the API should know the API secret; the clients receive short-lived room tokens from `/api/livekit/token`.

## Useful Scripts

Backend:

```bash
cd backend-server
npm run dev
npm run dev:api
npm run env:check
npm run seed
npm run typecheck
```

Expo client:

```bash
cd android-client/expo-mobile
npm run android
npm run typecheck
```

Native Android:

```bash
cd android-client
./gradlew test
./gradlew assembleDebug
```

## MVP Notes

- OTP is mocked with code `123456`, but auth routes are structured for a real provider.
- Wallets are ledger-based. Coin movement is handled by the API, not the client.
- Socket.IO handles room chat, gifts, reactions, moderation, and presence.
- LiveKit is abstracted behind backend token generation and mobile media client modules so Agora/Twilio/Daily can be added later.

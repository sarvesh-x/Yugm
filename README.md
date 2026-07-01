# Yugm

Yugm is a production-minded MVP for a Gen Z Indian live social discovery app.

Tagline: **Match the vibe.**

## Stack

- `apps/mobile`: Expo, React Native, Expo Router, Zustand, TanStack Query, Socket.IO client, LiveKit-ready media adapter.
- `apps/api`: Node.js, Express, TypeScript, MongoDB/Mongoose, Socket.IO, JWT, Zod, LiveKit server SDK.
- `packages/shared`: shared roles, room types, event names, Zod schemas, and demo constants.

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
npm run dev
```

The root `npm run dev` starts the API and Expo app together.

## Backend Environment

```env
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/yugm
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

**Option A - MongoDB Atlas (recommended for deployment):**
1. Create a free M0 cluster at https://cloud.mongodb.com
2. Get your connection string and set `MONGODB_URI` in `.env`
3. Run `npm run seed` once if you want to populate demo catalog/users/rooms in that database

**Option B - Local Docker MongoDB:**
```bash
docker compose up -d mongo redis livekit
npm run seed
npm run dev
```

## Mobile Environment

```env
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
EXPO_PUBLIC_LIVEKIT_URL=ws://localhost:7880

# Google Sign-In - get from Firebase Console > Project Settings > General > Your apps
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

For Android emulator, replace localhost values with `10.0.2.2`.

## Firebase Auth Setup

Google Sign-In and Phone Auth require a Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com) and create or select your project
2. Enable authentication methods:
   - Google: Authentication > Sign-in method > Google > Enable
   - Phone: Authentication > Sign-in method > Phone > Enable
3. Service account for backend: Project Settings > Service Accounts > Generate new private key, then copy `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` into `apps/api/.env`
4. Android app for native Android module:
   - Project Settings > General > Add app > Android
   - Package name: `com.example.yugm`
   - Download `google-services.json` and place it in the `app/` directory
5. Web client ID for Expo Google Sign-In:
   - Project Settings > General > Your apps > Web client ID, then use it as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env`
   - Android client ID listed under Android apps, then use it as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## LiveKit Local Development

Run LiveKit locally with the included Compose file:

```bash
docker compose up -d livekit
```

For LiveKit Cloud, copy the project WebSocket URL, API key, and API secret into `apps/api/.env`. Only the API should know the API secret; the mobile app receives short-lived room tokens from `/api/livekit/token`.

## Useful Scripts

```bash
npm run dev
npm run dev:api
npm run dev:mobile
npm run seed
npm run typecheck
```

## MVP Notes

- OTP is mocked with code `123456`, but auth routes are structured for a real provider.
- Wallets are ledger-based. Coin movement is handled by the API, not the client.
- Socket.IO handles room chat, gifts, reactions, moderation, and presence.
- LiveKit is abstracted behind backend token generation and mobile media client modules so Agora/Twilio/Daily can be added later.

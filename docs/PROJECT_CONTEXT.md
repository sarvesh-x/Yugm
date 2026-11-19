# Project context

## Product

Yugm describes itself as an Indian live social discovery app with the tagline “Match the vibe.” The repository includes social discovery, messaging, live rooms, gifting/wallet, creator, event, and safety/moderation capabilities. Feature presence in source is not proof that a complete user journey works. Trust Verification and creator payout KYC are separate by design; payout KYC applies to real money withdrawals, not ordinary social use.

## Repository and stack

- `android-client/`: Native Android app, package `com.yugm.app`, built with Kotlin, Jetpack Compose, AndroidX, Hilt and KSP. Gradle includes `app`, six `core` modules and fourteen feature modules; see `settings.gradle.kts` for the exact list.
- `backend-server/`: Independent Node.js 22+ / npm workspace. `apps/api` is TypeScript, Express, Mongoose and MongoDB; `packages/shared` contains shared TypeScript schemas/constants; `apps/admin` is a Vite/React admin client. The API uses Socket.IO and optional Redis/BullMQ, Firebase/FCM, LiveKit and payment/storage providers.
- `render.yaml` and GitHub workflows describe deployment automation. They do not prove the currently deployed state. `docs/production/` documents important environment and rollout limits.

## Local development

See [README.md](../README.md), [Android README](../android-client/README.md), and [backend README](../backend-server/README.md). Run backend npm commands from `backend-server/`; open `android-client/` in Android Studio. Keep credentials in local configuration and out of docs/source.

## Architecture landmarks

- Android app startup/navigation: `android-client/app/src/main/java/com/yugm/app/MainActivity.kt`, `app/.../navigation/`, feature navigation graphs.
- Shared Android UI foundation: `android-client/core/ui/src/main/java/com/yugm/app/core/ui/theme/` and `.../components/`.
- Android API/data foundation: `android-client/core/api/`, `core/data/`, and Hilt modules.
- Backend HTTP composition: `backend-server/apps/api/src/app.ts`; process startup: `src/index.ts`.
- Backend routes, services, models, and middleware: `backend-server/apps/api/src/{routes,services,models,middleware}`.
- Shared API/socket schemas and constants: `backend-server/packages/shared/src/index.ts`; API schema documentation: `backend-server/apps/api/openapi.yaml`.
- Detailed static route/socket/schema inventories and known audit limitations: [production audit](production/README.md).

## Constraints and evidence

The Android project has a documented history of expensive Kotlin and lint work; inspect statically first and use bounded verification. Backend transactions require a Mongo topology that supports them; the bundled standalone Compose Mongo does not establish that. Production database state, runtime configuration, provider behavior, and deployment status are not verified by this repository overview.

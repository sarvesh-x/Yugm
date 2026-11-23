# Realtime contracts

## Existing sources

- Shared event names: `backend-server/packages/shared/src/index.ts` (`socketEvents`).
- Server connection, room membership, presence, typing, cleanup, and emission: `backend-server/apps/api/src/services/socket.ts` and adjacent services/routes.
- Android account socket: `android-client/core/api/.../SocketManager.kt`.
- Android room socket: `android-client/core/api/.../YugmSocket.kt`; check current room-mode ownership in source and `docs/production/current-progress.md`.
- Static registration inventory: [production/socket-inventory.csv](production/socket-inventory.csv).

## Contract rules

For each changed event document the producer, recipient authorization, payload schema, triggering command, ephemeral/durable nature, ordering/deduplication needs, reconnect recovery, and listener cleanup. Validate subscriptions and sensitive emissions against current permission/session rules. Socket success must not substitute for a durable server command result. Assume transient disconnects and duplicated delivery unless the transport and protocol establish otherwise.

The inventory lists only syntactically discovered registrations and is not proof of complete recovery or client handling. Existing audit gaps include session revocation parity, typing policy, notification dedupe, and durable event recovery; see the current progress and finding register.

## Badge showcase invalidation

A successful authenticated `PUT /api/experience/badges/showcase` emits `sync:invalidate` with `{ topics: ["TASKS", "PROFILE"] }` to the actor's user room and broadcasts a topic-only `{ topics: ["PROFILE"] }` to connected clients. The payload contains no badge IDs, user IDs, or other user data. This is an ephemeral invalidation, not proof of commit and not a badge snapshot: Android `AppSync` coalesces it by topic revision, and the Achievements/profile screens re-read their scoped badge endpoints. Reconnect handling performs the same authorized re-read through `AutomaticSyncEffect`.

## Managed R2 media invalidation

A successful `POST /api/media/uploads/{sessionId}/complete` emits the same actor-scoped `sync:invalidate` topics as legacy `/api/upload/avatar`: `PROFILE` and `TASKS`. Session creation, cancellation and download are silent. The invalidation contains no media IDs, keys, signed URLs or user data; clients re-read the authoritative profile. The HTTP completion response remains the proof of commit.

## Bonds invalidation

A successful authenticated mutation under `/api/bonds/*` emits actor-scoped `sync:invalidate` with `{ topics: ["BONDS", "PROFILE", "TASKS"] }`. The payload contains no bond IDs, user IDs or other user data; Android `AppSync` treats `BONDS` like `GIFTS` and also invalidates `WALLET`, then screens re-read authorized endpoints. This is an ephemeral invalidation, not proof of commit. It closes the DCR-3 decision that existing Android BONDS listeners need a server emitter.

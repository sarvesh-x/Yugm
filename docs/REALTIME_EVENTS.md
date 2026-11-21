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

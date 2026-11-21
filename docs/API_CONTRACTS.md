# API contracts

## Sources of truth

- Backend route implementations and mounted order: `backend-server/apps/api/src/app.ts` and `src/routes/`.
- Shared runtime schemas/constants used across packages: `backend-server/packages/shared/src/index.ts`.
- OpenAPI contract: `backend-server/apps/api/openapi.yaml`.
- Android API facade and feature APIs: `android-client/core/api/`.
- Full static route declaration inventory: [production/endpoint-inventory.csv](production/endpoint-inventory.csv).

Do not hand-maintain a second route list as authoritative. The CSV is generated evidence: mounted paths can overlap, be shadowed, or require middleware-order review. Confirm the actual client request and Express mount when changing an endpoint. Keep OpenAPI, shared schemas, server behavior, and consumers aligned; document auth, authorization, errors, side effects, and idempotency for changed commands.

## Error format

The API has more than one response envelope in existing paths. Inspect `src/utils/http.ts`, app error middleware, and the specific route before assuming a universal shape. `requestId` is included by the central app error path. New or modified paths should use the existing helpers consistently and preserve client compatibility deliberately.

## Bonds contract (single inner-circle state)

- `/api/bonds` is the only source of truth for the unified three-slot Bonds circle. `GET /api/bonds/me` returns the server `capacity` (`YUGM_BOND_SLOTS` / `bondConfig.capacity`, default `3`), active bonds, pending requests, ended history, and preferences. The former `GET /api/users/me/close-friends` and `POST|DELETE /api/users/:id/close-friend` routes are removed; `User.closeFriendIds` is removed.
- `GET /api/users/me/friends` returns accepted friendships only. Each user carries a transient `isOnline` from socket presence; it is not persisted on `User`.
- Public profile responses derive `bondsCount` from active `Bond` rows and `isBonded` from a caller-target active bond; neither is a persisted `User` flag. `GET /api/users/:id` exposes both, and `PATCH /api/users/me` returns an authoritative `bondsCount`. `bonds:changed` is an invalidation, so clients must re-read scoped `/api/bonds` state instead of treating a card or event as proof of a commit.
- Invitations, acceptance/decline/cancel, gifts, type changes, and ending remain under `/api/bonds/...` with bilateral consent, transaction-fenced slots, and authorization at the resource boundary. See [Bonds](bonds.md) for the command contract.

## Badge showcase contract

- Worn badges are earned cosmetic slots, not claimable progression state. `/api/experience/badges/showcase` uses the server-authoritative capacity of five: `GET /experience/badges`, `GET /experience/badges/showcase/:userId`, and `PUT /experience/badges/showcase` return `data.capacity`. Android falls back to five only when an older API omits the field.
- `PUT /experience/badges/showcase` accepts `{ badgeIds: string[] }` for the authenticated actor only. The server rejects more than five IDs, duplicate IDs, unknown or unearned/expired IDs; a successful response returns the committed `badgeIds` order. There is no client-side proof of wear: public readers re-fetch `/experience/badges/showcase/:userId`.
- Successful badge mutations invalidate `TASKS` and `PROFILE` sync topics for the actor and broadcast a topic-only `PROFILE` invalidation to connected viewers, so an open viewing profile re-reads the changed user's badges. Both the Achievements screen and profile header re-read their scoped endpoints instead of applying an optimistic badge result as authoritative.

## Authentication and profile setup notes

- `/api/auth/google`, `/api/auth/facebook`, and `/api/auth/phone` are mounted behind `requireAppCheck`; the client sends a limited-use App Check token in `X-Firebase-AppCheck`. The API consumes tokens during verification and rejects a replay result. Do not cache the limited-use token or a successful consume verification.
- Local Android debug builds targeting loopback HTTP (`10.0.2.2`, localhost, or loopback) skip App Check token acquisition/header injection. The API middleware already bypasses App Check in `NODE_ENV=development` and `test`. Debug builds targeting remote APIs and all release builds keep App Check enabled. On a production API, verification is controlled by `APP_CHECK_ENFORCE`; confirm it is enabled for production.
- `/api/auth/me` is an authenticated session/user snapshot. Android calls it on cold start with a bounded request, allowing the normal one-time refresh path to reconcile an expired access token before routing. Network/App Check failure is not proof of revocation.
- Auth routes validate Firebase ID-token identity and issue one device session per account generation. `/api/auth/refresh` rotates the refresh token; generation/reuse failures are unauthorized. Keep the user-facing client distinction for another-device/revoked sessions.
- `/api/auth/logout` accepts an optional refresh token and optional current-install FCM `deviceToken`; it removes that user's matching device-token record, advances the account session generation, revokes sessions, and disconnects live sockets. Android clears local state immediately and sends this request best effort, so offline logout cannot guarantee server FCM cleanup.
- Profile setup currently uses `PATCH /api/users/me` (not `/api/auth/profile`) with the shared `profileSchema`. The response user includes authoritative `profileCompleted`. Completion requires nonblank name, username, bio, city, and one interest, unless `profileCompletedAt` already exists. See [auth-flow audit](features/auth-flow-audit.md) before changing these semantics.
- `POST /api/upload/avatar` (authenticated multipart `avatar`) persists a client-thumbnailed image through the configured storage driver and returns `{ url, storage }`. With `STORAGE_DRIVER=s3` plus `S3_ENDPOINT` and `S3_PUBLIC_BASE_URL`, avatars live in the public R2/S3 bucket and `User.avatar` holds the public URL. Successful upload replaces the previous managed object; legacy data URLs remain readable. See [avatar R2 storage](features/avatar-r2-storage.md).

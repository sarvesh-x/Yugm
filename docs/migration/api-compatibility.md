# API and client compatibility plan

**Date:** 2026-11-22  
**Status:** Phase 0 compatibility contract. No endpoint has been moved to a new runtime in this phase.

## 1. Sources of truth

- Current source: `backend-server/apps/api/src/app.ts` and `src/routes/*`.
- Shared schemas/constants: `backend-server/packages/shared/src/index.ts`.
- OpenAPI: `backend-server/apps/api/openapi.yaml` (currently 90 path objects, including four `/api/media` paths).
- Android call sites: `android-client/core/api/` and feature repositories.
- Admin call sites: `backend-server/apps/admin/src/api.ts` and view components.
- Historical generated inventory: [endpoint inventory](../production/endpoint-inventory.csv) (566 static rows at its baseline; predates `/api/media/*`).

Do not treat the CSV or OpenAPI alone as runtime truth. Middleware order, overlapping mounts and auth can change effective behavior.

Known current quirks to preserve or explicitly retire: `eventsRouter` is double-mounted at `/api/events` and `/api`; the payout webhook is mounted with a raw body before `express.json`, while payment and Google Play webhook handlers are implemented but unmounted; admin routers after `adminRouter` rely on its late `requireAdminAuth` middleware having populated `req.admin`.

## 2. Compatibility policy

| Change type | Policy |
|---|---|
| Additive response fields | Allowed only when existing Android/admin models ignore unknown fields. Document the field and fallback. Cosmetic/badge asset fields follow this rule. |
| New endpoints | Allowed; clients opt in. Managed media endpoints use this rule with a narrow legacy fallback. |
| Error code/status change | Breaking unless the old status is preserved for the old client version. Requires an explicit compatibility matrix and client release window. |
| Response envelope change | Breaking. The API currently has more than one envelope; preserve the specific route's shape and `requestId` behavior. |
| Auth/authorization change | Requires resource-level tests and old-client regression coverage. Never relax a boundary to keep a client working. |
| Removed endpoint | Breaking. Only the already accepted close-friends removal is in this category. |
| Event name/payload change | Breaking for Socket.IO clients unless dual-published or versioned. See [realtime plan](realtime-plan.md). |
| Price/eligibility/signed URL from client | Always reject; these are server-authoritative. |

## 3. Existing compatibility decisions to preserve

- **Auth:** `/api/auth/google|facebook|phone|refresh|logout|me`, limited-use Firebase App Check in `X-Firebase-AppCheck`, one device session per account generation, and one-time refresh rotation. Debug loopback behavior must not leak into remote/release builds.
- **Profile:** profile setup uses `PATCH /api/users/me`, not `/api/auth/profile`; `profileCompleted` is authoritative.
- **Bonds:** `/api/bonds` is the only inner-circle source; close-friends routes and `User.closeFriendIds` are intentionally removed. `bondsCount` and `isBonded` are derived, not persisted flags.
- **Badges:** capacity is server-sourced with an Android fallback of five. Showcase mutations are actor-scoped and invalidate rather than push badge snapshots.
- **Assets:** cosmetic/badge `assetId`, `assetVersion` and `assetVariants[]` are additive DTO fields; legacy `assetUrl`/`imageUrl` remains fallback. Legacy badge `imageData`/`imageMime` and `/api/badge-art/:id/:version` remain until separately approved cutover.
- **Media:** managed upload endpoints are additive. Android falls back to `/api/upload/avatar` only when session creation returns `503`/`501`; later failures surface. Staging grants and private download URLs are short-lived and never persisted or logged.
- **Admin:** `/api/admin/*` routes, RBAC, audit helpers and session handling must remain functionally identical. Admin UI permission gating is cosmetic; server RBAC is the boundary.

## 4. High-risk endpoint classes

| Class | Examples | Compatibility requirements |
|---|---|---|
| Session/auth | `/api/auth/*`, `/api/admin/auth/*` | Preserve token/refresh/generation semantics, App Check consume behavior, 2FA challenge and session revocation. Test old clients during transition. |
| Money and entitlement | `/api/wallet/*`, `/api/gifts/*`, `/api/subscriptions/*`, payment webhooks | Preserve status codes, error codes, idempotency and response payloads. No client-supplied price/currency/discount/availability. Verify authoritative commit before success. |
| Media | `/api/media/uploads`, `/complete`, cancel, `/media/:id/download`, legacy `/api/upload/avatar` | Grant non-disclosure, short-lived URLs, ownership/membership checks, quota semantics, fallback boundary, no signed URL in DTO or logs. |
| Admin mutations | `/api/admin/assets/*`, `cosmetics`, `badges`, `wallet`, `payments`, `withdrawals` | Preserve RBAC, audit entries, dual-approval rules and status codes. Fix mount-order fragility without changing effective permissions. |
| Realtime-triggering commands | badge showcase, profile/media completion, gifts, room/Pk commands | HTTP result remains proof of commit; socket event is invalidation only. Preserve event names/payloads until protocol decision. |
| List/search | `/api/users`, `/api/discover`, admin lists | Preserve pagination/query parameter names and ordering; enforce bounded result sizes for D1/Postgres. |
| Derived/count fields | `bondsCount`, `isOnline`, badge `capacity`, asset variant URLs | Continue deriving at read time; do not persist stale client-facing copies. |

## 5. Old/new comparison harness

Before any domain cutover, build a contract harness that runs the same authenticated scenarios against the legacy route and the Worker-backed route:

1. **Request parity:** method, path, headers, auth/App Check, body schema and query parameters.
2. **Response parity:** status, envelope, field names/types, nullable behavior, pagination metadata and error codes.
3. **Authorization parity:** anonymous, wrong user, wrong role, blocked/banned, expired session, resource-not-owned and admin superadmin cases.
4. **Side effects:** database rows, ledger entries, ownership changes, media references and audit logs.
5. **Idempotency/replay:** duplicate request keys, webhook replay, duplicate media completion and concurrent wallet/gift commands.
6. **Realtime:** events emitted or suppressed, topics, actor scope and payload redaction.
7. **Performance:** row reads/writes, query count, R2 operations, DO requests and p95 latency compared with capacity estimates.
8. **Old-client acceptance:** the currently shipped Android and admin builds must pass against the new backend without modification for the support window.

Differences must be recorded as accepted or blocking. A difference is not accepted because a doc says so; it needs an owner decision and client impact analysis.

## 6. Client caller map

| Client area | Call sites | Notes |
|---|---|---|
| Android auth/profile | `core/api` auth/user APIs, `feature/auth`, `feature/profile` | Preserve auth envelope, profile completion, avatar fallback and `PROFILE` invalidation re-read. `ProfileDetailScreen` reads only `avatarUploadBusy`; it does not consume progress or call `cancelOwnAvatarUpload()`. |
| Android social/chat/rooms | `feature/social`, `feature/chat`, `feature/room`, `core/api` socket managers | Preserve Socket.IO event names; add recovery cursors only after protocol decision. Android emits a `BONDS` sync topic the server mapping does not produce. |
| Android finance/gifts/assets | `feature/wallet`, `feature/gift`, `core:ui AssetArtwork` | Ignore additive asset fields; never trust client prices; preserve error states/retry. Client holds VIP thresholds, gift box prices and a `coinToInrRate` fallback (`0.01`) that must not become authoritative. |
| Android cross-cutting | 103 direct API calls across 32 screens/nav graphs; API clients are mostly Kotlin `object` singletons | Contract changes cannot be contained behind a repository boundary. `resolveMediaUrl()` (`ApiConfig.kt:22`) passes absolute R2 URLs through unchanged but is applied inconsistently across parsers; audit hardcoded media hosts at cutover. |
| Admin SPA | `admin/src/api.ts`, inline views in `App.tsx` | Preserve `{ success, data, meta, error }`, Bearer session/refresh, 2FA and RBAC. Reuse `DataTable`/`SimpleResource`; do not introduce a second shell. |
| External providers | Firebase, Google Play, Razorpay, LiveKit webhooks/callbacks | Verify signatures, preserve idempotency and reconcile against authoritative server state. |

## 7. Cutover rules

- Move one domain at a time behind a flag/adapter; keep the old repository available for rollback during the validation window.
- Do not switch clients until contract comparison, data validation and rollback rehearsal pass in staging.
- Keep auth/session and financial domains last or separately gated; a mistake there invalidates all other acceptance.
- Do not delete legacy routes or fields until the old-client support window ends and migration acceptance is signed off.
- Worker deploy rollback does not roll back data; data and code rollback plans must be separate and rehearsed.

## 8. Exit criteria

- Every migrated endpoint has an old/new parity record with no unaccepted differences.
- OpenAPI validation passes and matches route behavior for changed paths.
- Android callers and admin callers are mapped to every changed path/event.
- Financial, media and admin mutation side effects are verified against authoritative storage, not just HTTP status.
- Old clients pass compatibility tests; breaking changes have explicit approval and a versioned transition.

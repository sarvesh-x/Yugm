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

## Authentication and profile setup notes

- `/api/auth/google`, `/api/auth/facebook`, and `/api/auth/phone` are mounted behind `requireAppCheck`; the client sends a limited-use App Check token in `X-Firebase-AppCheck`. The API consumes tokens during verification and rejects a replay result. Do not cache the limited-use token or a successful consume verification.
- `/api/auth/me` is an authenticated session/user snapshot. Android calls it on cold start with a bounded request, allowing the normal one-time refresh path to reconcile an expired access token before routing. Network/App Check failure is not proof of revocation.
- Auth routes validate Firebase ID-token identity and issue one device session per account generation. `/api/auth/refresh` rotates the refresh token; generation/reuse failures are unauthorized. Keep the user-facing client distinction for another-device/revoked sessions.
- Profile setup currently uses `PATCH /api/users/me` (not `/api/auth/profile`) with the shared `profileSchema`. The response user includes authoritative `profileCompleted`. Completion requires nonblank name, username, bio, city, and one interest, unless `profileCompletedAt` already exists. See [auth-flow audit](features/auth-flow-audit.md) before changing these semantics.

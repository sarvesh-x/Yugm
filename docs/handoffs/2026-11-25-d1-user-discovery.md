# D1 user discovery and profile-media

- **Date:** 2026-11-25
- **Slice:** Mount 6 legacy `/api/users` routes on the shared D1 Worker: search, hosts suggested, recommended chat, PK history, profile-media add/delete.

## What changed

- Added `backend-server/apps/api/src/migration/d1UserDiscovery.ts` and mounted it in `backend-server/apps/api/src/migration/d1App.ts` at `/api/users`.
- Routes: `GET /search`, `GET /hosts/suggested`, `GET /recommended-chat`, `GET /:userId/pk-history`, `POST /me/profile-media`, `DELETE /me/profile-media/:mediaId`.
- Added coverage to `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs`.

## Behavior preserved

- Auth required; legacy validation preserved (search q min 2 chars, profile-media schema with `type` default IMAGE, caption max 140).
- Search: escaped LIKE, block filtering, scope=username support, legacy sort, vip/level/status/following enrichment.
- Hosts suggested: excludes self/following/blocked, host/mod/admin roles, legacy sort, `isFollowing: false`.
- Profile-media: D1 `user_profile_media` insert at position 0 with shift/slice to 24; delete repacks positions; response returns serialized public profile and added media.
- PK history: reuses `d1RoomPkHistory` projection/presenter for ended/force-ended battles, limit 50.

## Boundaries

- `GET /recommended-chat` returns empty `{ users: [] }` on D1 Worker because there is no Socket.IO/Redis live-presence source; legacy returns empty when no online IDs are available. Presence migration remains required for live discovery.
- No new migration; uses existing `user_profile_media` and `pk_battles` tables.

## Verification

- `npm.cmd run typecheck` (backend-server) — passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 561 D1 / 555 matched / 83 missing; `/api/users` 48 mounted / 5 missing.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed on rerun (1/1). First rerun after adding routes hit intermittent unrelated `d1-reports` count assertion; final rerun passed.
- `npm.cmd run secrets:check:strict` — passed.
- Scoped `git diff --check` — passed.

## Remaining `/api/users` routes

- `DELETE /api/users/me` (account deletion, sensitive)
- `GET /api/users/friend-match` / `POST /api/users/friend-match/search` / `POST /api/users/friend-match/cancel` (pairing/room creation/realtime)
- `POST /api/users/messages/:userId/call` (call/LiveKit flow)
# 2026-11-25 — D1 admin config and audit-log routes

## Scope

Ported the first bounded `/api/admin` slice to the local MongoDB-free D1 Worker: the four config routes and the paginated audit-log read. MongoDB remains authoritative for the deployed legacy runtime until route/job parity, reconciliation, recovery rehearsal and live acceptance pass. Work stayed on `master`; all pre-existing staged/unstaged changes and untracked files were preserved. No commit, push, deploy, provision, hosted migration, credential rotation or production data operation was performed.

## Changes applied

- Added `backend-server/apps/api/src/migration/d1AdminAuth.ts`, a host-neutral admin guard. It verifies the legacy HS256 `type: "admin"` access token with Web Crypto, then checks the active `admin_users` row, unrevoked/unexpired `admin_sessions` row and permissions derived from role plus `admin_role_permissions`. `ADMIN_JWT_SECRET` is forwarded from the Worker binding and falls back to `JWT_SECRET`, matching legacy secret precedence.
- Added `backend-server/apps/api/src/migration/d1AdminConfig.ts` and mounted it at `/api/admin`. It covers `GET /config`, `GET /config/:key`, `PUT /config/:key`, `DELETE /config/:key` and `GET /audit-logs`. Authorization runs before body validation, as in the legacy router. Config writes keep the legacy `{ config }` / `{ deleted }` payload and non-fatal audit writes; audit reads join `admin_users` for the populated admin fields and use the legacy `{ success, data, meta }` envelope.
- Added the `/api/admin` error-envelope case to the D1 error handler so admin failures use `{ success: false, error }` while user routes keep `{ ok: false, error }`.
- Added `0009_app_config_key_unique.sql` to restore the source `AppConfig.key` uniqueness guarantee, and added it to both local fixture migration lists.
- Added `backend-server/apps/cloudflare-worker/test/d1-admin.mjs` and wired it into `auth-worker.mjs`. The fixture creates two admins, checks missing/user/insufficient-permission auth, confirms auth precedes validation, verifies config create/update/delete and D1 rows, checks audit filtering/pagination/populated admin, verifies a second delete is still audited, and rejects an expired admin session.

## Legacy parity reviewed

Source: `backend-server/apps/api/src/routes/admin.ts:1624-1649`, `middleware/adminAuth.ts`, `modules/admin/{http,permissions}.ts`, `services/adminAudit.ts` and `models/AppConfig.ts`.

Deliberate details preserved: admin errors use `success: false`; validation failures are 422; a missing config read returns `data: null`; both successful and no-op deletes write `config.deleted` audits; config JSON mirrors the Mongoose projection; and audit failures do not fail the request. The unique config-key index is newly explicit in D1 because the generated base schema omitted the Mongoose uniqueness constraint.

No 2FA or dual-approval route was in this slice. Audit rows use source IDs; non-ObjectId entity IDs move into metadata, matching `auditLog()`. The legacy `GET /api/admin/progression/health` ordering oddity and the other 210 admin patterns are out of scope.

## Verification actually run

- `node --check` on `test/d1-admin.mjs` and `test/auth-worker.mjs` — passed.
- `npm.cmd run typecheck --workspace @yugm/api` and `--workspace @yugm/cloudflare-worker` — passed (both Worker tsconfigs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed 1/1 with the new admin fixture and migration `0009` applied locally.
- `npm.cmd run test:production-worker` — passed 1/1 with `0009` included in the local migration set. `npm.cmd run test:push-queue` — passed 6/6.
- `npm.cmd test` from `backend-server` — admin 9/9, API 515/515, shared 27/27, zero failures.
- `npm.cmd run dry-run:production --workspace @yugm/cloudflare-worker -- --outdir "C:\Users\longl\AppData\Local\Temp\opencode\d1-worker-bundle-check4"` — emitted the D1 bundle. Grep found **0** imports/requires of `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `sharp`, `livekit-server-sdk` or `redis-adapter`, and no `createRequire(import.meta.url)`.
- `npm.cmd run audit:d1-endpoints -- --missing` from `backend-server` — `legacy 638 / d1 176 / matched 171 / missing 467`; `/api/admin` is now `5 mounted / 210 missing` and `/api/rooms` stays `40 / 19`. Exit `1` is expected while legacy-only patterns remain.
- `git diff --check` — no errors, only pre-existing LF/CRLF notices.

## Not run / still open

- Hosted migration `0009`, live admin panel acceptance, deployed smoke tests and data import were not performed. Hosted `0003` through `0009` remain pending.
- 210 admin patterns remain, including users/profiles, rooms/PK, moderation, finance, analytics, catalog/media, notifications, support and trust verification. Finance and media admin slices need separate risk review.
- D1 still has no general realtime emitter, so admin side effects that previously emitted sockets remain out of this slice.

## Next action

Continue with the next bounded admin group only after reviewing its coupling, or return to the 19 remaining `/api/rooms` patterns. Rerun `npm.cmd run audit:d1-endpoints -- --missing` after each group. Keep MongoDB authoritative and do not deploy, provision or touch hosted data without separate authorization.

# 2026-11-25 — D1 admin support routes

## Scope

Ported the six `/api/admin/support` patterns to the local MongoDB-free D1 Worker: ticket list, ticket detail, admin reply, status update, assignment and stats. MongoDB remains authoritative for the deployed legacy runtime until route/job parity, reconciliation, recovery rehearsal and live acceptance pass. Work stayed on `master`; all pre-existing staged/unstaged changes and untracked files were preserved. No commit, push, deploy, provision, hosted migration, credential rotation or production data operation was performed.

## Changes applied

- Extracted the admin guard and audit-row helper from `d1AdminConfig.ts` into `d1AdminAuth.ts`. `createD1AdminGuard(db, secret)` now returns a permission-bound middleware, and `insertD1AdminAudit()` writes the same `admin_audit_logs` shape used by both config and support routes. Authentication still runs before permission checks and `validateBody`, matching the legacy middleware order.
- Added `d1AdminSupport.ts` and mounted it at `/api/admin` after the config router. It preserves the legacy `{ success, data, meta }` envelope, `support.read` / `support.reply` permissions, status/priority/category/q filters, pagination, populated detail reads, reply-driven `OPEN` → `IN_PROGRESS` transition, `RESOLVED` timestamp, assignment default and stats counts. Reply, status and assignment audits are awaited and fatal on failure, as in the legacy handlers.
- Added `0010_support_ticket_sender.sql`. The generated `support_ticket_messages.sender_id` column only referenced `users`, but legacy admin replies store an admin ID in that field. Migration `0010` rebuilds the table with nullable `sender_id` and `sender_admin_id` columns and a role/check constraint, preserving existing rows. Both local fixture migration lists now apply through `0010`.
- Updated `mapSupportTicket()` so `ADMIN` child messages populate `sender_admin_id` while `USER` messages populate `sender_id`; added assertions to the moderation mapping test.
- Added `test/d1-admin-support.mjs` and wired it into `auth-worker.mjs`. The fixture covers missing/user/insufficient-permission auth, filter behavior, populated and raw sender IDs, invalid IDs, validation ordering, reply persistence in the corrected columns, audit actions, status/assignment persistence and stats.

## Legacy parity reviewed

Source: `backend-server/apps/api/src/routes/adminSupport.ts`, `middleware/adminAuth.ts`, `modules/admin/{http,permissions}.ts`, `models/SupportTicket.ts` and `models/AdminAuditLog.ts`.

Deliberate details preserved: admin errors use `success: false`; validation failures are 422; a missing ticket returns 404; an invalid `adminUserId` returns 400 before the ticket lookup; an unassigned ticket has no `assignedTo` field in the JSON; non-`RESOLVED` updates preserve an existing `resolvedAt`; and stats count urgent tickets until they are `CLOSED`, not merely resolved. List `q` uses a literal case-insensitive substring, which matches the legacy escaped-regex search. Multiple `category` values are combined as an `OR`, matching the legacy `$in` filter.

Known intentional differences: malformed ticket IDs return an explicit 400 instead of relying on a Mongoose cast error; list ordering uses `updated_at DESC, source_id DESC` for deterministic pagination while legacy sorts only on `updatedAt`; and populated admin senders appear as `null` in ticket detail because legacy populates that field against `User`, while raw action/list responses expose the admin ID string. No socket emission exists in this D1 slice.

## Verification actually run

- `node --check` on `test/d1-admin-support.mjs` — passed.
- `npm.cmd run typecheck --workspace @yugm/api` and `--workspace @yugm/cloudflare-worker` — passed (both Worker tsconfigs).
- `npx.cmd tsx --test src/migration/mappings-moderation.test.ts` from `apps/api` — passed 12/12, including the new admin-sender assertions.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed 1/1 with the support fixture and migration `0010` applied locally.
- `npm.cmd run test:production-worker` — passed 1/1 with `0010` in the local migration set. `npm.cmd run test:push-queue` — passed 6/6.
- `npm.cmd test` from `backend-server` — admin 9/9, API 515/515, shared 27/27, zero failures.
- `npm.cmd run dry-run:production --workspace @yugm/cloudflare-worker -- --outdir "C:\Users\longl\AppData\Local\Temp\opencode\d1-worker-bundle-check6"` — emitted the D1 bundle. Grep found **0** imports/requires of `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `sharp`, `livekit-server-sdk` or `redis-adapter`, and no `createRequire(import.meta.url)`.
- `npm.cmd run audit:d1-endpoints -- --missing` from `backend-server` — `legacy 638 / d1 182 / matched 177 / missing 461`; `/api/admin` is now `11 mounted / 204 missing` and `/api/rooms` stays `40 / 19`. Exit `1` is expected while legacy-only patterns remain.
- `git diff --check` — no errors; only the three pre-existing LF/CRLF notices remain.

## Not run / still open

- Hosted migration `0010`, live admin panel acceptance, deployed smoke tests and data import were not performed. Hosted `0003` through `0010` remain pending.
- 204 admin patterns remain, including users/profiles, rooms/PK, moderation, finance, analytics, catalog/media, notifications and trust verification. Finance and media admin slices need separate risk review.
- D1 still has no general realtime emitter, so any side effects that previously emitted sockets remain out of scope.

## Next action

Continue with the next bounded admin group only after reviewing its coupling, or return to the 19 remaining `/api/rooms` patterns. Rerun `npm.cmd run audit:d1-endpoints -- --missing` after each group. Keep MongoDB authoritative and do not deploy, provision or touch hosted data without separate authorization.

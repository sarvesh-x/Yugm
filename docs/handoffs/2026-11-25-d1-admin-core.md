# 2026-11-25 — D1 admin core routes

## Scope

Mounted the first coherent admin core slice on the shared D1 Worker:

- Users: list, detail, patch, warn, suspend, ban, unban, shadow ban/remove, chat/room restriction, wallet freeze/unfreeze, activity, reports, wallet, rooms, chats, audit.
- Profiles: pending review, detail, approve, reject, verify, remove verification, hide/remove photo, request changes.
- Reports and moderation queue: assign, escalate, dismiss, resolve, report action, queue list/detail, assign, resolve, escalate.
- Messages and direct chats: list, detail, delete, restore, chat history, restrict/unrestrict.
- Rooms: list, live, detail, end, feature/unfeature, lock/unlock, remove/mute/ban participant, participants, messages, gifts, reports, live warning/escalate.

The endpoint audit now reports `/api/admin` at 75 mounted / 140 missing. MongoDB remains authoritative. No hosted migration, data import, deploy, provision, or credential change was performed.

## Behavior preserved

- Admin auth and permission checks run before validation and route work.
- User, profile, report, moderation, message, chat, and room operations use D1 tables and guarded writes.
- Safety status refresh, moderation actions, and admin audit rows are written for the migrated operations.
- Report actions replicate warning, suspend, ban, end-room, dismiss, and escalation behavior without Socket.IO fan-out.
- Rooms lock/unlock update D1 visibility; feature/unfeature and live warning are audit-only because D1 has no admin socket emitter.
- Legacy-only admin surfaces remain on MongoDB, including analytics, payments, withdrawals, creator KYC, trust verification, PK, uploads, media, reactions, badges, assets, cosmetics, gifts, notifications, referrals, and admin user management.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker, and shared workspaces.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, 1/1, including the clean Worker bundle assertion.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; legacy 638 / D1 398 / matched 393 / missing 245; `/api/admin` 75 mounted / 140 missing.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` — passed.

## Boundary

- This is a mount and behavior-preservation slice, not production cutover. MongoDB remains authoritative.
- Hosted verification, legacy data import, deploy, provision, credential changes, and MongoDB retirement are still out of scope.
- D1 has no Socket.IO replacement for admin room warnings, user socket disconnect, clan message cleanup, or other realtime side effects.
- The remaining 140 admin route patterns are still legacy-only.
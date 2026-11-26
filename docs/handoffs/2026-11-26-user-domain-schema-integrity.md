# 2026-11-26 — User-domain schema integrity (D1 migration 0042)

## Scope
First enhancement slice after MongoDB retirement: enforce user-domain data integrity in D1 only. Accepted scope was code + local verification; no hosted migration, deploy or provisioning.

## Changes
- `backend-server/apps/api/migrations/d1/0042_user_domain_integrity.sql`
  - Deduplicates existing `user_owned_cosmetics` rows, then adds a partial UNIQUE index on `(users_id, value)` for non-null values.
  - Adds a partial UNIQUE index on `bonds(pair_key)` where `status = 'ACTIVE'` so only one active bond exists per pair.
  - Adds indexes for `bonds(pair_key, status)`, `bond_requests(status, expires_at)` and `bond_points(kind, created_at)`.
- `backend-server/apps/cloudflare-worker/test/user-domain-integrity.mjs` (new, wired into `test:d1-worker`)
  - Applies `0001_initial.sql` and `0042...` to a fresh Miniflare D1 database.
  - Seeds duplicate ownership rows *before* `0042` to prove the dedup step leaves exactly one row.
  - Proves duplicate ownership and a second ACTIVE bond for the same pair are rejected, an ENDED bond for the same pair is allowed, and all four query indexes exist.
- `auth-worker.mjs` now applies `0042` with the other runtime migrations.

## Verification actually run
- `npm run typecheck` (admin, api, cloudflare-worker, shared) — pass.
- `npm run test:d1-worker` — 3/3 pass (Auth/Worker suite, production worker, new integrity test).
- `node --test apps/cloudflare-worker/test/user-domain-integrity.mjs` — 1/1 pass.

## Not run / open
- Hosted D1 migration 0042 was **not** applied (needs separate authorization).
- The other user-domain slices remain open: `todayXpCap` display bug, VIP expiry notification / banked EXP policy, and clearing all equipped reward-only slots on bond-reward expiry.
- No live API acceptance, no deploy, no commit made in this handoff.

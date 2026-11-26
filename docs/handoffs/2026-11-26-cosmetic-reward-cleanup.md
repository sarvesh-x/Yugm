# 2026-11-26 — Reward-only cosmetic cleanup

## Scope
Final slice in the initially identified user-domain set. Local code + verification only; no hosted changes, deploy or commit.

## Changes
- `apps/api/src/migration/d1Bonds.ts`
  - Extracted `expireD1BondRewards(db, now)` from `runD1BondMaintenance`.
  - On expiry it still marks the grant expired and removes the last ownership row for reward-only items, but now clears the item from **all** `active_cosmetics_*` slots (the previous code only cleared `avatar_frame`).
  - Existing guard retained: a slot/ownership row is left intact when the user holds another unexpired grant of the same item.
- `apps/cloudflare-worker/test/cosmetic-reward-cleanup.mts` (new): Miniflare D1 test with an expired frame reward plus an active frame grant (stays equipped) and an expired badge reward (unequipped, ownership removed). Wired into `test:domain`.

## Verification actually run
- `npm run typecheck` — all workspaces pass.
- `npm run test:domain` — 3/3 pass.
- `npm run test:d1-worker` — 3/3 pass, including the scheduled-maintenance fixture.

## Notes
- The first `test:d1-worker` run caught a missing `time` binding introduced while extracting the helper; fixed before final verification.
- No hosted migration applied; no deploy or commit.

## User-domain status
All originally identified slices are now handled: schema integrity (0042), VIP review notifications, reward-slot cleanup. `todayXpCap` was investigated and deliberately left unchanged; banked sub-threshold VIP EXP remains a product decision.

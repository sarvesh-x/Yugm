# 2026-11-26 — VIP cycle review notifications

## Scope
Second user-domain enhancement slice after schema integrity. Local code + verification only; no hosted changes, deploy or commit.

## Changes
- `apps/api/src/services/vip.ts`: added pure `vipCycleNotice(beforeLevel, afterLevel)` returning `null` for an unchanged tier, otherwise a system notification payload.
- `apps/api/src/migration/d1Maintenance.ts`: `rollExpiredVipCycles` is exported and now appends a notification insert to the same guarded D1 batch as the tier update. The insert guard matches the post-update state, so a stale update cannot produce a notification. Return value still counts only user rows updated.
- `apps/cloudflare-worker/test/vip-lifecycle.mts` (new): unit coverage for `vipCycleNotice` and a Miniflare D1 integration test with three expired VIP members (downgrade, full expiry, maintained tier).
- Root `package.json`: added `test:domain` (`tsx --test ...`).

## Verification actually run
- `npm run typecheck` — all workspaces pass.
- `npm run test:domain` — 2/2 pass.
- `npm run test:d1-worker` — 3/3 pass.

## Decisions / not changed
- `todayXpCap` remains the sum of all per-event XP caps: Android `GrowthScreen` presents it alongside `todayXpEarned`, which sums the same capped events. No bug; established behavior preserved.
- Banked `vipExp` below VIP1 is still retained indefinitely. `rollVipCycle` only reviews members with a tier; resetting banked EXP would need a new accrual timestamp and a product decision.
- No hosted migration was applied; no deploy or commit.

## Open
- Cosmetic reward cleanup: on bond-reward expiry, clear every equipped reward-only slot (currently only `avatarFrame` is cleared).

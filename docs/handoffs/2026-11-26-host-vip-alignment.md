# 2026-11-26 — Host VIP status alignment

## Scope
Finish the Android user-model alignment for public profiles and surface the existing VIP cycle data. No server contract change, no hosted operation, deploy or commit.

## Findings
- `serializePublicProfile` already returns the full `getVipStatus` payload (`vipLevel`, `vipExp`, `daysRemaining`, `vipExpiresAt`, `frozen`, …).
- Android's `Host` kept only `isVip`, `vipTier` and `vipLevel`, so the profile screen could not show the cycle's remaining days even though the payload carried them.
- The profile VIP card used generic copy for every viewer, including the signed-in member.

## Changes
- `core/model/HostModels.kt`: `Host.vip: VipStatus = VipStatus()`.
- `core/api/parsers/RoomParser.kt`: `toHost()` prefers a nested `vip` object and otherwise parses the flat profile fields; `isVip`/`vipTier`/`vipLevel` now derive from that status with the old top-level values as fallbacks.
- `feature/profile/ProfileDetailScreen.kt`: the own-profile VIP card shows "VIPN member · X days left in this cycle."; other profiles keep the generic description.
- `core/api/.../ProfileParserAlignmentTest.kt`: the profile contract now asserts `host.vip.daysRemaining` and `host.vip.vipExp`.

## Verification actually run
- `:core:api:testDebugUnitTest --tests com.yugm.app.core.api.ProfileParserAlignmentTest` — 3/3 pass.
- `:core:api:testDebugUnitTest` — 41/41 pass, 0 failures.
- `:feature:profile:compileDebugKotlin` — pass.

## Open
- The VIP card reads the profile payload fetched when the screen loads; it is not a live countdown. A refresh reloads it.
- No hosted D1 migration applied; no deploy or commit.

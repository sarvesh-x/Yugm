# 2026-11-26 — Android user-model alignment

## Scope
Client-side follow-up to the user-domain work: align the session user DTO with the user payload the D1 Worker already returns. No server contract change, no deploy or commit.

## Findings
- `GET /api/auth/me` and `PATCH /api/users/me` return the full VIP status (`vipLevel`, `vipExp`, `daysRemaining`, `vipExpiresAt`, `frozen`) via `getVipStatus`, but Android's `YugmUser` only kept `isVip`/`vipTier` and dropped the rest. Room/profile DTOs (`Host`) already keep `vipLevel`.
- No behavioral bug was found elsewhere in the parser chain; the change is additive.

## Changes
- `core/model/HostModels.kt`: `YugmUser.vip: VipStatus = VipStatus()`.
- `core/api/parsers/ProfileParser.kt`: `toUser()` prefers a nested `vip` object (wallet-style payloads), otherwise parses the flat auth/me VIP fields; `isVip`/`vipTier` now derive from that status with the old top-level values as fallbacks.
- `core/api/build.gradle.kts`: test-only `org.json:json:20090211`, replacing Android's throwing local-test stub.
- `core/api/src/test/.../ProfileParserAlignmentTest.kt`: three contract tests (flat auth payload, nested VIP payload, `Host` profile VIP/counters).

## Verification actually run
- `:core:api:testDebugUnitTest --tests com.yugm.app.core.api.ProfileParserAlignmentTest` — 3/3 pass.
- `:core:api:testDebugUnitTest` — 41/41 pass, 0 failures (the previous 12 `org.json` "not mocked" failures are resolved by the test dependency).
- `:feature:auth:compileDebugKotlin`, `:feature:profile:compileDebugKotlin` — pass.
- No backend tests re-run (no backend change).

## Open
- Banked sub-threshold VIP EXP policy remains a product decision.
- No hosted D1 migration applied; no deploy or commit.

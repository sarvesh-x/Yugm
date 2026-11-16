# Progression API contract (v1)

The progression contract is server authoritative. The Android parser accepts absent optional fields so an older API can still serve the client. New response fields are additive; `schemaVersion: 1` is included on the level and overview endpoints.

## Level and overview

`GET /users/me/level` returns `{ schemaVersion, level }`. The level object includes `xp` (lifetime XP), `level`, `title`, `currentLevelXp`, nullable `nextLevel` and `nextLevelXp`, `progressXp`, `requiredXp`, `progress` in the range 0–1, `canDailyCheckIn`, and `dailyCheckInXp`. Legacy `progressXp` and `requiredXp` fields remain available.

`GET /users/me/level-overview` returns:

- `level`: the level object above.
- `streak`: current count, check-in eligibility, next milestone, reward, and milestone states.
- `milestones`: configured account-level thresholds and coin rewards.
- `xpEvents`: a keyed object of event label, icon, category, base XP, optional daily cap, and today’s earned amount.
- `todayXpEarned` / `todayXpCap`: sum of capped event receipts for the current UTC day.
- `leaderboardRank` and the first ten ranked users.

The full leaderboard is `GET /users/leaderboard/levels?page=1&pageSize=25`. Page is one based, `pageSize` is clamped to 1–50, and ordering is level descending, XP descending, then user ID ascending. Response fields are `users` and legacy alias `leaderboard` (each row includes `rank`), `total`, `page`, `pageSize`, `requesterId`, and `requesterRank`.

## Check-in and grant receipts

`POST /users/me/check-in` returns the post-claim `streak`, `alreadyClaimed`, `streakBonus`, optional `unlockedCosmetic`, `level`, `balance`, and flattened legacy XP receipt fields. `xpGrant` contains `event`, `xpAwarded`, `capped`, optional `cap`, `earnedToday`, and `remainingToday`, level-up reward/levels, and the resulting level status. Repeated claims for a UTC day return `alreadyClaimed: true` and do not grant again.

Synchronous XP-earning endpoints include an additive `xpGrant` field where available. Grants with a durable action identifier use the unique `(userId, event, actionKey)` record. The same action key cannot award the same event twice. Battle Pass XP mirroring uses a transaction-backed action ledger keyed by `(userId, seasonId, actionKey)`, so retrying a failed synchronization cannot duplicate pass XP. Transient sync failures retry with bounded exponential backoff. The server logs privacy-minimized JSON metrics named `xp_granted`, `xp_cap_hit`, `level_up`, `battle_pass_xp_sync_retry`, and `battle_pass_xp_sync_failed`; the deployment log pipeline can aggregate these records.

## Achievements and badges

`GET /experience/achievements` returns `achievements`. Each item contains identity/display fields, `progress`/`total`, `currentTier`, `highestClaimedTier`, `nextTier`, `canClaim`, `canUpgrade`, `complete`, and per-tier target, reward, reached, and claimed state. `POST /experience/achievements/claim` atomically claims the next reached tier and returns its reward. A concurrent/repeated claim returns HTTP 409. `PUT /experience/badges/showcase` accepts at most five earned badge IDs; public profile badge data includes each earned tier. `POST /experience/achievements/:id/share` returns share text only after a tier has been earned.

## Seasonal pass

`GET /battle-pass`, `/battle-pass/purchase`, and `/battle-pass/claim` retain the existing `{ battlePass, season }` payloads. A pass is provisioned once per user and season. Purchase and reward claims use transaction guards. Claim errors distinguish locked/already-claimed conflicts, premium-track authorization, missing rewards, and unavailable seasons through the standard API error response.

## Data and rollout operations

- API startup ensures model indexes, including leaderboard, daily-cap, grant-idempotency, and pass uniqueness indexes. `XpDailyCap` rows expire after three days; grant idempotency records are retained because their natural action IDs must remain non-replayable.
- `npm run migrate:progression:backfill` is dry-run by default and reports how many users have level/title values inconsistent with their XP. To apply on a verified staging snapshot, pass `--apply` and set `PROGRESSION_BACKFILL_CONFIRM=YES`. Do not run against production without a reviewed backup and deployment approval.
- The workspace implementation does not connect to or modify a staging/production database. Run the backfill and index verification in the deployment environment before releasing the client.
- No remote feature-flag service is configured in this repository. Fields and routes are additive; staged deployment should use the existing API/client release controls and log metrics above.
- Admins and analysts with `analytics.read` can inspect aggregate progression health at `GET /api/admin/progression/health`, including 24-hour grant totals, stale processing records, UTC-day cap use, and the active Battle Pass season. The endpoint does not return user identifiers.

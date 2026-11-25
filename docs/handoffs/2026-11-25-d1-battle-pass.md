# D1 battle-pass routes

## Scope

Mounted all three legacy `/api/battle-pass` HTTP patterns on the shared D1 Worker on 2026-11-25. MongoDB remains authoritative. No deploy, hosted migration, seed or hosted data operation was performed.

| Route | Behavior |
| --- | --- |
| `GET /api/battle-pass` | Active season, lazily created pass, reward states and previous-season summary. |
| `POST /api/battle-pass/purchase` | Guarded 999-coin debit and premium upgrade with one ledger row. |
| `POST /api/battle-pass/claim` | Level/track validation then one guarded reward grant for coins, diamonds, cosmetic, title or XP. |

The audit now reports `legacy 638 / d1 249 / matched 244 / missing 394`, with `/api/battle-pass` at `3 mounted / 0 missing`.

## Behavior notes

- **Season and pass identity.** The active season is found by the legacy date window and is created lazily with the monthly key. An existing battle pass is returned by `(user_id, season_id)` instead of by a derived ID, so imported legacy IDs remain valid. New passes use deterministic IDs and lazily mirror every configured season reward.
- **Previous-season summary.** Counts unclaimed free and premium rewards up to the previous pass level. The legacy generic `claimed` flag suppresses the free-track count; imported rows with that flag are honored.
- **Purchase.** Auth runs before the debit. The 999-coin `BATTLE_PASS_PURCHASE` debit, wallet marker clearing and premium upgrade commit in one D1 batch under a scratch `user_auth_profile.edit_token` claim. Insufficient funds and frozen wallets are checked before the batch and rechecked from authoritative state if a guard misses. The idempotency key is `battle-pass-purchase:<seasonId>:<userId>`.
- **Claim order.** The reward-state claim is staged with the ledger/ownership/XP side effects in one batch. Level, premium entitlement and reward existence are checked before the batch, matching the legacy error order. Coins use `BATTLE_PASS_REWARD`, diamonds use `REWARD`, cosmetics are validated against the default catalog and titles are added to owned titles.
- **XP reward.** The shared XP helper gained a `skipBattlePass` option so a battle-pass XP reward does not create a second battle-pass XP grant. Level-up coins still use `LEVEL_REWARD` and the shared level milestones.
- **Idempotency and replay.** Duplicate claims are rejected from the claim flag. Diamond credits use the legacy `bp:<seasonId>:<userId>:<level>:<track>` idempotency key; XP grants use its `:xp` suffix.

## Files

- `backend-server/apps/api/src/migration/d1BattlePass.ts`
- `backend-server/apps/api/src/migration/d1XpGrant.ts` (reward-recursion opt-out)
- `backend-server/apps/api/src/migration/d1Cosmetics.ts` (export default-catalog seed)
- `backend-server/apps/api/src/migration/d1App.ts` (mount)
- `backend-server/apps/cloudflare-worker/test/d1-battle-pass.mjs`
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs`

No migration file was added: existing `seasons.key`, `battle_passes(user_id, season_id)`, wallet idempotency and battle-pass XP action indexes cover the new writes.

## Verification (run)

- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed (both configs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — 1/1 passed. The fixture covers auth/validation order, previous-season summary, insufficient funds, frozen wallet, purchase, duplicate purchase, all five reward types, XP level-up coins, ownership records, replay rejection and per-user isolation.
- `npm.cmd run audit:d1-endpoints` — 244 shared / 394 legacy-only; `/api/battle-pass` 3/0.
- `git diff --check` — no whitespace errors (LF/CRLF notices only).

## Not run / open

- Full API suite, production Worker fixture, push queue suite, production dry-run bundle, Android journeys, hosted migrations, live payments, FCM and realtime delivery.
- `0020` and `0021` are not applied to the local recovered database or hosted D1. The Worker fixture applies them in a fresh emulator.
- No D1 realtime emitter publishes battle-pass purchase or claim events. MongoDB remains authoritative; do not deploy, import data or retire MongoDB without explicit authorization.

# D1 route coverage and cutover checkpoint

The debug and production D1 entrypoints share the same API implementation. Android debug uses the local Worker at `10.0.2.2:4000` with local D1 and R2. The release target uses the configured HTTPS origin, hosted D1 `yugm`, hosted R2 and Firebase. The production origin and provider settings still need operator values and hosted acceptance.

## HTTP coverage

The 2026-11-25 audit counted 638 legacy patterns, 259 D1 patterns, 254 shared patterns and 384 legacy-only patterns. A mounted pattern still requires journey and authorized hosted verification.

| Surface | Shared patterns | Legacy-only patterns |
| --- | ---: | ---: |
| Rooms | 59 | 0 |
| Clans | 23 | 0 |
| Bonds | 16 | 0 |
| Wallet | 16 | 0 |
| Highlights | 6 | 0 |
| Wishlist | 5 | 0 |
| Subscriptions | 5 | 0 |
| Missions | 4 | 0 |
| Referrals | 4 | 0 |
| Battle pass | 3 | 0 |
| Direct gift | 1 | 0 |
| Admin | 15 | 200 |
| Users | 34 | 19 |
| Customer support | 6 | 0 |
| PK battle APIs | 0 | 22 |

The room coverage includes lifecycle and controls, watch parties, themes, chat and private messages, polls, invites, reactions, missions, modes, PK history, reports and gift transfers. Feed, gift leaderboard, story-comment deletion, inventory trade refusal, highlights, wishlist, missions, battle-pass purchase/claims, referral codes/claims, subscriptions and direct-send-gift are also mounted. The admin routes cover config, audit logs, support and report reads. Gift catalogs, collections and owned gift inventory are mounted. Full PK gameplay, manual moderation actions and several gift commands remain legacy-only; `/api/badge-art` stays legacy-only until the approved R2 badge-blob cutover. For the exact list, run `npm run audit:d1-endpoints -- --missing` from `backend-server`.

## Local setup and hosted boundary

The recovered emulator database has migrations through `0019_room_gift_transfers.sql`. `0020_wishlist_unique.sql`, `0021_user_mission_unique.sql`, `0022_referral_unique.sql` and `0023_subscription_unique.sql` are added but not yet applied locally or hosted. New local setups apply the same numbered migrations with `npm run d1:setup:local`. To preserve the recovered emulator profile and media, point setup and development at the same local directory.

```powershell
$localState = Join-Path (Get-Location) 'apps/cloudflare-worker/auth-local/.wrangler/local-sign-in-2026-11-24'
npm.cmd run d1:setup:local -- --persist-to $localState
npm.cmd run dev -- --persist-to $localState
```

Hosted `yugm` has a recorded schema and reference seed through `0002`. Application of `0003` through `0023` remains unverified on hosted D1. Keep the reference catalog seed separate from legacy data import. [Hosted schema and seed evidence](2026-11-24-d1-schema-and-reference-seed.md)

## Remaining cutover work

- Finish the legacy-only HTTP routes needed by active clients, including admin moderation, chat attachment uploads and PK gameplay.
- Wire application realtime delivery and RealtimeKit room admission with the Android media transport. Room HTTP coverage includes the LiveKit-compatible token route outside the room group, while the RealtimeKit client still needs live wiring.
- Verify live Firebase/FCM and payments. Finish or retire the remaining legacy weekly honors, account-deletion and PK deadline jobs.
- Rehearse and reconcile legacy accounts, wallet history, memberships and media. Verify backup and restore before switching production traffic.

The D1 Worker bundles exclude MongoDB and Redis. Legacy Node/Render, staging, the current admin deployment and source-data tooling still rely on the legacy runtime. The default-branch workflow runs CI and may deploy the existing staging Worker and admin app. The D1 production Worker has a separate deployment path. [Room gift and Android verification](2026-11-25-d1-room-gift-transfers.md) · [Direct gift](2026-11-25-d1-direct-send-gift.md) · [Referrals](2026-11-25-d1-referrals.md) · [Subscriptions](2026-11-25-d1-subscriptions.md) · [Production configuration](2026-11-24-production-cloudflare-builds.md)

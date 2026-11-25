# D1 route coverage and cutover checkpoint

The debug and production D1 entrypoints share the same API implementation. Android debug uses the local Worker at `10.0.2.2:4000` with local D1 and R2. The release target uses the configured HTTPS origin, hosted D1 `yugm`, hosted R2 and Firebase. The production origin and provider settings still need operator values and hosted acceptance.

## HTTP coverage

The 2026-11-25 audit counted 638 legacy patterns, 338 D1 patterns, 333 shared patterns and 305 legacy-only patterns. A mounted pattern still requires journey and authorized hosted verification.

| Surface | Shared patterns | Legacy-only patterns |
| --- | ---: | ---: |
| Rooms | 59 | 0 |
| Clans | 23 | 0 |
| Social features | 20 | 0 |
| Experience | 11 | 0 |
| Bonds | 16 | 0 |
| Wallet | 16 | 0 |
| Highlights | 6 | 0 |
| Wishlist | 5 | 0 |
| Subscriptions | 5 | 0 |
| Dating | 5 | 1 |
| Missions | 4 | 0 |
| Referrals | 4 | 0 |
| Games | 4 | 5 |
| Battle pass | 3 | 0 |
| Events | 14 | 0 |
| Vibe | 8 | 0 |
| Groups | 8 | 0 |
| Direct gift | 1 | 0 |
| Moderation checks | 2 | 3 |
| Admin | 15 | 200 |
| Users | 34 | 19 |
| Customer support | 6 | 0 |
| PK battle APIs | 0 | 22 |

Arcade read coverage is catalog, missions, leaderboard and challenges. The five legacy-only `/api/games` patterns are score write, challenge create, challenge accept, challenge decline and score share. Social coverage is all 20 mood, activity, wave, daily-question, voice-poll and countdown routes; the friends/follows/block group remains in `d1Social.ts`.

The room coverage includes lifecycle and controls, watch parties, themes, chat and private messages, polls, invites, reactions, missions, modes, PK history, reports and gift transfers. Feed, gift leaderboard, all 20 social routes, all 11 experience routes, all 11 story routes, the two moderation text-check routes, all four Arcade read routes (catalog, missions, leaderboard and challenges), inventory trade refusal, highlights, wishlist, missions, battle-pass purchase/claims, referral codes/claims, subscriptions, dating preferences/like/pass/matches, event creation/list/join/cancel/leave, all eight vibe graph routes, all eight group chat routes and direct-send-gift are also mounted. `GET /api/dating/explore` stays legacy-only because its `onlineOnly` filter and `isOnline` field need live Socket.IO/Redis presence. `/api/discover` also stays legacy-only pending a compatibility decision: presence count and online-now need live presence, `lastSeen` is not a schema field, and three room routes populate a `host` path absent from the `Room` model. Group routes have no D1 Socket.IO fan-out, and their participant foreign key rejects dangling user IDs that legacy Mongoose could populate as `null`. Social wave sends persist the `WAVE` notification but do not emit the legacy wave events. Experience home badge sync is non-blocking and achievement unlock notifications are persisted without socket fan-out. [Experience parity and boundary](2026-11-25-d1-experience.md). The admin routes cover config, audit logs, support and report reads. Gift catalogs, collections and owned gift inventory are mounted. Full PK gameplay, manual moderation actions, v1 moderation report/appeal/status, Arcade score and challenge writes, score sharing and several gift commands remain legacy-only; `/api/badge-art` stays legacy-only until the approved R2 badge-blob cutover. For the exact list, run `npm run audit:d1-endpoints -- --missing` from `backend-server`. [Arcade reads and boundary](2026-11-25-d1-games-reads.md) · [Moderation checks and boundary](2026-11-25-d1-moderation-checks.md) · [Story parity and boundary](2026-11-25-d1-stories.md) · [Group parity and boundary](2026-11-25-d1-groups.md) · [Vibe parity and boundary](2026-11-25-d1-vibe.md) · [Social parity and boundary](2026-11-25-d1-social-features.md)

## Local setup and hosted boundary

The recovered emulator database has migrations through `0019_room_gift_transfers.sql`. `0020_wishlist_unique.sql`, `0021_user_mission_unique.sql`, `0022_referral_unique.sql`, `0023_subscription_unique.sql`, `0024_event_participants_unique.sql`, `0025_dating_swipes.sql`, `0026_vibe_graph_unique.sql`, `0027_group_participants_unique.sql`, `0028_story_views_unique.sql`, `0029_social_unique.sql` and `0030_experience_claim_unique.sql` are added but not yet applied locally or hosted. Hosted application of `0025` also needs a duplicate audit of legacy swipe/match/relationship rows, `0026` needs a duplicate audit of `vibe_graphs.user_id` rows, `0027` needs a duplicate audit of `conversation_participants` `(group_chats_id, value)` rows, `0028` needs a duplicate audit of `story_views(stories_id, value)` rows, and `0029` needs duplicate audits of `user_moods.user_id`, `daily_questions.date`, `user_daily_answers(user_id, question_id)` and non-null `voice_poll_votes(voice_polls_id, value)` rows; `0030` needs a duplicate audit of `user_claimed_achievement_tiers(users_id, achievement_id, tier)` rows before its table rebuild. New local setups apply the same numbered migrations with `npm run d1:setup:local`. To preserve the recovered emulator profile and media, point setup and development at the same local directory.

```powershell
$localState = Join-Path (Get-Location) 'apps/cloudflare-worker/auth-local/.wrangler/local-sign-in-2026-11-24'
npm.cmd run d1:setup:local -- --persist-to $localState
npm.cmd run dev -- --persist-to $localState
```

Hosted `yugm` has a recorded schema and reference seed through `0002`. Application of `0003` through `0030` remains unverified on hosted D1. Keep the reference catalog seed separate from legacy data import. [Hosted schema and seed evidence](2026-11-24-d1-schema-and-reference-seed.md)

## Remaining cutover work

- Finish the legacy-only HTTP routes needed by active clients, including admin moderation, chat attachment uploads and PK gameplay.
- Wire application realtime delivery and RealtimeKit room admission with the Android media transport. Room HTTP coverage includes the LiveKit-compatible token route outside the room group, while the RealtimeKit client still needs live wiring.
- Verify live Firebase/FCM and payments. Finish or retire the remaining legacy weekly honors, account-deletion and PK deadline jobs.
- Rehearse and reconcile legacy accounts, wallet history, memberships and media. Verify backup and restore before switching production traffic.

The D1 Worker bundles exclude MongoDB and Redis. Legacy Node/Render, staging, the current admin deployment and source-data tooling still rely on the legacy runtime. The default-branch workflow runs CI and may deploy the existing staging Worker and admin app. The D1 production Worker has a separate deployment path. [Room gift and Android verification](2026-11-25-d1-room-gift-transfers.md) · [Arcade reads](2026-11-25-d1-games-reads.md) · [Stories](2026-11-25-d1-stories.md) · [Groups](2026-11-25-d1-groups.md) · [Vibe](2026-11-25-d1-vibe.md) · [Dating](2026-11-25-d1-dating.md) · [Events](2026-11-25-d1-events.md) · [Experience](2026-11-25-d1-experience.md) · [Direct gift](2026-11-25-d1-direct-send-gift.md) · [Referrals](2026-11-25-d1-referrals.md) · [Subscriptions](2026-11-25-d1-subscriptions.md) · [Production configuration](2026-11-24-production-cloudflare-builds.md)

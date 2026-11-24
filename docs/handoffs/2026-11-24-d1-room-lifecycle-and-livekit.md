# D1 room lifecycle and LiveKit token admission

This slice completes the room lifecycle and media-token admission surface on the MongoDB-free D1 Worker. It is local code and fixture evidence only. MongoDB remains authoritative; no deploy, migration application, credential change or hosted data access was performed.

## HTTP surface

- `apps/api/src/migration/d1Rooms.ts` now registers 36 `/api/rooms` handlers. The new lifecycle and control paths cover create, join, leave, end, room PATCH, mic lock, seat lock, chat clean, speaker request/approve/invite/reject, take/leave seat, mute/unmute, mic state, remove speaker/user, room admin, co-host add/remove and co-host reads.
- Create and join reuse the shared `ROOM_CREATE` and `ROOM_JOIN` XP rules. XP is committed with the per-event UTC daily cap, grant receipt, Battle Pass statement and guarded `users` XP/level/wallet updates in the same D1 batch. Repeated or concurrent requests do not double-award.
- Join enforces visibility, invites, room restrictions, safety state, seat capacity and the existing speaker-request flow. Leave and end clear participant state, pending speaker requests and room chat in guarded batches. `endD1Room` preserves the official always-on voice room (`VOICE` plus `official-yugm-trending`), matching the legacy exception.
- Host-only controls accept the host or a platform `ADMIN`; broader room controls also accept room admins. Error status and messages follow the legacy `assertHost`/`assertHostOrRoomAdmin` boundary.
- `apps/api/src/migration/d1LiveKit.ts` adds `POST /api/livekit/token`. It rechecks the HTTP session, room ID and `LIVE` room state, requires a non-left participant row, and derives publish capabilities from role, mic, moderator mute, camera and room type. Audience participants receive only `screen_share_audio` for room music when unmuted. The response contract is `{ token, url, identity, roomName, role, canPublishMicrophone }`.
- The token is an HS256 JWT built with Web Crypto, matching the legacy LiveKit SDK claims (`iss`, `sub`, `nbf`, `exp`, `video` grant, two-hour TTL). It does **not** import `livekit-server-sdk`; production requires operator-supplied `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and a `wss://` `LIVEKIT_URL`. No credentials were added to tracked config.

## Verification run

- `npm.cmd run audit:d1-endpoints -- --missing`: `legacy 638 / d1 145 / matched 140 / missing 498`. `/api/rooms` is `36 mounted / 23 missing`; `/api/livekit` is `1 mounted / 0 missing`. This is a mount inventory, not behavioral proof.
- `npm.cmd --workspace apps/cloudflare-worker run test:auth-worker`: **1 pass / 0 fail**. The real D1 Worker fixture covered lifecycle authorization, concurrent joins, speaker approval/mute transitions, token claims, signature verification, daily XP caps, scheduled maintenance and FCM delivery.
- `npm.cmd --workspace apps/cloudflare-worker run test:production-worker`: **1 pass / 0 fail**. `npm.cmd --workspace apps/cloudflare-worker run test:push-queue`: **6 pass / 0 fail**.
- `npm.cmd run typecheck`: all four workspaces passed. `npm.cmd test`: admin **9/9**, API **515/515**, shared **27/27**, zero failures.
- Production and debug Wrangler dry runs passed. The emitted bundles contain no `import`/`require` or `node_modules` path for `mongoose`, `mongodb`, `sharp` or `livekit-server-sdk`. MongoDB strings remain only in the legacy env schema and runtime guard checks. `git diff --check` was clean.

## Exact remaining `/api/rooms` routes

```text
DELETE /api/rooms/:roomId/watch-party
GET /api/rooms/:id/missions
GET /api/rooms/:id/mode-state
GET /api/rooms/:id/polls
GET /api/rooms/:roomId/pk-history
GET /api/rooms/:roomId/watch-party
GET /api/rooms/modes
PATCH /api/rooms/:roomId/watch-party/sync
POST /api/rooms/:id/invites
POST /api/rooms/:id/messages
POST /api/rooms/:id/messages/direct
POST /api/rooms/:id/mode
POST /api/rooms/:id/mode/action
POST /api/rooms/:id/polls
POST /api/rooms/:id/polls/:pollId/close
POST /api/rooms/:id/polls/:pollId/vote
POST /api/rooms/:id/reactions
POST /api/rooms/:id/report
POST /api/rooms/:id/send-gift
POST /api/rooms/:id/theme
POST /api/rooms/:roomId/watch-party
POST /api/rooms/invites/:inviteId/respond
POST /api/rooms/mode/random
```

These remain on the legacy stack: watch-party, modes/mode actions/random mode, missions, polls, reactions, messages and direct messages, invites and invite responses, reports, gifts, theme POST (theme PATCH parity exists), and PK history. No PK route is mounted on D1, and `endD1Room` does not end an active PK battle.

## Remaining jobs

- Bonds maintenance: pending request expiry, reward expiry with cosmetic-entitlement cleanup, milestone points/notifications/rewards, weekly/monthly/season ranking snapshots and ranking rewards, and anniversary reminders.
- Weekly honor awards: weekly host/gift-sender/gift-recipient badges with next-Sunday expiry.
- Account deletion cleanup: the 30-day grace hard delete, including Bonds termination, session/device/token/follow/block/notification/message/mute cleanup, clan successor or clan removal, room/chat cleanup and host-owned room deletion.
- Stale-room cleanup: legacy 48-hour `LIVE` room end path.
- PK deadlines: `runPkDeadlines` READY recovery, COUNTDOWN start, ACTIVE/FINAL_CRUNCH/FINALIZING ticks and end, COMPLETED close, invite expiry, plus in-memory tick timers. The legacy Durable Object owns these alarms.
- Live FCM delivery is implemented on D1 with mocked provider verification only. Socket.IO/presence, room disconnect grace, fan-out and cache paths remain on the legacy runtime.

## Open before cutover

Hosted migrations `0003` through `0007`, live FCM, Android RTC/RealtimeKit acceptance, remaining 498 route patterns and the jobs above still block MongoDB retirement. D1 is not approved for production. Do not deploy, provision, rotate credentials, apply hosted migrations or transfer data without explicit authorization.

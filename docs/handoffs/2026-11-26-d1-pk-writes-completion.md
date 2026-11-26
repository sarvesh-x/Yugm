# 2026-11-26 — D1 PK writes completion

## Scope

Mounted the seven remaining legacy `/api/pk` write patterns on the shared D1 Worker:

- `POST /api/pk/invite`
- `POST /api/pk/auto-match`
- `POST /api/pk/end`
- `POST /api/pk/rematch`
- `POST /api/pk/:battleId/vote`
- `POST /api/pk/:battleId/send-gift`
- `POST /api/pk/:battleId/reactions`

The HTTP mount audit is now **638 legacy / 644 D1 / 638 matched / 0 missing**; `/api/pk` is **22 mounted / 0 missing**. The six extra D1 patterns are additional mounts, not missing legacy behavior. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change or data operation was performed. The owner explicitly authorized commit and push after verification; those Git operations belong to this slice.

## Behavior preserved

- Router-scoped authentication still runs before body validation. `invite`, `auto-match`, `vote`, `send-gift` and `reactions` keep `requireNotMuted` before `validateBody`; `end` and `rematch` keep only validation. No PK rate limiter was added.
- Legacy status codes are unchanged: `201` for invite, auto-match, rematch, vote, gift and reactions; `200` for end. Success DTOs reuse the existing D1 battle/invite presenters, with `myVote`, `voted`, `ready` and `giftTransaction` shapes where legacy returns them.
- `invite`, `auto-match` and `rematch` share one guarded cross-room invite helper. It preserves the legacy checks in order: object-id validation, different rooms, allowed duration, host/live/restricted-host checks, opponent-room liveness/ownership/type, both-direction block denial, and the active-battle room-lock claim. The battle insert is the single claim; invite/event/notification writes are guarded by that committed battle so a stale lock cannot leave a partial invite.
- Auto-match uses the same candidate query and `rankPkOpponents` ordering as legacy. It does not pre-filter blocks: a ranked blocked host still reaches invite validation and returns `Cannot invite this host`. With no ranked candidate it returns `No live PK opponent is available right now`.
- `end` preserves terminal replay, room-manager authorization, `FINALIZING → COMPLETED` for an active battle, `INVITED … COUNTDOWN → CANCELLED` for pre-start battles, winner/loser selection, room-lock release and event inserts. `stateVersion` bumps once for cancel and twice for an active end; `event_sequence` is not incremented. Replays do not duplicate events.
- `rematch` preserves `Can only rematch ended battles`, participant-only access, a live requesting room, host-only authority, the `Rematch: ` title prefix and a `201` guarded invite.
- `vote` preserves mode/active/remaining-time checks, participant authorization, one vote per battle, score/version/sequence increments and the exact duplicate-message conflict. Replays return the current state without a second vote event.
- `send-gift` checks replay before fresh validation, then preserves active battle, gift catalog, selected-gift, point value, participant, opposing-side, self, amount, frozen-wallet and balance checks in legacy order. The wallet debit, `GIFT_SENT` ledger, receiver charm credit, battle score/version/sequence, leaderboard, battle events and room activity commit in guarded batches. Replay returns the original transaction without another debit.
- `reactions` preserves `ACTIVE`-only access, room-PK and own-side rejection, the fixed 10-second bucket, score-only increments, optional `LEAD_CHANGED`, and no `stateVersion`/`event_sequence` bump.

## D1 implementation

- `backend-server/apps/api/src/migration/d1PkWrites.ts` adds the seven route bodies, shared invite helper, replay lookups, guarded event inserts and legacy DTO helpers. A static parity pass moved the frozen-wallet check to its legacy position after the team/self/amount checks.
- No new SQL migration. Existing `pk_battles`, `pk_invites`, `pk_participants`, `pk_votes`, `pk_events`, `pk_leaderboard_entries`, `gift_transactions`, `wallet_transactions`, `room_activities` and `notifications` tables are reused.
- `backend-server/apps/cloudflare-worker/test/d1-pk-writes-extended.mjs` adds scoped fixtures with shared-account snapshots and `try/finally` cleanup. `auth-worker.mjs` invokes the new helper after the existing PK fixture.

## Boundaries and divergence

- This remains HTTP-only. Legacy PK socket events, user push and receiving-client invalidation have no D1 emitter; other clients must refresh through the mounted PK reads.
- `reactionBuckets` and `giftCombos` are process-local `Map`s, matching the legacy Node module shape but not providing durable or cross-isolate rate limiting.
- D1 still lacks parity unique indexes for `pk_participants`, `pk_votes`, `pk_leaderboard_entries`, `pk_events(battle_id, sequence)` and `pk_events.gift_transaction_id`. The `pk_battles.status` CHECK still does not include `OVERTIME`.
- No new SQL migration was added. Hosted migrations `0003`–`0035`, existing-data reconciliation and imported-row uniqueness audits remain open.
- Complete cutover is still blocked by no D1 PK socket fan-out, no live presence provider, no Firebase live identity deletion or 30-day hard-delete cascade, hosted migration application, recovery rehearsal and live acceptance. MongoDB remains authoritative.

## Verification

From `backend-server` on the final source tree:

- `npm.cmd run typecheck --workspace apps/api` — passed.
- `npm.cmd run typecheck --workspace apps/cloudflare-worker` — passed.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed twice consecutively (1/1 each). The new fixture covers unauthenticated calls on all seven paths, invalid invite/auto-match/end/rematch bodies, exact legacy validation and authorization messages, the blocked auto-match path, no-opponent 404, invite locks/events/notification/conflict, cancel and replay, rematch guards/success, vote DTO/state/version/sequence/duplicate replay, gift checks/replay/ledger/score/charm/activity checks, reaction limits/score-only writes, and active/completed end transitions with version 3 and no duplicate events. Existing clean-bundle assertions still exclude `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter`, `redis.ts`, `livekit-server-sdk` and `sharp`.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — passed (1/1).
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 644 D1 / 638 matched / 0 missing; `/api/pk` 22 mounted / 0 missing. This is a mount inventory, not behavioral proof.
- `npm.cmd run secrets:check:strict` — passed.
- `node --check apps/cloudflare-worker/test/d1-pk-writes-extended.mjs` and `node --check apps/cloudflare-worker/test/auth-worker.mjs` — passed.
- `git diff --check` from the repository root — no errors (one LF/CRLF notice for the edited TypeScript file).

Fixture debugging during development corrected three expectations: auto-match does not pre-filter blocked hosts, a gift debits its coin price while PK points change score, and an active end bumps `stateVersion` twice through `FINALIZING`. No Android build, hosted request, migration application or legacy data operation was run.

## Not run / open

- Hosted D1 verification, existing-data reconciliation, uniqueness audits, recovery rehearsal and live acceptance.
- PK socket/push fan-out, durable reaction/combo limiting, D1-compatible presence, Firebase live deletion and the 30-day hard-delete cascade.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh fixtures while the recovered local database remains recorded at `0019`.

## Next action

Design the D1 realtime boundary for PK events and receiving-client invalidation, then perform reconciliation and recovery rehearsal before any production cutover. Do not apply hosted migrations, import data, deploy, provision or retire MongoDB without new explicit authorization.

# 2026-11-26 — D1 PK accept, start and ready writes

## Scope

Mounted three more `/api/pk` write patterns on the shared D1 Worker:

- `POST /api/pk/accept`
- `POST /api/pk/start`
- `POST /api/pk/:battleId/ready`

`accept` and `start` share one guarded invite-acceptance handler because both legacy routes call `acceptPkInvite`. The HTTP mount audit is now **638 legacy / 637 D1 / 631 matched / 7 missing**; `/api/pk` is **15 mounted / 7 missing**. The remaining unmounted PK writes are `/invite`, `/auto-match`, `/end`, `/rematch`, `/:battleId/vote`, `/:battleId/send-gift` and `/:battleId/reactions`. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed in this slice; the prior authorization was consumed by pushed commit `d89a2df`.

## Behavior preserved

- Router-scoped authentication still runs before body/path validation; the PK router has no rate limiter, so none was added. `accept`/`start` use the legacy invite schema (invalid body IDs return 422), while `ready` validates the empty body and then rejects an invalid path ID with 400 `Invalid battleId`.
- Acceptance keeps the exact legacy order: invite lookup, invitee-only check, pending check, expiry recovery, battle lookup, both-room LIVE check, legal `PREPARING` transition, then guarded invite/battle/host-participant/event writes. Legacy messages are retained, including `PK invite not found`, `Only invitee can accept`, `Invite is not pending`, `PK invite expired`, `PK battle not found`, `Both rooms must be live`, `Invitation was already answered or expired` and `PK is no longer available`.
- Expired acceptance reuses the deadline recovery expiry transaction: invite `EXPIRED`, battle `EXPIRED`, room-lock release, `state_version`/`event_sequence` bumps and one `PK_INVITE_EXPIRED` event. The replay path returns `Invite is not pending` because the earlier request already committed the invitation, matching the legacy post-commit state.
- A successful acceptance returns the existing D1 battle presenter plus the shared invite presenter, with `stateVersion` incremented and both host participants upserted as `LEFT`/`RIGHT` `HOST` rows with `isReady: false`. It writes one `PK_INVITE_ACCEPTED` event and does not fabricate DMs or notifications.
- `ready` keeps the legacy order: `PK preparation is closed` for a missing or non-`PREPARING` battle, legal `READY` transition, participant check with `Only a PK participant can ready up`, then the participant `isReady` write and `PK_READY` event. One ready leaves the battle in `PREPARING`; when all non-departed participants are ready it performs the same two-step `PREPARING → READY → COUNTDOWN` chain as legacy, with `stateVersion +2`, `countdownEndsAt = now + 3000`, two additional `PK_READY` events and one `PK_COUNTDOWN` event. The response includes `ready: true`, `myReady: true` and the current authoritative battle.
- All status and participant writes are guarded in D1 batches. No route reports success before the relevant commit; replays after countdown return the legacy closed-preparation conflict without duplicating countdown events.

## D1 implementation

- `backend-server/apps/api/src/migration/d1PkWrites.ts` adds one `acceptInvite` helper and three routes. Host participant rows are updated or conditionally inserted only after the battle reaches the expected `PREPARING` version.
- `backend-server/apps/api/src/migration/d1PkReads.ts` exports `presentInvite` so acceptance can return the same DTO as the read surface without a second implementation.
- `backend-server/apps/api/src/migration/d1PkDeadlines.ts` exports `expireD1PkInvite`, which delegates to the existing deadline `expireInvite` batch; rejection and acceptance now share that path instead of carrying a duplicate expiry helper.
- No new SQL migration. HTTP event inserts keep the existing `guardedEventInsert` convention (`stateVersion: 1`, no sequence), matching legacy `addPkEvent`; deadline-generated events continue to use their monotonic `event_sequence`.
- The existing Durable Object PK alarm continues from `COUNTDOWN`; the disabled legacy JavaScript timer is not needed for the new route.

## Boundaries and divergence

- This remains HTTP-only. Legacy `pk:state`, `pk:invite:*`, user and notification fan-out have no D1 socket emitter; other clients refresh through `GET /api/pk/active/:roomId`.
- The state-machine assertion can still throw the legacy generic `Illegal PK state transition` error for an unusual imported battle status; acceptance batches intentionally require `INVITED`, as in the existing reject path.
- D1 still lacks the legacy partial unique indexes for `pk_participants`, `pk_invites`, `pk_votes` and `pk_leaderboard_entries`; imported-row audits are required before cutover. The `pk_battles.status` CHECK still does not include `OVERTIME`.
- `/api/users` side-effect callbacks, live presence, Firebase live deletion, 30-day hard-delete cascade, hosted migrations `0003`–`0035`, data reconciliation, recovery rehearsal and live acceptance remain open. MongoDB remains authoritative.

## Verification

From `backend-server` on the final source tree:

- `npm.cmd run typecheck --workspace apps/api` — passed.
- `npm.cmd run typecheck --workspace apps/cloudflare-worker` — passed.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). The PK fixture now covers unauthenticated calls on all seven write paths, invalid invite/body/path IDs, non-invitee acceptance, accepted DTO/state/host participants/event, acceptance replay, `/start` parity, expired acceptance with lock release and event sequence, non-live rooms, non-participant ready, closed preparation, one-ready `PREPARING`, second-ready `COUNTDOWN` with `stateVersion: 3`, `myReady` persistence and countdown replay. Existing clean-bundle assertions still exclude `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter`, `redis.ts`, `livekit-server-sdk` and `sharp`.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — passed (1/1).
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 637 D1 / 631 matched / 7 missing; `/api/pk` 15 mounted / 7 missing. This is a mount inventory, not behavioral proof.
- `npm.cmd run secrets:check:strict` — passed.
- `node --check apps/cloudflare-worker/test/d1-endpoints.mjs` — passed.
- `git diff --check` from the repository root — no errors.

One intermediate fixture run hit the previously observed unrelated `d1-reports` `6 !== 5` count assertion after the new PK assertions passed. A debug query showed the expected five report rows; the unchanged source then passed twice consecutively. No Android build, hosted request, migration application or legacy data operation was run.

## Not run / open

- Hosted D1 verification, existing-data reconciliation, uniqueness audits, recovery rehearsal and live acceptance.
- The seven remaining PK writes and all realtime/receiving-client verification.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh fixtures while the recovered local database remains recorded at `0019`.

## Next action

Continue with another bounded PK write group (invite/auto-match, end/rematch, then vote/gift/reactions) or design the D1 realtime boundary first. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.

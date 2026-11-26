# 2026-11-26 — D1 PK deadline recovery alarm

## Scope

Added a singleton SQLite Durable Object alarm that runs PK deadline recovery directly against D1. The Worker now keeps the legacy ~5-second active-tick cadence without relying on the one-minute cron or the legacy in-memory timers, which are disabled when `YUGM_RUNTIME === "cloudflare"`.

No HTTP path changed. The endpoint audit remains `638 legacy / 625 D1 / 619 matched / 19 missing`; `/api/pk` remains 12 mounted / 10 missing. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed in this slice. The latest explicit commit/push authorization was consumed by `ee28fcb`; these changes remain uncommitted.

## Behavior preserved

- `READY` stale for more than 2 seconds moves to `COUNTDOWN` with a new `countdown_ends_at`.
- `COUNTDOWN` moves to `ACTIVE`, using `countdown_ends_at` as `started_at`, so the legacy countdown identity is retained.
- `ACTIVE` moves to `FINAL_CRUNCH` at 10 seconds or less, then to `FINALIZING`, `COMPLETED` with winner side/user, and `CLOSED` after the legacy 60-second close grace.
- Pending invites that pass `expires_at` move the invite and battle to `EXPIRED` and release both room locks.
- Each transition increments `state_version` and `event_sequence`, writes the matching `PK_*` event, and is guarded by the expected status, version and sequence. Re-running the alarm does not duplicate events or repeat committed transitions.
- Room `active_pk_id` is cleared only while it still points at the battle being finalized or closed.

## D1 and Worker implementation

- Added `backend-server/apps/api/src/migration/d1PkDeadlines.ts` with `runD1PkDeadlines(db, now)` and `nextD1PkDeadline(db, now)`. All writes use `db.batch(...)` with conditional updates and guarded event selects; no post-commit validation decides success.
- Added `backend-server/apps/cloudflare-worker/src/d1PkAlarm.ts`, a singleton `DurableObject` using ID `yugm-d1-pk-deadlines`. It runs the deadline job, reschedules to the earliest persisted deadline, keeps active battles on a ~5-second alarm, retries failures after 30 seconds, and is enabled only for the isolated local stage or a configured production origin without legacy database bindings.
- Added `backend-server/apps/cloudflare-worker/src/d1PkAlarmBinding.ts` for the host-neutral binding/wake helper, plus `src/cloudflare-workers.d.ts` for the Node/runtime typecheck boundary. The Worker typecheck continues to use `@cloudflare/workers-types`.
- `d1Api.ts` wakes the alarm from cron and around `/api/pk` writes. A 15-second fallback alarm is persisted before a PK write so a Worker stop after the D1 commit still recovers state; a wake failure is logged and does not block the authoritative HTTP write.
- Exported `D1PkAlarm` from `production.ts` and `authLocal.ts`; added `PK_DEADLINES` bindings and `new_sqlite_classes` migration entries to both Wrangler configs. Updated config assertions in the production and auth Worker tests.
- No new D1 SQL migration. Existing `pk_battles`, `pk_invites`, `pk_events` and `rooms` tables are used unchanged. The deadline module deliberately avoids importing `d1Cosmetics.ts` so the Worker bundle does not eagerly load `dotenv/config`.

## Boundaries and divergence

- There is still no D1 emitter for `pk:state`, `pk:score:update`, `pk:timer:tick`, `pk:ended`, `pk:force_ended`, `notification:new` or invite events. Acting clients update from HTTP responses/local clears; other clients must refresh via `GET /api/pk/active/:roomId`.
- The ten remaining PK writes, active-battle ending inside `endD1Room()`, weekly honors and 30-day account deletion remain legacy-only.
- The legacy state machine can read `OVERTIME`; this implementation never writes it because the D1 status CHECK rejects it. Imported rows still need uniqueness audits for `battle_code`, vote/participant/leaderboard pairs and event sequence.
- The alarm is a singleton for recovery, not a per-battle timer. Concurrency is bounded by the DO, but load/latency under many simultaneous battles has not been measured.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — passed (1/1), including dry-run bundle assertions that still exclude `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter`, `redis.ts`, `livekit-server-sdk` and `sharp`, plus the new `PK_DEADLINES` binding and `new_sqlite_classes` assertions.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1) on the final run. The new fixture covers stale `READY`, due `COUNTDOWN`, active final crunch/finalize/complete, close after 60 seconds, pending invite expiry, event counts, `stateVersion`/`eventSequence`, room-lock release, replay idempotency, and alarm rescheduling/status after the run.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 625 D1 / 619 matched / 19 missing; `/api/pk` 12/10. This is a mount inventory, not behavioral proof.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors after CRLF normalization.

Intermediate fixture runs exposed a missing `status = ?` assignment in the guarded UPDATE, a wrong `ended_at` value in the fixture, and an eager `dotenv/config` import through `d1Cosmetics.ts`; all three were fixed before the final runs. Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared. No Android build, hosted D1 request, legacy data operation or recovery rehearsal was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- Hosted migrations `0003`–`0035`; `0020`–`0035` remain verified only in fresh fixtures while the recovered local database is recorded at `0019`.
- PK socket/push fan-out, receiving-client invalidation, remaining PK writes, `endD1Room()` active-battle ending and Android PK journey QA.

## Next action

Migrate the next bounded PK write group or design the D1 realtime emitter boundary. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.

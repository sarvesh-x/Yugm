# 2026-11-26 — D1 realtime, presence, deletion cleanup and local recovery readiness

## Scope

This local-only slice closes the remaining implementation blockers before a D1 cutover can be considered: post-commit realtime fan-out, D1-backed presence seams, account-deletion cascade mappings, schema/rate parity migrations, and a real fixture-driven restore replay. MongoDB remains authoritative. No hosted D1 migration was applied, no data was imported into a hosted binding, no provider was called, and no commit, push, deploy or provision was performed. The prior commit/push authorization was consumed by `52c9529 feat(migration): complete D1 PK write parity`; no new authorization exists.

## Changes applied

### Host-neutral presence and realtime seams

- Added `backend-server/apps/api/src/migration/d1Presence.ts` with `D1PresencePort` (`getPresenceCount`, `isUserOnline`, `getOnlineUserIds`, `markOnline`, `markOffline`, optional `emitUser`/`disconnectUser`) and `noD1Presence`, which returns `0`, `false`, `[]` and no-op mutations.
- Added `backend-server/apps/api/src/migration/d1Realtime.ts` with `D1RealtimePort`, `noD1Realtime` and a best-effort `emitD1Realtime` that swallows delivery failures so a socket error cannot invalidate an authoritative D1 commit.
- Added `createD1App(..., presence, realtime)` injection points. `d1Api.ts` passes `createNativeRealtimePort(env)` for both ports and retains `{ deleteFirebaseUser }` in the user-matching callback slot.
- Discover, Dating, UserDiscovery and UserMatching now use the injected presence port for counts, `isOnline`, `online-now`, `onlineOnly` and `recommended-chat`. Without an adapter they preserve the locked fixture behavior: `{ count: 0 }`, `{ users: [] }`, no online-only candidates, `isOnline: false`, and WAITING friend-match responses. Presence is explicitly ephemeral and never proof of a commit.

### Internal-only native Durable Object

- Rewrote `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts` as an internal publish/presence/history/WebSocket adapter with serialized operations and DO storage.
- Added `backend-server/apps/cloudflare-worker/src/nativeRealtimePort.ts`, which calls the DO through `NATIVE_REALTIME`; a missing binding falls back to no-op presence/realtime behavior.
- Bound `NATIVE_REALTIME` to `NativeRealtimeDurableObject` in local and production wrangler configs and exported the class from both entrypoints. There is no public HTTP route to this object, and the default command handler rejects commands with `Command handling is not configured`. Worker-side auth/resource membership is still required before any public exposure.

### PK post-commit fan-out

- Added `backend-server/apps/api/src/migration/d1PkRealtime.ts` to re-read committed PK state and publish to both legacy room scopes.
- `d1PkWrites.ts` now emits after guarded commits for invite, accept, reject, cancel, end, rematch, room-start, vote, gift and reaction, including `pk:lead:changed`, `pk:score:update`, `pk:gift:received` and `pk:reaction:received`.
- `d1PkDeadlines.ts` accepts a realtime port; guarded deadline and invite-expiry transitions publish `pk:state`, `pk:started`, `pk:timer:tick`, `pk:ended`, `pk:invite:expired`, room/user invite events and `notification:new`. `d1PkAlarm.alarm()` injects the native port.
- `pk:force_ended` remains intentionally unimplemented because there is no trusted admin boundary in the D1 PK end route. Reaction weighted points and gift combo counters remain process-local; no D1-backed counter design was approved.
- Added Worker typings for the DO/WebSocket runtime and history assertions in the PK alarm, PK write and endpoint fixtures.

### Deletion and schema/rate parity

- Added `backend-server/apps/api/src/migration/d1AccountDeletion.ts` and `0036_deletion_cleanup.sql`. Deletion now removes owned rows by `source_id`, binds one JSON array per numbered placeholder, decrements owned-clan member counts and keeps an anonymized minimal user stub for NOT NULL financial/audit references. `users.hard_deleted_at` was abandoned because `ALTER TABLE users ADD COLUMN` failed with `too many columns`; `account_deletions` records the hard-deletion request instead.
- Added `0037_pk_battle_status_check.sql` through `0041_friend_match_indexes.sql`: `OVERTIME` status, PK/vote/leaderboard/event uniqueness, gift inventory uniqueness, partial active-withdrawal uniqueness and friend-match indexes. Existing `idx_pk_history_left_room` and `idx_pk_history_right_room` are retained. Friend-match search reuses any existing row by `user_id` and guards expired `PAIRING`, matching legacy behavior alongside the new unique index.
- The admin fixture selects a user without an existing active withdrawal so `0040` is deterministic.

### Fixture-only local restore replay

- Checked in a synthetic snapshot under `backend-server/apps/cloudflare-worker/test/fixtures/d1-restore/` (`snapshot-manifest.json` and JSONL batches for `users`, `wallet_transactions`, `media_objects`). No production data or credential is present.
- Added `backend-server/apps/cloudflare-worker/test/d1-restore-rehearsal.mts` and the `test:restore-rehearsal` script. It applies `0001`–`0041` to an ephemeral Miniflare D1 database, verifies the snapshot with `verifyBackup`, imports through the real `FileSystemSnapshotStore` + `D1TargetWriter` + `importMappedCollection` path, persists filesystem checkpoints, reads rows back, checks wallet balance against `balance_after` and media owner/bucket/key, then replays the import to prove batches are skipped and no rows are duplicated.
- The test refuses remote D1/R2 bindings and non-fixture D1 IDs, including an explicit assertion that the production config is rejected. It never connects to MongoDB, R2, Cloudflare or a live provider. Passing is evidence for this synthetic fixture only; it is not a production restore test.

### Fixture reliability

- `verifyD1Reports` intermittently failed with `6 !== 5` because other fixtures can leave one pre-existing report for the shared target user. The detail and per-user report assertions now use `initialReportCount + 5`, preserving the check that exactly five new reports are visible while tolerating fixture baseline state.

## Boundaries and divergence

- Native realtime remains internal-only. No authenticated public WebSocket route, client adapter or command handler is wired; receiving-client behavior still needs live acceptance.
- PK event payloads and scopes follow the legacy mapping discovered from source: room-only `pk:state`, `pk:started`, `pk:timer:tick`, `pk:score:update`, `pk:lead:changed`, `pk:gift:received`, `pk:reaction:received`, `pk:ended`; user-only `pk:invite:received`, `pk:invite:accepted`, `pk:rematch:requested`, `notification:new`; invite expiry targets the inviter room and invitee user.
- Presence is a read/write seam, not a durable source of truth. It must not be used to assert an authoritative commit.
- Local migration notes still conflict: a backed-up emulator was reported through `0035`, while the recovered local `yugm` database remains recorded at `0019`. `0020`–`0041` are verified only in fresh fixtures.
- Hosted migrations `0003`–`0041`, hosted reconciliation, real backup/restore, R2 binary verification, live acceptance and MongoDB retirement remain gated.

## Verification

From `backend-server` on the final source tree:

- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed 1/1 in three consecutive final runs after the baseline-relative report fix.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — passed 1/1; bundle assertions still exclude `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter`, `redis.ts`, `livekit-server-sdk` and `sharp`.
- `npm.cmd run test:restore-rehearsal --workspace apps/cloudflare-worker` — passed 1/1; one real local D1 import plus idempotent replay.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 644 D1 / 638 matched / 0 missing; `/api/pk` 22 mounted / 0 missing.
- `npm.cmd run secrets:check:strict` — passed; no credential-bearing assignments in tracked config files.
- `git diff --check` from the repository root — no errors. Git reported LF/CRLF normalization notices for edited files.

## Not run / open

- Hosted migration application, hosted D1 verification, existing-data reconciliation, real backup/restore rehearsal, R2 binary restore and live acceptance.
- Public realtime route, authenticated WebSocket command handling, live presence provider, durable reaction/combo counters and Firebase live identity deletion.
- Android, admin, staging/production deploy, provision, credential use, commit and push.

## Next action

Ask for explicit authorization before any hosted migration, data import, reconciliation, deploy, provision, commit or push. Before cutover, complete a production-data backup/restore rehearsal with financial and media reconciliation, wire and authorize any public realtime transport, and pass live acceptance while MongoDB remains authoritative.

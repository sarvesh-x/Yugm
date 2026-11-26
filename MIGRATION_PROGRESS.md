# Yugm Cloudflare migration progress

This is the persistent, single-source tracker for the MongoDB/Render to Cloudflare migration. Update it after every phase. It records work actually performed and verified; it does not imply that a planned phase is complete.

## Current work

The [active 18-phase plan](docs/migration/implementation-plan.md) governs behavior preservation and zero-spend activation. The [preservation registries and gate tracker](docs/migration/MIGRATION_PROGRESS.md) record baseline evidence. [ADR-0008](docs/decisions/0008-zero-spend-cloudflare-migration.md) records the budget and conditional R2 direction. No production metrics are available. D1 Free can be evaluated against isolated workloads while MongoDB remains authoritative.

The owner expanded debug to the whole app on local D1 and R2. The shared D1 Worker matches 628 of 638 legacy HTTP patterns with 10 missing outside admin, including the full admin surface, all 11 experience patterns, all 20 social patterns, all 59 room patterns, all 23 clan patterns, all 16 Bonds and wallet patterns, all 14 event patterns, all 11 story patterns, all eight vibe and group patterns, all six highlights patterns, all five wishlist and subscription patterns, all six dating patterns, all six discover patterns, all four missions and referral patterns, all nine games patterns, all three battle-pass patterns, all ten AI wingman patterns, all ten trust verification patterns, 12 PK patterns (eight reads plus four writes), direct cover/profile-media/story/voice-note/recording/avatar/trust-verification uploads, the five v1 moderation patterns, the API root, payout webhook, `POST /api/direct-send-gift` and all 53 `/api/users` patterns, including account deletion and friend-match search. Both D1 bundles exclude MongoDB, Mongoose, Redis and BullMQ. The remaining ten patterns, existing-data import and live acceptance still gate retirement of the legacy runtime. The mounted Discover, Dating explore and friend-match search routes use a documented no-presence shim until live Socket.IO/Redis state has a D1-compatible provider. [Discover, Dating and Users completion](docs/handoffs/2026-11-26-d1-discover-dating-users-completion.md) · [Durable user matching and calls](docs/handoffs/2026-11-26-d1-users-matching-and-calls.md) · [AI wingman](docs/handoffs/2026-11-26-d1-ai-wingman.md) · [Trust verification](docs/handoffs/2026-11-26-d1-trust-verification.md) · [PK reads](docs/handoffs/2026-11-26-d1-pk-read-routes.md) · [PK writes](docs/handoffs/2026-11-26-d1-pk-writes.md) · [PK deadline alarm](docs/handoffs/2026-11-26-d1-pk-deadlines.md) · [Cover upload](docs/handoffs/2026-11-26-d1-cover-upload.md) · [Profile-media and story uploads](docs/handoffs/2026-11-26-d1-profile-media-and-story-uploads.md) · [Voice-note and recording uploads](docs/handoffs/2026-11-26-d1-voice-note-and-recording-uploads.md) · [Avatar upload](docs/handoffs/2026-11-26-d1-avatar-upload.md) · [Trust verification media](docs/handoffs/2026-11-26-d1-trust-verification-media.md) · [Arcade writes](docs/handoffs/2026-11-26-d1-games-writes.md) · [Arcade reads](docs/handoffs/2026-11-25-d1-games-reads.md) · [Moderation checks](docs/handoffs/2026-11-25-d1-moderation-checks.md) · [Stories](docs/handoffs/2026-11-25-d1-stories.md) · [Groups](docs/handoffs/2026-11-25-d1-groups.md) · [Vibe](docs/handoffs/2026-11-25-d1-vibe.md) · [Social features](docs/handoffs/2026-11-25-d1-social-features.md) · [Experience](docs/handoffs/2026-11-25-d1-experience.md) · [Dating](docs/handoffs/2026-11-25-d1-dating.md) · [Events](docs/handoffs/2026-11-25-d1-events.md) · [Direct gift](docs/handoffs/2026-11-25-d1-direct-send-gift.md) · [Current coverage and audit](docs/handoffs/2026-11-25-d1-route-coverage-checkpoint.md) · [Referrals](docs/handoffs/2026-11-25-d1-referrals.md) · [Subscriptions](docs/handoffs/2026-11-25-d1-subscriptions.md) · [Battle pass](docs/handoffs/2026-11-25-d1-battle-pass.md) · [Missions](docs/handoffs/2026-11-25-d1-missions.md) · [Feed, highlights and wishlist](docs/handoffs/2026-11-25-d1-feed-highlights-wishlist.md)

Android selects emulator loopback for debug and the configured production HTTPS origin for release. The recovered local `yugm` database is recorded at `0019`; `0020`–`0035` are applied only in fresh fixtures, while notes about a separate backed-up emulator through `0035` conflict. The last recorded hosted schema and reference seed are at `0002`. The D1 Workers use native Cloudflare rate limits, and production config binds five verified hosted R2 buckets. RealtimeKit has an offline-tested server client. [Database setup](docs/handoffs/2026-11-24-d1-schema-and-reference-seed.md) · [Hosted R2 verification](docs/handoffs/2026-11-24-hosted-r2-d1-endpoint-audit.md)

| Workstream | Status | Next evidence |
| --- | --- | --- |
| Authentication | MongoDB and local D1 Auth journey fixtures passed. The isolated Worker passed the Auth lifecycle with D1 as its only service binding. | Verify live Firebase and App Check on Workers and the full Android Auth journey before rollout. [Local Worker evidence](docs/handoffs/2026-11-24-local-d1-auth-worker.md) |
| Navigation | Full-app Android 17 checks passed for a notification tap, validated conversation restore, Profile tab and dock on Back, and revoked-session routing. | Live FCM and device parity remain open. [Emulator evidence](docs/handoffs/2026-11-24-navigation-process-restart.md) |
| Profile | The local Worker serves reads and edits from D1. The mounted MongoDB fixture matched the committed Profile response and first-completion rewards. Concurrent setup and rollback passed. The local D1 + R2 managed avatar flow passed grant, upload, completion, cancellation and cleanup checks. The latest slices add friends, follow and block operations with guarded XP and counters, and block now terminates the active D1 Bond pair. | Verify Android setup, uploaded-avatar selection and Edit Profile. Live presence and invalidation remain open. [Profile read evidence](docs/handoffs/2026-11-24-d1-profile-reads.md) · [Profile edit evidence](docs/handoffs/2026-11-24-d1-profile-edits.md) · [Managed media evidence](docs/handoffs/2026-11-24-local-d1-r2-media.md) · [Social writes](docs/handoffs/2026-11-24-d1-profile-social-writes.md) · [Bonds block hook](docs/handoffs/2026-11-24-d1-bonds.md) |
| Cosmetics, inbox and clans | Local D1 handles player cosmetics, notification reads and core clan membership and invitations. Published cosmetic variants read from local R2. | Verify Android journeys, then cover admin assets, clan moderation and chat, and receiving-client realtime. [Local feature evidence](docs/handoffs/2026-11-24-local-d1-r2-app-expansion.md) |
| Room HTTP | All 59 legacy room patterns are mounted. Isolated Worker fixtures cover lifecycle, chat and invites, polls, modes, reports and gift transfers. | Verify room and gift events, hosted APIs, Android journeys and RTC. [Room route coverage](docs/handoffs/2026-11-25-d1-route-coverage-checkpoint.md) |
| Admin and support | Customer support is mounted. The admin surface has 15 D1 patterns for config, audit logs, support and report reads. | Port the 200 remaining admin patterns needed for cutover and verify permissions and live admin journeys. [Reports and support](docs/handoffs/2026-11-25-d1-reports-and-gift-catalog.md) |
| BullMQ and jobs | Notification contract characterized. D1 Cron covers push dispatch, auth and invite expiry, VIP review, story/clan retention, suspension cleanup, R2 staging cleanup, Bonds milestones, ranking finalization, poll expiry and 48-hour stale-room end. PK deadline recovery now runs from a singleton D1 Durable Object alarm. | Weekly honors and the 30-day hard-delete cascade still use the legacy runtime; D1 now records deletion requests and revokes access immediately. Live FCM and legacy job drain remain open. [PK deadline alarm](docs/handoffs/2026-11-26-d1-pk-deadlines.md) · [Poll expiry](docs/handoffs/2026-11-25-d1-room-polls.md) · [Stale-room cleanup](docs/handoffs/2026-11-24-d1-stale-room-cleanup.md) |
| Redis and application realtime | The D1 Worker bundles exclude Redis and BullMQ. Native Cloudflare auth limits passed locally. Legacy runtime still carries the shared cache, presence and socket adapter. | Verify Durable Object realtime, room disconnect grace and queue drain before retiring legacy Redis. [Migration status](docs/handoffs/2026-11-24-d1-database-and-redis-boundary.md) |
| D1 Free | All nine Arcade routes are mounted on D1; the catalog, read and write fixtures passed with local D1. Production DCR-2 is parked. | Receiving-client fan-out for score shares and challenge DMs still needs a D1-compatible realtime path. Evaluate other local slices independently. [Games writes](docs/handoffs/2026-11-26-d1-games-writes.md) · [Games reads](docs/handoffs/2026-11-25-d1-games-reads.md) |
| R2 and Images | Local avatar foundation, admin tools, the isolated D1 + R2 managed avatar flow, seven direct upload routers and owner-authorized private verification delivery exist with local-only bindings. Conditional scope on R2 Standard. | Verify the live Android upload journey, then demonstrate budget admission, pause behavior, category access and recovery before approving live use. [Managed media evidence](docs/handoffs/2026-11-24-local-d1-r2-media.md) · [Avatar upload evidence](docs/handoffs/2026-11-26-d1-avatar-upload.md) · [Private media evidence](docs/handoffs/2026-11-26-d1-trust-verification-media.md) |
| RTC | D1 now mints LiveKit-compatible tokens after live-room and participant checks; room lifecycle controls are mounted. RealtimeKit server client tested with simulated responses. | Supply LiveKit secrets, verify RealtimeKit admission/provider choice and wire the Android Core SDK. Prove device parity and a no-charge limit before live use. [Room and token evidence](docs/handoffs/2026-11-24-d1-room-lifecycle-and-livekit.md) |
| Recovery | Verified backup and restore evidence is missing. | Rehearse data, media and configuration recovery on approved isolated targets before production cutover. |

The current work is local documentation, tests and compatibility preparation. Provisioning, billing changes, deployments, production data operations and commit/push require separate authorization. The work log below preserves prior evidence and checkpoints.

**Commit-state note (2026-11-24):** "Uncommitted" in the dated entries below describes the working-tree state when each entry was written. The local migration slices were subsequently captured in commit `b04f77d` (`feat(migration): checkpoint local Cloudflare migration`) on `codex/cloudflare-migration-checkpoint`, branched from `master@5a519fe`. Current Git state is authoritative; those historical phrases are not claims about the present working tree.

## Work log

### 2026-11-26 - D1 Discover, Dating explore and final Users routes

- **Status:** mounted all six Discover routes, `GET /api/dating/explore`, `DELETE /api/users/me` and `POST /api/users/friend-match/search`. Account deletion uses guarded tombstone/auth-profile writes, bond termination, session/device revocation, injected best-effort realtime callbacks, injected Firebase identity deletion and a verified 30-day schedule. Friend-match search preserves reservation races, block exclusions and guarded room creation; with no presence adapter it returns WAITING. [Evidence](docs/handoffs/2026-11-26-d1-discover-dating-users-completion.md)
- **Verification:** api and Worker typechecks, auth Worker 1/1, production Worker 1/1, endpoint audit, strict credential check, fixture syntax checks and `git diff --check` passed. Audit: 638 legacy / 634 D1 / 628 matched / 10 missing; Discover 6/0, Dating 6/0, Users 53/0 and PK 12/10.
- **Boundary:** no new SQL migration. Presence remains a shim (`isOnline: false`, zero count, empty online list), no D1 socket emitter or 30-day hard-delete cascade exists, `friend_match_requests` still needs unique/status indexes, and D1 rate-limit wire headers still differ. The remaining ten PK writes, reconciliation, recovery rehearsal and live acceptance are open. MongoDB remains authoritative.

### 2026-11-26 - D1 PK deadline recovery alarm

- **Status:** added `d1PkDeadlines.ts` and a singleton SQLite Durable Object alarm for stale `READY`, due `COUNTDOWN`, active/final-crunch ticks, `FINALIZING`/`COMPLETED`/`CLOSED` and pending invite expiry. All transitions use guarded D1 batches with `stateVersion`/`eventSequence` bumps and event inserts; PK writes and cron wake the alarm, and active battles reschedule at ~5 seconds. [Evidence](docs/handoffs/2026-11-26-d1-pk-deadlines.md)
- **Verification:** full workspace typecheck, production Worker 1/1, auth Worker 1/1 with deadline/replay/rescheduling fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit unchanged: 638 legacy / 625 D1 / 619 matched / 19 missing.
- **Boundary:** no HTTP route or D1 SQL migration; Worker config gains `PK_DEADLINES` and `new_sqlite_classes`. PK socket/push fan-out, remaining PK writes, `endD1Room()` active-battle ending, weekly honors, 30-day account deletion, recovery rehearsal and live acceptance remain open. MongoDB remains authoritative.

### 2026-11-26 - D1 PK writes (first slice)

- **Status:** mounted `POST /api/pk/room-start`, `/reject`, `/cancel` and `/:battleId/close` with router-scoped auth before validation, legacy muted/status/authorization messages, conditional D1 batch guards for the room lock and event inserts, `stateVersion` bumps and the existing PK battle DTO. `/api/pk` is now 12/14; invite/accept/start/ready/vote/gift/reactions/rematch/end writes, PK deadlines (since superseded by the D1 PK alarm), active-battle job ending and socket fan-out were legacy-only at this slice. [Evidence](docs/handoffs/2026-11-26-d1-pk-writes.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with auth/muted/validation/start-lock/reject/cancel/close/replay/state-version/event-duplication fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 625 D1 / 619 matched / 19 missing.
- **Boundary:** no new migration. HTTP-only writes require other clients to refresh via `GET /api/pk/active/:roomId`; D1 has no PK socket/push emitter, deadline recovery or active-battle job ending. Missing unique indexes and `OVERTIME` CHECK parity still need reconciliation. MongoDB remains authoritative.

### 2026-11-26 - D1 trust verification upload and private media

- **Status:** mounted `POST /api/upload/trust-verification` and `GET /api/trust-verification/media/:fileName` with auth before multipart/filename validation, legacy purpose filters and signatures, private R2 keys and registry rows committed before success. Delivery keeps owner-prefix authorization and `private, no-store` headers; a shared helper now aligns user and admin reference parsing. `/api/upload` is 7/7 and `/api/trust-verification` is 10/0. [Evidence](docs/handoffs/2026-11-26-d1-trust-verification-media.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with auth/purpose/validation/signature/size/DTO/R2/registry/delivery/version/cleanup fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 621 D1 / 615 matched / 23 missing.
- **Boundary:** no new migration. Imported verification bytes still need reconciliation into the private R2 key layout; no D1 `sync:invalidate` emitter exists for successful POSTs. PK writes, discovery/dating presence, `DELETE /me`, jobs, realtime fan-out, recovery rehearsal and live acceptance remain open. MongoDB remains authoritative.

### 2026-11-26 - D1 avatar upload

- **Status:** mounted `POST /api/upload/avatar` with auth before multipart, legacy image validation, the 5 MB multipart cap and the separate 220 KB avatar limit. The media registry, variant, prior-object supersede and guarded authoritative profile update commit in one D1 batch, and the previous public R2 key is deleted after success. `/api/upload` is 6/7. [Evidence](docs/handoffs/2026-11-26-d1-avatar-upload.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with auth/validation/size/DTO/R2/registry/profile/public-delivery/version/cleanup fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 619 D1 / 613 matched / 25 missing.
- **Boundary:** no new migration. Legacy generic filter errors surface as 400 `VALIDATION` instead of a masked 500; the returned URL uses the managed public media route rather than the legacy absolute S3 URL. The trust-verification upload and its authorized private-media read, managed `COVER` sessions and live Android QA remain open. MongoDB remains authoritative.

### 2026-11-26 - D1 voice-note and recording uploads

- **Status:** mounted `POST /api/upload/voice-note` and `POST /api/upload/recording` with auth before multipart, legacy extension/MIME validation, the Worker 10 MB cap, server-derived R2 keys and `{ url, type, storage }`. No signature check was added because neither legacy handler has one. Public registry rows commit before the response. `/api/upload` is 5/7. [Evidence](docs/handoffs/2026-11-26-d1-voice-note-and-recording-uploads.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with auth/validation/oversize/DTO/R2/registry/public-delivery/version/cleanup fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 618 D1 / 612 matched / 26 missing. Two test-only fixture assertions were made order-independent.
- **Boundary:** `PUBLIC_VARIANT` serves audio variants; avatar and trust-verification uploads, managed `COVER` sessions and live Android QA remain open. MongoDB remains authoritative.

### 2026-11-26 - D1 profile-media and story uploads

- **Status:** mounted `POST /api/upload/profile-media` and `POST /api/upload/story` with auth before multipart, legacy image/video validation, a 10 MB Worker cap, server-derived R2 `gallery` keys and `{ url, type, storage }`. Public registry rows commit before the response. `/api/upload` is 3/7. [Evidence](docs/handoffs/2026-11-26-d1-profile-media-and-story-uploads.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with auth/validation/signature/oversize/DTO/R2/registry/public-delivery/version/cleanup fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 616 D1 / 610 matched / 28 missing.
- **Boundary:** a shared `nextD1MediaVersion` helper now allocates owner/category versions from `media_counters` for AVATAR, COVER and GALLERY, which also fixes repeated cover uploads. No migration was added; avatar, trust-verification, voice-note and recording uploads stay legacy-only. MongoDB remains authoritative.

### 2026-11-26 - D1 cover upload

- **Status:** mounted `POST /api/upload/cover` with auth before multipart, the legacy 5 MB/extension/MIME/signature checks, a server-derived R2 `covers` key and the `{ url, storage }` response. It commits a public media object and variant before returning and deletes the R2 object if that commit fails. `/api/upload` is 1/7. [Evidence](docs/handoffs/2026-11-26-d1-cover-upload.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with new auth/validation/R2/registry/public-delivery/cleanup fixtures and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 614 D1 / 608 matched / 30 missing.
- **Boundary:** no new migration, managed `COVER` upload sessions remain disabled, and the six other upload routes stay legacy-only. Legacy generic filter errors surface as 400 `VALIDATION` instead of a masked 500; MongoDB remains authoritative.

### 2026-11-26 - D1 PK read routes

- **Status:** mounted eight read-only `/api/pk` patterns with router-scoped auth before validation, legacy active/history/event/leaderboard DTOs, pending-invite and viewer vote/ready reads, and host-neutral LiveKit-compatible media sessions. `/api/pk` is 8/14; PK writes, deadlines, active-battle job ending and socket fan-out remain legacy-only. [Evidence](docs/handoffs/2026-11-26-d1-pk-read-routes.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with a new eight-route fixture and clean-bundle assertions, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 613 D1 / 607 matched / 31 missing.
- **Boundary:** the new routes perform no D1 writes, emits, notifications or jobs and add no migration. D1 uses the existing Web Crypto LiveKit-compatible token helper with the legacy flattened `token`/`url` response. MongoDB remains authoritative.

### 2026-11-26 - D1 trust verification state routes

- **Status:** mounted the nine user-facing `/api/trust-verification` state routes with router-scoped auth before validation, no limiter, shared schemas/DTOs and guarded verification-plus-submission batches. `/api/trust-verification` is 9/1; the private media route remains legacy-only. [Evidence](docs/handoffs/2026-11-26-d1-trust-verification.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with unauthenticated/validation/response/guard fixtures for all nine patterns and clean-bundle assertions, endpoint audit, strict credential check and scoped `git diff --check` (LF/CRLF notices only) passed. Audit: 638 legacy / 605 D1 / 599 matched / 39 missing.
- **Boundary:** no new migration or external provider; D1 commits verification and submission state together, has no `sync:invalidate` emitter for successful POSTs, and its non-unique user index needs imported-row reconciliation. MongoDB remains authoritative.

### 2026-11-26 - D1 AI wingman routes

- **Status:** mounted all ten `/api/ai/wingman` routes with router-scoped auth before validation and no limiter, matching legacy. Schemas, defaults and response builders moved to a shared host-neutral service used by both the legacy and D1 routers. `/api/ai` is 10/0. [Evidence](docs/handoffs/2026-11-26-d1-ai-wingman.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with unauthenticated/validation/response fixtures for all ten patterns and clean-bundle assertions, endpoint audit, strict credential check and scoped `git diff --check` (LF/CRLF notices only) passed. Audit: 638 legacy / 596 D1 / 590 matched / 48 missing; `/api/ai` 10/0.
- **Boundary:** no new migration, no D1 writes and no external AI provider; random values stay per-request as in legacy. The legacy global middleware emits `sync:invalidate` after successful AI POSTs; D1 has no socket emitter for it. MongoDB remains authoritative.

### 2026-11-26 - D1 durable user matching and private calls

- **Status:** mounted `GET /api/users/friend-match`, `POST /api/users/friend-match/cancel` and `POST /api/users/messages/:userId/call`. Auth/limiter order, legacy DTOs, guarded room/participant/speaker/DM batch and post-commit notification preserved. `/api/users` is 51/2. [Evidence](docs/handoffs/2026-11-26-d1-users-matching-and-calls.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with unauthenticated/limiter/persistence/private-call-row fixtures and clean-bundle assertions, endpoint audit, strict credential check and scoped `git diff --check` (LF/CRLF warnings only) passed. Audit: 638 legacy / 586 D1 / 580 matched / 58 missing; `/api/users` 51/2.
- **Boundary:** no new migration. `friend-match/search` remains legacy-only pending live presence; `DELETE /me` remains legacy-only pending Firebase identity deletion and socket invalidation. No D1 socket emitter replaces private-call `directMessageNew`. MongoDB remains authoritative.

### 2026-11-26 - D1 Arcade write routes

- **Status:** mounted all 5 remaining `/api/games` patterns: score save, challenge create/accept/decline and score share. Auth/limiter/validation order, legacy DTOs, XP cap/idempotency, personal best and guarded commits preserved. [Evidence](docs/handoffs/2026-11-26-d1-games-writes.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with games persistence and clean-bundle assertions, endpoint audit, strict credential check and scoped `git diff --check` (LF/CRLF warnings only) passed. Audit: 638 legacy / 583 D1 / 577 matched / 61 missing; `/api/games` 9/0.
- **Boundary:** no new migration. No D1 socket emitter replaces `directMessageNew`, score-share invalidation or challenge notification fan-out; personal-best tie order is deterministic where legacy was undefined. MongoDB remains authoritative.

### 2026-11-26 - D1 payout webhook

- **Status:** mounted `POST /api/payments/webhook/payout` before JSON parsing with raw-body HMAC verification. Processed and reversed/rejected/failed transitions use guarded idempotent batches for `payout_reviews`, `withdrawal_requests`, and audit rows. [Evidence](docs/handoffs/2026-11-26-d1-payout-webhook.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 (signature, processed, duplicate, reversal, missing payout), endpoint audit, strict credential check, and scoped `git diff --check` (LF/CRLF warning only) passed. Audit: 638 legacy / 578 D1 / 572 matched / 66 missing; `/api/payments` 1/0.
- **Boundary:** transition and audit writes share one D1 batch; no new migration; MongoDB remains authoritative.

### 2026-11-26 - D1 v1 moderation and API root

- **Status:** mounted `POST /api/v1/moderation/report`, `POST /api/v1/moderation/appeal`, `GET /api/v1/moderation/status`, and the `/api` discovery root. Auth before validation, legacy report/queue inserts, appeal ownership/UNBAN checks, status shape, and root payload preserved. [Evidence](docs/handoffs/2026-11-26-d1-v1-moderation-and-api-root.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit, strict credential check, and scoped `git diff --check` (LF/CRLF warning only) passed. Audit: 638 legacy / 577 D1 / 571 matched / 67 missing; `/api/v1` 5/0 and `/api/` 1/0.
- **Boundary:** No new migration. Report requires a target (400 instead of D1 NOT NULL 500). No D1 push/socket side effects. MongoDB remains authoritative.

### 2026-11-25 - D1 gifts mutations

- **Status:** mounted 5 `/api/gifts` mutation routes on the shared D1 Worker: purchase, combo, room-wide, surprise-box, upgrade. Auth/validation, wallet guards, guarded inventory/wallet writes, and combo fail-closed behavior preserved. [Evidence](docs/handoffs/2026-11-25-d1-gifts-mutations.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit, strict credential check, and scoped `git diff --check` (LF/CRLF warning only) passed. Audit: 638 legacy / 573 D1 / 567 matched / 71 missing; `/api/gifts` 8/0.
- **Boundary:** No new migration. D1 `gift_inventories` lacks Mongo unique `(user_id,gift_id)` schema parity; room-wide XP grants not wired and mid-loop partial failures need reconciliation. MongoDB remains authoritative.

### 2026-11-25 - D1 creator payout-kyc and withdrawals

- **Status:** mounted all 7 `/api/creator` routes on the shared D1 Worker for payout KYC, status, submit/update, withdrawal eligibility, list, and creation. Auth before validation, creator role gates, encrypted sensitive KYC fields, guarded withdrawal/review batch writes, and D1 fraud checks preserved. [Evidence](docs/handoffs/2026-11-25-d1-creator.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit, strict credential check, and scoped `git diff --check` passed. Audit: 638 legacy / 568 D1 / 562 matched / 76 missing; `/api/creator` 7/0.
- **Boundary:** No new migration. D1 schema lacks Mongo partial unique indexes for `creator_payout_kycs.user_id` and active `withdrawal_requests` lock; code uses guarded checks/batch inserts. MongoDB remains authoritative.

### 2026-11-25 - D1 user discovery and profile-media

- **Status:** mounted 6 `/api/users` routes on the shared D1 Worker: search, hosts suggested, recommended chat, PK history, profile-media add/delete. Auth before validation, legacy validation/DTO behavior, D1 profile-media position/slice semantics, and PK history reuse the D1 battle presenter. `recommended-chat` returns empty because D1 has no live presence source. [Evidence](docs/handoffs/2026-11-25-d1-user-discovery.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 (passed on rerun; intermittent unrelated `d1-reports` count assertion observed on an intermediate run), endpoint audit, strict credential check, and scoped `git diff --check` passed. Audit: 638 legacy / 561 D1 / 555 matched / 83 missing; `/api/users` 48/5.
- **Boundary:** No new migration. Recommended-chat live presence remains legacy-only. Remaining `/api/users` routes: DELETE /me, friend-match (3), messages/:userId/call. MongoDB remains authoritative.

### 2026-11-25 - D1 recordings

- **Status:** mounted all seven `/api/recordings` routes on the shared D1 Worker with auth-before-validation, host-only guards, LIVE-room start check, legacy DTO shape, pre-increment view response, and no D1 socket fan-out for `recording:started`/`recording:stopped`. Uses existing `room_recordings` table. [Evidence](docs/handoffs/2026-11-25-d1-recordings.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 (rerun; first run hit intermittent unrelated `d1-reports` count assertion), endpoint audit, strict credential check, and scoped `git diff --check` passed. Audit: 638 legacy / 555 D1 / 549 matched / 89 missing; `/api/recordings` 7/0.
- **Boundary:** No new migration. Recording realtime broadcast remains legacy-only. MongoDB remains authoritative; 89 legacy routes remain unmounted across PK, trust verification, AI, upload, creator, discover, games writes/share, gifts mutations, users, v1 moderation report/appeal/status, dating explore, payments webhook, and `/api/`.

### 2026-11-25 - D1 admin core routes

- **Status:** mounted 60 admin core routes for users, profiles, reports, moderation queue, messages, chats, and rooms on the shared D1 Worker. Admin auth and permission checks run before validation; D1 table writes, safety refresh, moderation actions, and audit logs are preserved. Admin sockets, user disconnect, and other realtime side effects remain legacy-only. [Evidence](docs/handoffs/2026-11-25-d1-admin-core.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit, strict credential check, and `git diff --check` passed. Audit: 638 legacy / 398 D1 / 393 matched / 245 missing; `/api/admin` 75/140.
- **Boundary:** MongoDB remains authoritative. 140 admin patterns remain legacy-only, including analytics, payments, withdrawals, creator KYC, trust verification, PK, uploads, media, reactions, badges, assets, cosmetics, gifts, notifications, referrals, and admin user management.

### 2026-11-25 - D1 experience routes

- **Status:** mounted all 11 `/api/experience` patterns for notification preferences, achievement claim/share, badge gallery/showcase, safety center, creator dashboard and home. Router-scoped auth precedes validation; claims commit one exact tier at a time with deterministic reward-row IDs and conflict on replay. `0030_experience_claim_unique.sql` restores the full tier enum and uniqueness in fresh fixtures. [Evidence](docs/handoffs/2026-11-25-d1-experience.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with a clean-bundle assertion, fixture syntax checks, endpoint audit, strict credential check and `git diff --check` passed. Audit: 638 legacy / 338 D1 / 333 matched / 305 missing; `/api/experience` 11/0.
- **Boundary:** `0030` is applied only in fresh fixtures; the recovered local database remains at `0019`. Hosted application needs duplicate claim-triple audits as well as the `0025`–`0029` audits. Home badge sync is non-blocking and D1 has no achievement-unlock socket or push fan-out. MongoDB remains authoritative. The owner authorized committing and pushing this slice.

### 2026-11-25 — D1 social features

- **Status:** mounted all 20 `/api/social` patterns: mood/activity, waves, daily question, voice polls and countdowns. Router-scoped auth runs before validation; DTOs omit unset values while preserving explicit `activityRoomId: null`. `0029_social_unique.sql` adds the upsert/replay keys and the null-room discriminator; wave sends persist the legacy `WAVE` notification in the same batch. [Evidence](docs/handoffs/2026-11-25-d1-social-features.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with a clean-bundle assertion, fixture syntax checks, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 327 D1 / 322 matched / 316 missing; `/api/social` 20/0.
- **Boundary:** `0029` is applied only in fresh fixtures; the recovered local database remains at `0019`. Hosted application needs duplicate audits of social mood/question/answer/vote keys. D1 has no socket emitter for legacy wave events and no receiving-client fan-out. MongoDB remains authoritative.

### 2026-11-25 — D1 Arcade read routes

- **Status:** mounted `GET /api/games/missions`, `leaderboard` and `challenges` with auth before query work, UTC mission windows, compact populated projections, the raw lean `personalBest` and the preserved negative-limit `$limit` 500. All four Arcade read patterns are now mounted; the three routes added here perform no D1 writes. [Evidence](docs/handoffs/2026-11-25-d1-games-reads.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with a clean-bundle assertion, fixture syntax checks, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 307 D1 / 302 matched / 336 missing; `/api/games` 4/5.
- **Boundary:** legacy leaderboard row order is undefined because `$group` follows `$sort`, while D1 returns deterministic score-descending order. Score writes are paused, challenge writes are legacy-only and score sharing needs Socket.IO fan-out. MongoDB remains authoritative.

### 2026-11-25 — D1 moderation text checks

- **Status:** mounted `POST /api/v1/moderation/check-text` and `check-voice` with auth before validation, host-neutral keyword/regex scoring, the legacy AI placeholders and the direct-Zod-parse 500 body. No D1 writes or migration were added. [Evidence](docs/handoffs/2026-11-25-d1-moderation-checks.md)
- **Verification:** full workspace typecheck, auth Worker 1/1 with a clean-bundle assertion, fixture syntax checks, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 304 D1 / 299 matched / 339 missing; `/api/v1` 2/3.
- **Boundary:** report, appeal and status remain legacy-only because their v1 error and safety-status semantics differ from the mounted D1 reports flow. No moderation queue or action state is mutated by these checks. MongoDB remains authoritative.

### 2026-11-25 — D1 story routes

- **Status:** mounted all 11 `/api/stories` patterns with auth before validation, the legacy create limiter, populated DTOs, view replay, guarded comment/count/notification batches and owner-only hide/delete. `0028_story_views_unique.sql` closes the concurrent view race in fresh fixtures. [Evidence](docs/handoffs/2026-11-25-d1-stories.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, fixture syntax checks, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 302 D1 / 297 matched / 341 missing; `/api/stories` 11/0.
- **Boundary:** `0028` is applied only in fresh fixture emulators; the recovered local database remains at `0019`. Hosted application needs a duplicate `story_views(stories_id, value)` audit. D1 story deletion removes dependent rows that legacy left dangling, and no Worker emitter replaces `notification:new`. MongoDB remains authoritative.

### 2026-11-25 — D1 group chat routes

- **Status:** mounted all eight `/api/groups` patterns with auth before validation, chat limiting, legacy populated DTOs, guarded message/participant writes, creator transfer and last-member cleanup. `0027_group_participants_unique.sql` prevents duplicate participant edges. [Evidence](docs/handoffs/2026-11-25-d1-groups.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, fixture syntax checks, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 291 D1 / 286 matched / 352 missing; `/api/groups` 8/0.
- **Boundary:** `0027` is applied only in fresh fixture emulators; the recovered local database remains at `0019`. Hosted application needs a duplicate `(group_chats_id, value)` audit. D1 has no group-event fan-out and its participant FK rejects dangling user IDs. MongoDB remains authoritative.

### 2026-11-25 — D1 vibe routes

- **Status:** mounted all eight `/api/vibe` patterns with router-scoped auth before validation, legacy scores/labels, ordered child arrays, malformed-pagination behavior and the observed `preferences` upsert defaults. `0026_vibe_graph_unique.sql` adds the one-graph-per-user key. [Evidence](docs/handoffs/2026-11-25-d1-vibe.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, fixture syntax check, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 283 D1 / 278 matched / 360 missing; `/api/vibe` 8/0.
- **Boundary:** `0026` is applied only in fresh fixture emulators. The recovered local database remains at `0019`; hosted application needs a duplicate `vibe_graphs.user_id` audit before `0003`–`0026`. MongoDB remains authoritative; `/api/discover` needs a compatibility decision before porting.

### 2026-11-25 — D1 dating routes

- **Status:** mounted five of six `/api/dating` patterns: preference read/update, like, pass and match listing. Shadow-ban and block guards, validation order and replay follow the legacy handler. Mutual likes commit match creation, 50/75 relationship XP, level/streak notifications and both members in one guarded batch. `0025_dating_swipes.sql` adds fresh-fixture uniqueness keys. `GET /api/dating/explore` stays legacy-only because its presence fields require live Socket.IO/Redis state. [Evidence](docs/handoffs/2026-11-25-d1-dating.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, fixture syntax check, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 275 D1 / 270 matched / 368 missing; `/api/dating` 5/1.
- **Boundary:** `0025` is applied only in fresh fixture emulators. The recovered local database remains at `0019`; hosted application needs a duplicate audit before `0003`–`0025`. MongoDB remains authoritative; live presence, FCM and deployed dating acceptance remain open.

### 2026-11-25 — D1 events routes

- **Status:** mounted all seven `/api/events` handlers through both legacy mounts with limiter/validation order, populated list/detail DTOs, unpopulated user-event DTOs, capacity-safe join, replay classification, host cancellation and leave. `0024_event_participants_unique.sql` closes the concurrent participant race; the join notification remains non-fatal after the authoritative insert. [Evidence](docs/handoffs/2026-11-25-d1-events.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 273 D1 / 268 matched / 370 missing; `/api/events` 14/0.
- **Boundary:** `0024` is applied only in fresh fixture emulators. The recovered local database remains at `0019`; hosted application through `0024`, live FCM delivery and deployed event acceptance remain open.

### 2026-11-25 — D1 direct-send-gift route

- **Status:** mounted `POST /api/direct-send-gift` on the shared D1 Worker with legacy validation order, VIP/interact guards, coin and diamond debit/credit ledgers and creator-share pricing. The gift transaction, both ledger rows, balance updates and profile-marker clears commit in one guarded batch; gift XP, relationship XP, DM and notification are non-fatal post-commit side effects. [Evidence](docs/handoffs/2026-11-25-d1-direct-send-gift.md)
- **Verification:** full workspace typecheck, auth Worker 1/1, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 259 D1 / 254 matched / 384 missing; `/api/direct-send-gift` 1/0.
- **Boundary:** no new migration was needed. MongoDB remains authoritative; hosted migrations, live FCM/realtime delivery and deployed gift acceptance remain open.

### 2026-11-25 — D1 subscription routes

- **Status:** mounted all five `/api/subscriptions` patterns. Prices, expiry, validation order and DTO shape follow the legacy route. The 299/2999-coin debit, subscription row and creator notification commit in one guarded batch with a `SUBSCRIPTION` ledger row; `0023_subscription_unique.sql` adds the legacy unique pair and lookup indexes. [Evidence](docs/handoffs/2026-11-25-d1-subscriptions.md)
- **Verification:** both typechecks, auth Worker 1/1, endpoint audit and `git diff --check` passed. Audit: 638 legacy / 258 D1 / 253 matched / 385 missing; `/api/subscriptions` 5/0.
- **Boundary:** `0023` is not applied to the recovered local database or hosted D1. MongoDB remains authoritative; hosted migrations, live payments, realtime events and deployed acceptance remain open.

### 2026-11-25 — D1 referral routes

- **Status:** mounted all four `/api/referrals` patterns. Code generation keeps the legacy prefix/random suffix; claim validation, replay and post-commit notification follow the legacy handler. Both 100-coin credits and the referral record commit in one guarded batch; `0022_referral_unique.sql` adds code/referral uniqueness and lookup indexes. [Evidence](docs/handoffs/2026-11-25-d1-referrals.md)
- **Verification:** both typechecks, auth Worker 1/1, endpoint audit and `git diff --check` passed. Audit: `/api/referrals` 4/0.
- **Boundary:** `0022` is not applied to the recovered local database or hosted D1. MongoDB remains authoritative; hosted migrations, FCM, realtime events and deployed acceptance remain open.

### 2026-11-25 — D1 battle-pass routes

- **Status:** mounted all three `/api/battle-pass` patterns on the shared D1 Worker. Active seasons and passes are created lazily while imported IDs remain valid. Purchase performs a guarded 999-coin debit and premium upgrade in one batch; claim stages all five reward types with legacy idempotency keys and level-up coins. `prepareD1XpGrant()` now supports a battle-pass reward opt-out so the reward does not recursively grant battle-pass XP. [Evidence](docs/handoffs/2026-11-25-d1-battle-pass.md)
- **Verification:** both typechecks, auth Worker 1/1 and `git diff --check` passed. Audit: 638 legacy / 249 D1 / 244 matched / 394 missing; `/api/battle-pass` 3/0.
- **Boundary:** no migration file was needed; existing season, pass, wallet and XP indexes cover the writes. MongoDB remains authoritative. Hosted `0003`–`0021`, live payments, realtime events and deployed acceptance remain open.

### 2026-11-25 — D1 admin config, audit and support routes

- **Status:** mounted the first eleven `/api/admin` patterns on the local D1 Worker: app-config list/read/upsert/delete, paginated audit logs, and support ticket list/detail/reply/status/assign/stats. Added a Web Crypto admin guard, a shared audit helper, `0009_app_config_key_unique.sql` and `0010_support_ticket_sender.sql`; updated the ticket mapping and local fixtures. [Config/audit evidence](docs/handoffs/2026-11-25-d1-admin-config-and-audit.md) · [Support evidence](docs/handoffs/2026-11-25-d1-admin-support.md)
- **Verification:** both typechecks, focused mapping test 12/12, auth Worker 1/1, production Worker 1/1, push queue 6/6, backend suite (admin 9/9, API 515/515, shared 27/27), production dry-run bundle, banned-import grep and `git diff --check` passed. Audit: 638 legacy / 182 D1 / 177 matched / 461 missing; `/api/admin` 11/204.
- **Boundary:** MongoDB remains authoritative. Hosted `0003`–`0010`, live admin acceptance, data import and deployed smoke tests remain open. The owner authorized committing and pushing the complete working tree; no deploy, provision, hosted migration or hosted data operation was authorized.

### 2026-11-24 — Commit-state wording clarified

- **Status:** documentation-only; no code, data, credential, provisioning or deploy change.
- **Changes:** added a commit-state note to this tracker, `docs/DEVELOPMENT_PROGRESS.md`, `docs/CURRENT_TASK.md` and the migration continuation handoff. Historical "uncommitted" wording is retained as evidence and qualified by checkpoint `b04f77d`.
- **Verification:** `git status` checked before editing; `git diff --check` clean. No tests re-run; no production access.
- **Next task:** continue the Profile slice — Android setup and Edit Profile against the loopback D1 Worker. Commit/push authorization applies only to this documentation commit.

### 2026-11-24 — Local D1 Profile edits

- Compared the D1 setup and edit responses and completion rewards with mounted MongoDB. The local Worker passed concurrent setup and different concurrent edits. The ledger failure fixture proved the Profile and reward writes roll back together. [Verification](docs/handoffs/2026-11-24-d1-profile-edits.md)

### 2026-11-24 — Local D1 Profile reads

- Compared the authenticated D1 reader with mounted MongoDB and exercised Profile reads and visit persistence in the bundled Worker. [Verification](docs/handoffs/2026-11-24-d1-profile-reads.md)

### 2026-11-24 — Profile HTTP baseline and local D1 import

- Verified Profile reads, edit validation, one-time completion XP and actor invalidation. Repaired the save response and the Bond milestone/preference import mismatch. The isolated D1 import retained the fixture's account state, relationship counts and completion receipts. [Verification](docs/handoffs/2026-11-24-profile-contract-baseline.md)

### 2026-11-24 — Full-app Navigation after process death

- Fixed a startup check skipped by restored screens and verified the request order and rendered dock on Android 17. A revoked session discarded the restored Settings stack and returned to Sign in. [Verification](docs/handoffs/2026-11-24-navigation-process-restart.md)

### 2026-11-24 — Local D1 Auth Worker

- Ran the existing Auth routes on a loopback Worker with local D1. The fixture verified sign-in, `/auth/me`, refresh rotation and logout without connecting to MongoDB or Redis. [Verification](docs/handoffs/2026-11-24-local-d1-auth-worker.md)

### 2026-11-24 — Navigation recreation on the emulator

- Fixed explicit tab requests after revealing an existing MainTabs entry. Verified back-stack and queued notification behavior across recreation on Android 17. [Verification](docs/handoffs/2026-11-24-navigation-recreation.md)

### 2026-11-24 — Local Auth parity and Navigation baseline

- Matched the local D1 candidate's Auth outcomes with MongoDB using the same route handlers. Started the Navigation baseline with the core route, dock and startup destination tests. [Auth evidence](docs/handoffs/2026-11-24-auth-journey-parity.md) · [Navigation evidence](docs/handoffs/2026-11-24-navigation-baseline.md)

### 2026-11-24 — Auth access and revocation

- Exercised the shared HTTP and Socket.IO guards on the MongoDB entry points and isolated D1 servers. Logout denied the next HTTP request and reconnect and blocked the open socket's next inbound packet. [Verification and scope](docs/handoffs/2026-11-24-auth-access-revocation.md)

### 2026-11-24 — Auth session persistence adapters

- Verified the shared token service on MongoDB and local D1. The D1 fixture exercised replay after concurrent refresh, account generation after concurrent login, batch rollback and explicit handling of import collisions. [Verification](docs/handoffs/2026-11-24-auth-session-store.md)

### 2026-11-23 — Auth providers and local D1 session mapping

- Added local provider, App Check and warm-session fixtures. Scoped the direct Google verifier to the configured client audience. Preserved legacy generation presence in the D1 mapper and verified it through a local binding. [Verification](docs/handoffs/2026-11-23-auth-providers-and-session-mapping.md)

### 2026-11-23 — Authentication first

- Recorded the owner's journey sequence and passed the first Auth characterization against the current HTTP routes with disposable MongoDB and fixture Firebase keys. Ten focused tests and API typecheck passed. [Auth handoff](docs/handoffs/2026-11-23-auth-journey-baseline.md)

### 2026-11-23 — Legacy direct-message characterization

- Deferred the Arcade write slice at the owner's request. Exercised the existing direct-message endpoints against disposable MongoDB and captured Socket.IO fan-out at the adapter boundary. The test records the distinct-message behavior of repeat sends, XP keys, history paging, read receipts, and privacy behavior. [Evidence](docs/handoffs/2026-11-23-direct-message-baseline.md)

### 2026-11-23 — Local notification and push Queues slice

- Characterized the inbox, socket, preferences and FCM payload behavior. Added an opt-in local Worker queue with durable retry, duplicate suppression, recovery and replay. The default dispatcher and deployed configurations keep the existing provider.
- The focused route/service and local queue tests passed. The [handoff](docs/handoffs/2026-11-23-local-push-queues.md) records verification and the remaining cutover gates.

### 2026-11-23 — Arcade catalog local D1 parity

- The normal catalog route matched JSON and auth errors across MongoDB and local D1. Local usage was 20 rows read, zero written, and 1,601,536 bytes for the full draft schema and fixture. Production configuration still uses the MongoDB path. [Arcade D1 handoff](docs/handoffs/2026-11-23-arcade-catalog-d1-parity.md)

### 2026-11-23 — Behavior-preservation baseline

- Recorded the owner's 18-phase behavior-preservation directive and retained Firebase Auth/FCM and existing journeys. Refreshed the static source indexes and added registries for models, rules, journeys, HTTP, events and dependencies.
- Ran the Arcade catalog against the Express app and disposable MongoDB to establish the first golden comparison. The new fixture checks the serialized response and persisted score state. See the [baseline handoff](docs/handoffs/2026-11-23-behavior-preservation-baseline.md).

### 2026-11-23 — Push delivery retry contract

- Reused the existing notification job and Firebase sender. Queue attempts now report delivery errors and persist transient device targets before retrying partial results.
- API tests passed 467/467 and Worker typecheck passed. Cloudflare Queues wiring and provider integration are still pending. See the [handoff](docs/handoffs/2026-11-23-push-delivery-retries.md).

### 2026-11-23 — Cloudflare migration replanned for $0

- Recorded the budget decision, current provider sequence and R2 activation conditions. The plan uses measured isolated workloads to advance D1 Free evaluation without assuming production capacity.
- Reviewed current Cloudflare quotas and billing semantics, repository status, Worker bindings and the existing notification delivery path. No runtime or account verification was performed. See the [handoff](docs/handoffs/2026-11-23-zero-spend-cloudflare-migration.md).

### 2026-11-23 — DCR-2 parked and not approved

- **Status:** documentation-only decision record. No production data, provisioning, deploy or code change. Changes are uncommitted pending authorization.
- **Added/updated files:** `docs/decisions/0007-dcr2-capacity-gate-not-approved.md`, `docs/decisions/0001-d1-and-r2-target.md`, `docs/cloudflare-migration/decision-request.md`, `docs/database/d1-capacity-assessment.md`, `docs/migration/DCR2_READINESS_RUNBOOK.md`, `docs/migration/data-migration-tooling.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-parked.md`.
- **Verification performed:** `capacity:intake` on the supplied two-record snapshot metrics → NOT READY, 11 missing fields. Owner confirmed Workers Paid = no and metrics unavailable. No fabricated values.
- **Issues:** DCR-2 cannot be evaluated; D1 is not approved and MongoDB remains authoritative.
- **Decisions:** DCR-2 production path parked; Hyperdrive fallback reopened; no cutover or MongoDB removal authorized.
- **Dependencies:** to reopen — Workers Paid approval, real production aggregates, production-shaped snapshot, then the readiness runbook.
- **Risks:** treating D1 design tooling as production-ready; the docs now state explicitly that it is not.
- **Next task:** owner chooses to reopen DCR-2 with paid plan + metrics, advance DCR-3 with the GA date, or advance DCR-4 with origin/CORS and provisioning approvals.

### 2026-11-23 — Durable Object publish race fixed

- **Status:** local correctness fix in an unwired harness. No binding, deploy, runtime wiring or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/packages/shared/src/serializedOperations.ts`, `backend-server/packages/shared/src/serializedOperations.test.ts`, `backend-server/packages/shared/src/index.ts`, `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-do-publish-race-fix.md`.
- **Verification performed:** shared tests 27/27; shared and Worker typechecks; full API suite 462/462; strict credential guard zero findings. No production access.
- **Issues:** the lock is not a substitute for storage-level transactions if a wired design allows other writers; no interoperability proof.
- **Decisions:** none; internal DCR-3 harness correctness.
- **Dependencies:** none for this slice; runtime wiring still needs owner authorization and the GA date.
- **Risks:** an in-flight lock cannot protect against writes from another DO instance; the current design is a single-object harness.
- **Next task:** owner supplies the GA date and authorizes authoritative wiring before any real-path parity run.

### 2026-11-23 — Read-only snapshot export CLI added

- **Status:** local read-only export tooling. No MongoDB connection, export, deploy or data change made by the assistant. Changes are uncommitted; commit/push needs new explicit authorization.
- **Added/updated files:** `backend-server/apps/api/src/migration/nativeCollectionReader.ts`, `backend-server/apps/api/src/migration/nativeCollectionReader.test.ts`, `backend-server/apps/api/src/scripts/export-snapshot.ts`, `backend-server/apps/api/package.json`, `docs/migration/DCR2_READINESS_RUNBOOK.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-snapshot-export-cli.md`.
- **Verification performed:** new tests 3/3; full API suite 462/462; API typecheck; strict credential guard zero findings; CLI guard paths reject before connecting. No database access.
- **Issues:** CLI has not been executed against a real MongoDB source; string-ID collections are defaulted from schema inspection and remain overridable.
- **Decisions:** none; owner authorized building the CLI only, not running it against production.
- **Dependencies:** owner-provided env URI to an isolated/staging database; explicit approval before any production read.
- **Risks:** a full export can be large; `--collections` allows a bounded subset. Credentials remain in env and are never printed or stored by the tool.
- **Next task:** owner runs `snapshot:export` on isolated staging, then `metrics:from-snapshot` on the result and completes the 11 remaining metric fields.

### 2026-11-23 — Snapshot metrics derivation helper added

- **Status:** local read-only input-preparation helper. No database/network access, no fabricated values, no deploy or data change. Changes are uncommitted; commit/push needs new explicit authorization.
- **Added/updated files:** `backend-server/apps/api/src/migration/metricsFromSnapshot.ts`, `backend-server/apps/api/src/migration/metricsFromSnapshot.test.ts`, `backend-server/apps/api/src/scripts/metrics-from-snapshot.ts`, `backend-server/apps/api/package.json`, `docs/migration/DCR2_READINESS_RUNBOOK.md`, `docs/database/d1-capacity-assessment.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-snapshot-metrics-helper.md`.
- **Verification performed:** new tests 5/5; full API suite 459/459; API typecheck; strict credential guard zero findings; CLI smoke on synthetic snapshot. No production access.
- **Issues:** derives 5 of 16 fields; index bytes, growth, plan and monitoring values still require owner sources. Binary stripping is opt-in to avoid misclassifying legitimate text.
- **Decisions:** none; DCR-2 evidence preparation only.
- **Dependencies:** owner supplies a real snapshot export and installs the CLI output as the partial metrics file before filling the remaining fields.
- **Risks:** derived bytes include export newline separators (reconciled with the manifest); estimates must never be presented as measured monitoring values.
- **Next task:** owner runs `metrics:from-snapshot` on a real snapshot, fills the 11 remaining fields, then runs runbook steps 3-10.

### 2026-11-23 — Legacy compatibility adapter added

- **Status:** local pure harness only. No binding, deploy, runtime wiring or data change. Changes are uncommitted; commit/push needs new explicit authorization.
- **Added/updated files:** `backend-server/packages/shared/src/legacyRealtimeAdapter.ts`, `backend-server/packages/shared/src/legacyRealtimeAdapter.test.ts`, `backend-server/packages/shared/src/index.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-legacy-compatibility-adapter.md`.
- **Verification performed:** shared tests 25/25; shared and Worker typechecks. No production access.
- **Issues:** no authoritative publish path or GA date yet; classification defaults to `unknown` for unclassified events.
- **Decisions:** none; implements DCR-3 Option C dual-path support locally.
- **Dependencies:** owner-supplied native GA date and explicit authorization before wiring or committing.
- **Risks:** a legacy socket ack is never proof of commit; the adapter enforces this, but a wired implementation must supply the authoritative eventId.
- **Next task:** record the GA date, then wire authoritative publication and run the parity matrix against both real paths.

### 2026-11-23 — Native command/ack flow added

- **Status:** local harness and typechecked skeleton only. No binding, deploy, runtime wiring or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeProtocol.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.test.ts`, `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-command-ack.md`.
- **Verification performed:** shared tests 19/19; shared and Worker typechecks. No production access.
- **Issues:** no configured authoritative command handler exists; default rejects commands.
- **Decisions:** none; implements DCR-3 ack semantics locally.
- **Dependencies:** a real command handler must commit to authoritative state before returning success.
- **Risks:** an invalid handler ack could claim commit; schema validation rejects malformed acks but cannot verify the write.
- **Next task:** wire room:join and other commands through authoritative services, then run dual-path parity.

### 2026-11-23 — Native Durable Object skeleton added

- **Status:** local typechecked skeleton only. No binding, deploy, live WebSocket, credential or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`, `backend-server/apps/cloudflare-worker/tsconfig.json`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-do-skeleton.md`.
- **Verification performed:** Worker typecheck passed. No runtime or production access.
- **Issues:** not wired; no authentication or authoritative event publication yet.
- **Decisions:** none; implements hibernation requirement from closed DCR-3 inputs.
- **Dependencies:** explicit approval before binding, auth wiring and staging validation.
- **Risks:** typechecked skeleton could be mistaken for a running adapter; docs state it is unwired.
- **Next task:** add authenticated upgrade, authoritative publish and dual-path parity tests before any realtime cutover.

### 2026-11-23 — Native realtime server transport foundation added

- **Status:** local pure transport harness only. No DO binding, runtime wiring, client change, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/packages/shared/src/nativeRealtimeServer.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.test.ts`, `backend-server/packages/shared/src/index.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-server-transport.md`.
- **Verification performed:** shared tests 17/17 passed; shared typecheck passed. No production access.
- **Issues:** unwired; no authentication, persistence or authoritative publish path.
- **Decisions:** none; implements DCR-3 Option C harness work.
- **Dependencies:** owner DCR-3 runtime implementation approval and a DO adapter before staging validation.
- **Risks:** harness success could be mistaken for protocol interoperability; docs state it is unwired.
- **Next task:** build the hibernation-compatible DO adapter using this transport and run the parity matrix against both real paths.

### 2026-11-23 — Read-only media quota reconciliation added

- **Status:** local read-only admin tooling. No quota mutation, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.test.ts`, `backend-server/apps/api/src/routes/adminMedia.ts`, `backend-server/apps/admin/src/MediaPage.tsx`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-media-quota-reconciliation.md`.
- **Verification performed:** targeted API tests 11/11, root typecheck, admin tests 9/9, admin typecheck/build; `dist/` restored. No production access.
- **Issues:** report-only; stale sessions are not swept from this endpoint.
- **Decisions:** none; extends staged DCR-4 admin tooling.
- **Dependencies:** same provisioning and approval gates as the media registry slice.
- **Risks:** drift report compares counters to active sessions only; committed media bytes are a separate quota component already handled by reservation checks.
- **Next task:** owner approves provisioning and any future mutation tooling before category cutover.

### 2026-11-23 — Android profile upload progress/cancel wired

- **Status:** local UI/ViewModel change, compile-verified only. No client release, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `android-client/feature/profile/src/main/java/com/yugm/app/feature/profile/screens/ProfileDetailScreen.kt`, `android-client/feature/profile/src/main/java/com/yugm/app/feature/profile/viewmodel/ProfileViewModel.kt`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-android-upload-progress-cancel.md`.
- **Verification performed:** `:feature:profile:compileDebugKotlin` BUILD SUCCESSFUL; only pre-existing deprecation warnings. No runtime/media/production verification.
- **Issues:** device/emulator visual and live upload QA remain open.
- **Decisions:** none; implements DCR-4 client wiring locally.
- **Dependencies:** release build config, exact API/socket hosts and R2 provisioning approvals remain owner-owned.
- **Risks:** cancellation before session ID cannot call the server cancel endpoint; the local job and cancel flag stop the upload, and the sweeper releases any late reservation.
- **Next task:** owner approves device QA and staging two-client media validation before category cutover.

### 2026-11-23 — Private-media policy applied at runtime boundary

- **Status:** local server authorization change with tests; no provider, deploy, credential or production data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/mediaAccessPolicy.ts`, `backend-server/apps/api/src/migration/mediaAccessPolicy.ts`, `backend-server/apps/api/src/services/media.ts`, `backend-server/apps/api/src/services/media.integration.test.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/migration/private-media-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-private-media-runtime-policy.md`.
- **Verification performed:** targeted tests 21/21 passed; typecheck passed. No production access.
- **Issues:** room admins include moderator/admin/co-host arrays and active RoomParticipant rows; clan admins include LEADER/CO_LEADER/OFFICER roles. Platform-admin override remains excluded per owner decision.
- **Decisions:** implements ADR-0005 policy; no new decision.
- **Dependencies:** category cutover still needs R2 provisioning, exact production CORS/domain and per-category approval.
- **Risks:** broader access than the previous message-only rule; block/hide overrides and authoritative read-time checks mitigate it.
- **Next task:** owner approval for per-category cutover, then verify two-client media access on staging.

### 2026-11-23 — Expired upload-session quota sweeper added

- **Status:** local code and tests only. No provider config, deploy, cron provisioning or production data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/media.ts`, `backend-server/apps/api/src/services/jobs.ts`, `backend-server/apps/api/src/services/media.integration.test.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-upload-quota-sweeper.md`.
- **Verification performed:** targeted media integration/unit tests 14/14 passed; typecheck passed. No production access.
- **Issues:** sweep is local-maintenance only; Cloudflare Cron and production job deployment remain gated.
- **Decisions:** none; implements the DCR-4 quota-leak fix locally.
- **Dependencies:** explicit approval before provisioning/deploying scheduled maintenance.
- **Risks:** staging object deletion is best-effort by design; quota release is committed even if object deletion fails.
- **Next task:** owner approves cron/provisioning and separately authorizes Android progress/cancel wiring.

### 2026-11-23 — Read-only admin media tooling staged

- **Status:** local admin tooling only. No media mutation, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/routes/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.test.ts`, `backend-server/apps/api/src/routes/adminRouterGuards.test.ts`, `backend-server/apps/api/src/app.ts`, `backend-server/apps/admin/src/MediaPage.tsx`, `backend-server/apps/admin/src/App.tsx`, `backend-server/apps/admin/src/navigationPermissions.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-media-tooling.md`.
- **Verification performed:** targeted API tests 16/16, API typecheck, admin tests 9/9, admin typecheck/build; `dist/` restored. No production access.
- **Issues:** read-only lists only; no quota release sweep or media mutation is implemented.
- **Decisions:** none; implements the DCR-4 decision that agent stages local admin tooling.
- **Dependencies:** exact production origin/CORS, provisioning and separate approval for runtime wiring.
- **Risks:** storage keys are visible to authorized admins; signed URLs and mutation controls are not emitted.
- **Next task:** owner approves provisioning and separately authorizes mutation/sweeper tooling before category cutover.

### 2026-11-23 — DCR-5 plan accepted and commit authorized

- **Status:** decision/authorization record; no provision, deploy, credential or data change. Commit/push of current local slices is authorized once by the owner.
- **Added/updated files:** `docs/decisions/0006-implementation-plan-acceptance.md`, `docs/decisions/0004-local-code-and-tests-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/implementation-plan.md`, `docs/CURRENT_TASK.md`, `docs/INDEX.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr5-plan-acceptance.md`.
- **Verification performed:** documentation-only; links checked by inspection. Commit verification and push result are recorded separately in the handoff once complete.
- **Issues:** DCR-2 capacity/recovery gates and runtime implementation gates remain open.
- **Decisions:** DCR-5 plan accepted; one-time commit/push authorization for current local slices only.
- **Dependencies:** new explicit approval for future commit/push, deploy, provisioning and data work.
- **Risks:** one-time authorization could be mistaken for standing authority; ADR-0006 states the limit.
- **Next task:** verify and publish current local slices, then pause pending new approvals.

### 2026-11-23 — DCR-4 decision gate completed

- **Status:** decision recorded plus unwired policy harness; uncommitted. No runtime authorization, provision or data change.
- **Added/updated files:** `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/private-media-authorization.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `backend-server/apps/api/src/migration/mediaAccessPolicy.ts`, `backend-server/apps/api/src/migration/mediaAccessPolicy.test.ts`, `docs/handoffs/2026-11-23-dcr4-decision-complete.md`.
- **Verification performed:** policy tests 6/6 passed; typecheck passed. No production access.
- **Issues:** runtime authorization still only covers direct-message participants; production CORS/domain values and provisioning remain open.
- **Decisions:** DCR-4 Option B; five existing buckets; public variants/private originals; owner/resource-admin/accepted-participant private access; explicit per-env CORS; agent stages local tooling.
- **Dependencies:** exact production origin/CORS, R2 provisioning, owner-approved export, wiring fixes and category cutover approvals.
- **Risks:** unwired harness could be mistaken for runtime behavior; docs state it is a design contract only.
- **Next task:** implement the accepted policy behind resource-boundary checks and stage admin media/quota tooling before any category cutover.

### 2026-11-23 — DCR-3 decision gate completed

- **Status:** decision recorded plus local invalidation emitter; uncommitted. No runtime adapter, deploy, provision or data change.
- **Added/updated files:** `backend-server/apps/api/src/middleware/syncInvalidation.ts`, `backend-server/apps/api/src/middleware/syncInvalidation.test.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/realtime-plan.md`, `docs/REALTIME_EVENTS.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr3-decision-complete.md`.
- **Verification performed:** sync invalidation tests 6/6 passed; typecheck passed. No production access.
- **Issues:** runtime adapter/native DO implementation remains; BONDS emitter is an invalidation, not proof of commit.
- **Decisions:** DCR-3 inputs closed: 90-day support window, hibernation hard requirement, 83-name inventory accepted, BONDS server emitter chosen.
- **Dependencies:** native GA date must be recorded to set the 90-day cutoff; runtime implementation needs separate authorization.
- **Risks:** BONDS invalidations activate existing Android listeners; they carry no payload data and screens re-read authoritative APIs.
- **Next task:** implement/verify the compatibility adapter and hibernating native DO protocol with the dual-path parity suite before any realtime cutover.

### 2026-11-23 — Re-verified all local changes after DCR-2 tooling

- **Status:** verification only; no code behavior, deploy, provision or data change.
- **Added/updated files:** `docs/handoffs/2026-11-23-final-local-verification.md`, `docs/DEVELOPMENT_PROGRESS.md`.
- **Verification performed:** root typecheck passed; API 439/439, hardening 34/34, shared 12/12, admin 9/9; guard suites and strict secret check passed; admin build passed with tracked `dist/` restored; `git diff --check` clean apart from line-ending notices.
- **Issues:** none found in local checks; DCR-2 owner inputs still open.
- **Decisions:** none.
- **Dependencies:** owner evidence for DCR-2 and explicit approval for further commit/push.
- **Risks:** local test success must not be read as production verification.
- **Next task:** owner follows the DCR-2 readiness runbook and supplies real evidence.

### 2026-11-23 — DCR-2 readiness runbook added

- **Status:** documentation-only consolidation. No code, deploy, provision or data change. Changes are uncommitted.
- **Added/updated files:** `docs/migration/DCR2_READINESS_RUNBOOK.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-runbook.md`.
- **Verification performed:** none required for documentation-only change; links checked by inspection.
- **Issues:** DCR-2 gate still open on owner-owned metrics, Workers Paid, recovery evidence and schema approval.
- **Decisions:** none; documents the existing D1 decision and evidence sequence.
- **Dependencies:** owner-supplied metrics, attestations and approved snapshots.
- **Risks:** runbook must not be read as acceptance; it states that explicitly.
- **Next task:** owner follows the runbook and supplies the real evidence before any D1 production step.

### 2026-11-23 — DCR-2 readiness summary added

- **Status:** local aggregation only. No verification claims, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/dcr2Readiness.ts`, `backend-server/apps/api/src/migration/dcr2Readiness.test.ts`, `backend-server/apps/api/src/scripts/dcr2-readiness.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-readiness-summary.md`.
- **Verification performed:** targeted tests 24/24 passed; typecheck passed; CLI smoke on generated reports reported READY 8/8 with 4 review items and an explicit non-acceptance warning. No production access.
- **Issues:** summary readiness depends entirely on supplied reports and attestations.
- **Decisions:** none; implements input aggregation under DCR-5 authorization.
- **Dependencies:** all DCR-2 local reports plus owner attestations.
- **Risks:** a READY summary could be mistaken for cutover approval; CLI and docs state otherwise.
- **Next task:** owner supplies real reports/attestations and reviews open items before any production decision.

### 2026-11-23 — DCR-2 recovery evidence checker added

- **Status:** local evidence validation only. No restore, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/scripts/verify-backup.ts`, `backend-server/apps/api/src/migration/dcr2RecoveryEvidence.ts`, `backend-server/apps/api/src/migration/dcr2RecoveryEvidence.test.ts`, `backend-server/apps/api/src/scripts/dcr2-recovery-evidence.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-recovery-evidence.md`.
- **Verification performed:** targeted tests 22/22 passed; typecheck passed; CLI smoke on generated fixtures reported evidence COMPLETE and 3 review items. No production access.
- **Issues:** evidence completeness is not a restore test; attestations are owner claims.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** real backup verification, rehearsal artifacts and owner attestation.
- **Risks:** a complete evidence bundle could be mistaken for a verified restore; docs and CLI state otherwise.
- **Next task:** owner creates real backups, performs an isolated restore rehearsal and supplies attestations before DCR-2 recovery gate can close.

### 2026-11-23 — DCR-2 billing estimate added

- **Status:** local read-only tooling only. No billing API, database, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/d1BillingEstimate.ts`, `backend-server/apps/api/src/migration/d1BillingEstimate.test.ts`, `backend-server/apps/api/src/scripts/d1-billing-estimate.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-billing-estimate.md`.
- **Verification performed:** targeted tests 19/19 passed; typecheck passed; CLI smoke reported reads/writes/storage within Paid inclusions and three review items. No production access.
- **Issues:** estimates are not invoices; recovery evidence still open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** query observations and completed capacity metrics.
- **Risks:** peak write rate overstates average writes; docs label it as an upper bound.
- **Next task:** owner supplies real observations/metrics and reviews billing/recovery evidence before schema approval.

### 2026-11-23 — DCR-2 query-profile audit added

- **Status:** local read-only tooling only. No query collection, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/queryProfileAudit.ts`, `backend-server/apps/api/src/migration/queryProfileAudit.test.ts`, `backend-server/apps/api/src/scripts/query-profile-audit.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-query-profile-audit.md`.
- **Verification performed:** targeted tests 16/16 passed; typecheck passed; CLI smoke on generated observations reported hard-gate PASS and 4 review items. No production access.
- **Issues:** query evidence is owner-supplied; hard-limit PASS is not query acceptance.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** approved query observations and owner review of full scans/headroom.
- **Risks:** weighted-average throughput estimate is coarse and cannot replace peak measurement.
- **Next task:** owner supplies real query observations, then review index/full-scan and billing evidence.

### 2026-11-23 — DCR-2 projection cross-check added

- **Status:** local read-only tooling only. No metrics collected, no deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/projectionAudit.ts`, `backend-server/apps/api/src/migration/projectionAudit.test.ts`, `backend-server/apps/api/src/scripts/projection-audit.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-projection-audit.md`.
- **Verification performed:** targeted tests 12/12 passed; typecheck passed; CLI smoke on generated snapshots reported a 1-hour window and four review items. No production access.
- **Issues:** a short snapshot window cannot prove seasonality; index bytes and retention remain owner evidence.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** two owner-approved snapshots and a completed metrics file.
- **Risks:** byte growth from snapshots may not reflect retained/indexed totals; docs state this.
- **Next task:** owner supplies real snapshots and metrics, then reviews the four projection items.

### 2026-11-23 — DCR-2 metrics intake helper added

- **Status:** local input-preparation tool only. No metrics collected, no deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/dcr2MetricsIntake.ts`, `backend-server/apps/api/src/migration/dcr2MetricsIntake.test.ts`, `backend-server/apps/api/src/scripts/dcr2-metrics-intake.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-metrics-intake.md`.
- **Verification performed:** targeted tests 9/9 passed; typecheck passed; CLI smoke showed incomplete template NOT READY and completed fixture READY/PASS. No production access.
- **Issues:** real DCR-2 metrics remain owner-supplied; hard-limit PASS is not acceptance.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-supplied aggregates, Workers Paid, query/growth/recovery evidence.
- **Risks:** a completed template could be treated as verified capacity; docs and CLI label it as screening only.
- **Next task:** owner fills the template from approved monitoring/export aggregates, then review the five open items.

### 2026-11-23 — DCR-1 closed after successful deployment

- **Status:** documentation-only closure record. No code, credential, deploy or data change in this entry.
- **Added/updated files:** `docs/decisions/0003-credential-remediation-approach.md`, `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/migration/BASELINE_REPORT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr1-local-cleanup.md`.
- **Verification:** owner confirmed deployment of commit `d4b0510` succeeded with strict `secrets:check:strict` CI active. No values were printed or copied.
- **Issues:** none for DCR-1; history rewrite was not selected.
- **Decisions:** DCR-1 Option A closure recorded.
- **Dependencies:** DCR-2/DCR-3/DCR-4 inputs, recovery gates and cutover approvals remain open.
- **Risks:** optional gitleaks and periodic secret-store review remain follow-ups, not DCR-1 blockers.
- **Next task:** owner supplies the remaining DCR inputs and approves a verified backup/restore rehearsal.

### 2026-11-23 — DCR-1 local credential cleanup staged

- **Status:** owner-confirmed rotation; local config/CI cleanup staged and uncommitted. No credential value exposed or stored by the assistant.
- **Added/updated files:** `backend-server/apps/cloudflare-worker/wrangler.jsonc`, `.gitignore`, `.github/workflows/ci.yml`, `docs/decisions/0003-credential-remediation-approach.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BASELINE_REPORT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr1-local-cleanup.md`.
- **Verification performed:** strict secret guard zero findings across 30 tracked config files; credential guard tests 8/8; config parses as JSON; ignore rules verified with `git check-ignore`; `git diff --check` clean apart from line-ending notices.
- **Issues:** commit/push and first strict CI run still pending; no history rewrite performed.
- **Decisions:** DCR-1 Option A already accepted; owner confirmed provider rotation on 2026-11-23.
- **Dependencies:** explicit commit/push approval, then CI observation and secret-store confirmation for staging/production separation.
- **Risks:** removing tracked values does not by itself invalidate leaked history; owner rotation is the mitigating control and has been confirmed.
- **Next task:** commit/push after explicit approval, then verify the strict CI gate on the first run.

### 2026-11-23 — Consolidated local verification pass

- **Status:** verification only; no code behavior, deploy, provision or data change. Changes remain uncommitted.
- **Added/updated files:** `docs/handoffs/2026-11-23-final-local-verification.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`.
- **Verification performed:** root typecheck passed for all workspaces; API 421/421, hardening 34/34, shared 12/12, admin 9/9; credential guard 8/8, OpenAPI guard 6/6, config manifest 3/3, worker-config guard 5/5; `openapi:check` PASS; admin build passed with tracked `dist/` restored; `git diff --check` clean apart from line-ending notices.
- **Issues:** worker-config guard remains report-only with 6 owner-decision findings.
- **Decisions:** none; local evidence only.
- **Dependencies:** owner decisions and approvals remain unchanged.
- **Risks:** passing local suites must not be read as production verification or CI success.
- **Next task:** owner supplies DCR inputs/approvals before any provisioning, deploy, migration or commit/push of these slices.

### 2026-11-23 — Delta rate audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/deltaRateAudit.ts`, `backend-server/apps/api/src/migration/deltaRateAudit.test.ts`, `backend-server/apps/api/src/scripts/delta-rate-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-delta-rate-audit.md`.
- **Verification performed:** targeted tests 26/26 passed; typecheck passed; CLI smoke reported a 2-hour window with 0.5 changes/hour. No production access.
- **Issues:** averages do not establish peak rate; owner decisions remain open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots with valid watermarks before real use.
- **Risks:** a two-snapshot average could be mistaken for peak load; docs state the opposite.
- **Next task:** owner decides online/offline replay and maximum cutover downtime before implementation.

### 2026-11-23 — Child-table impact audit added (final delta-sync input)

- **Status:** local reporting/refactor only. No DDL behavior change, delete, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/childTables.ts`, `backend-server/apps/api/src/migration/childTableAudit.ts`, `backend-server/apps/api/src/migration/childTableAudit.test.ts`, `backend-server/apps/api/src/scripts/child-table-audit.ts`, `backend-server/apps/api/src/scripts/generate-d1-schema.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-child-table-audit.md`.
- **Verification performed:** targeted tests 23/23 passed; typecheck passed; `schema:d1` regenerated 146 tables with no SQL change; CLI smoke reported 26 root tables and 49 child tables. No production access.
- **Issues:** replacement-scope decision remains open; report is static sizing evidence.
- **Decisions:** none; shares one child-table source between generator and audit.
- **Dependencies:** owner decision on per-parent vs per-batch replacement before delta implementation.
- **Risks:** a future child table added directly to the generator would bypass the audit; docs note the shared module.
- **Next task:** owner decides replacement unit before implementing delta child-row handling.

### 2026-11-23 — Financial delta audit added (final delta-sync input)

- **Status:** local read-only sizing tool. No reconciliation, export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/financialDeltaAudit.ts`, `backend-server/apps/api/src/migration/financialDeltaAudit.test.ts`, `backend-server/apps/api/src/scripts/financial-delta-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-financial-delta-audit.md`.
- **Verification performed:** targeted tests 19/19 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke reported 1 changed wallet transaction. No production access.
- **Issues:** sizing only; no balance reconciliation or maintenance-window decision.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots and remaining delta-sync design decisions.
- **Risks:** collection allowlist could miss a future money collection; docs name the six current authoritative collections.
- **Next task:** owner decides online vs maintenance-window financial deltas before implementation.

### 2026-11-23 — Deletion audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, delete, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/deletionAudit.ts`, `backend-server/apps/api/src/migration/deletionAudit.test.ts`, `backend-server/apps/api/src/scripts/deletion-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-deletion-audit.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported 1 soft-deleted record. No production access.
- **Issues:** sizing evidence only; no deletion representation decision was made.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots and remaining delta-sync design decisions.
- **Risks:** soft-delete detection is field-configurable and heuristic; hard removals rely on complete source IDs in both snapshots.
- **Next task:** owner decides tombstone vs explicit deletion list before implementing delta deletion handling.

### 2026-11-23 — Watermark candidate audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/watermarkAudit.ts`, `backend-server/apps/api/src/migration/watermarkAudit.test.ts`, `backend-server/apps/api/src/scripts/watermark-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-watermark-audit.md`.
- **Verification performed:** targeted tests 15/15 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture reported viable and sorted. No production access.
- **Issues:** viability does not prove MongoDB export support; owner design decisions remain open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved export before real use; open delta-sync decisions.
- **Risks:** a non-date opaque string is accepted as a logical cursor value; docs state that viability is not a MongoDB export guarantee.
- **Next task:** owner decides watermark field/order and remaining delta-sync design items before implementation.

### 2026-11-23 — Report-only Worker config guard added

- **Status:** local guard script and report-only CI step. No config, deploy, provision, credential or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-worker-config.mjs`, `backend-server/scripts/check-worker-config.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-worker-config-guard.md`.
- **Verification performed:** `test:worker-config` 5/5 passed; `worker-config:check` reported 6 current findings with no values printed. No production access.
- **Issues:** findings are intentionally not fixed here; production observability and CORS are owner decisions.
- **Decisions:** none; implements a report-only guard under DCR-5 authorization.
- **Dependencies:** owner decision and config change before findings can be closed.
- **Risks:** JSONC parsing is a small local subset; guard is report-only so it cannot block deploys by itself.
- **Next task:** owner approves staging redaction, production observability and explicit CORS values before production traffic.

### 2026-11-23 — Value-free config manifest added

- **Status:** local inventory tooling only. No credential values read into output, no push, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-tracked-secrets.mjs`, `backend-server/scripts/config-backup-manifest.mjs`, `backend-server/scripts/config-backup-manifest.test.mjs`, `backend-server/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-config-manifest.md`.
- **Verification performed:** `test:config-manifest` 3/3 passed; `config:manifest` produced a 30-file tracked-config manifest with hashes only. No production access.
- **Issues:** not a config backup; ignored secret files and external config remain owner-managed.
- **Decisions:** none; implements backup procedure step 5 preparation under DCR-5 authorization.
- **Dependencies:** owner-managed protected store for actual config values before recovery is valid.
- **Risks:** a hash-only manifest could be mistaken for a backup; documentation states the opposite.
- **Next task:** owner creates and verifies the actual protected configuration backup before any destructive migration step.

### 2026-11-23 — Combined backup rehearsal runner added

- **Status:** local read-only snapshot input plus local artifact writes only. No export, provision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/backupRehearsal.ts`, `backend-server/apps/api/src/migration/backupRehearsal.test.ts`, `backend-server/apps/api/src/scripts/backup-rehearse.ts`, `backend-server/apps/api/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-backup-rehearsal-runner.md`.
- **Verification performed:** targeted tests 13/13 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated snapshot printed PASS for integrity, dry-run rehearsal and combined result. No production access.
- **Issues:** no real backup or restore; combined PASS is not a restore verification.
- **Decisions:** none; implements backup step 7 plus dry-run rehearsal under DCR-5 authorization.
- **Dependencies:** owner-approved snapshot copy before real use; restore rehearsal still requires an isolated target and real data.
- **Risks:** the combined PASS could be mistaken for a successful restore; wording and docs explicitly deny that.
- **Next task:** owner approves a real export target, then run verification and rehearsal on that copy before any destructive step.

### 2026-11-23 — OpenAPI structural guard added to CI

- **Status:** local guard script and CI steps only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-openapi.mjs`, `backend-server/scripts/check-openapi.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/implementation-plan.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-openapi-guard.md`.
- **Verification performed:** `test:openapi` 6/6 passed; `openapi:check` passed against the real spec (90 paths, 16 schemas, 23 local refs). No network or production access.
- **Issues:** structural guard only; it does not replace full OpenAPI schema validation with `swagger-cli`.
- **Decisions:** none; closes a Phase 0 CI observation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the CI steps should become active.
- **Risks:** regex-based YAML inspection can miss exotic syntax; documented as a guard, not a validator. CI YAML was not parser-validated locally.
- **Next task:** decide whether to add full `swagger-cli` validation to CI with a pinned dependency.

### 2026-11-23 — Admin view permission helper extracted and tested

- **Status:** local admin UI hardening and tests. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/admin/src/navigationPermissions.ts`, `backend-server/apps/admin/src/navigationPermissions.test.ts`, `backend-server/apps/admin/src/App.tsx`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`, `docs/handoffs/2026-11-23-admin-router-auth-guards.md`.
- **Verification performed:** admin tests 9/9, typecheck and Vite build passed; `dist/` artifacts restored to HEAD. No production access.
- **Issues:** pure permission decisions are tested; component rendering/runtime UI QA remains pending.
- **Decisions:** none; preserves server authority and existing permitted views while closing a UI bypass gap.
- **Dependencies:** owner approval before commit/push if these UI changes should become active.
- **Risks:** view guard uses the same permission map as sidebar; a missing map entry would leave a view unrestricted rather than deny-by-default. Tests assert the map is non-empty but cannot prove every future view is mapped.
- **Next task:** runtime admin UI QA across roles before treating view-level permissions as verified.

### 2026-11-23 — Admin API client tests added to CI gate

- **Status:** local admin test scaffolding and CI step only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/admin/src/api.ts`, `backend-server/apps/admin/src/api.test.ts`, `backend-server/apps/admin/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/feature-matrix.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`.
- **Verification performed:** admin tests 5/5, typecheck and Vite production build passed locally; `dist/` artifacts restored to HEAD. No YAML parser/actionlint available and no CI run triggered.
- **Issues:** tests cover API-client/formatting behavior only; view-level permission rendering remains untested.
- **Decisions:** none; closes the admin test-script finding under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the CI test step should become active.
- **Risks:** `tsx` resolves from the hoisted workspace root; a fresh install must preserve that resolution. The CI workflow was not parser-validated locally.
- **Next task:** add admin view-level permission-rendering tests before treating the admin UI as verified.

### 2026-11-23 — Explicit admin router auth guards added

- **Status:** local server-side security hardening. No permission change, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/routes/adminAssets.ts`, `adminBadges.ts`, `adminCosmetics.ts`, `adminReactions.ts`, `adminSupport.ts`, `backend-server/apps/api/src/routes/adminRouterGuards.test.ts`, `docs/architecture/backend-source-audit.md`, `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/private-media-authorization.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-router-auth-guards.md`.
- **Verification performed:** guard tests 5/5, full API suite 395/395, hardening suite 34/34, typecheck passed. No production access.
- **Issues:** unauthenticated 401 tests plus valid-JWT/guard-layer tests were added later in the day; real route-handler execution under a valid JWT remains untested. The public badge-art router remains intentionally public.
- **Decisions:** none; preserves effective permissions while removing mount-order dependence.
- **Dependencies:** owner approval before commit/push if these guards should become active.
- **Risks:** double auth runs for routers mounted after `adminRouter`; correctness preserved, minor extra JWT/DB lookup per request.
- **Next task:** add route-handler execution tests under a valid admin JWT before treating admin authorization as fully verified.

### 2026-11-23 — Admin CI typecheck/build gate added

- **Status:** local workflow configuration only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `.github/workflows/ci.yml`, `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`.
- **Verification performed:** local admin typecheck and Vite production build passed; workflow structure inspected manually. No YAML parser/actionlint was available locally and no CI run was triggered.
- **Issues:** admin still has no test script; this is not a test gate. Strict secret scanning remains blocked on credential rotation.
- **Decisions:** none; closes a Phase 0 CI observation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the workflow change should become active in GitHub Actions.
- **Risks:** an untested workflow edit could fail remotely; local commands were run with the same workspace scripts and the YAML was manually checked.
- **Next task:** owner approves commit/push, then observe the first CI run with the new job before treating the gate as active.

### 2026-11-23 — Snapshot delta diff added (final delta-sync planning aid)

- **Status:** local read-only tooling only. No export, import, provision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/snapshot.ts`, `backend-server/apps/api/src/migration/snapshotDiff.ts`, `backend-server/apps/api/src/migration/snapshotDiff.test.ts`, `backend-server/apps/api/src/scripts/snapshot-diff.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-snapshot-delta-diff.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on two generated snapshots printed added/removed/changed counts and field names only. No production access.
- **Issues:** this is not final delta sync; watermark export, tombstones/deletion lists, upsert-by-source_id, child-row replacement and delta checkpoints remain open.
- **Decisions:** none; implements a verification aid under DCR-5 local-code-and-tests authorization.
- **Dependencies:** two owner-approved snapshots before real use; open delta design decisions.
- **Risks:** a snapshot diff could be mistaken for an authoritative delta export; documented as a planning aid only.
- **Next task:** owner resolves the final delta-sync design decisions before any delta exporter/upsert implementation.

### 2026-11-23 — D1 draft schema conflicts refined (local code + tests)

- **Status:** local DDL/transform refinement only. No database, export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/transform.ts`, `backend-server/apps/api/src/migration/types.ts`, `backend-server/apps/api/src/migration/mappings.ts`, `backend-server/apps/api/src/migration/transform.test.ts`, `backend-server/apps/api/src/migration/mappings-progression.test.ts`, `backend-server/apps/api/src/scripts/generate-d1-schema.ts`, `backend-server/apps/api/migrations/d1/0001_initial.sql`, `backend-server/apps/api/migrations/d1/0001_initial.manifest.json`, `docs/database/d1-schema-warning-triage.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-d1-schema-conflict-refinement.md`.
- **Verification performed:** full migration suite 163/163 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `schema:d1` regenerated 146 tables with 0 warnings/import failures; SQL diff limited to three nullable columns, two `REAL` columns/checks and the manifest timestamp.
- **Issues:** none introduced in tests; schema remains a review draft and owner approval is still required.
- **Decisions:** resolved draft-level nullability and multiplier typing from source evidence; no product decision and no schema approval.
- **Dependencies:** owner approval of regenerated DDL, DCR-2 metrics/Workers Paid, backup/restore rehearsal and cutover gates.
- **Risks:** REAL multipliers could be mistaken for money columns; documented that money remains INTEGER minor units and only two named fields use REAL.
- **Next task:** owner reviews/refines the regenerated DDL, then approves it as the baseline before rehearsal.

### 2026-11-23 — Private-media authorization audit added (DCR-4 input preparation)

- **Status:** documentation-only source audit. No code, policy, bucket, deploy, migration or data change. No new commit/push authorization.
- **Added/updated files:** `docs/migration/private-media-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-private-media-authorization-audit.md`.
- **Finding:** current non-owner `PRIVATE` access is implemented only for `ownerType=MESSAGE` direct-message participants; `ROOM`, `CLAN` and other owner types are denied. Latent today because managed upload only accepts `AVATAR`/`USER`, but blocking for any private room/clan/category cutover.
- **Verification performed:** source reads and cross-check of the existing `mediaAccessDecision` unit tests; no runtime verification.
- **Issues:** participant rules are undefined for room/clan/group scenarios; admin asset-staging auth depends on router mount order already flagged in Phase 0.
- **Decisions:** none; no room/clan policy was recommended or selected.
- **Dependencies:** owner definitions for room/clan/message participant rules, block/hide semantics and admin overrides before private category cutover.
- **Risks:** the latent gap could be mistaken for implemented room/clan privacy if only `MediaObject.ownerType` enums are reviewed.
- **Next task:** owner supplies DCR-4 scope and private-media rules; then design the adapter in a separately authorized slice.

### 2026-11-23 — Legacy media reference scanner added (DCR-4 input preparation)

- **Status:** local read-only tooling only. No export, provision, policy decision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/legacyMediaReferences.ts`, `backend-server/apps/api/src/migration/legacyMediaReferences.test.ts`, `backend-server/apps/api/src/scripts/legacy-media-references.ts`, `backend-server/apps/api/package.json`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-legacy-media-reference-scanner.md`.
- **Verification performed:** targeted tests 23/23 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture produced counts and URL digests without echoing raw URLs. No production access.
- **Issues:** this counts references, not existing binaries. The historical unrecoverable-file finding and media backup requirement remain unchanged. No public/private policy is asserted.
- **Decisions:** none; implements DCR-4 input preparation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-approved export or snapshot copy, DCR-4 environment inputs and option selection.
- **Risks:** a reference count could be mistaken for a recoverable binary census; signed/query-bearing URLs are de-queried before hashing and raw values are intentionally not emitted.
- **Next task:** owner supplies a media export or snapshot copy; run both `inventory:media` and `inventory:legacy-media`, then cross-check against the unresolved `/uploads` recovery gap before any cutover.

### 2026-11-23 — D1 hard-limit screener added (DCR-2 input preparation)

- **Status:** local read-only tooling only. No metrics collected, no Cloudflare account queried, no deploy, provision, migration or data change. New changes are uncommitted; no commit/push authorization applies to this slice.
- **Added/updated files:** `backend-server/apps/api/src/migration/d1CapacityGate.ts`, `backend-server/apps/api/src/migration/d1CapacityGate.test.ts`, `backend-server/apps/api/src/scripts/d1-capacity-gate.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BASELINE_REPORT.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-d1-capacity-screener.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke printed `PASS / REVIEW REQUIRED` for a valid fixture and exited 1 with all expected hard-limit failures for an over-limit fixture. No production access.
- **Issues:** no real metrics exist; five review items remain open by design. Hard-limit PASS must not be reported as DCR-2 acceptance.
- **Decisions:** none; implements input preparation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-supplied aggregates, Workers Paid confirmation, query/growth/recovery evidence and schema approval.
- **Risks:** a hard-limit PASS could be mistaken for full capacity approval; the screener relies on decimal byte units and caller-honest aggregates.
- **Next task:** owner supplies metrics in the documented input shape, then review the five open items and the schema before any D1 rehearsal or cutover.

### 2026-11-22 — Realtime parity matrix added (DCR-3 harness, unwired)

- **Status:** local harness only. No adapter, Durable Object, client, deployment or data change. No commit or push.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeParity.ts`, `backend-server/packages/shared/src/realtimeParity.test.ts`, `backend-server/packages/shared/src/index.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-realtime-parity-matrix.md`.
- **Verification performed:** `npm.cmd run test --workspace @yugm/shared` 12/12 passed; `npm.cmd run typecheck --workspace @yugm/shared` and `--workspace @yugm/api` passed; a broken test double was detected by the matrix.
- **Issues:** no real adapter exists, so protocol interoperability is unproven. The `BONDS` and other sign-off-dependent checks are skipped by default; 10 requirements remain documented but not executable.
- **Decisions:** implements the dual-test-matrix consequence of DCR-3 Option C (ADR-0002); no new product decision.
- **Dependencies:** owner DCR-3 inputs, then concrete adapters before the matrix can run against real paths.
- **Risks:** passing against a test double could be mistaken for adapter parity; scenario isolation depends on unique peer IDs and scopes.
- **Next task:** after owner sign-off, implement the compatibility adapter and native DO protocol, then run this matrix against both paths before cutover.

### 2026-11-22 — Read-only media inventory reporter added (DCR-4 input preparation)

- **Status:** local tooling only; no export, provision, policy decision, deployment or data change. No commit or push.
- **Added/updated files:** `backend-server/apps/api/src/migration/mediaInventory.ts`, `backend-server/apps/api/src/migration/mediaInventory.test.ts`, `backend-server/apps/api/src/scripts/media-inventory.ts`, `backend-server/apps/api/package.json`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-media-inventory-reporter.md`.
- **Verification performed:** `npm.cmd exec -- tsx --test src/migration/mediaInventory.test.ts src/migration/verifyBackup.test.ts` 10/10 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `inventory:media` CLI smoke on a generated JSONL fixture produced a complete report. No database, bucket or remote access.
- **Issues:** no real media data was read; legacy `/uploads` coverage, binary verification and media backup remain unaddressed. Public/private bucket policy is deliberately not asserted because DCR-4 is still open.
- **Decisions:** none; implements an input-preparation item from DCR-4 under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-approved media export before real numbers; DCR-4 environment inputs and option selection.
- **Risks:** partial inventory could be mistaken for a complete media census or for proof that binaries exist and are restorable.
- **Next task:** owner supplies DCR-4 scope/environment inputs and approves an export; then run the reporter on real data and cross-check against the legacy `/uploads` gap before any cutover.

### 2026-11-22 — Snapshot-copy integrity verifier added (Phase 1 tooling)

- **Status:** local read-only tooling only. No backup created, no restore rehearsed, no commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `backend-server/apps/api/src/migration/verifyBackup.ts`, `backend-server/apps/api/src/migration/verifyBackup.test.ts`, `backend-server/apps/api/src/scripts/verify-backup.ts`, `backend-server/apps/api/src/migration/snapshot.ts`, `backend-server/apps/api/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-backup-integrity-verifier.md`.
- **Verification performed:** `npm.cmd exec -- tsx --test src/migration/verifyBackup.test.ts src/migration/adapters.test.ts` 9/9 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `backup:verify` CLI smoke on a generated fixture produced `PASS` with and without `--expect-digest`. No database, bucket or remote service access.
- **Issues:** verification statuses in `BACKUP_AND_RECOVERY.md` section 5 are unchanged — no real backup or restore yet. The verifier proves copy integrity only, not recoverability.
- **Decisions:** no new product decision; implements procedure step 7 from `docs/migration/BACKUP_AND_RECOVERY.md` under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval and an explicitly identified source environment before any real export; then isolated restore rehearsal and financial/media reconciliation.
- **Risks:** a digest match could be mistaken for a successful restore; manifest and data could be tampered with consistently unless the source digest is recorded independently.
- **Next task:** owner approval for a specific export target, then create and verify a real backup and rehearse a restore before any destructive migration step.

### 2026-11-22 — Native realtime contract foundation added (local, unwired)

- **Status:** local DCR-3 foundation only; no protocol cutover, adapter or client change. No commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeProtocol.ts`, `backend-server/packages/shared/src/realtimeProtocol.test.ts`, `backend-server/packages/shared/src/index.ts`, `backend-server/packages/shared/package.json`, `docs/migration/realtime-plan.md`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-native-realtime-contract.md`.
- **Verification performed:** `npm.cmd run typecheck --workspace @yugm/shared` passed; `npm.cmd run test --workspace @yugm/shared` 8/8 passed; `npm.cmd run typecheck --workspace @yugm/api` passed. Event constants re-checked against the source-verified inventory (47 + 16 + 17 + 3 = 83 names).
- **Issues:** contract is not consumed by any runtime path; event classification, support window, hibernation requirement, `BONDS` decision and inventory sign-off are still open. No interoperability between the Socket.IO adapter and native protocol has been demonstrated.
- **Decisions:** follows DCR-3 Option C ([ADR-0002](docs/decisions/0002-staged-hybrid-realtime-protocol.md)) and DCR-5 local-code-and-tests ([ADR-0004](docs/decisions/0004-local-code-and-tests-authorization.md)); no new product decision made.
- **Dependencies:** owner DCR-3 inputs, then adapter/parity tests and D1 DO integration design; credential rotation, backup/restore rehearsal and DCR-4 remain prerequisites for cutover.
- **Risks:** an unwired contract could be mistaken for a working adapter; off-catalog literals remain the highest drift risk; dual-protocol maintenance cost until the support-window cutoff.
- **Next task:** after owner sign-off, classify events and build the two-client parity matrix (reconnect, restart, ordering, dedupe, room/DM/gift/PK) before any adapter or cutover work.

### 2026-11-22 — Phase 0 started

- **Status:** In progress.
- **Modified files so far:**
  - `docs/infrastructure/cloudflare-platform-limits.md` (new; official platform-limit/pricing snapshot).
  - `docs/database/d1-capacity-assessment.md` (new; incomplete decision gate with required metrics).
  - `docs/infrastructure/tracked-worker-credentials-finding.md` (new; no secret values reproduced).
  - `MIGRATION_PROGRESS.md` (new; this tracker).
- **Verification performed:** Read AGENTS/index/task docs and checked `git status --short` before edits. Verified with Git commands that `backend-server/apps/cloudflare-worker/wrangler.jsonc` is tracked and not ignored. Fetched official Cloudflare limit/pricing pages. No build, test, migration, deploy or live request was run for Phase 0.
- **Issues:**
  - Critical: tracked Worker config contains plaintext credentials. Remediation requires owner authorization and provider access; see the finding document.
  - Production size/growth/DAU/write-volume metrics are unavailable; D1 decision is blocked.
  - Existing Worker prototype is experimental, uses a singleton Durable Object around Express/Mongoose, GridFS media and a non-hibernating Engine.IO bridge; it is not a production architecture.
- **Decisions:** None committed in Phase 0. D1 remains provisional pending the capacity assessment.
- **Dependencies:** Completed source audits for backend, Android, admin/infrastructure, docs/tests; production metrics and owner approval for credential rotation.
- **Risks:** Secret exposure, incorrect capacity choice, Socket.IO protocol incompatibility, R2/GridFS media divergence, financial atomicity loss, unsupported Node packages in Workers.
- **Next task:** Reconcile the four repository audits into the Phase 0 report and repository-specific phased implementation plan; update this tracker and the task/progress docs.

### 2026-11-22 — Phase 0 evidence and planning expansion

- **Status:** In progress; documentation and source audits expanded, backend/Android audit reconciliation still pending.
- **Added/updated files:**
  - `docs/infrastructure/cloudflare-platform-limits.md` (new; official limits/pricing snapshot).
  - `docs/database/d1-capacity-assessment.md` (new; blocked decision gate).
  - `docs/database/mongo-to-relational-mapping.md` (new; Phase 0 mapping specification, no schema generated).
  - `docs/infrastructure/tracked-worker-credentials-finding.md` (new; no secret values reproduced).
  - `docs/infrastructure/worker-prototype-audit.md` (new; singleton DO/GridFS/Engine.IO bridge audit).
  - `docs/infrastructure/admin-deployment-audit.md` (new; admin, Wrangler, Render and CI/CD audit).
  - `docs/infrastructure/environments.md` (new; environment/binding/secrets plan).
  - `docs/architecture/target-architecture.md` (new; target responsibility map).
  - `docs/architecture/backend-source-audit.md` (new; backend runtime, persistence, API, auth, realtime, jobs and test-gap audit).
  - `docs/cloudflare-migration/phase0-report.md` (new; reconciled evidence baseline).
  - `docs/migration/feature-matrix.md` (new; per-feature state, entities, endpoints, clients, risks and tests).
  - `docs/migration/api-compatibility.md` (new; old/new parity and client compatibility rules).
  - `docs/migration/data-migration-tooling.md` (new; export/import/validation/rollback requirements).
  - `docs/migration/realtime-plan.md` (new; Socket.IO/Durable Object decision gate).
  - `docs/migration/implementation-plan.md` (new; Phase 0–8 dependency chain).
  - `docs/testing/migration-test-plan.md` (new; reuse existing harnesses plus required migration checks).
  - `docs/INDEX.md` (updated; Phase 0 links).
- **Verification performed:** Read-only static audits of backend source (runtime boot, ~95 models, ~606 route registrations, auth, realtime, jobs, integrations, migrations and tests), Worker source/config/tests, admin SPA, Wrangler configs, Render blueprint, GitHub Actions, test scripts and documentation inventory. Git commands confirmed the local Worker config is tracked and not ignored. No build, test, migration, deploy, provisioning, live request or credential change was run in Phase 0.
- **Issues discovered beyond the earlier baseline:**
  - Admin router auth relies on Express mount order; `GET /api/admin/progression/health` appears dead because it is registered before the router-level guard.
  - Admin UI permission gating is cosmetic; server RBAC is the boundary. Admin has no test script and stale unused shell components.
  - CI lacks admin build/test and secret-scanning gates; staging health gate is not a full migration acceptance gate.
  - Production Wrangler CORS is `*`, staging observability does not redact query strings, and Render/Worker Google Play package names differ.
  - Backend startup runs index/migration/seed steps after `listen()` and only logs failures, allowing degraded traffic; `eventsRouter` is double-mounted; payment and Google Play webhook handlers are implemented but unmounted.
  - User auth revocation cache is per-process for 20 seconds; rate limits fall back to process-local memory without Redis; App Check is off by default.
  - Maintenance/PK timers have no distributed leader election; media session/reservation expiry has no sweeper; migration dry-run and index-conflict tests are absent.
- **Decisions:** None committed. D1 remains blocked; Socket.IO protocol path remains a decision gate; credential remediation remains an owner-authorized prerequisite.
- **Dependencies:** Android source audit output still to reconcile; backend audit integrated; production metrics; owner approval for credential rotation, D1/Hyperdrive decision and plan acceptance.
- **Risks:** Secret exposure, auth mount-order regressions, admin RBAC/UI divergence, D1 capacity mismatch, Socket.IO incompatibility, media cutover without provisioned R2, and false confidence from staging smoke tests.
- **Next task:** Reconcile the remaining Android audit into the per-feature matrix and data/API compatibility plan; then update task/progress docs and stop for approval.

### 2026-11-22 — Phase 0 audits reconciled; audit/planning closed pending decisions

- **Status:** Audit and planning complete; phase not accepted. No implementation phase started.
- **Added/updated files:**
  - `docs/architecture/android-source-audit.md` (new; modules, network, realtime, media, hardcoded catalogs, design system and test gaps).
  - `docs/cloudflare-migration/phase0-report.md` (updated; Android findings, corrected test inventory and final conclusion).
  - `docs/migration/feature-matrix.md` (updated; Android risks per feature plus cross-cutting client debt row).
  - `docs/migration/api-compatibility.md` (updated; concrete Android caller map and compatibility caveats).
  - `docs/migration/implementation-plan.md` (updated; Android Phase 7 debt).
  - `docs/testing/migration-test-plan.md` (updated; Android protocol/ViewModel and catalog-parity test gaps).
  - `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` (updated).
  - `docs/handoffs/2026-11-22-cloudflare-migration-phase0.md` (new; dated handoff).
  - `docs/cloudflare-migration/decision-request.md` (new; consolidated five-gate request with exact metrics, options and approvals).
  - `docs/INDEX.md` (updated; decision-request link and stale "work in progress" note removed).
  - `MIGRATION_PROGRESS.md` (this tracker; status and work log).
- **Verification performed:** Read-only Android source inspection. Key claims were independently re-checked against source before recording: hardcoded catalogs (`CosmeticNames.kt:3–118`, `VipPlansScreen.kt:57`, `GiftCatalogScreen.kt:46`, `FilteredInput.kt:18`), the `coinToInrRate` fallback nuance (`WalletModels.kt:73` default `0.01`, but `CreatorApi.kt:123` prefers the server value), `resolveMediaUrl()` in `ApiConfig.kt:22`, and the `ProfileDetailScreen.kt:202` gap where only `avatarUploadBusy` is read while `ProfileViewModel.kt:154–160` exposes an unused cancel API. `git status --short` reconfirmed the uncommitted R2/media baseline is intact. No build, test, lint, migration, deploy, provisioning, credential change or live request was run.
- **Issues discovered in this reconciliation:**
  - `ProfileDetailScreen` does not consume upload progress or call `cancelOwnAvatarUpload()`; that API is dead from this screen. `CreateProfileScreen` does wire both correctly.
  - Cancellation before the first progress callback is a no-op because the session ID is not yet known; a failed upload does not call server-side cancel, leaving the quota reservation until TTL with no sweeper.
  - 103 direct API calls across 32 screens/nav graphs bypass the ViewModel/repository layer; most API clients are Kotlin `object` singletons rather than DI-managed.
  - Android defines a `BONDS` sync topic that the server's `syncInvalidation` mapping does not emit.
  - Hardcoded catalog/pricing/policy in source (114 cosmetic names, VIP thresholds, gift box prices, event/report categories, `coinToInrRate` fallback) requires an Android release for server-side changes; client keyword filtering is advisory only.
  - No admin media/registry/quota UI exists.
- **Decisions:** None committed. D1/Hyperdrive, realtime protocol and credential remediation remain owner decisions. This documentation-only completion does not satisfy the Phase 0 exit gate.
- **Dependencies:** Production capacity metrics; credential rotation/removal authorization; D1-versus-Hyperdrive ADR; realtime protocol decision; plan acceptance.
- **Risks:** Old-client compatibility with direct composable callers, media quota leaks before a sweeper exists, sync-topic drift, catalog/policy divergence between client and admin, and false confidence from static audits.
- **Next task:** Await owner responses to the [Phase 0 decision request](docs/cloudflare-migration/decision-request.md). Do not start Phase 1 before the gates are resolved.

### 2026-11-22 — Decision brief and realtime event inventory

- **Status:** Documentation-only; Phase 0 still not accepted and no implementation authorized.
- **Added/updated files:**
  - `docs/cloudflare-migration/decision-request.md` (new; DCR-1–DCR-5 with exact inputs, options, approvals and a fill-in response template).
  - `docs/migration/realtime-event-inventory.md` (new; 47 shared + 16 PK events, 17 off-catalog literals, three Android-only dead listeners, admin consumer check and parity-test list).
  - `docs/INDEX.md`, `docs/cloudflare-migration/phase0-report.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/realtime-plan.md`, `docs/architecture/backend-source-audit.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `docs/handoffs/2026-11-22-cloudflare-migration-phase0.md` (updated links and reconciled counts).
  - `MIGRATION_PROGRESS.md` (this tracker; work log).
- **Verification performed:** Read-only source extraction of every realtime emit/listener in `backend-server` and `android-client`, then spot-checked against source: `shared/index.ts:49–97` contains **47** (not 48) `socketEvents`; `api/services/socket.ts:294–302` checks only ObjectId format for DM typing; no `voice:room:presence` emit exists in `apps/api/src`; `api/services/pk.ts:610–615` bypasses the host check when `force` is set; `apps/admin/src` has no socket client. Relative markdown links resolved across the changed docs and `git diff --check` was clean apart from pre-existing LF/CRLF notices. No build, test, lint, migration, deploy, live request or credential change was run.
- **Issues corrected:** earlier documents said 48 shared events; the verified count is 47. `docs/production/socket-inventory.csv` is stale (line numbers no longer match source) and incomplete (11 `NOT VERIFIED` registrations in one file only).
- **Issues discovered:** DM typing spoofing; `pk:force_ended` caller-dependent authorization; emit helpers authorize nothing; socket rate limiting silently drops packets; PK timers disabled on Cloudflare need DO alarms; process-local PK combo/reaction buckets; `clan:member:left` double emit; three dead Android voice-presence listeners; no typed payload contracts for any socket event.
- **Decisions:** None committed. Event inventory is an input to DCR-3, not a protocol choice.
- **Dependencies:** Owner responses to DCR-1–DCR-5; admin `admin.ts` permission trace for admin room emits remains an open verification item.
- **Risks:** Off-catalog events are invisible to shared-schema tests; Socket.IO compatibility or versioned replacement must be chosen before Phase 5; PK financial events need idempotency and ordering guards.
- **Next task:** Await owner responses to the [decision request](docs/cloudflare-migration/decision-request.md). Do not start Phase 1 before the gates are resolved.

### 2026-11-22 — MongoDB to D1 decision and first schema draft (not a migration phase)

- **Status:** Owner selected D1 + R2 as the full target and MongoDB retirement; DCR-2 is resolved in [ADR-0001](docs/decisions/0001-d1-and-r2-target.md). Local non-destructive tooling only; no provision, migration, data change or deploy. DCR-1 and DCR-3 through DCR-5 remain open, and D1 capacity gates are unverified.
- **Changes:** `backend-server/apps/api/src/scripts/generate-d1-schema.ts` and `schema:d1` script; generated `backend-server/apps/api/migrations/d1/0001_initial.sql` (97 roots + 49 child tables = 146 tables, 246 FKs, 204 `CHECK` constraints, 0 warnings) and manifest; Phase 2 tooling in `src/migration/` (transform/checkpoint/validate/snapshot/export/import plus read-only MongoDB source and D1 batch target adapters, golden fixtures, reviewed per-collection mappings for all 97 root collections (identity, auth, finance, subscriptions, assets, media, social/messaging, rooms/live state, progression/rewards, moderation/safety, events/XP/engagement, bonds/vibe graphs, clan/group messaging/comments and final KYC/matching/gifting/notification/payout/PK models) with multi-table replay-safe imports, deterministic `id_map` artifacts and a local-only dry-run rehearsal CLI (`migrate:rehearse`), 138 unit tests); updates to the decision request, D1 assessment, mapping spec, implementation plan, data tooling status, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and [a dated handoff](docs/handoffs/2026-11-22-mongodb-to-d1-decision-and-schema.md).
- **Verification:** schema generator ran with 0 import failures; `tsx --test src/migration/transform.test.ts` 8/8; `tsx --test src/migration/pipeline.test.ts` 7/7; `tsx --test src/migration/adapters.test.ts src/migration/golden.test.ts` 6/6; `tsx --test src/migration/mappings.test.ts` 10/10; `tsx --test src/migration/rehearsal.test.ts` 6/6; `tsx --test src/migration/mappings-social.test.ts src/migration/mappings-domains.test.ts src/migration/mappings.test.ts` 37/37; progression/rewards-focused tests 12/12; moderation/safety-focused tests 12/12; all migration tests 138/138 across 15 files; full API suite 359/359; API typecheck pass; all 97 mappings' columns cross-checked against the generated DDL, including `support_ticket_messages`, `event_participants`, `relationship_users`, `bond_users`, `bond_slots`, `vibe_graph_interests`, `vibe_graph_languages`, `clan_message_reactions`, `conversation_participants` and `match_users`; `migrate:rehearse` CLI smokes on generated fixture snapshots (`users`, `achievements`, `reports`, all 11 events/XP/engagement collections, all six bonds/vibe collections, all six clan/group messaging/comment collections, then all 13 final-batch collections) returned validation PASS/exit 0; generated SQL passed static structure checks (146 unique tables, no dotted/duplicate columns, 246 FKs, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 warnings). No live SQLite parse (`sqlite3` unavailable), export, import or data operation.
- **Generator fix:** Mongoose `Map` wildcard paths (`field.$*`) previously collapsed onto the parent field's SQL column, producing invalid duplicate columns `bonds.preferences` and `room_mode_states.scores`; `generate-d1-schema.ts` now suppresses the duplicate with a DDL note. Regeneration removed one obsolete warning (47 → 46) without dropping a field or changing schema policy; the [warning triage](docs/database/d1-schema-warning-triage.md) and doc counts were updated to match.
- **Progression/rewards batch:** added 15 reviewed mappings and a 12-test focused suite. Badge inline binary is soft-quarantined with `imageUrl`/`assetRef` kept as provenance; legacy badge endpoints and multipart upload are unchanged. Fractional `Number` fields (for example gift-collection bonus multipliers) are a draft-DDL `INTEGER` limitation recorded in the [triage proposal](docs/database/d1-schema-warning-triage.md), not a schema approval. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-progression-mappings.md).
- **Moderation/safety batch:** added 11 reviewed mappings and a 12-test focused suite, bringing the registry to 61 collections. Reports, queues, moderation actions, admin audit/moderation actions, support tickets/messages, trust verifications, face/voice submissions and user safety statuses keep draft-DDL enums, bounded integers, UTC dates, canonical JSON, boolean flags and references; embedded support messages become deterministic `support_ticket_messages` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-moderation-mappings.md).
- **Events/XP/engagement batch:** added 11 reviewed mappings and a 12-test focused suite, bringing the registry to 72 collections. App config Mixed values, countdown/event enums and defaults, XP cap/grant state, moods, nudges, visits, likes, referrals and relationships keep draft-DDL columns, enums, canonical JSON and UTC dates; reference arrays become deterministic `event_participants` and `relationship_users` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-events-mappings.md).
- **Bonds/vibe batch:** added six reviewed mappings and a 12-test focused suite, bringing the registry to 78 collections. Bond status/request enums, per-user Map preferences, ranking entry JSON, replay keys, integer points and vibe-score bounds keep draft-DDL columns; reference/primitive arrays become deterministic `bond_users`, `bond_slots`, `vibe_graph_interests` and `vibe_graph_languages` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-bonds-mappings.md).
- **Messaging/comments batch:** added six reviewed mappings and a 12-test focused suite, bringing the registry to 84 collections. Clan invite statuses, group message media enums and defaults, watch-party playback flags and UTC state keep draft-DDL columns; clan message reactions and group-chat participant IDs become deterministic `clan_message_reactions` and `conversation_participants` rows. `story_comments.parent_id` is preserved as null for root comments (the draft DDL's `NOT NULL` is a flagged schema issue). Details in [the dated handoff](docs/handoffs/2026-11-22-d1-messaging-mappings.md).
- **Final reviewed mappings:** added transforms for the last 13 root models (KYC, friend matches, gifts, matches, notifications/campaigns, payout reviews and PK) plus a 14-test focused suite, completing all 97 reviewed root models. Defaults, enums, UTC timestamps, integer state and canonical JSON follow the draft DDL; `Match.users` becomes deterministic `match_users` child rows. `story_comments.parent_id`, `gifts.expires_at` and `gifts.collection_id` remain flagged source/DDL null conflicts rather than silently coerced. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-final-mappings.md).
- **Next task:** owner decides the 46 warnings using the source-checked [triage proposal](docs/database/d1-schema-warning-triage.md), then refine/approve `0001_initial.sql`, including the `story_comments.parent_id` and `gifts.expires_at`/`gifts.collection_id` null conflicts; rehearse restore on isolated staging with real snapshots. Do not delete MongoDB support or switch runtime persistence before validated D1 repositories exist.

### 2026-11-22 — R2 backend configuration scaffolding (not a migration phase)

- **Status:** Blocked on owner-supplied values; storage remains unconfigured. This is local R2 configuration scaffolding, not Phase 1 implementation.
- **Changes:** `backend-server/apps/api/src/scripts/check-env.ts` validates R2/S3 settings without printing values; `docs/features/r2-centralized-media.md` documents the fill-in procedure; `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `docs/handoffs/2026-11-22-r2-storage-configuration-pending-values.md` record the pending work.
- **Verification:** `npm.cmd run env:check` passed with current config and failed as designed with a temporary `s3` override; `npm.cmd run typecheck --workspace apps/api` passed; no R2/deploy/credential operation was performed.
- **Next task:** Owner writes values into ignored local files, then rerun preflight/tests and a live media cycle only after the target environment is authorized.

### 2026-11-22 — Owner decisions recorded; DCR-1 credential guard staged

- **Status:** Phase 0 gates partially resolved. Local, non-destructive implementation and verification are authorized. No commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/decisions/0003-credential-remediation-approach.md`, `docs/decisions/0004-local-code-and-tests-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `backend-server/scripts/check-tracked-secrets.mjs`, `backend-server/scripts/check-tracked-secrets.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `MIGRATION_PROGRESS.md`, `docs/handoffs/2026-11-22-dcr-decisions-and-credential-guard.md`.
- **Verification performed:** `npm.cmd run test:secrets` 8/8 passed; `npm.cmd run secrets:check` scanned 30 tracked config files and reported 8 findings in `wrangler.jsonc` by variable name and line only; `npm.cmd run secrets:check:strict` returned exit code 1 as designed. No build, deploy, provision or production data operation.
- **Issues:** tracked Worker credentials are still active and unrotated; strict CI gate is intentionally report-only; 8 findings remain until owner rotation and source removal. DCR-4, support window, event-inventory sign-off, capacity metrics and Workers Paid are still open.
- **Decisions:** DCR-1 Option A (owner rotates, agent prepares, no history rewrite — ADR-0003); DCR-3 Option C staged hybrid (ADR-0002); DCR-5 local code + tests only (ADR-0004); DCR-2 D1 (ADR-0001, earlier).
- **Dependencies:** owner provider rotation and confirmation, tracked-config cleanup, DCR-4 inputs, DCR-2 metrics, backup/restore rehearsal, separate approval for commit/push/deploy/provisioning.
- **Risks:** false confidence from a report-only gate; stale active credentials; dual-protocol complexity; untested recovery.
- **Next task:** owner rotates credentials and supplies remaining inputs; then remove tracked values, enable strict CI, verify backups/restore and continue local testable slices. Do not remove legacy services before validated replacement and explicit approval.

### 2026-11-22 — Full migration directive reconciled; Phase 1 planning documents added

- **Status:** Phase 0 audit remains complete but not accepted. Phase 1 preparation documentation added; recovery gate not satisfied. No implementation phase started.
- **Added/updated files:** `docs/migration/DIRECTIVE_RECONCILIATION.md`, `docs/migration/BASELINE_REPORT.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/ROLLBACK_PLAN.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `MIGRATION_PROGRESS.md`, `docs/handoffs/2026-11-22-migration-phase0-reconciliation.md`.
- **Verification performed:** read-only source audits of backend, Android, admin and infrastructure; Git checkpoint `9b5081a` and version reads; three `curl` probes each for staging `/health`, `/ready`, `/api/health`, `/api/ready` (all HTTP 200, total 0.573–1.305 s). No build, test, migration, provision, deploy, credential read or production data operation.
- **Issues:** no verified backup or restore rehearsal; DCR-1, DCR-3, DCR-4 and DCR-5 still open; DCR-2 capacity metrics and Workers Paid still missing. The directive's paid-plan restriction means production D1 cutover cannot proceed until Workers Paid is explicitly approved.
- **Decisions:** none new. ADR-0001 (D1 + R2) remains the recorded owner decision. The directive is treated as scope definition, not authorization for commit, push, deploy, DNS, provisioning or destructive data work.
- **Dependencies:** owner gate decisions, DCR-2 metrics, and a verified backup/restore rehearsal before any destructive step.
- **Risks:** false confidence from documentation-only work; credential exposure; protocol and media-scope divergence; no recovery mechanism proven.
- **Next task:** resolve DCR-1/DCR-3/DCR-4/DCR-5 and capacity inputs; then create and verify backups and rehearse a restore. Do not remove legacy infrastructure before validated replacement and explicit approval.

## Release readiness

Each workstream uses the exit evidence in the [active implementation plan](docs/migration/implementation-plan.md). Production access, recovery, rollout and legacy removal are independently authorized. Local development can proceed without the production data gate.

## Verification rule

A phase is marked complete only when the stated checks were actually run and passed. Source presence, documentation, or a local dry run alone is not proof of production behavior.

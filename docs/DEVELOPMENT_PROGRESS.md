# Development progress

## 2026-11-26 — LiveKit connection handling and room-create fixture

- Missing local LiveKit bindings now produce a typed `503 ROOM_MEDIA_UNCONFIGURED` with a clear voice/video unavailable message, and PK media reads use the same validation. Android keeps room chat/realtime available when media cannot connect, suppresses the request reference for that expected code, and caches the unavailable room id. Corrected the no-media Worker fixture's required `category`/`language` fields and made the PK-history live-battle fixture independent of earlier fixtures. No LiveKit credentials were read or used; the local Worker was restarted with its original configuration. Both typechecks, both Worker suites, the endpoint audit, strict secret check, focused Android test and room compile passed. [Details](handoffs/2026-11-26-d1-route-fixes.md)

## 2026-11-26 — D1 route and realtime fixes

- Reused room and profile visibility checks for Discover, tied live presence to authenticated sockets, bounded SQL bindings for online lists, fixed case-insensitive self-swipes, and scoped replay and account-deletion events to their authorized recipients. [Changes and verification](handoffs/2026-11-26-d1-route-fixes.md)

## 2026-11-26 — One hosted Worker and native WebSockets

- Removed the legacy Cloudflare staging runtime and put production deployments on `yugm-api-production`. GitHub workflow source now verifies D1/R2, applies hosted migrations, and deploys the single API Worker. Android account and room connections use authenticated WebSockets. Worker fixtures, shared protocol tests, and Android room socket lifecycle tests passed. [Deployment and realtime verification](handoffs/2026-11-26-single-worker-native-realtime.md)

## 2026-11-26 — Production D1 and R2 deployment

- Applied hosted `yugm` migrations `0003`–`0041`, confirmed the reference catalogs and no pending migrations, and deployed the production Worker with all five existing R2 buckets. Removed the legacy Render blueprint and stopped Android release from falling back to the staging Worker. Public traffic requires the production hostname and Worker credentials. [Deployment and verification](handoffs/2026-11-26-production-d1-r2.md)

## 2026-11-26 — Local D1 startup

- Updated both debug launch commands to apply pending `yugm` migrations before starting the Worker, using the same persistence directory in both steps. Verified the default and custom directories through `0041`, `/ready` HTTP 200, Google auth request validation with the emulator Host header, and the local Worker fixture. [Startup and verification](handoffs/2026-11-26-local-d1-startup.md)

## 2026-11-26 — D1 realtime, presence, deletion cleanup and local recovery readiness

- Added host-neutral `D1PresencePort`/`D1RealtimePort` seams and an internal-only `NATIVE_REALTIME` Durable Object adapter; guarded PK writes and deadlines now publish post-commit events, while `pk:force_ended` and public WebSocket command handling remain intentionally unwired and reaction/gift counters remain process-local. Added the account-deletion cascade with an anonymized user stub, `account_deletions`, and migrations `0036`–`0041` for status/uniqueness/withdrawal/friend-match parity. Checked in a synthetic D1 restore fixture and a real local replay test that applies `0001`–`0041`, imports through the production importer with persisted checkpoints, reconciles wallet/media rows and proves idempotent replay while refusing remote bindings. Diagnosed and fixed the intermittent report-count fixture failure by making shared-user assertions baseline-relative. Both typechecks, both Worker suites (auth suite three consecutive final runs), endpoint audit, strict secret check and `git diff --check` passed. No hosted migration, data import, deploy, provision, credential use, commit or push was performed. [Scope, verification and boundary](handoffs/2026-11-26-d1-realtime-presence-recovery.md)

## 2026-11-26 — D1 PK writes complete

- Mounted the final seven `/api/pk` writes: `invite`, `auto-match`, `end`, `rematch`, `/:battleId/vote`, `/:battleId/send-gift` and `/:battleId/reactions`. A shared guarded invite helper covers the three invitation paths, and legacy auth/muted order, exact errors, replay order, status codes, wallet guard order, `stateVersion`/`event_sequence` rules, room locks and DTOs are preserved. The audit is now 638 legacy / 644 D1 / 638 matched / 0 missing; `/api/pk` is 22 mounted / 0 missing. Both typechecks, both Worker suites, endpoint audit, strict secret check, fixture syntax checks and `git diff --check` passed. No SQL migration, hosted operation, deploy or data operation was performed; MongoDB remains authoritative. The owner authorized commit and push after verification. [Scope, verification and boundary](handoffs/2026-11-26-d1-pk-writes-completion.md)

## 2026-11-26 — D1 PK accept, start and ready

- Mounted `POST /api/pk/accept`, `POST /api/pk/start` and `POST /api/pk/:battleId/ready` with router-scoped auth before validation, one guarded invite-acceptance handler, shared deadline expiry, host participant upserts, the full `PREPARING → READY → COUNTDOWN` chain and legacy DTOs/messages. The audit is now 638 legacy / 637 D1 / 631 matched / 7 missing; `/api/pk` is 15 mounted / 7 missing. Both typechecks, both Worker suites, endpoint audit, strict secret check, fixture syntax check and `git diff --check` passed. No SQL migration was added and no commit, push, deploy or hosted operation was performed. [Scope, verification and boundary](handoffs/2026-11-26-d1-pk-accept-start-ready.md)

## 2026-11-26 — D1 Discover, Dating explore and final Users routes

- Completed the requested non-PK parity slice: mounted all six `/api/discover` routes, added `GET /api/dating/explore`, and added `DELETE /api/users/me` plus `POST /api/users/friend-match/search`. Account deletion now guards the tombstone and auth-profile unset fields, terminates bonds, revokes sessions/device tokens, uses injected best-effort realtime and Firebase callbacks, and returns the legacy 30-day schedule. Friend-match search preserves state races and guarded room creation but stays WAITING without a live presence adapter. The audit is now 638 legacy / 634 D1 / 628 matched / 10 missing; only deferred `/api/pk` writes remain. Typechecks, both Worker suites, endpoint audit, strict secret check, fixture syntax checks and `git diff --check` passed. [Scope, verification and boundary](handoffs/2026-11-26-d1-discover-dating-users-completion.md)

## 2026-11-26 — D1 PK deadline recovery alarm

- Added a singleton SQLite Durable Object alarm and D1 deadline job for stale `READY`, due `COUNTDOWN`, active/final-crunch ticks, finalization, 60-second close and pending invite expiry. PK writes and cron wake the alarm; active battles reschedule at ~5 seconds. No HTTP route or SQL migration changed, so the audit remains 619 of 638 legacy patterns mounted with 19 missing. Typecheck, both Worker fixture suites, endpoint audit, strict secret check and `git diff --check` passed. [Alarm and verification](handoffs/2026-11-26-d1-pk-deadlines.md)

## 2026-11-26 — D1 PK writes (first slice)

- Mounted `POST /api/pk/room-start`, `/reject`, `/cancel` and `/:battleId/close` with router-scoped auth before validation, legacy validation/muted/status/authorization messages, conditional D1 batch guards for the room lock and event inserts, `stateVersion` bumps and legacy DTOs. `/api/pk` is now 12/14; invite/accept/ready/vote/gift/reactions/rematch/end/start writes, PK deadlines (since superseded by the D1 PK alarm), active-battle job ending and socket fan-out were legacy-only at this slice. The route audit reports 619 of 638 legacy patterns mounted, with 19 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-pk-writes.md)

## 2026-11-26 — D1 trust verification upload and private media

- Mounted `POST /api/upload/trust-verification` and `GET /api/trust-verification/media/:fileName` with auth before multipart/filename validation, legacy purpose filtering and signatures, the Worker 10 MB cap, private R2 keys and registry rows committed before success. The delivery route preserves owner-prefix authorization and `private, no-store` headers; a shared helper keeps the user and admin reference rules in step. `/api/upload` is now 7/7 and `/api/trust-verification` is 10/0. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-trust-verification-media.md)

## 2026-11-26 — D1 avatar upload

- Mounted `POST /api/upload/avatar` with auth before multipart, the legacy image extension/MIME/signature checks, a 5 MB multipart cap and the separate 220 KB avatar limit. The media registry row, variant, prior-object supersede and guarded authoritative profile update commit in one D1 batch; the previous public R2 object is removed after success. `/api/upload` is now 6/7 and the audit reports 613 of 638 legacy patterns mounted, with 25 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-avatar-upload.md)

## 2026-11-26 — D1 voice-note and recording uploads

- Mounted `POST /api/upload/voice-note` and `POST /api/upload/recording` with auth before multipart, legacy extension/MIME validation, the Worker 10 MB cap, server-derived R2 keys in `public-media`, and the `{ url, type, storage }` response. No signature check was added because neither legacy handler has one; public media rows commit before the response. `/api/upload` is now 5/7 and the audit reports 612 of 638 legacy patterns mounted, with 26 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. Two test-only fixture assertions were made order-independent. [Routes and verification](handoffs/2026-11-26-d1-voice-note-and-recording-uploads.md)

## 2026-11-26 — D1 profile-media and story uploads

- Mounted `POST /api/upload/profile-media` and `POST /api/upload/story` with auth before multipart, legacy image/video validation, a 10 MB Worker cap, server-derived R2 `gallery` keys and the `{ url, type, storage }` response. Public media object and variant rows commit before the response; a shared `nextD1MediaVersion` helper now allocates owner/category versions for AVATAR, COVER and GALLERY, which also fixes repeated cover uploads. `/api/upload` is now 3/7 and the audit reports 610 of 638 legacy patterns mounted, with 28 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-profile-media-and-story-uploads.md)

## 2026-11-26 — D1 cover upload

- Mounted `POST /api/upload/cover` with auth before multipart, legacy 5 MB/extension/MIME/signature checks, a server-derived R2 `covers` key and the `{ url, storage }` response. The route registers a public media object and variant before returning; the R2 object is removed if that commit fails. `/api/upload` is now 1/7 and the route audit reports 608 of 638 legacy patterns mounted, with 30 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-cover-upload.md)

## 2026-11-26 — D1 PK read routes

- Mounted eight read-only `/api/pk` patterns on the shared D1 Worker with auth before validation, legacy active/history/event/leaderboard DTOs, pending-invite and viewer vote/ready reads, and host-neutral LiveKit-compatible media sessions. PK writes, deadlines, active-battle job ending and socket fan-out stay legacy-only. The route audit reports 607 of 638 legacy patterns mounted, with 31 remaining outside admin. Typecheck, Worker fixture suite, endpoint audit, strict secret check and `git diff --check` passed. [Routes and verification](handoffs/2026-11-26-d1-pk-read-routes.md)

## 2026-11-25 — D1 inbox and profile activity

- Mounted five inbox mutation routes and three profile routes. The route audit reports 542 of 638 legacy patterns mounted, with 96 remaining outside admin. Applied `0035` to the backed-up recovered emulator database and confirmed no pending migrations. Backend typechecking and both Worker suites passed. [Routes and verification](handoffs/2026-11-25-d1-inbox-profile-activity.md)

## 2026-11-25 — D1 admin route coverage

- Added the final 81 admin patterns plus badge and reaction art delivery. The audit reports 215 of 215 admin patterns and 534 of 638 legacy patterns overall. Admin sessions use local credentials in debug and Firebase in the hosted Worker. D1 keeps wallet and finance transitions, and R2 holds managed and protected media. Applied migrations `0020`–`0034` to the backed-up local emulator database. [Setup and verification](handoffs/2026-11-25-d1-admin-auth-and-media.md)

## 2026-11-25 — D1 admin operations

- Mounted 59 additional patterns for dashboard and analytics, progression health, fraud and referrals, finance reads, gift and cosmetic management, and notification campaigns. Reused the D1 notification delivery trigger and fixed the campaign and city-targeting callers in the admin app. The audit reports 452 shared and 186 legacy-only patterns. Admin coverage is 134 mounted of 215 legacy patterns. [Verification and remaining work](handoffs/2026-11-25-d1-admin-operations.md)

## 2026-11-25 — D1 admin core routes

- Mounted 60 `/api/admin` user, profile, report, moderation-queue, message, chat, and room routes on the shared D1 Worker with router-scoped admin auth, validation order, guarded writes, safety refresh, moderation actions, and audit logs. The audit now reports 393 shared and 245 legacy-only patterns; admin coverage is 75 mounted / 140 missing. Room feature/unfeature and live warnings are audit-only because D1 has no admin socket emitter, and legacy-only analytics/payment/admin surfaces remain. [Verification and boundary](handoffs/2026-11-25-d1-admin-core.md)

## 2026-11-25 — D1 experience routes

- Mounted all 11 `/api/experience` preferences, achievement claim/share, badge gallery/showcase, safety-center, creator-dashboard and home routes with router-scoped auth, explicit user-column projection and guarded one-tier-at-a-time claims. A disposable MongoDB replica-set probe confirmed the validation order, direct-Zod-parse claim failure, tier progress/clamping, share gating, showcase rules and home DTO shape. Added `0030_experience_claim_unique.sql` for the full tier enum and claim uniqueness; home badge sync stays non-blocking. The audit reports 333 shared and 305 legacy-only patterns. [Verification and boundary](handoffs/2026-11-25-d1-experience.md)

## 2026-11-25 — D1 social features

- Mounted all 20 `/api/social` mood, activity, wave, daily-question, voice-poll and countdown routes with router-scoped auth before validation, legacy DTO omission rules, replay conflicts and guarded poll votes. A disposable MongoDB characterization confirmed `activityRoomId: null` after activity, compact populated users, `WAVE` notification persistence, local-day question seeding, option/ballot `_id` fields and `409 Already voted`. Added `0029_social_unique.sql` plus a Worker fixture; poll children are read directly because SQLite cannot correlate nested `FROM` subqueries. The audit reports 322 shared and 316 legacy-only patterns. [Verification and boundary](handoffs/2026-11-25-d1-social-features.md)

## 2026-11-25 — D1 Arcade read routes

- Mounted `GET /api/games/missions`, `GET /api/games/leaderboard` and `GET /api/games/challenges` with router-scoped auth before query work, UTC mission windows, compact populated projections and the legacy raw `personalBest`. A disposable MongoDB characterization found that legacy leaderboard row order is undefined because `$group` follows `$sort`; D1 uses deterministic score-descending order. The negative-limit `$limit` 500 is preserved directly, and the routes perform no writes. Score writes remain paused and score sharing needs Socket.IO fan-out. The audit reports 302 shared and 336 legacy-only patterns. [Verification and boundary](handoffs/2026-11-25-d1-games-reads.md)

## 2026-11-25 — D1 moderation text checks

- Mounted `POST /api/v1/moderation/check-text` and `POST /api/v1/moderation/check-voice` with auth before validation, host-neutral keyword/regex scoring, the legacy zero-value AI placeholders and the unusual direct-Zod-parse 500 body. The Worker fixture confirms read-only behavior and a clean emitted bundle. Report, appeal and status remain legacy-only because their v1 semantics differ from the mounted D1 report flow. The audit reports 299 shared and 339 legacy-only patterns. [Verification and boundary](handoffs/2026-11-25-d1-moderation-checks.md)

## 2026-11-25 — D1 stories

- Mounted all 11 `/api/stories` routes with auth before validation, the legacy create limiter, compact populated DTOs, view replay, guarded comment/count/notification batches and owner-only hide/delete. A disposable MongoDB characterization confirmed create defaults, trimmed caption/text, feed grouping, viewer order, reply notifications and the legacy orphan-retention behavior. Added `0028_story_views_unique.sql` and a Worker fixture. The audit reports 297 shared and 341 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-stories.md)

## 2026-11-25 — D1 groups

- Mounted all eight `/api/groups` routes with auth before validation, chat limiting, legacy populated DTOs, guarded participant/message writes, creator transfer and last-member deletion. A disposable MongoDB characterization confirmed raw lean `__v`, partial `avatarParts`, and the group `updatedAt` change on message send. Added `0027_group_participants_unique.sql` and a Worker fixture. The audit reports 286 shared and 352 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-groups.md)

## 2026-11-25 — D1 vibe

- Mounted all eight `/api/vibe` routes with the legacy auth-before-validation order, scoring, pagination, DTOs and upsert behavior. A disposable MongoDB characterization confirmed that undeclared `preferences` are dropped and a new preferences upsert uses city `""` with score `0`; malformed page/limit values remain unbounded as in legacy `parseInt`. Added `0026_vibe_graph_unique.sql` and a Worker fixture. The audit reports 278 shared and 360 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-vibe.md)

## 2026-11-25 — D1 dating

- Mounted preference read/update, like, pass and match listing on the shared D1 Worker. Like/pass preserve shadow-ban and block guards, validation order and replay; mutual likes commit one guarded match, relationship XP and notification batch. `0025_dating_swipes.sql` adds fresh-fixture uniqueness keys. `GET /api/dating/explore` stays legacy-only because its presence fields require live Socket.IO/Redis state. The audit reports 270 shared and 368 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-dating.md)

## 2026-11-25 — D1 events

- Mounted all seven `/api/events` handlers at the canonical and older double-prefixed paths. List, detail and user event DTOs match the legacy populated projections; join uses a conditional D1 insert with replay/full/closed classification and a non-fatal host notification. Added `0024_event_participants_unique.sql`. The audit reports 268 shared and 370 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-events.md)

## 2026-11-25 — D1 direct-send-gift

- Mounted `POST /api/direct-send-gift` with the legacy validation order, VIP and interact guards, coin and diamond debit/credit ledgers and creator-share pricing. The gift transaction, both ledger rows, balance updates and profile marker clears commit in one guarded batch; XP, relationship XP, DM and notification are non-fatal post-commit side effects. [Verification and remaining work](handoffs/2026-11-25-d1-direct-send-gift.md)

## 2026-11-25 — D1 subscriptions

- Mounted all five `/api/subscriptions` routes. Prices, expiry, validation order and response shape match the legacy contract. The wallet debit, subscription and creator notification commit in one guarded D1 batch with a `SUBSCRIPTION` ledger row; `0023_subscription_unique.sql` closes the concurrent duplicate race. The audit reports 253 shared and 385 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-subscriptions.md)

## 2026-11-25 — D1 referrals

- Mounted all four `/api/referrals` routes. Code generation keeps the legacy prefix/random suffix, claim validation preserves the legacy order, replay returns the legacy success message, and both 100-coin credits commit with the referral in one guarded batch. Added `0022_referral_unique.sql`. [Verification and remaining work](handoffs/2026-11-25-d1-referrals.md)

## 2026-11-25 — D1 battle pass

- Mounted all three `/api/battle-pass` routes. Active-season creation preserves legacy monthly keys and imported pass IDs; purchase debits 999 coins in one guarded batch; claims grant coins, diamonds, cosmetics, titles or XP with legacy idempotency keys. Battle-pass XP rewards no longer create recursive battle-pass grants. The audit reports 244 shared and 394 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-battle-pass.md)

## 2026-11-25 — D1 missions

- Mounted all four `/api/missions` routes. Moved the mission catalog to a host-neutral seed module that the legacy model re-exports, preserving lazy seeding without importing Mongoose into the Worker. Progress upserts use the new `0021_user_mission_unique.sql` key; claims grant XP and coins under one guarded D1 batch with the legacy idempotency keys. The audit reports 241 shared and 397 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-missions.md)

## 2026-11-25 — D1 feed, highlights, comments and wishlist

- Mounted the feed, gift leaderboard, story-comment deletion, fail-closed inventory trade, all six highlight routes and all five wishlist routes. Wishlist sends use one guarded D1 batch for the debit, creator-share credit, charm XP, gift transaction and item deletion. Comment deletion removes replies because D1 enforces the self reference; the legacy handler left them orphaned. Added `0020_wishlist_unique.sql`. The audit reports 237 shared and 401 legacy-only patterns; `/api/badge-art` remains legacy-only pending the R2 badge cutover. [Verification and remaining work](handoffs/2026-11-25-d1-feed-highlights-wishlist.md)

## 2026-11-25 — D1 route coverage checkpoint

- Reconciled the migration trackers and local/hosted runbooks with the route audit. It reports 222 shared patterns, 416 legacy-only patterns, all 59 room patterns and 15 of 215 admin patterns. [Coverage, migrations and remaining work](handoffs/2026-11-25-d1-route-coverage-checkpoint.md)

## 2026-11-25 — D1 room gift transfers

- Mounted coin, inventory and feature-gated diamond room gifts. The Worker fixture covers concurrent duplicate requests, last-unit stock races, wallet authorization, XP and side effects, and rollback on a ledger failure. Applied `0019` to the emulator database. The audit reports 59 of 59 room patterns and 222 shared patterns overall. [Verification and remaining work](handoffs/2026-11-25-d1-room-gift-transfers.md)

## 2026-11-25 — D1 reports and gift browsing

- Mounted both report intake routes and four permission-checked staff review reads. Evidence and moderation queue entries commit with the report. Verified evidence privacy, the shared rate limit, rollback and one automatic mute at the distinct-reporter threshold.
- Mounted both gift catalogs, collection reads and owner-scoped inventory. Applied migrations `0017` and `0018` to the emulator’s local `yugm` database. The audit reports 221 shared and 417 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-reports-and-gift-catalog.md)

## 2026-11-25 — D1 room modes and PK history

- Mounted five room-mode routes and the read-only room PK history route. The fixtures covered legacy Android action payloads, concurrent game updates, permissions, and private-room history filtering. Applied `0015` and `0016` to local `yugm`. [Verification and remaining work](handoffs/2026-11-25-d1-room-modes-and-pk-history.md)

## 2026-11-25 — D1 room messages

- Mounted public room chat and room direct-message sends. Verified membership and block checks, moderation, VIP photo URL handling, public history, inbox delivery, rollback and the room DM relationship cap. Applied `0014_room_message_progression.sql` to local `yugm`. The audit reports 205 shared and 433 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-room-messages.md)

## 2026-11-25 — D1 room reactions and missions

- Ported the public reaction catalog, live-room reaction submissions and mission progress. Verified preservation of operator-managed reactions, VIP gating, moderation, stored activity and capped mission counts. Applied `0013_room_activity_indexes.sql` to local `yugm`. The audit reports 203 shared and 435 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-room-reactions-and-missions.md)

## 2026-11-25 — D1 room invitations

- Mounted both room invitation routes and verified private-room access, inbox message delivery, notification push enqueueing, block and mute checks, and rollback. Applied `0012_room_invite_index.sql` to the local emulator database. The audit reports 200 shared and 438 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-room-invites.md)

## 2026-11-25 — D1 room polls

- Mounted four room poll endpoints and added scheduled D1 expiry. The Worker fixture covers private room access, host control, atomic vote tallies, duplicate votes, rollback, and the 45-second deadline. Applied the index migration to local `yugm`. The audit counts 198 shared and 440 legacy-only patterns. [Verification and remaining work](handoffs/2026-11-25-d1-room-polls.md)

## 2026-11-25 — D1 immersive themes and public pages

- Mounted theme catalog, purchase, owned and equipped reads, equip, and room theme selection in the shared Worker. Reused the existing default catalog and checked wallet balance, entitlement and room control against D1.
- Mounted the shared legal pages and public service root. The contact and account-deletion forms use the D1 public support route. The audit reports 194 shared and 444 legacy-only patterns. [Verification and cutover notes](handoffs/2026-11-25-d1-themes-and-public-pages.md)

## 2026-11-25 — D1 customer support

- Mounted public requests and the customer ticket lifecycle. Verified cross-account denial, staff replies, concurrent customer replies, close and reopen behavior, and public rate limiting. Corrected the Android client's support paths. [Verification and remaining routes](handoffs/2026-11-25-d1-customer-support.md)

## 2026-11-25 — D1 admin support routes

- Added the six `/api/admin/support` patterns: list/detail, reply, status, assignment and stats. The admin guard and audit helper are now shared with the config routes, preserving auth-before-validation order and the legacy admin envelope. `0010_support_ticket_sender.sql` separates user and admin ticket-message senders, and the ticket mapping now emits `sender_admin_id` for legacy admin replies.
- Added a Worker fixture for auth/permission denial, filters, validation, reply persistence, audits, status/assignment and stats. Typechecks, focused mapping test 12/12, all Worker fixtures, backend tests (admin 9/9, API 515/515, shared 27/27), production dry-run bundle, emitted-bundle import grep and `git diff --check` passed. The audit reports 638 legacy / 182 D1 / 177 matched / 461 missing, with `/api/admin` at 11 mounted / 204 missing. Hosted `0003` through `0010` and live admin acceptance remain open. [Support handoff](handoffs/2026-11-25-d1-admin-support.md)

## 2026-11-25 — D1 admin config and audit-log routes

- Added a host-neutral admin guard using Web Crypto HS256 verification, active-admin/session checks and role-plus-table permissions. Mounted the first five `/api/admin` patterns: config list/read/upsert/delete and paginated audit logs. Admin errors now use the legacy `success: false` envelope, and `0009_app_config_key_unique.sql` restores the source unique-key guarantee.
- Added a Worker fixture for auth ordering, user/permission denial, D1 config persistence, audit filtering/pagination and expired sessions. Typechecks, all Worker fixtures, backend tests (admin 9/9, API 515/515, shared 27/27), production dry-run bundle, emitted-bundle import grep and `git diff --check` passed. The audit reports 638 legacy / 176 D1 / 171 matched / 467 missing, with `/api/admin` at 5 mounted / 210 missing. Hosted `0003` through `0009` and live admin acceptance remain open. [Admin handoff](handoffs/2026-11-25-d1-admin-config-and-audit.md)

## 2026-11-24 — D1 watch-party routes

- Added the four `/api/rooms/:roomId/watch-party` patterns to the local D1 Worker: host-only start/sync/stop and session read. Starting replaces the single per-room record in one D1 batch, and the response mirrors the legacy `WatchParty` JSON. Validation and status codes follow the existing shared contracts.
- Added a Worker fixture for auth, host guards, invalid bodies, D1 persistence, replacement and replay. Typechecks, all Worker fixtures, backend tests (admin 9/9, API 515/515, shared 27/27), production dry-run bundle, emitted-bundle import grep and `git diff --check` passed. The audit reports 638 legacy / 171 D1 / 166 matched / 472 missing, with `/api/rooms` at 40 mounted / 19 missing. Realtime watch-party events and the remaining room patterns are still open. [Watch-party handoff](handoffs/2026-11-24-d1-watch-party.md)

## 2026-11-24 — D1 stale-room safety cleanup

- Ported the legacy 48-hour stale-room end job to the `*/15 * * * *` D1 maintenance run. `endD1Room()` is now exported and reused from the room routes, so the room end, chat delete, participant release and pending speaker-request rejection stay in one guarded D1 batch, with the always-on official room exempt. The Worker fixture verifies the stale room ends while recent and official rooms stay live.
- Typechecks, all Worker fixtures, backend tests (admin 9/9, API 515/515, shared 27/27), production dry-run bundle, emitted-bundle import grep and `git diff --check` passed. The audit is unchanged at 638 legacy / 167 D1 / 162 matched / 476 missing because this job adds no HTTP route. Weekly honors, 30-day account-deletion cleanup and PK deadlines remain on the legacy runtime. [Stale-room handoff](handoffs/2026-11-24-d1-stale-room-cleanup.md)

## 2026-11-24 — D1 wallet routes and payments

- Added the six remaining `/api/wallet` patterns to the local D1 Worker: purchase history, Razorpay order/verify, Google Play verify, VIP activation and dev recharge (local stage only). Balances, purchases, credits, VIP state and XP caps stay authoritative in D1; credits are once-only and provider calls are host-neutral and injected.
- Added `d1Payments.ts` with Web Crypto HMAC/RSA helpers and `0008_wallet_purchase_indexes.sql`. The auth-worker fixture uses generated local keys and mocked Razorpay/Google/FCM endpoints; no live provider call was made. API/Worker typechecks, all Worker fixtures, backend tests, both D1 dry-run bundles, emitted-bundle import grep and `git diff --check` passed. The audit reports 638 legacy / 167 D1 / 162 matched / 476 missing patterns, with 16/16 wallet mounted. Hosted payment secrets, legacy VIP XP atomicity and realtime emitters remain open. [Wallet handoff](handoffs/2026-11-24-d1-wallet.md)

## 2026-11-24 — D1 Bonds route group

- Added all 16 `/api/bonds` patterns to the local D1 Worker. Invitation holds/releases, paid/free requests, slot capacity, eligibility, privacy preferences, check-ins, gifts, type changes, end/block termination, profile reads and leaderboards now use D1 as authoritative state. Wallet debits/credits, receipt keys, version bumps and guarded notifications share the same transactions.
- Shared `bondRulesCore.ts` now holds host-neutral rules for both the legacy service and Worker bundles. Cron maintenance finalizes prior ranking periods, persists milestones, grants the day-7 frame to both partners and awards weekly ranking frames. Blocking terminates an active pair through the existing D1 social hook.
- A new Worker fixture covers validation, opt-in eligibility, replayed paid invitations, cancellation release, reciprocal check-in, gift points/fees, visibility, leaderboard, type change, end and block termination. API/Worker typechecks, all Worker fixtures, backend tests, dry-run bundle checks and `git diff --check` passed. The audit reports 638 legacy / 161 D1 / 156 matched / 482 missing patterns, with 16/16 Bonds mounted. Legacy Bonds rate limiting, D1 realtime emitters, admin/moderation/account-deletion wiring and hosted flag confirmation remain open. [Bonds handoff](handoffs/2026-11-24-d1-bonds.md)

## 2026-11-24 — D1 room lifecycle and LiveKit token admission

- Added 36 mounted `/api/rooms` handlers for create, join, leave, end, room PATCH, mic/seat locks, chat clean, speaker requests and seat/mute/moderation controls. XP, daily caps, receipts and guarded user updates stay in the same D1 transactions. The official always-on voice room remains exempt from automatic end.
- Added `POST /api/livekit/token` with Web Crypto HS256 tokens, live-room and participant checks, role/media capability derivation and a production `wss://` requirement. No `livekit-server-sdk` import was added to either D1 Worker bundle; LiveKit credentials still need operator-supplied secrets.
- The audit counts 140 shared and 498 legacy-only patterns, with 23 `/api/rooms` routes still open. Worker fixtures, production/debug dry runs, all workspace typechecks, backend tests and `git diff --check` passed. [Room lifecycle verification and remaining jobs](handoffs/2026-11-24-d1-room-lifecycle-and-livekit.md)

## 2026-11-24 — D1 progression and scheduled jobs

- Added the level, level overview, leaderboard and daily check-in APIs. Concurrent and repeated claims award one day's XP, streak, cosmetic and wallet credits. The Worker fixture verified rollback when the ledger write failed.
- Added D1 maintenance and Firebase push dispatch through Cloudflare Cron Triggers. Tested expiry, retention, VIP review, quota release, staged R2 cleanup, overlapping push invocation, retry and recipient preferences. Production FCM remains unverified.
- Applied `0006` and `0007` to both local persistence directories. The route audit counts 116 shared and 522 legacy-only patterns. [Verification and remaining jobs](handoffs/2026-11-24-d1-progression-and-jobs.md)

## 2026-11-24 — Local Google sign-in recovery

- Preserved the prior Wrangler state and started the emulator Worker on a separate local `yugm` database after a 409 Firebase identity collision. The original and new profiles remain in separate persistence directories. Google exchange and Firebase device-token registration returned HTTP 200 from the emulator. [Restart command and evidence](handoffs/2026-11-24-local-google-sign-in-conflict.md)

## 2026-11-24 — MongoDB-free D1 Worker bundles and clan HTTP parity

- Removed the MongoDB driver and Mongoose from both D1 builds. Auth session storage is explicit, D1 constructs its Auth and Profile responses directly, and Firebase and season rules can be bundled independently of legacy persistence. CI now verifies the build graph and runs both D1 Worker fixtures.
- Switched `npm run dev` to the loopback D1/R2 Worker. Ported nine clan paths, the Auth profile compatibility endpoint and both VIP privacy endpoints. The audit counts 23 of 23 clan patterns and 112 of 638 across the legacy API. The Worker fixture verified permission failures, persisted chat and reports, and deletion rollback.
- Applied `0005` to local `yugm`. The hosted migration list still shows `0003`, `0004` and `0005` pending. Legacy staging, Node, admin and the remaining feature paths still need MongoDB. [Cutover status and verification](handoffs/2026-11-24-mongodb-runtime-cutover.md)

## 2026-11-24 — D1 direct text messages and replies

- Added D1 text sends and replies with verified sender sessions, account restrictions, moderation, block and follower-only privacy checks, and per-user Cloudflare rate limits.
- D1 commits the message, read state, inbox notices, and eligible account, relationship and Battle Pass XP in one transaction. Both Worker fixtures, both typechecks and seven legacy characterization tests passed. The live local Worker reached readiness after applying `0004` and restarting.
- The route audit counts 100 shared and 538 legacy-only patterns. Managed attachments, delivery events, FCM and hosted migration application remain open. [Direct message send verification](handoffs/2026-11-24-d1-direct-message-send.md)

## 2026-11-24 — D1 direct conversations

- Ported six HTTP operations for direct conversation history, search, read state, mute changes and hiding a conversation. The same D1 query scopes inbox and conversation results. Hiding a conversation preserves the other participant's history.
- Added a versioned index migration for message, mute and relationship lookups. Verified the unread query plan, repeated and concurrent requests, and denial after blocking.
- At this checkpoint the audit counted 99 shared patterns and 539 legacy-only patterns. [Direct messaging verification](handoffs/2026-11-24-d1-direct-conversation.md)

## 2026-11-24 — D1 schema, reference catalogs and dating routes

- Applied the two tracked Wrangler migrations to the local and hosted `yugm` databases. Verified all 148 project tables on hosted D1 and the seeded catalog counts on both targets. The existing local account was preserved.
- Added D1 dating preference reads and writes and the match list, including transactional creation of missing relationship records.
- Added explicit local and production D1 setup commands and isolated the schema generator output from applied migrations. [Setup and verification](handoffs/2026-11-24-d1-schema-and-reference-seed.md)

## 2026-11-24 — Release Google sign-in conflict investigation

- Confirmed the local release APK targets the staging Worker (`yugm-api-staging...`) and therefore MongoDB `YugmStaging`, not D1, R2 or a separate production origin.
- Two read-only Wrangler tails captured a successful logout/google-exchange/device-token cycle with HTTP 200 responses and no exceptions. The original 409 identity conflict did not reproduce; the code path is deterministic for a given token and Mongo state, so the differing token, origin or earlier database state remains unconfirmed.
- No source, config, database, secret, deploy or commit changes were made for this investigation. Unrelated uncommitted files appeared later and were left untouched. [Investigation](handoffs/2026-11-24-release-google-auth-conflict-investigation.md)

## 2026-11-24 — Local D1 Profile/social reads and writes

- Added D1 friends and blocked-list reads plus follow, unfollow, remove-follower and block/unblock writes. Follow uses the existing guarded XP grant pattern with one `FOLLOW_USER` reward per actor/target pair, daily capping, counter and notification writes guarded by the exact follow edge, and replay receipts.
- Both Worker suites passed (1/1 each), both API and Worker typechecks passed, and `git diff --check` was clean. The mount audit now reports 638 legacy, 94 D1, 90 shared and 548 legacy-only distinct method/path patterns.
- D1 block does not terminate Bonds or publish `BONDS` because the Worker has no D1 Bonds router. Chat writes and conversation reads remain open. No commit, push, deploy, provision, migration or production data operation was performed. [Profile/social slice](handoffs/2026-11-24-d1-profile-social-writes.md)

## 2026-11-24 — Emulator Auth startup recovery

- Reproduced the Google backend exchange 503 and identified missing rate-limit bindings in the running Wrangler process and an older local D1 schema. Preserved the old SQLite database, applied the current schema and restarted the Worker on port 4000.
- Added local setup errors that distinguish configuration from a missing or stale schema. Verified emulator readiness and the exchange route, plus fixture sign-in and both Worker suites. [Recovery and verification](handoffs/2026-11-24-emulator-auth-startup-recovery.md)

## 2026-11-24 — D1 database identity and Redis-free D1 Workers

- Matched the production `AUTH_DB` binding to the existing hosted `yugm` database. Debug uses the same name with its original local ID and `remote: false`. It retains its existing persistence directory.
- Moved both D1 Workers to Cloudflare Rate Limiting bindings for sign-in and refresh. Bundle tests confirm Redis and BullMQ are absent. Legacy staging and Node still own the Redis-backed compatibility paths.
- Wrangler reported zero tables at this checkpoint. A later authorized migration initialized hosted D1. [Initial evidence](handoffs/2026-11-24-d1-database-and-redis-boundary.md) · [Current D1 setup](handoffs/2026-11-24-d1-schema-and-reference-seed.md)

## 2026-11-24 — Hosted R2 verification and D1 endpoint audit

- Verified all five hosted Standard R2 buckets with a disposable write, byte-for-byte read-back and deletion in each. Enabled their native bindings in the production target and retained the media pause switch.
- Added 20 legacy API operations to the shared D1 Worker. The slice covers room discovery, follows and history, push-device registration and removal, wallet and daily-claim operations, and the game catalog. The mount audit at that checkpoint identified 65 shared patterns and 573 legacy-only patterns; the latest audit is recorded in the Profile/social entry above.
- The dated handoff records test results, the remaining route families and the production inputs. [Hosted R2 and endpoint audit](handoffs/2026-11-24-hosted-r2-d1-endpoint-audit.md)

## 2026-11-24 — Cloudflare migration checkpoint

- Updated the README, build guide, environment matrix and migration handoffs to reflect the emulator and production build split, the current D1 route coverage, the hosted R2 default and the remaining RealtimeKit work.
- The strict tracked-config credential scan and staged whitespace checks passed. Local secrets and generated build files are ignored.
- The checkpoint branch is `codex/cloudflare-d1-r2-checkpoint`. The staging workflow runs on pushes to `master`. [Environment and deployment triggers](infrastructure/environments.md)

## 2026-11-24 — Production Cloudflare target and build routing

- Made Android debug use emulator loopback and release use one production HTTPS origin. Removed staging as the release default in Gradle and tagged CI builds.
- Switched the production Wrangler target to the existing D1 API routes with native R2 bindings and Firebase App Check. Tested the production bundle in isolation. Hosted R2 remains disabled in the tracked config.
- Added a RealtimeKit server client with mocked meeting creation, token issuance, participant removal and confirmed shutdown. Full app parity, production data cutover, Android RTC and the $0 activation envelope remain open. [Production setup and verification](handoffs/2026-11-24-production-cloudflare-builds.md)

**Commit-state note (2026-11-24):** The "uncommitted" / "changes remain uncommitted" wording in older entries records the working-tree state at the time each entry was written. Those local slices were subsequently captured in commit `b04f77d` on `codex/cloudflare-migration-checkpoint` (branched from `master@5a519fe`). Check Git for current state; the historical wording is retained as evidence and is not a claim about the present working tree.

## 2026-11-24 — Local D1 cosmetics, inbox and clan membership

- Reviewed the isolated Worker at `05617d2`, the standard MongoDB Worker and Android API callers. Recorded the remaining ownership, storage, notifications and realtime boundaries for whole-app local debugging.
- Mounted player cosmetics and inventory, published cosmetic R2 delivery, wallet reads, the notification inbox and clan membership and invitations in the loopback Worker. Cosmetic debits, XP and ownership commit together. Clan joins and invitations use actor-scoped D1 writes.
- The workerd integration fixture, 30 focused API checks, both typechecks and `git diff --check` passed. Android, provider and realtime checks are open. [Evidence and remaining work](handoffs/2026-11-24-local-d1-r2-app-expansion.md)

## 2026-11-24 — Local D1 + R2 managed avatar media slice

- Added the end-model managed media flow to the isolated Auth/Profile Worker: five local-only R2 buckets, Cloudflare Images, D1-backed upload sessions, media objects, variants, quota reservations and version counters, plus server-derived keys and capabilities. The same Android upload contract is preserved, including the absolute `uploadUrl`, bare `PUT` with only `Content-Type`, authoritative completion response and `avatarType: "UPLOADED"` commit. Generated avatars remain unchanged.
- Extracted host-neutral media policy/key helpers without changing the Node API behavior. The schema generator now reproduces the new `upload_token_hash` column, media indexes and `media_counters`; `schema:d1` reported 147 tables, 0 warnings and 0 import failures.
- The Worker fixture passed end-to-end: grant creation, staging upload, forged-capability denial, idempotent completion, actor scoping, authoritative profile commit, public variant and private original delivery, authenticated download denial, cancel cleanup, expiry and failed-image cleanup. API media unit tests passed 7/7; both API and Worker typechecks passed; `git diff --check` had no errors.
- Local only. No bucket provisioning, credential value, deploy, staging/production change, MongoDB removal or live Android/Firebase run was performed. Settings, Chat and Rooms are still not started. [Media handoff](handoffs/2026-11-24-local-d1-r2-media.md)

## 2026-11-24 — Local D1 Auth + Profile emulator path

- Added the Android emulator host `10.0.2.2` to the isolated D1 Auth Worker's loopback allowlist and added focused Worker assertions for that host, for refusing `/ready` when a legacy MongoDB binding is present, and for the Android-generated avatar payload on `PATCH /users/me`. Debug emulator builds already target `http://10.0.2.2:4000/api` and already disable App Check for that local HTTP host.
- The Worker smoke test and both Worker typechecks passed; `git diff --check` was clean. A fresh temporary local D1 database applied the draft schema (147 tables), and an isolated Wrangler dev run with a temporary env file returned `storage: "d1"` from `/ready` plus a successful `10.0.2.2` Host check. Shell-only variables are not Worker bindings; the runbook now calls this out.
- A static Android trace confirmed that the scoped journey's authoritative Auth/Profile calls are mounted. Push-token and adjacent profile/tab calls are non-blocking. At this point managed avatar upload was unsupported locally: the owner observed that photo upload fails; tracing showed `/media/uploads` returns the Worker's catch-all `404`, while Android only falls back to legacy `/upload/avatar` on `503`/`501`, and this Worker mounted neither route. Generated avatars were the supported local path. This was superseded by the managed media slice above; the original diagnosis is retained in the runbook.
- The owner created the ignored local `.dev.vars` and confirmed `/ready` returned `storage: "d1"` after starting the Worker with a fresh persistence directory. The earlier default persistence database had stale `user_auth_profile`, `bond_milestones` and `bond_preferences` definitions; the runbook now records the fresh-directory fix. The owner scoped this local slice to Auth + Profile only. The live Firebase/Android journey remains to be reported. [Emulator runbook](handoffs/2026-11-24-local-d1-auth-emulator.md)

## 2026-11-24 — Commit-state wording clarified

- Added current commit-state notes to this file, the root migration tracker, `CURRENT_TASK.md` and the migration continuation handoff. Older "uncommitted" statements are retained as historical evidence and qualified by checkpoint `b04f77d`.
- Documentation only; no code, data, credential or deployment change. `git diff --check` clean. No tests re-run in this slice.

## 2026-11-24 — Local D1 Profile edits

- Wired `PATCH /api/users/me` to local D1 with a single batch for the Profile save, first-completion XP, Battle Pass progress and any earned level-up coins and inbox entry. The fixture matched the mounted MongoDB response and verified rollback on ledger failure. The bundled Worker processed concurrent setup requests with one completion grant.
- All 67 focused API checks, both typechecks, the Worker smoke test and the strict credential scan passed. Android setup and Edit Profile, live invalidation and managed-avatar behavior remain open. [Profile edit evidence](handoffs/2026-11-24-d1-profile-edits.md)

## 2026-11-24 — Local D1 Profile reads

- Wired authenticated Profile reads into the loopback Worker. Compared the D1 reader with mounted MongoDB for viewer and self visibility, relationship counts, null and omitted fields, profile media, denial and visit behavior. The bundled Worker also checked session revocation and persisted a visit to local D1.
- The 52 focused API checks, both typechecks, Worker smoke test and credential check passed. Local D1 edits were completed in the follow-up above. Live presence remains open. [Profile read evidence](handoffs/2026-11-24-d1-profile-reads.md)

## 2026-11-24 — Profile contract and local D1 import

- Fixed `PATCH /api/users/me` to return the committed user, including completion and self-only email. Verified authorization, read visibility, normalization, repeat saves, one-time XP and actor-scoped invalidation against a disposable MongoDB replica set.
- Matched Bond milestone and preference rows to the draft D1 child tables. The Profile import fixture passed with its relationship counts and completion grants intact. [Profile verification](handoffs/2026-11-24-profile-contract-baseline.md)

## 2026-11-24 — Migration continuation handoff

- Recorded the current working-tree checkpoint, the verification process for each journey and the first Profile acceptance checks. Linked the Auth and Navigation evidence and the remaining production gates. [Migration handoff](handoffs/2026-11-24-migration-continuation.md)

## 2026-11-24 — Full-app Navigation after process death

- Moved the startup session check out of Splash so restored screens wait for server validation. The Android emulator exercised a notification shade tap, authenticated conversation restoration, the selected Profile dock after Back and a revoked session returning to Sign in from Settings.
- Both debug APKs built and the reports show 26 Auth and Navigation JVM checks. Live FCM remains open. [Emulator evidence](handoffs/2026-11-24-navigation-process-restart.md)

## 2026-11-24 — Local D1 Auth Worker

- Wired the existing Auth HTTP routes to an isolated loopback Worker with local D1. The built Worker passed readiness, verified email sign-in, `/auth/me`, refresh rotation, immediate revocation, logout and return sign-in with generated Firebase keys and no MongoDB or Redis connection.
- The Worker typecheck and 22 focused API checks passed. Live Firebase, App Check on Workers and full Android checks remain open. [Commands and evidence](handoffs/2026-11-24-local-d1-auth-worker.md)

## 2026-11-24 — Android navigation back stack and push recreation

- Reproduced a dropped Chat request from Settings on the emulator and repaired root tab switches. The pager now writes to the MainTabs destination's saved state. Push routes wait for the app to leave Auth and preserve pending or consumed state on activity recreation.
- Four connected Android tests, 12 core navigation JVM tests and the app Kotlin compile passed. The fixture uses Android's real NavController in an isolated test activity. [Scope and commands](handoffs/2026-11-24-navigation-recreation.md)

## 2026-11-24 — Local Auth journey parity and Navigation baseline

- Ran the same Auth routes against disposable MongoDB and local D1. Linked accounts retained their IDs and wallet balances. The restored self-profile matched with its explicit nulls, nested fields and ordered arrays. The fixture exercised sign-in, refresh, scoped logout and overlapping identity claims. All 505 API tests and both API and Worker typechecks passed. [Auth evidence](handoffs/2026-11-24-auth-journey-parity.md)
- Started Navigation with 12 core route and dock tests and four Auth startup destination tests. The next evidence is actual back-stack, restored tab and notification targeting behavior. [Navigation baseline](handoffs/2026-11-24-navigation-baseline.md)

## 2026-11-24 — Auth access and revocation across local servers

- Shared the HTTP and Socket.IO access-token checks with a D1 authorization reader. The fixture verified required and optional HTTP access, account ownership, suspension, block and expiry, and rejection after logout on a separate local server.
- The D1 socket fixture rejected reconnect and disconnected an open client before handling its next packet. The existing MongoDB `/auth/me` and Socket.IO handshake passed. All 33 focused tests and API and Worker typechecks passed. [Access verification](handoffs/2026-11-24-auth-access-revocation.md)

## 2026-11-24 — Local Auth session adapters

- Moved session issuance, rotation and logout persistence behind the shared Auth token service. Verified MongoDB and local D1 for ordinary and legacy session generations. Isolated D1 tests covered concurrent sign-ins, replay, rollback and import retry. [Session adapter evidence](handoffs/2026-11-24-auth-session-store.md)
- D1 imports now update by source ID and surface secondary uniqueness conflicts. The 48 focused tests and API and Worker typechecks passed. Protected access and sockets still use MongoDB and need their own D1 parity checks. [Remaining Auth work](handoffs/2026-11-24-auth-session-store.md)

## 2026-11-23 — Auth providers, App Check and legacy session mapping

- Exercised Firebase Google, Facebook and phone exchanges, the mounted App Check gate and the existing warm-cache behavior after logout. The legacy direct Google verifier now requires the configured client audience and expiration. Android continues to exchange Firebase ID tokens. [Auth verification](handoffs/2026-11-23-auth-providers-and-session-mapping.md)
- Preserved the distinction between a missing session generation, explicit null and zero in the draft D1 mapping. Verified all three representations through the importer on a local D1 binding. The 27 focused API and mapping tests, API and Worker typechecks, and six Android JVM tests passed. [Mapping and rollout boundaries](handoffs/2026-11-23-auth-providers-and-session-mapping.md)

## 2026-11-23 — Ordered journey migration and Auth baseline

- Set the execution order to Authentication, Navigation, Profile, Settings, Chat and Rooms. Record outstanding production gates for each journey and run its local checks in that sequence. Arcade work stays deferred. [Journey order](migration/implementation-plan.md#journey-order)
- Exercised the existing Firebase email exchange and session lifecycle through the HTTP API against disposable MongoDB. All 10 focused tests and the API typecheck passed. Provider-specific flows, App Check and client parity are still open. [Auth evidence](handoffs/2026-11-23-auth-journey-baseline.md)

## 2026-11-23 — Direct-message characterization

- Deferred Arcade score writes at the owner's request and characterized the existing DM send, history and read paths. Captured persisted messages, XP effects, addressed socket events, mute and block behavior and repeat requests.
- Repeating the legacy send creates another message, inbox notification and XP grant. A repeat read echoes only to the reader's sessions. [Evidence and next boundary](handoffs/2026-11-23-direct-message-baseline.md)

## 2026-11-23 — Local notification and push Queues slice

- Characterized notification creation, persisted inbox state, socket and FCM payloads, opt-outs, and failure behavior with disposable MongoDB and a stubbed sender.
- Added the opt-in local Cloudflare Queue and SQLite Durable Object outbox. Local queue tests exercise duplicate delivery, transient retry targets, permanent failures, broker failure, expiry and manual replay. [Evidence and remaining gates](handoffs/2026-11-23-local-push-queues.md)

## 2026-11-23 — Arcade catalog parity on local D1

- Added a D1 adapter behind the existing catalog HTTP route and indexed its best-score and recent-score reads. The draft mapper now preserves legacy field presence separately from indexed columns.
- The shared fixture passed with disposable MongoDB and a Wrangler local D1 binding. Across 267 scores, D1 reported 20 rows read, zero rows written and 1,601,536 bytes for the complete draft schema and fixture. [Verification and limits](handoffs/2026-11-23-arcade-catalog-d1-parity.md)

## 2026-11-23 — Behavior-preservation baseline and Arcade fixture

- Added source-backed [registries and phase tracking](migration/MIGRATION_PROGRESS.md) and refreshed the static route, socket and schema indexes. All 97 extracted Mongoose registrations have a draft D1 mapping. Field equivalence and production capacity are open.
- Added a legacy characterization for the Arcade catalog release contract, including auth denial, per-user scope, best-score tie-breaking, latest ten, optional metadata and unchanged score records. The [handoff](handoffs/2026-11-23-behavior-preservation-baseline.md) records the commands and remaining evidence.

## 2026-11-23 — Push delivery errors reach the retry handler

- The BullMQ push path now fails attempts when delivery fails. For a partial Firebase response it saves only retryable device IDs, then resolves current registrations for that same user on retry.
- API suite passed 467/467, including five focused tests. Worker entry and runtime typechecks passed. Queues binding and end-to-end delivery remain open. See the [handoff](handoffs/2026-11-23-push-delivery-retries.md).

## 2026-11-23 — Cloudflare migration replanned for $0

- Recorded the owner's zero-spend constraint and conditional R2 direction in [ADR-0008](decisions/0008-zero-spend-cloudflare-migration.md).
- Reordered the [implementation plan](migration/implementation-plan.md) to start with the BullMQ push-notification slice and independently test Redis, D1 Free, R2 and RTC replacements. D1 evaluation starts with a bounded fixture and measurements from the target store. Production D1 and recovery remain open.
- Checked Cloudflare's published free quotas and billing controls and traced the current push and Worker paths. This pass changed documentation only. No runtime, deployment, account or data checks were run. Evidence and next steps are in the [handoff](handoffs/2026-11-23-zero-spend-cloudflare-migration.md).

## 2026-11-23 -- DCR-2 parked; documentation updated

- **Scope:** recorded that D1 is not approved for production. No code change; documentation only.
- **Trigger:** owner supplied a snapshot metrics file derived from a two-record test export. `capacity:intake` reported NOT READY with 11 missing fields, and the owner confirmed Workers Paid is not enabled and production metrics are unavailable.
- **Changes:** new [ADR-0007](decisions/0007-dcr2-capacity-gate-not-approved.md) records DCR-2 as parked/not approved, MongoDB as authoritative, and the Hyperdrive fallback as reopened. Updated ADR-0001, DCR decision request, D1 capacity assessment, DCR-2 runbook, data-migration-tooling, `INDEX.md`, `CURRENT_TASK.md` and both progress trackers.
- **Verification (run):** `capacity:intake` on the supplied file → NOT READY with 11 missing fields. No gate was claimed passed; no values were fabricated; no database, deploy or production data access.
- **State/remaining:** DCR-2 cannot be closed until Workers Paid is enabled and real metrics plus a production-shaped snapshot exist. DCR-3 needs the GA date; DCR-4 needs origin/CORS and provisioning approvals.

## 2026-11-23 -- Durable Object publish race fixed

- **Scope:** fixed a concurrency gap in the unwired DO skeleton: two concurrent `publish()` calls could allocate the same per-scope sequence and overwrite each other's bounded history, and a `resume` could race a publish on connection cursors.
- **Changes:** added a pure `SerializedOperations` primitive in `@yugm/shared` with 2 tests; the DO skeleton now routes `publish` and `resume` through it. The lock is in-flight only and needs no persistence because DO hibernation occurs when idle.
- **Verification (run):** shared tests 27/27; shared and Worker typechecks passed; full API suite 462/462; strict credential guard zero findings. No binding, deploy, credential or production data access.
- **State/remaining:** still an unwired harness. This fixes internal harness correctness, not interoperability or authoritative publication. Changes are uncommitted.

## 2026-11-23 -- Read-only snapshot export CLI added

- **Scope:** added a read-only export CLI so a snapshot can be produced from an isolated MongoDB source when none exists. No connection was made or data read by the assistant.
- **Changes:** `backend-server/apps/api/src/migration/nativeCollectionReader.ts` implements keyset-paginated reads over an injected native collection (ObjectId and string `_id` support). `backend-server/apps/api/src/scripts/export-snapshot.ts` wires `connectDatabase()` to `exportCollection`/`writeSnapshotManifest`, requires `--confirm-isolated-export`, restricts collections to reviewed `MAPPINGS` keys, refuses an existing manifest, and prints only aggregate counts/bytes with no URI. Added the `snapshot:export` npm script and 3 reader tests.
- **Verification (run):** new tests 3/3; full API suite 462/462; API typecheck passed; strict credential guard zero findings; CLI guard paths verified to reject before connecting (missing args, missing collections, unreviewed collection). Added opt-in `test:export` and ran it against a disposable loopback MongoDB: export of `users` (3 ObjectId records) and `media_objects` (2 string-_id records) PASS, manifest and batches verified.
- **State/remaining:** the CLI has not been run against any real database. Owner must run it against isolated staging or a restored backup (production needs separate approval), then feed the resulting snapshot to `metrics:from-snapshot`. Changes are uncommitted; commit/push needs new explicit authorization.

## 2026-11-23 -- Snapshot metrics derivation helper added

- **Scope:** added a read-only helper to fill only the DCR-2 metric fields an exported snapshot can honestly provide. No invented monitoring/plan values, no database or network access.
- **Changes:** `backend-server/apps/api/src/migration/metricsFromSnapshot.ts` derives `snapshotId`, `sourceEnvironment`, `collectedAt`, `relationalBytes` and `largestRowBytes`, reconciles recomputed bytes against the manifest, reports base64/byte-array candidates, and strips them only on an explicit glob or opt-in detector. Added a `metrics:from-snapshot` CLI (`--snapshot`, `--strip`, `--detect-binary-like`, `--metrics-out`, `--out`) and 5 tests. All 11 other fields remain null with a provenance reason.
- **Verification (run):** new tests 5/5; full API suite 459/459; API typecheck passed; strict credential guard zero findings; CLI smoke on a synthetic snapshot derived 5 fields and left 11 null.
- **State/remaining:** input preparation only, not evidence or acceptance. Owner still supplies Workers Paid, index bytes, growth projection, query observations and monitoring values. Changes are uncommitted; commit/push needs new explicit authorization.

## 2026-11-23 -- Legacy compatibility adapter added

- **Scope:** added the remaining ungated DCR-3 local slice — a pure legacy Socket.IO compatibility translation surface for the 90-day dual-path window. No runtime wiring, commit or production access.
- **Changes:** `backend-server/packages/shared/src/legacyRealtimeAdapter.ts` maps validated legacy routing to native scopes, converts envelopes to legacy emit frames with protocol internals stripped, converts legacy socket acks to native acks that require an authoritative eventId before claiming commit, derives the 90-day cutoff from an owner-supplied GA date, and reports inventory coverage. Event classification is conservative (`unknown` by default). Exported from `@yugm/shared` with 6 tests.
- **Verification (run):** shared tests 25/25 passed; shared and Worker typechecks passed. No binding, deploy, credential or production data access.
- **State/remaining:** still a harness. The GA date, authoritative event publication, real dual-path parity run and client migration remain separate gated work. Changes are uncommitted; commit/push requires new explicit authorization.

## 2026-11-23 -- Native command/ack flow added

- **Scope:** added command-frame parsing and authoritative ack validation to DCR-3 local harnesses; no runtime wiring or claimed commit.
- **Changes:** `nativeCommandSchema` added to the shared protocol; `NativeRealtimeRoom.handleFrame()` is now async, routes commands through an optional handler and validates the returned `NativeCommandAck`. The unwired DO skeleton parses commands and exposes a default-rejecting `authorizeCommand()` override point.
- **Verification (run):** shared tests 19/19 passed; shared and Worker typechecks passed. No binding, deploy, credential or production data access.
- **State/remaining:** a configured handler must still perform the authoritative write before returning `committed: true`. Compatibility adapter, client migration and dual-path parity remain separate. Changes are uncommitted.

## 2026-11-23 -- Native Durable Object skeleton added

- **Scope:** added a hibernation-compatible native DO skeleton for DCR-3 without binding or runtime wiring. No production traffic can reach it.
- **Changes:** `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts` stores connection identity/scope in WebSocket attachments and keeps cursors, seen IDs, sequences and bounded history in Durable Object storage. It handles WebSocket upgrade, matching-scope resume frames and typed envelopes. Added to Worker typecheck include only; not exported from `index.ts` or Wrangler configs.
- **Verification (run):** `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` passed. No DO binding, Wrangler deploy, live WebSocket, credential or production data access.
- **State/remaining:** typechecked skeleton only; authentication, authoritative publish, compatibility adapter, client migration and dual-path parity remain separate gated work. Changes are uncommitted.

## 2026-11-23 -- Native realtime server transport foundation added

- **Scope:** added a pure, host-neutral native protocol transport for DCR-3 without wiring a Durable Object, Android client or production path.
- **Changes:** `backend-server/packages/shared/src/nativeRealtimeServer.ts` provides per-scope sequence assignment, connection scope isolation, receiver dedupe, bounded history and resume replay using the v1 schemas; exported from `@yugm/shared` with 5 tests.
- **Verification (run):** shared tests 17/17 passed; shared typecheck passed. No worker runtime, binding, credential, deploy or production data access.
- **State/remaining:** still a harness. A Durable Object adapter, authentication, authoritative event publication, client migration and dual-path parity run remain separate gated work. Changes are uncommitted.

## 2026-11-23 -- Read-only media quota reconciliation added

- **Scope:** extended staged admin media tooling with a read-only report comparing quota counters against live staging reservations. No quota was mutated.
- **Changes:** added `buildQuotaReconciliation()` and `reconcileMediaQuotas()` in `services/adminMedia.ts`, a `GET /api/admin/media/quota-reconciliation` endpoint, a Media registry UI section, and deterministic tests for OK/over/under/missing-counter drift.
- **Verification (run):** targeted API tests 11/11 passed; root typecheck passed; admin tests 9/9, typecheck and production build passed; tracked `dist/` restored. No database outside tests, provider, credential or production data access.
- **State/remaining:** report-only. Stale sessions are counted, not swept by this endpoint; the maintenance sweeper remains the local remediation path. Changes are uncommitted.

## 2026-11-23 -- Android profile upload progress/cancel wired

- **Scope:** closed the DCR-4 client gap where `ProfileDetailScreen` ignored managed upload progress and could not cancel. Only the upload-related section was changed; unrelated working-tree edits in profile screens were preserved.
- **Changes:** `ProfileViewModel.cancelOwnAvatarUpload()` now sets the cancel flag and cancels the job even before a session ID exists, and `EditProfilePage` receives ViewModel-owned progress/busy state plus a Cancel upload action with a progress indicator and percentage.
- **Verification (run):** Android Studio JBR `:feature:profile:compileDebugKotlin` → BUILD SUCCESSFUL (only pre-existing deprecation warnings). No Gradle full build, device QA, client release, provider config or production data access.
- **State/remaining:** compile-verified only; device/emulator QA, live two-client media validation and R2 provisioning remain gated. Changes are uncommitted.

## 2026-11-23 -- Private-media policy applied at runtime boundary

- **Scope:** implemented the DCR-4 accepted private-media rules in the existing download authorization path without provider, deploy or production data changes.
- **Changes:** moved the pure policy to `services/mediaAccessPolicy.ts` and re-exported it from the migration path; `services/media.ts` now resolves room host/admin/active participant, clan owner/roles/member and message sender/receiver facts, then applies `decideMediaAccess()` before signing a URL. Block/hide checks override grants. Added integration coverage for room and clan owner, admin, accepted participant and outsider cases.
- **Verification (run):** targeted media, policy and integration tests 21/21 passed; API typecheck passed. No R2 provider, credential, Cloudflare account or production data access.
- **State/remaining:** short-lived signed URLs still require authoritative resource state at read time; no R2 provisioning, media category cutover or Android client change was made. Changes are uncommitted.

## 2026-11-23 -- Expired upload-session quota sweeper added

- **Scope:** closed the DCR-4 failed-upload quota leak locally without provider, deploy or production data access.
- **Changes:** added bounded `sweepExpiredUploadSessions()` in `services/media.ts`; it atomically claims expired PENDING/PROCESSING sessions, releases held quota once and best-effort removes staging objects. `services/jobs.ts` invokes it from local maintenance. Added an integration test proving single release plus no-op replay.
- **Verification (run):** targeted media integration/unit tests 14/14 passed; API typecheck passed. No database outside the in-memory test server, R2 provider, credential or production data access.
- **State/remaining:** local maintenance only; no Cloudflare Cron provisioning or production job deployment. Android progress/cancel wiring and runtime private-media policy remain separate slices. Changes are uncommitted.

## 2026-11-23 -- Read-only admin media tooling staged

- **Scope:** staged DCR-4 admin registry/quota visibility without media mutation, provider config or production data.
- **Changes:** added `routes/adminMedia.ts` with authenticated permission-gated lists for media objects, upload sessions and quota reservations; added pure query/DTO helpers in `services/adminMedia.ts` with 4 tests; added `apps/admin/src/MediaPage.tsx` and wired `media` into admin navigation with `cosmetics.read`; extended admin router guard tests.
- **Verification (run):** targeted API tests 16/16 passed; API typecheck passed; admin tests 9/9, admin typecheck and production build passed; tracked `dist/` artifacts restored. No database, bucket, credential or production data access.
- **State/remaining:** read-only tooling only. Provider provisioning, exact production CORS/domain, admin mutation tooling, Android wiring fixes and category cutover remain separately gated. Changes are uncommitted.

## 2026-11-23 -- DCR-5 plan accepted and commit authorized

- **Scope:** recorded owner acceptance of the implementation plan and a one-time commit/push authorization for the current local slices. No provision, deploy, credential or data operation authorized.
- **Changes:** added ADR-0006; updated ADR-0004, DCR-5 decision request, implementation plan, `CURRENT_TASK.md`, `INDEX.md`, and progress docs. A handoff records the one-time authorization limit.
- **State:** DCR-1, DCR-3, DCR-4 and DCR-5 decision gates are closed. DCR-2 evidence, recovery rehearsal, runtime implementation and all production approvals remain open.
- **Next:** verify and publish the current local slices under the one-time authorization, then stop pending new approvals.

## 2026-11-23 -- DCR-4 decision gate completed

- **Scope:** recorded all DCR-4 owner decisions and staged an unwired private-media policy harness. No runtime authorization, provision, credential or production data change.
- **Decisions recorded:** Option B phased cutover; five existing R2 bucket names; public variants with private originals/staging; private access for media/resource owner, resource admins and accepted participants only; explicit per-env domains/CORS with production origin pending; agent stages local admin tooling/guards while owner controls provider credentials.
- **Changes:** added ADR-0005, updated DCR-4 decision request, private-media authorization audit, `REALTIME_EVENTS.md` was not touched, `CURRENT_TASK.md`, `INDEX.md`, progress docs. Added `src/migration/mediaAccessPolicy.ts` with 6 tests.
- **Verification (run):** policy tests 6/6 passed; `npm.cmd run typecheck --workspace @yugm/api` passed. No production access.
- **State/remaining:** decision gate closed; runtime authorization, admin tooling, wiring fixes, exact production CORS/domain values, provisioning and phased category cutover remain separate work. Changes are uncommitted.

## 2026-11-23 -- DCR-3 decision gate completed

- **Scope:** recorded all owner inputs closing DCR-3 and implemented the accepted BONDS invalidation emitter locally.
- **Decisions recorded:** 90-day legacy Socket.IO support window after native GA; hibernation is a hard requirement; 83-name event inventory accepted; server emits `BONDS` for `/api/bonds/*` mutations.
- **Changes:** updated ADR-0002, DCR-3 decision request, realtime plan and `REALTIME_EVENTS.md`; added `BONDS` topic mapping in `syncInvalidation.ts` with a new test. `mutationTopics("POST", "/api/bonds/invitations")` now returns `["BONDS", "PROFILE", "TASKS"]`.
- **Verification (run):** sync invalidation tests 6/6 passed; `npm.cmd run typecheck --workspace @yugm/api` passed. No database, Cloudflare account, credential or production data access.
- **State/remaining:** decision gate closed; runtime compatibility adapter, native hibernating DO protocol, Android migration, cutoff-date record and dual-path parity suite remain separate implementation work. Changes are uncommitted.

## 2026-11-23 -- Re-verified all local changes after DCR-2 tooling

- **Scope:** re-ran bounded local verification across all accumulated changes; no behavior change and no production access.
- **Results:** root typecheck passed; API 439/439, hardening 34/34, shared 12/12, admin 9/9; credential guard 8/8, OpenAPI guard 6/6, config manifest 3/3, worker-config guard 5/5; strict credential guard zero findings; `openapi:check` PASS; admin build passed with tracked `dist/` restored; `git diff --check` clean apart from line-ending notices.
- **Record:** [final local verification handoff](handoffs/2026-11-23-final-local-verification.md) updated with the new counts.
- **State:** DCR-1 is closed and pushed in `d4b0510`; later DCR-1 closure docs and DCR-2 tooling remain uncommitted. DCR-2 still needs owner inputs.

## 2026-11-23 -- DCR-2 readiness runbook added

- **Scope:** documentation-only consolidation of the DCR-2 command sequence, owner inputs and interpretation limits. No code or data change.
- **Changes:** added `docs/migration/DCR2_READINESS_RUNBOOK.md`, linked it from `docs/INDEX.md` and `CURRENT_TASK.md`. The runbook covers metrics template, hard-limit gate, projection, query, billing, recovery-evidence and readiness commands, plus the exact owner attestations required.
- **State:** DCR-2 local tooling is complete; the gate remains open pending real metrics, Workers Paid, recovery evidence and schema approval. No tests were needed for this documentation-only change.

## 2026-11-23 -- DCR-2 readiness summary added

- **Scope:** aggregated the existing local DCR-2 reports into a single readiness checklist without adding new verification claims.
- **Changes:** `backend-server/apps/api/src/migration/dcr2Readiness.ts`, CLI `src/scripts/dcr2-readiness.ts`, npm script `capacity:status`, and 2 tests. It checks capacity, Workers Paid, projection, query, billing, recovery evidence and owner attestations for schema approval/Workers Paid.
- **Verification (run):** targeted tests 24/24 with DCR-2 suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated reports reported READY 8/8 with 4 review items and an explicit “not production acceptance” warning. No production access.
- **State/remaining:** the summary is only as good as the supplied reports/attestations. Real metrics, restore rehearsal, Workers Paid confirmation and schema approval remain owner responsibilities. Changes are uncommitted.

## 2026-11-23 -- DCR-2 recovery evidence checker added

- **Scope:** added local validation of recovery evidence artifacts without performing a restore or touching any production system.
- **Changes:** `verify-backup` now supports `--out`; added `src/migration/dcr2RecoveryEvidence.ts`, CLI `src/scripts/dcr2-recovery-evidence.ts`, npm script `capacity:recovery`, and 3 tests. It checks verification output, rehearsal validation/transform/id-map artifacts and an owner attestation, reporting snapshot mismatches and missing attestation fields.
- **Verification (run):** targeted tests 22/22 with DCR-2 suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated fixtures reported evidence COMPLETE with three open review items. No database, Cloudflare account or production data access.
- **State/remaining:** evidence completeness is not a restore test; attestation booleans are owner claims. DCR-2 still needs real backups, an isolated restore rehearsal, Workers Paid and schema approval. Changes are uncommitted.

## 2026-11-23 -- DCR-2 billing estimate added

- **Scope:** added local billing evidence for DCR-2 without billing API, database or Cloudflare access.
- **Changes:** `backend-server/apps/api/src/migration/d1BillingEstimate.ts`, CLI `src/scripts/d1-billing-estimate.ts`, npm script `capacity:billing`, and 3 tests. It estimates monthly rows read from query observations, rows written from peak write rate as an upper bound, and storage from capacity metrics, comparing each to Workers Paid inclusions with three review items.
- **Verification (run):** targeted tests 19/19 with DCR-2 suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated inputs reported all three inclusions within limits and three open review items. No production access.
- **State/remaining:** estimates are not invoices and do not cover recovery evidence. Workers Paid, restore rehearsal and schema approval remain open. Changes are uncommitted.

## 2026-11-23 -- DCR-2 query-profile audit added

- **Scope:** added local tooling for the query-shape review item without collecting query data or touching any database.
- **Changes:** `backend-server/apps/api/src/migration/queryProfileAudit.ts`, CLI `src/scripts/query-profile-audit.ts`, npm script `capacity:queries`, and 4 tests. It validates JSONL query observations, screens statement/parameter/result/duration hard limits, and reports p50/p95/p99, full scans, unindexed observations, rows scanned and coarse headroom evidence.
- **Verification (run):** targeted tests 16/16 with the DCR-2 suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated observations reported hard-gate PASS with 4 review items. No production access.
- **State/remaining:** hard-limit PASS is not query acceptance. DCR-2 still needs real query evidence, Workers Paid, recovery evidence and schema approval. Changes are uncommitted.

## 2026-11-23 -- DCR-2 projection cross-check added

- **Scope:** added local evidence for the 12-month D1 projection gate without collecting metrics or touching any database.
- **Changes:** `backend-server/apps/api/src/migration/projectionAudit.ts`, CLI `src/scripts/projection-audit.ts`, npm script `capacity:projection`, and 3 tests. It compares declared projection with byte growth between two snapshot manifests, reports baseline alignment and adds four review items (retention, seasonality, index growth, baseline alignment).
- **Verification (run):** targeted tests 12/12 with the DCR-2 intake/capacity suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported a 1-hour window, observed growth and four review items. No production access.
- **State/remaining:** projection evidence only; DCR-2 still needs real metrics, Workers Paid, query/growth/recovery evidence and schema approval. Changes are uncommitted.

## 2026-11-23 -- DCR-2 metrics intake helper added

- **Scope:** prepared a concrete owner-facing metrics intake for DCR-2 without collecting metrics or touching MongoDB/D1/Cloudflare.
- **Changes:** added `src/migration/dcr2MetricsIntake.ts`, CLI `src/scripts/dcr2-metrics-intake.ts`, npm script `capacity:intake`, and 3 tests. `--template` emits a blank 16-field JSON file; `--input` reports missing/invalid fields with guidance, then screens ready metrics through the hard-limit gate.
- **Verification (run):** targeted tests 9/9 with the capacity-gate suite; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke showed the blank template as NOT READY and a completed fixture as READY/PASS with 5 review items. No production access.
- **State/remaining:** DCR-2 still requires real aggregates, Workers Paid, query/growth/recovery evidence and schema approval. Changes are uncommitted.

## 2026-11-23 -- DCR-1 closed after successful deployment

- **Scope:** recorded owner confirmation that the DCR-1 cleanup commit `d4b0510` deployed successfully with strict credential CI active. No code/config/credential change in this documentation update.
- **Updated:** ADR-0003, DCR-1 decision request, tracked-credentials finding, baseline report, `CURRENT_TASK.md`, the DCR-1 handoff and `MIGRATION_PROGRESS.md`.
- **State:** DCR-1 Option A is complete: provider rotation confirmed, tracked values removed, ignore rules added, strict CI pushed and verified on deployment. No Git history rewrite was performed.
- **Remaining at that point:** DCR-2/DCR-3/DCR-4 inputs, verified backups/restore rehearsal, schema approval and cutover approvals. DCR-3 inputs were closed later the same day; runtime implementation remains.

## 2026-11-23 -- DCR-1 local credential cleanup staged

- **Scope:** after owner confirmation that all affected credentials were rotated/revoked and moved to ignored secret stores, staged the local/config/CI portion of DCR-1. No credential value was printed, copied or stored.
- **Changes:** removed all secret-bearing `vars` from tracked `apps/cloudflare-worker/wrangler.jsonc` (10 secret-named keys, including placeholders); added root ignore rules for `wrangler.local.jsonc` and `wrangler.*.local.jsonc` (`.dev.vars*` was already ignored); switched CI from report-only `secrets:check` to blocking `secrets:check:strict`; updated ADR-0003, the credential finding, DCR-1, baseline report, task and progress docs.
- **Verification (run):** `wrangler.jsonc` parses as valid JSON; `git check-ignore` verified `.dev.vars.local`, `wrangler.local.jsonc` and `wrangler.*.local.jsonc`; `npm.cmd run test:secrets` 8/8 passed; `npm.cmd run secrets:check:strict` reports zero findings across 30 tracked config files; `git diff --check` clean apart from LF/CRLF notices.
- **State/remaining:** local changes are uncommitted. Explicit commit/push approval and the first CI run with strict mode active are required. No Git history rewrite was performed.

## 2026-11-23 -- Consolidated local verification pass

- **Scope:** re-ran bounded local verification over all accumulated uncommitted changes. No new behavior or production access.
- **Results:** root typecheck passed for all workspaces; API 421/421, hardening 34/34, shared 12/12, admin 9/9; credential guard 8/8, OpenAPI guard 6/6, config manifest 3/3, worker-config guard 5/5; `openapi:check` PASS; `worker-config:check` report-only with 6 findings; admin production build passed and tracked `dist/` artifacts were restored; `git diff --check` clean apart from line-ending notices.
- **Limits:** local evidence only. No database, D1, R2, Cloudflare account, deploy, provision, credential value or production data was touched. No CI run was triggered; the worker-config findings remain owner decisions.
- **Record:** [final local verification handoff](handoffs/2026-11-23-final-local-verification.md).

## 2026-11-23 -- Delta rate audit added (final delta-sync input)

- **Scope:** added local average-rate evidence for the online-vs-maintenance-window decision without observing peak load or touching any database.
- **Changes:** `backend-server/apps/api/src/migration/deltaRateAudit.ts`, CLI `src/scripts/delta-rate-audit.ts`, npm script `delta:rates`, and 3 tests. It uses two manifest watermarks and the snapshot diff to report added/removed/changed counts per hour by collection, with review items for peak-vs-average, window choice and financial peak.
- **Verification (run):** targeted tests 26/26 with adjacent delta suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported a 2-hour window with 0.5 changes/hour. No production access.
- **State/remaining:** averages cannot establish peak rate or downtime tolerance. Owner decisions on online/offline replay and the final delta window remain open. Changes are uncommitted.

## 2026-11-23 -- Child-table impact audit added (final delta-sync input)

- **Scope:** added local evidence for the child-row replacement-scope decision. No DDL behavior change, database access or data deletion.
- **Changes:** moved the schema generator's `CHILD_TABLES` declaration into shared `src/migration/childTables.ts`; added `childTableAudit.ts`, CLI `src/scripts/child-table-audit.ts`, npm script `delta:child-tables`, and 4 tests. The report lists 26 root collections with 49 normalized child tables plus review items for replacement unit, stale rows and idempotent replay.
- **Verification (run):** targeted tests 23/23 with adjacent delta suites; `npm.cmd run typecheck --workspace @yugm/api` passed; `npm.cmd run schema:d1` regenerated 146 tables with no SQL change beyond the earlier draft refinements; CLI smoke produced the 26/49 report. No production access.
- **State/remaining:** this is sizing/scope evidence only. Owner decision on per-parent vs per-batch replacement and the remaining delta items remains open. Changes are uncommitted.

## 2026-11-23 -- Financial delta audit added (final delta-sync input)

- **Scope:** added local sizing evidence for the financial-delta maintenance-window decision without reconciling balances or touching any database.
- **Changes:** `backend-server/apps/api/src/migration/financialDeltaAudit.ts`, CLI `src/scripts/financial-delta-audit.ts`, npm script `delta:finance`, and 3 tests. It filters the snapshot diff to six authoritative money collections and keeps review items for ledger reconciliation, maintenance-window sizing and idempotent replay.
- **Verification (run):** targeted tests 19/19 with adjacent delta suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported 1 changed wallet transaction. No values, credentials or production data accessed.
- **State/remaining:** sizing only; it does not prove reconciliation or choose online vs maintenance-window import. Owner delta decisions and all recovery gates remain open. Changes are uncommitted.

## 2026-11-23 -- Deletion audit added (final delta-sync input)

- **Scope:** added local tooling for the hard-delete representation decision without implementing tombstones, deletion lists or D1 deletes.
- **Changes:** `backend-server/apps/api/src/migration/deletionAudit.ts`, CLI `src/scripts/deletion-audit.ts`, npm script `delta:deletions`, and 4 tests. It lists source IDs removed between two snapshots, detects soft-delete markers from a configurable field, and emits a stable digest.
- **Verification (run):** targeted tests 16/16 with adjacent delta suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported one soft-deleted record. No database, Cloudflare account, credential or production data access.
- **State/remaining:** sizing evidence only. Owner decision on tombstones vs explicit deletion lists, child-row replacement scope, online/offline import, downtime and financial-delta handling remains open. Changes are uncommitted.

## 2026-11-23 -- Watermark candidate audit added (final delta-sync input)

- **Scope:** added local tooling for the first open final-delta-sync design decision without selecting a watermark or touching MongoDB.
- **Changes:** `backend-server/apps/api/src/migration/watermarkAudit.ts`, CLI `src/scripts/watermark-audit.ts`, npm script `delta:watermark`, and 7 tests. It reports field coverage, parseability, unique `(value, _id)` composite keys, input ordering and sample gaps from a copied snapshot or JSONL export.
- **Verification (run):** targeted tests 15/15 with adjacent migration suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture reported `viable: true` and `already sorted: true`. No database, Cloudflare account, credential or production data access.
- **State/remaining:** viability does not prove MongoDB can export by that cursor. Owner decision on the watermark field/order, hard-delete representation, child-row replacement scope and cutover window remains open. Changes are uncommitted.

## 2026-11-23 -- Report-only Worker config guard added

- **Scope:** added a CI guard for Worker deployment configuration hygiene without changing any config or printing values.
- **Changes:** `backend-server/scripts/check-worker-config.mjs` parses staging/production Wrangler configs and reports missing observability, missing persisted logs, unredacted query strings and wildcard CORS by finding identifier only. Added `worker-config:check` / `test:worker-config` scripts, 5 tests and a report-only CI step.
- **Verification (run):** `npm.cmd run test:worker-config` 5/5 passed; `npm.cmd run worker-config:check` reported 6 current findings (1 staging, 5 production). No config value was printed; no deploy, provision, credential or production data access.
- **State/remaining:** report-only by design. Query-string redaction, production observability and an explicit CORS allowlist are owner decisions before production use. Changes are uncommitted.

## 2026-11-23 -- Value-free config manifest added

- **Scope:** prepared recovery evidence for backup procedure step 5 without printing or copying secret values.
- **Changes:** exported `trackedConfigFiles()` from the existing credential guard, added `scripts/config-backup-manifest.mjs` with `config:manifest` / `test:config-manifest` scripts and 3 tests. The manifest records each tracked config file's path, byte count and SHA-256 only, plus a top-level digest.
- **Verification (run):** `npm.cmd run test:config-manifest` 3/3 passed; `npm.cmd run config:manifest` produced a stable 30-file manifest without values. No credential, database, Cloudflare account, deploy or production access.
- **State/remaining:** this is an inventory aid, not a config backup. Ignored `.env`/`.dev.vars` values, GitHub Actions variables and external provider config remain owner-managed. Changes are uncommitted.

## 2026-11-23 -- Combined backup rehearsal runner added

- **Scope:** chained existing integrity verification and dry-run import tooling into one local command. No database, R2, Cloudflare account, credential or production data access.
- **Changes:** added `src/migration/backupRehearsal.ts`, CLI `src/scripts/backup-rehearse.ts`, npm script `backup:rehearse`, and 3 tests. The runner verifies a copied snapshot first and skips rehearsal when integrity fails; on success it writes transform/validation/id-map artifacts into one output directory.
- **Verification (run):** targeted tests 13/13 with rehearsal and backup-verifier suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated snapshot printed `PASS` for integrity, dry-run rehearsal and the combined result. No production access.
- **State/remaining:** PASS means copy integrity plus mapping/validation dry run, not a tested restore. No real backup exists and no restore was rehearsed. Changes are uncommitted.

## 2026-11-23 -- OpenAPI structural guard added to CI

- **Scope:** added a dependency-free guard for the migration-critical OpenAPI surface; no deploy, provision, credential or production access.
- **Changes:** `backend-server/scripts/check-openapi.mjs` checks OpenAPI 3 version, required auth/media/admin paths, duplicate paths or schemas, local `#/components/...` ref targets and embedded server credentials. Added `openapi:check` and `test:openapi` npm scripts, 6 unit tests, and two CI steps in the backend job. The real `apps/api/openapi.yaml` passes with 90 paths, 16 schemas and 23 local refs.
- **Verification (run):** `npm.cmd run test:openapi` 6/6 passed; `npm.cmd run openapi:check` printed `PASS`. No YAML parser or network tool was needed; workflow YAML was inspected manually and no CI run was triggered.
- **State/remaining:** this is a structural guard, not full OpenAPI validation. Full `swagger-cli` validation remains a manual step; adding it to CI needs network dependency handling. Changes are uncommitted.

## 2026-11-23 -- Admin view permission helper extracted and tested

- **Scope:** closed the admin view-level permission test gap with a pure helper and a direct view guard. Server RBAC remains authoritative.
- **Changes:** added `admin/src/navigationPermissions.ts` with `ViewKey`, `VIEW_PERMISSIONS` and `canAccessView()`. `App.tsx` now derives sidebar visibility from the same map (no required-permission string duplicated there) and blocks unauthorized direct views with `ErrorState`. Added 4 tests for unrestricted, restricted, wrong-permission and super-admin cases.
- **Verification (run):** admin tests 9/9 passed; `npm.cmd run typecheck --workspace @yugm/admin` passed; `npm.cmd run build --workspace @yugm/admin` passed. Generated `dist/` changes were restored to HEAD. No credential, database, Cloudflare account, deploy or production access.
- **State/remaining:** this tests the permission decision function and compiles the guard into the renderer; real component rendering and admin UI runtime QA are still pending. Changes are uncommitted.

## 2026-11-23 -- Admin API client tests added to CI gate

- **Scope:** closed the remaining "admin has no test script" finding with focused, database-free tests. No deploy, provision or production access.
- **Changes:** made `api.ts` read `import.meta.env` with optional chaining so pure helpers run under Node; added `src/api.test.ts` with 5 tests covering `formatDate`/`formatNumber`, `adminApi` success and `ApiError` mapping, `adminApiWithMeta`, and multipart auth headers. Added an admin `test` script and wired it into the `admin` CI job between typecheck and build.
- **Verification (run):** `npm.cmd run test --workspace @yugm/admin` 5/5 passed; `npm.cmd run typecheck --workspace @yugm/admin` passed; `npm.cmd run build --workspace @yugm/admin` passed. Generated `dist/` changes were restored to HEAD because some dist files are tracked. No YAML parser/actionlint was available and no CI run was triggered.
- **State/remaining:** four follow-up tests now cover the extracted view-permission helper used by both the sidebar and the direct view guard; runtime component rendering/UI QA is still pending. Strict secret scanning remains blocked on credential rotation. Changes are uncommitted.

## 2026-11-23 -- Explicit admin router auth guards added

- **Scope:** closed the Phase 0 finding that five admin routers depended on `adminRouter`'s late catch-all guard. No permission or route behavior changed; the public `badgeArtRouter` was deliberately left unguarded.
- **Changes:** added `router.use(requireAdminAuth)` to `adminAssetsRouter`, `adminBadgesRouter`, `adminCosmeticsRouter`, `adminReactionsRouter` and `adminSupportRouter`. Added `routes/adminRouterGuards.test.ts` with 5 tests that mount each router alone and assert 401 without a token.
- **Verification (run):** targeted guard tests 5/5 passed; full API suite 395/395 passed; hardening suite 34/34 passed; `npm.cmd run typecheck --workspace @yugm/api` passed. No database, credential, Cloudflare account, deploy or production data change.
- **State/remaining:** two follow-up tests now cover valid-JWT acceptance by `requireAdminAuth` and explicit guard layers on each formerly dependent router (with the public badge-art router unguarded). Real route-handler execution under a valid JWT is still untested, and the admin SPA has no test script. Changes are uncommitted.

## 2026-11-23 -- Admin CI typecheck/build gate added

- **Scope:** closed the Phase 0 finding that PR CI did not build the admin SPA. No deploy or production action; only workflow configuration changed locally.
- **Change:** `.github/workflows/ci.yml` now has a separate `admin` job that installs workspace dependencies, runs `npm --workspace apps/admin run typecheck` and `npm --workspace apps/admin run build` on push/PR to `master`. It mirrors the build step already used by the manual Pages deploy workflow.
- **Verification (run locally):** `npm.cmd run typecheck --workspace @yugm/admin` passed; `npm.cmd run build --workspace @yugm/admin` passed (Vite build; generated `dist/` files were restored to HEAD because some are tracked despite the ignore rule). YAML structure inspected manually; no YAML parser or actionlint was available locally, and no CI run was triggered because nothing was pushed.
- **State/remaining:** this is a build gate, not an admin test gate — the admin app still has no test script. Strict secret scanning remains gated on owner credential rotation. Workflow changes are uncommitted.

## 2026-11-23 -- Snapshot delta diff added (final delta-sync planning aid)

- **Scope:** added local tooling to compare two copied snapshots for the final delta-sync gate. No database, Cloudflare account, credential or production data access; no delta exporter or importer was implemented.
- **Implementation:** `snapshot.ts` gained `readDeclaredSnapshotRecords()`; `snapshotDiff.ts` reports per-collection added/removed/changed counts, top-level changed field names, duplicate/invalid IDs and watermark ordering, emitting source IDs and content digests only. Added `src/scripts/snapshot-diff.ts` with `snapshot:diff` and 5 unit tests.
- **Verification (run):** targeted tests passed 16/16 with backup-verifier and legacy-reference suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on two generated snapshots reported 1 removed / 1 changed record and no values. No production access.
- **State/remaining:** this is a planning/verification aid, not final delta sync. Watermark export, tombstone/deletion handling, upsert-by-`source_id`, child-row replacement and delta checkpoints remain open. New changes are uncommitted.

## 2026-11-23 -- D1 draft schema conflicts refined (local code + tests)

- **Scope:** resolved the three concrete DDL draft conflicts recorded in `CURRENT_TASK.md` without approving the schema or touching any database.
- **Changes:** `generate-d1-schema.ts` now treats Mongoose `default: null` as nullable instead of `NOT NULL` and maps the two non-monetary gift-collection multipliers to `REAL` with a non-negative `CHECK`. `transform.ts` adds `toFiniteNumber()` with a new `NON_FINITE_NUMBER` quarantine reason; `mappings.ts` uses it for `bonus.xpMultiplier`/`coinMultiplier` so fractional ratios are preserved. Regenerated `0001_initial.sql` and manifest: `story_comments.parent_id`, `gifts.expires_at` and `gifts.collection_id` are nullable, and the two multiplier columns are `REAL`.
- **Verification (run):** full `src/migration/*.test.ts` suite 163/163 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; schema generator reported 146 tables, 0 warnings and 0 import failures. SQL diff contains only the three nullability changes, two `REAL` columns/checks and the manifest generation timestamp.
- **State/remaining:** this is still a review draft; owner approval, capacity metrics, backup/restore rehearsal and cutover gates are unchanged. New changes are uncommitted.

## 2026-11-23 -- Private-media authorization audit added (DCR-4 input preparation)

- **Scope:** read-only source audit of current private-media authorization; no code, policy, bucket, credential or production data change.
- **Finding:** `authorizeMediaDownload()` grants non-owner `PRIVATE` access only for `ownerType=MESSAGE` direct-message participants (sender/receiver, hidden/block checks). `ROOM`, `CLAN`, `COSMETIC`, `ACHIEVEMENT`, `EVENT` and `APPLICATION` private media have no participant path and are denied. The gap is latent because managed upload currently accepts only `AVATAR`/`USER`, but it blocks any future private room/clan/chat category cutover.
- **Deliverable:** `docs/migration/private-media-authorization.md` with the exact decision order, the owner-type matrix, legacy public `/uploads` behavior, admin trust/asset-staging rules and the mount-order dependency; linked from DCR-4 and `INDEX.md`.
- **Verification (run):** source reads of `services/media.ts`, `routes/media.ts`, `services/storage.ts`, `app.ts`, admin routers and the existing unit tests. No build, test, deploy or production access was needed for this documentation-only slice.

## 2026-11-23 -- Legacy media reference scanner added (DCR-4 input preparation)

- **Scope:** filled the remaining DCR-4 inventory gap identified in the media-inventory handoff: historical `/uploads` and other non-MediaObject URL references. No database, bucket, credential or production data access; still no policy decision.
- **Implementation:** `backend-server/apps/api/src/migration/legacyMediaReferences.ts` scans exported JSONL records or a copied snapshot directory for legacy public `/uploads`, private trust/staging routes, badge-art routes, inline data URLs, absolute URLs and managed upload endpoints. It emits counts, field paths, extensions, de-queried URL digests and a stable report digest — never raw URLs or customer content — and does not check binary existence. Added `src/scripts/legacy-media-references.ts` with npm script `inventory:legacy-media` and 7 unit tests.
- **Verification (run):** targeted tests passed 23/23 with the D1 screener, media inventory and backup verifier suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture produced counts and digests without echoing URLs. No production access.
- **State/remaining:** reference counts are not a binary census and do not solve the unrecoverable-file finding. DCR-4 environment inputs, option selection, export approval, media backup and restore rehearsal remain open. New changes are uncommitted.

## 2026-11-23 -- D1 hard-limit screener added (DCR-2 input preparation)

- **Scope:** added local tooling to prepare DCR-2 capacity inputs without any production access. No metric was collected, no Cloudflare account was queried, and no capacity decision was made.
- **Implementation:** `backend-server/apps/api/src/migration/d1CapacityGate.ts` validates a flat metrics JSON and screens documented D1 hard limits (10 GB, Workers Paid/500 MB Free, 2 MB row, R2-only binaries, 100 KB statement, 100 parameters, 50 MB result, 30 s p99, 50/1,000 queries per invocation). It returns five always-open review items for comfort, throughput headroom, query shape, growth/retention and recovery/billing. Added `src/scripts/d1-capacity-gate.ts` with npm script `capacity:gate` and 6 unit tests.
- **Verification (run):** targeted tests passed 16/16 with the media-inventory and backup-verifier suites; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smokes with a valid fixture printed `PASS / REVIEW REQUIRED` and an over-limit fixture exited 1 with all expected hard-limit failures. No database, Cloudflare account, credential or production data access.
- **State/remaining:** hard-limit screening is not DCR-2 acceptance. Owner must supply real aggregates, Workers Paid confirmation, query/growth/recovery evidence and an approved schema before any D1 production step. New local changes are uncommitted; no commit/push authorization applies to this slice.

## 2026-11-22 -- Realtime parity matrix added (DCR-3 harness, unwired)

- **Scope:** encoded the accepted DCR-3 consequence that a dual-test matrix is required, without building an adapter or touching any runtime path.
- **Implementation:** `backend-server/packages/shared/src/realtimeParity.ts` defines a transport-agnostic `ParityTransport`, 6 executable scenarios (reconnect/resume, duplicate ID, stale sequence, scope isolation, room-join ack and a sign-off-gated `BONDS` invalidation case) and 10 documented requirements sourced from the verified inventory. `runParityMatrix` skips sign-off scenarios unless enabled. Exported from `@yugm/shared` and covered by 4 new tests using a clearly marked in-memory test double.
- **Verification (run):** `npm.cmd run test --workspace @yugm/shared` passed 12/12; `npm.cmd run typecheck --workspace @yugm/shared` and `--workspace @yugm/api` passed. A deliberately broken double was detected by the matrix. No build, deploy, provision, client change or data access.
- **State/remaining:** the matrix has only been exercised against an in-memory test double. It is not evidence that the Socket.IO compatibility path and native protocol interoperate. DCR-3 inputs, DCR-4 scope, DCR-2 metrics, credential rotation and a tested restore remain open.

## 2026-11-22 -- Read-only media inventory reporter added (DCR-4 input preparation)

- **Scope:** added local tooling to prepare the media-inventory input requested in [DCR-4](cloudflare-migration/decision-request.md) without touching MongoDB or R2. No policy decision was made or encoded.
- **Implementation:** `backend-server/apps/api/src/migration/mediaInventory.ts` aggregates exported MediaObject-shaped records into counts/bytes by category, bucket, visibility, owner type, media type and bucket×visibility, plus processing/moderation status, variant storage, duplicate storage keys and a stable digest. `src/scripts/media-inventory.ts` with npm script `inventory:media` reads a local JSONL export and writes JSON to stdout or `--out`. Added 6 unit tests.
- **Verification (run):** `npm.cmd exec -- tsx --test src/migration/mediaInventory.test.ts src/migration/verifyBackup.test.ts` passed 10/10; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture produced a complete report. No database, bucket, remote service, credential or production data access.
- **State/remaining:** this does not supply legacy `/uploads` URL coverage, does not verify binaries exist, and does not create a media backup. DCR-4 environment inputs, option A/B/C selection and owner approval for any export or media change are still required. No commit, push or deploy was authorized.

## 2026-11-22 -- Snapshot-copy integrity verifier added (Phase 1 tooling)

- **Scope:** filled the missing backup-integrity piece identified in [BACKUP_AND_RECOVERY.md](migration/BACKUP_AND_RECOVERY.md) section 4, step 7. This is local, read-only tooling; no backup was created and no restore was rehearsed.
- **Implementation:** added `backend-server/apps/api/src/migration/verifyBackup.ts` (batch presence, record/byte counts, per-batch checksums, unexpected batch files, optional top-level digest), a CLI at `src/scripts/verify-backup.ts` with npm script `backup:verify`, and 4 unit tests in `verifyBackup.test.ts`. Exported the shared batch-filename convention from `snapshot.ts` so the writer and verifier cannot drift.
- **Verification (run):** `npm.cmd exec -- tsx --test src/migration/verifyBackup.test.ts src/migration/adapters.test.ts` passed 9/9; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke against a generated fixture printed `Verification: PASS` both with and without `--expect-digest`. No database, bucket, remote service, credential or production data was touched.
- **State/remaining:** backup/recovery verification statuses are unchanged — no verified MongoDB, media or config backup and no tested restore. DCR-4, DCR-2 metrics, DCR-3 inputs and owner credential rotation remain open. No commit, push or deploy was authorized.

## 2026-11-22 -- Native realtime protocol contract foundation (local, unwired)

- **Scope:** took the next unblocked local slice under DCR-3 Option C ([ADR-0002](decisions/0002-staged-hybrid-realtime-protocol.md)) and the DCR-5 local-code-and-tests authorization. No runtime path, adapter, client or infrastructure was changed.
- **Implementation:** added `backend-server/packages/shared/src/realtimeProtocol.ts` (version-1 envelope, resume frame, authoritative command-ack shape, bounded per-scope dedupe/replay state and event-coverage harness), exported it from `@yugm/shared`, and added 8 unit tests in `realtimeProtocol.test.ts`. The event constants were re-checked against `docs/migration/realtime-event-inventory.md` and source: 47 shared, 16 PK, 17 off-catalog literals and 3 Android-only listeners. Added a `test` script to the shared workspace so the root `npm test` aggregation picks it up.
- **Verification (run):** `npm.cmd run typecheck --workspace @yugm/shared` passed; `npm.cmd run test --workspace @yugm/shared` passed 8/8; `npm.cmd run typecheck --workspace @yugm/api` passed. No build, deploy, provision, credential operation or data migration was run.
- **State/remaining:** the contract is a harness only. Owner still owes the DCR-3 support window, hibernation/cost requirement, event-inventory sign-off and `BONDS` decision before classification, adapters or cutover work. DCR-4, DCR-2 capacity metrics, credential rotation and a tested restore remain open.

## 2026-11-22 -- DCR decisions recorded and DCR-1 credential guard prepared

- **Scope:** recorded the owner's answers as [ADR-0002](decisions/0002-staged-hybrid-realtime-protocol.md) (DCR-3 staged hybrid), [ADR-0003](decisions/0003-credential-remediation-approach.md) (DCR-1 Option A, owner rotates and agent prepares) and [ADR-0004](decisions/0004-local-code-and-tests-authorization.md) (DCR-5 local code + tests). Updated `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `MIGRATION_PROGRESS.md` and a new dated handoff.
- **Implementation:** added a value-free credential regression guard at `backend-server/scripts/check-tracked-secrets.mjs` with 8 unit tests, root npm scripts (`secrets:check`, `secrets:check:strict`, `test:secrets`) and report-only CI steps in `.github/workflows/ci.yml`. No secret value was read into output, printed, modified, rotated or removed; no tracked credential values were changed.
- **Verification (run):** `npm.cmd run test:secrets` passed 8/8; `npm.cmd run secrets:check` scanned 30 tracked config files and reported exactly 8 findings in the tracked local Worker config by name and line only; `npm.cmd run secrets:check:strict` returned exit code 1 as designed. No build, deploy, provision, credential change or data migration was run.
- **State/remaining:** DCR-4 R2 scope, DCR-3 support window/inventory sign-off, DCR-2 capacity metrics and Workers Paid, verified backups and restore rehearsal are still open. Owner must rotate credentials and confirm before tracked values are removed and the strict gate is enabled. No commit, push or deploy authorization was given.

## 2026-11-22 -- Full Cloudflare migration: Phase 0 reconciliation and Phase 1 planning

- **Scope:** reconciled the owner's 26-phase Cloudflare migration directive with the repository's existing Phase 0–8 plan, five decision gates and [ADR-0001](decisions/0001-d1-and-r2-target.md). No architecture was redefined and no duplicate implementation was created.
- **Artifacts:** `docs/migration/DIRECTIVE_RECONCILIATION.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/migration/BASELINE_REPORT.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/ROLLBACK_PLAN.md`, plus links in `docs/INDEX.md`, status in `docs/CURRENT_TASK.md`, this record, `MIGRATION_PROGRESS.md` and a dated handoff.
- **Verification (run):** read-only source audits, Git checkpoint and version reads, and three staging HTTP probes per health/readiness endpoint (all 200). No build, test, migration, provision, deploy, credential read or production data operation was run.
- **State/remaining:** backups and restore rehearsal are unverified; DCR-1, DCR-3, DCR-4 and DCR-5 plus DCR-2 capacity inputs remain open. No commit, push, deploy, paid provisioning or legacy removal was authorized.

## 2026-11-22 -- Worker runtime compatibility and image processing boundary (YUGM-WORKER-1101)

- **Root cause:** The deployed staging Worker's Error 1101 came from Sharp's native import chain: HTTP routes reached `media.ts`/`assets.ts`, and scheduled maintenance reached `assets.ts` through a dynamic `badges.ts` import. Dynamic imports still bundle reachable modules.
- **Backend:** added a host-neutral image processor registry, a Node-only Sharp provider installed by the API entry point, and a Cloudflare Images binding provider installed by the Worker runtime before API modules load. `media.ts`/`assets.ts` now use the registry; absent processors return `503` for managed uploads so the Android legacy fallback contract remains valid.
- **Worker/config:** added `IMAGES` to local, staging and production Wrangler configs; added structured request/binding/alarm error handling with controlled `503` responses; split liveness `/health` from dependency `/ready`; updated CI and local/staging smoke scripts to use `/ready`.
- **Startup fix:** aligned `AssetObject`/`MediaObject` schema index names/options with additive migrations v6/v9 and drop known legacy default-named indexes first. This fixed the `IndexOptionsConflict` discovered by the local Worker suite without rewriting data.
- **Docs:** added [Worker runtime and image processing boundary](infrastructure/worker-runtime-image-processing.md), linked it from `INDEX.md`, the Worker audit and Worker README; updated API health/readiness and asset contracts; updated the CI row in the admin/deployment audit; recorded the task and handoff.
- **Verification:** backend root `typecheck` passed; API tests 360/360; hardening 34/34; Worker staging dry-run passed with `env.IMAGES (Images)`; emitted staging bundle JavaScript contains no Sharp import/path or `createRequire(import.meta.url)`; local Worker realtime suite passed (ready gate, GridFS media, Socket.IO, bonds, PK alarms, reconnect/heartbeat, room closure). The pre-existing `whatwg-url` unenv warning remains.
- **Commit/push/deploy:** committed as `80d46af` and pushed to `origin/master`, triggering staging CI run #76. All pre-deploy checks passed (install, typecheck, unit, hardening, Worker realtime, admin build) and the Worker deployed. The readiness gate failed initially because the live Durable Object kept serving the old script for roughly 3-4 minutes; after restart, live `/health` and `/ready` passed (`images.configured=true`, `images.provider=cloudflare-images`, `db.ready=true`, `storage.ready=true`, scheduled `lastCronRun` present) with no Error 1101 or error events in a fresh log tail. Widened the CI gate retry window accordingly.
- **State/remaining:** CI run #77 passed all 23 steps (tests, Worker deploy, readiness gate, Pages admin deploy); final live probes were `/health` 200, `/ready` 200 and admin `/` 200 with `images.configured=true`. Live R2 upload, D1/R2/Queue provisioning and production deployment were not run. No provision, credential change or production data operation was authorized.

## 2026-11-22 -- Release APK/AAB configuration for R2 media (YUGM-RELEASE-001)

- **Docs:** added [release APK/AAB configuration](features/release-build-configuration.md) covering the rule that R2 credentials/keys stay server-side, Gradle property precedence and enforced release checks, keystore resolution, AAB/APK commands, Node and Worker server configuration, the expected upload sequence, failure mapping and a security checklist. Linked it from the [R2 media doc](features/r2-centralized-media.md#release-clients), the [Play checklist](play-store-release-checklist.md) and `INDEX.md`; the Play checklist now has the release property block and a signed-artifact R2 verification step.
- **Local findings (no values printed):** `android-client/local.properties` has `YUGM_SERVER_MODE` set to deploy and all four signing keys populated, but `YUGM_API_BASE_URL`, `YUGM_SOCKET_BASE_URL`, `YUGM_VERSION_CODE` and `YUGM_VERSION_NAME` are missing. The configured keystore path did not resolve to an existing file from the repository root or `android-client/app`. Without explicit URLs the release build falls back to the staging Worker default, which still uses `STORAGE_DRIVER=mongodb`.
- **Verification:** read-only source/config inspection plus key-presence, URL-scheme and keystore-existence checks. No Gradle release build, install, signing, deploy, credential change or production operation was run. The R2 `env:check`/typecheck/test results recorded under YUGM-R2-002 remain the last executed storage verification.
- **State:** release documentation is ready; release execution is blocked on the exact API/socket hosts, a valid keystore path, and confirmation that the target deployment has R2 enabled. No commit, push, deploy or release is authorized.

## 2026-11-22 -- MongoDB to D1/R2 decision and first schema draft (YUGM-DB-001)

- **Decision:** [ADR-0001](decisions/0001-d1-and-r2-target.md) records the owner's selection of D1 for authoritative relational state, R2 for all binaries and eventual retirement of MongoDB. DCR-2 is closed in the [decision request](cloudflare-migration/decision-request.md); capacity metrics, Workers Paid, backup/restore and cutover remain mandatory gates. The [capacity assessment](database/d1-capacity-assessment.md), [mapping spec](database/mongo-to-relational-mapping.md), [implementation plan](migration/implementation-plan.md) and `INDEX.md` were updated accordingly.
- **Backend tooling:** added `src/scripts/generate-d1-schema.ts` and a `schema:d1` npm script. It imports local Mongoose models only (no DB connection, no credentials) and emits D1/SQLite DDL with `source_id` keys, UTC TEXT timestamps, integer numeric columns, enum CHECKs, `min` constraints, FK references and translated indexes. The refined draft has 97 root tables plus 49 normalized child tables (approved triage dispositions applied locally), 246 FK references, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 review warnings. Added the Phase 2 foundation under `src/migration/`: transform primitives with explicit quarantine and source-row accountancy, checkpoint/idempotency helpers, validation report builders, deterministic snapshot checksums/filesystem store, read-only bounded export, a checkpoint-backed idempotent importer with dry-run and manifest checksum verification, a read-only keyset-paginated MongoDB source adapter, a D1 batch writer that respects the 100-bound-parameter limit, golden transform fixtures, reviewed per-collection mappings (root plus normalized child rows) with a multi-table replay-safe import path, deterministic checksummed `id_map` artifacts and a local-only rehearsal CLI/harness (`npm run migrate:rehearse`) that runs real mappings in dry run and emits transform/validation/id_map reports. Reviewed mappings now cover all 97 root collections: identity/auth, finance/entitlements, assets/media, social/messaging (`friendships`, `blocks`, `follows`, `clans`, `direct_messages`, `chat_messages`, `conversation_mutes`, `stories`, `story_highlights`, plus rooms/live state (`rooms`, `room_participants`, `room_invites`, `room_follows`, `room_mode_states`, `room_reactions`, `room_activities`, `room_recordings`, `speaker_requests`, `polls`, `voice_polls`), plus progression/rewards (`achievements`, `battle_passes`, `battle_pass_xp_grants`, `seasons`, `missions`, `user_missions`, `daily_questions`, `user_daily_answers`, `mini_game_challenges`, `mini_game_scores`, `cosmetics`, `immersive_themes`, `gift_collections`, `gift_inventories`, `wishlist_items`), plus moderation/safety (`reports`, `moderation_queues`, `moderation_actions`, `admin_audit_logs`, `admin_moderation_actions`, `support_tickets`, `support_messages`, `trust_verifications`, `face_verification_submissions`, `voice_verification_submissions`, `user_safety_statuses`), plus events/XP/engagement (`app_config`, `countdown_events`, `events`, `xp_daily_caps`, `xp_grants`, `user_moods`, `wave_nudges`, `profile_visits`, `likes`, `referrals`, `relationships`) and bonds/vibe graphs (`bonds`, `bond_points`, `bond_ranking_snapshots`, `bond_requests`, `bond_rewards`, `vibe_graphs`) and clan/group messaging/comments (`clan_invites`, `clan_messages`, `group_chats`, `group_messages`, `story_comments`, `watch_parties`) and final KYC/matching/gifting/notification/payout/PK models (`creator_payout_kycs`, `friend_match_requests`, `gifts`, `matches`, `notifications`, `notification_campaigns`, `payout_reviews`, `pk_battles`, `pk_events`, `pk_invites`, `pk_leaderboard_entries`, `pk_participants`, `pk_votes`), with reaction/hidden-for/story-view/poll-voter/ballot/room-mode-participant, achievement-tier/battle-pass-reward/season-reward/gift-collection-item, support-ticket-message, event-participant, relationship-user, bond-user/slot, vibe-graph interest/language, clan-message-reaction, group-chat-participant and match-user child rows). Finance mappings preserve replay/idempotency keys and provider references; JSON TEXT draft columns are deterministically canonicalized pending the warning-triage decision. `story_comments.parent_id` stays null for root comments and `gifts.expires_at`/`gifts.collection_id` preserve source nulls; those draft-DDL `NOT NULL` constraints are flagged. 138 migration unit tests total. All 97 reviewed root models are mapped; no transform mappings remain unwritten. No live MongoDB connection or Cloudflare binding is opened by this code. Handoff: [2026-11-22 MongoDB to D1 decision and schema draft](handoffs/2026-11-22-mongodb-to-d1-decision-and-schema.md).
- **Verification:** `npm.cmd run schema:d1 --workspace apps/api` (131 tables, 0 import failures, 46 warnings), `npm.cmd exec -- tsx --test src/migration/transform.test.ts` (8/8), `npm.cmd exec -- tsx --test src/migration/pipeline.test.ts` (7/7), `npm.cmd exec -- tsx --test src/migration/adapters.test.ts src/migration/golden.test.ts` (6/6), `npm.cmd exec -- tsx --test src/migration/mappings.test.ts` (10/10), `npm.cmd exec -- tsx --test src/migration/rehearsal.test.ts` (6/6), `npm.cmd exec -- tsx --test src/migration/mappings-social.test.ts src/migration/mappings-domains.test.ts src/migration/mappings.test.ts` (37/37), `npm.cmd exec -- tsx --test src/migration/mappings-progression.test.ts` (12/12), `npm.cmd exec -- tsx --test src/migration/mappings-moderation.test.ts src/migration/mappings.test.ts` (moderation and registry suites passed), `tsx --test src/migration/*.test.ts` (138/138 across 15 files), `npm.cmd test --workspace apps/api` (359/359), `npm.cmd run typecheck --workspace apps/api` (pass). `migrate:rehearse` CLI smokes against generated fixture snapshots for the earlier slices and all 13 final-batch collections returned validation PASS/exit 0 and wrote the three aggregate artifacts; no real snapshot was used. Static checks of the SQL found 146 unique tables, 0 dotted or duplicate columns, 246 `REFERENCES`, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 warnings; every column emitted by the 97 reviewed mappings was cross-checked against the generated DDL, including the `support_ticket_messages`, `event_participants`, `relationship_users`, `bond_users`, `bond_slots`, `vibe_graph_interests`, `vibe_graph_languages`, `clan_message_reactions`, `conversation_participants` and `match_users` child tables. `sqlite3` CLI unavailable, so no live SQL parse was run. No export/import, provision, credential, deploy or data change.
- **Progression/rewards mappings:** added reviewed transforms and registry entries for 15 more collections (badges/achievements with six-tier arrays and R2-provenance-only inline binary, battle passes and XP grants, seasons, missions/user missions, daily questions/answers, mini-game challenges/scores, cosmetics, immersive themes and gift collections/inventories/wishlist items) plus `mappings-progression.test.ts` (12 tests). Legacy badge `imageData`/`imageMime`, multipart badge upload and `/api/badge-art/:id/:version` are untouched; any blob move needs separate approval. Noted a schema-wide review item: `generate-d1-schema.ts` maps every Mongoose `Number` to `INTEGER`, so fractional values such as `GiftCollection.bonus.xpMultiplier`/`coinMultiplier` would be quarantined by the draft-compliant transform until an owner decision changes the column type. This does not change the 46-warning manifest count. See [the dated handoff](handoffs/2026-11-22-d1-progression-mappings.md).
- **Moderation/safety mappings:** added reviewed transforms and registry entries for 11 more collections (reports, moderation queues/actions, admin audit/moderation actions, support tickets/messages, trust verifications, face/voice verification submissions and user safety statuses) plus `mappings-moderation.test.ts` (12 tests). Draft-DDL enum allowlists, bounded scores/counts, UTC dates, canonical JSON, 0/1 flags and references are preserved; embedded support messages become deterministic `support_ticket_messages` child rows. Verification: focused suite passed, all 88 migration tests passed, full API suite 309/309, typecheck passed, 61 root column sets and the new child table cross-checked against the DDL, and a generated-fixture rehearsal including `reports` returned PASS/exit 0. No real snapshot or production operation was used. See [the dated handoff](handoffs/2026-11-22-d1-moderation-mappings.md).
- **Events/XP/engagement mappings:** added reviewed transforms and registry entries for 11 more collections (app config, countdown events, events, XP daily caps/grants, user moods, wave nudges, profile visits, likes, referrals and relationships) plus `mappings-events.test.ts` (12 tests). Draft-DDL enums/defaults, canonical JSON for `app_config.value`/`xp_grants.receipt`/`events.tags`, UTC dates, bounded integers and 0/1 flags are preserved; deterministic `event_participants` and `relationship_users` child rows are emitted. Verification: focused 34/34, all 100 migration tests, full API suite 321/321, typecheck, DDL cross-check of the 11 roots and two child tables, and a generated-fixture rehearsal across all 11 collections returned PASS/exit 0. No real snapshot or production operation was used. See [the dated handoff](handoffs/2026-11-22-d1-events-mappings.md).
- **Bonds/vibe mappings:** added reviewed transforms and registry entries for six more collections (bonds, bond points, ranking snapshots, requests, rewards and vibe graphs) plus `mappings-bonds.test.ts` (12 tests). Draft-DDL enums/defaults, canonical Map/JSON columns, UTC dates, integers and 0/1 flags are preserved; bond users/slots and vibe-graph interests/languages become deterministic child rows. Verification: focused 46/46, all 112 migration tests, full API suite 333/333, typecheck, DDL cross-check of six roots and four child tables, and a generated-fixture rehearsal across all six collections returned PASS/exit 0. No real snapshot or production operation was used. See [the dated handoff](handoffs/2026-11-22-d1-bonds-mappings.md).
- **Messaging/comments mappings:** added reviewed transforms and registry entries for six more collections (clan invites, clan messages, group chats, group messages, story comments and watch parties) plus `mappings-messaging.test.ts` (12 tests). Draft-DDL clan-invite/group-message enums and defaults, watch-party playback 0/1 flags, canonical IDs and UTC dates are preserved; clan message reactions and group-chat participants become deterministic `clan_message_reactions` and `conversation_participants` rows. `story_comments.parent_id` is kept null for root comments and the draft DDL's `NOT NULL` is flagged as a schema issue rather than inventing a self-reference. Verification: focused 58/58, all 124 migration tests, full API suite 345/345, typecheck, DDL cross-check of six roots and two child tables, and a generated-fixture rehearsal across all six collections returned PASS/exit 0. No real snapshot or production operation was used. See [the dated handoff](handoffs/2026-11-22-d1-messaging-mappings.md).
- **Final reviewed mappings:** added transforms and registry entries for the last 13 root models (creator payout KYC, friend match requests, gifts, matches, notifications/campaigns, payout reviews and the seven PK models) plus `mappings-final.test.ts` (14 tests). All 97 root models are now reviewed; `Match.users` becomes deterministic `match_users` child rows. KYC/payout/notification/campaign/PK enums, defaults, UTC dates, integer flags/counters and canonical JSON columns follow the draft DDL. `PkParticipant.joinedAt` is required rather than re-dated, and `PkParticipant` has no synthetic timestamps because the source and draft DDL omit them. `gifts.expires_at`/`gifts.collection_id` preserve source nulls and join the existing `story_comments.parent_id` `NOT NULL` schema conflict. Verification: focused 24/24, all 138 migration tests, full API suite 359/359, typecheck, DDL cross-check of 13 roots and `match_users`, and a generated-fixture rehearsal across all 13 collections returned PASS/exit 0. No real snapshot or production operation was used. See [the dated handoff](handoffs/2026-11-22-d1-final-mappings.md).
- **Schema triage applied locally:** applied the owner-approved 46-warning triage to the generator and regenerated the draft DDL (146 tables, 97 roots + 49 child tables, 246 FKs, 204 `CHECK` constraints, 0 warnings). Added child tables for approved array/Map fields, promoted `DirectMessage.replyTo` and `PayoutReview.payout`, removed legacy `Achievement.imageData` bytes, and suppressed approved validated-JSON warnings. Updated transform mappings/tests for promoted columns and the removed `image_data` column. Verification: typecheck pass, 138/138 migration tests, 359/359 API tests, schema generator 0 warnings, and `git diff --check` clean. The DDL is still not approved. See [the dated handoff](handoffs/2026-11-22-d1-schema-triage-applied.md).
- **Schema review:** added [D1 schema warning triage](database/d1-schema-warning-triage.md), a source-checked disposition proposal covering all 46 manifest warnings (18 recommended for child tables/promoted columns/R2 references and 28 for validated JSON). It is a review package only: no DDL was edited and no schema was approved. Linked from `docs/INDEX.md` and the mapping spec.
- **Schema generator fix:** corrected a generator defect where Mongoose `Map` wildcard paths (`field.$*`) collapsed onto the same SQL column as the parent field, producing invalid duplicate columns `bonds.preferences` and `room_mode_states.scores`. `generate-d1-schema.ts` now suppresses the duplicate and emits a note in the DDL. Regenerating the draft removed one obsolete warning (47 → 46) without dropping a field or changing schema policy; the warning triage was updated to match. Static checks confirm 131 tables with 0 duplicate columns.
- **State:** non-destructive design stage. No Mongoose model was deleted and no runtime persistence path changed; DCR-1 and DCR-3 through DCR-5 remain open. Do not treat the generated SQL as an approved schema.

## 2026-11-22 -- R2 backend storage configuration scaffolding (YUGM-R2-002)

- **Backend:** `check-env.ts` reports all 11 `R2_*` keys by name/status only and validates that `STORAGE_DRIVER=s3` has an endpoint (R2 account ID or explicit `S3_ENDPOINT`), credentials, five bucket names and a public URL. The local config now passes with `STORAGE_DRIVER=s3` and all required R2 values set; no storage configuration problems are reported. No value is printed.
- **Docs:** [R2 media configuration](features/r2-centralized-media.md#configuration-procedure) now gives the fill-in steps for ignored `.env`/`.dev.vars`, Wrangler secrets, bucket/CORS/domain prerequisites and post-config verification. Handoff: [pending owner values](handoffs/2026-11-22-r2-storage-configuration-pending-values.md).
- **Verification:** `npm.cmd run env:check` (pass with current config; exit 1 with `s3` override), `npm.cmd run typecheck --workspace apps/api` (pass), `git diff --check` (pre-existing LF/CRLF notices only). No R2 credential, bucket, deploy, migration or live request was touched.
- **State:** local R2 configuration is supplied and validated with `STORAGE_DRIVER=s3`; Wrangler configs remain `mongodb` and are unchanged. No deploy or production media change is authorized.

## 2026-11-22 -- Cloudflare migration Phase 0 audit and planning (YUGM-CLOUDFLARE-000)

- **Docs:** added the single migration tracker `MIGRATION_PROGRESS.md` and a Phase 0 evidence set: [report](cloudflare-migration/phase0-report.md), [decision request](cloudflare-migration/decision-request.md), [target architecture](architecture/target-architecture.md), [backend source audit](architecture/backend-source-audit.md), [Android source audit](architecture/android-source-audit.md), [platform limits](infrastructure/cloudflare-platform-limits.md), [Worker prototype audit](infrastructure/worker-prototype-audit.md), [admin/deployment audit](infrastructure/admin-deployment-audit.md), [environments](infrastructure/environments.md), [credential finding](infrastructure/tracked-worker-credentials-finding.md), [D1 assessment](database/d1-capacity-assessment.md), [data mapping](database/mongo-to-relational-mapping.md), [feature matrix](migration/feature-matrix.md), [API compatibility](migration/api-compatibility.md), [data tooling](migration/data-migration-tooling.md), [realtime plan](migration/realtime-plan.md), [realtime event inventory](migration/realtime-event-inventory.md), [implementation plan](migration/implementation-plan.md), [test plan](testing/migration-test-plan.md) and a dated [handoff](handoffs/2026-11-22-cloudflare-migration-phase0.md). Linked them from `INDEX.md`.
- **Audit findings:** the existing Worker prototype is a singleton Express/Mongoose wrapper with GridFS, non-hibernating Engine.IO and disabled production startup; staging Worker/admin are deployed but no D1/R2/Queues/KV/Cron bindings exist; tracked local Worker config contains plaintext credentials; admin auth depends on Express mount order; admin has no test script; CI lacks secret scanning and admin build/test gates; backend startup failures are only logged, payment/Google Play webhooks are unmounted, and production metrics are unavailable. Android findings: 103 direct API calls from screens/nav graphs, hardcoded catalogs/pricing, `ProfileDetailScreen` progress/cancel wiring gap, failed-upload quota leak, and an unmatched `BONDS` sync topic.
- **Realtime findings:** source-verified 47 shared events (earlier docs said 48), 16 PK events, 17 off-catalog literals and three Android-only listeners with no server emit. DM typing accepts any user ID after format validation, `pk:force_ended` bypasses the host check, PK timers are disabled on Cloudflare, and the 11-row static socket CSV is stale and incomplete. Admin has no socket client. Full table: [realtime event inventory](migration/realtime-event-inventory.md).
- **Verification:** static source/config/docs audits and Git tracking/ignore checks only. Key Android claims and the highest-risk realtime claims were independently re-checked in source. The R2/media verification numbers below remain the prior uncommitted baseline and were not re-run for Phase 0. No build, test, migration, deploy, provisioning, credential change or live request was performed for this documentation phase.
- **State:** Phase 0 audit and planning complete but not accepted, pending production capacity metrics, credential remediation approval, the D1-versus-Hyperdrive ADR, realtime protocol choice and plan acceptance. No implementation phase is approved.

## 2026-11-22 -- Centralized R2 media foundation + avatar slice (YUGM-R2-001)

- **Backend:** added one centralized R2 service (`services/r2.ts`) with all object operations, server-owned key builders, checksums and presigned grants; R2 env schema with derived S3 endpoint/region/credentials; shared S3 client export; unified `MediaObject` registry and `MediaUploadSession`; additive migration 9 and production indexes. Added `/api/media/uploads`, `/complete`, cancel and authorized download routes with ownership, quota, staging verification, image validation, idempotent commit, supersede-preservation and short-lived private grants. `syncInvalidation` maps successful managed avatar completion to `PROFILE`+`TASKS`.
- **Android:** added `MediaUploadApi` and a non-logging presigned PUT client with progress/cancellation, plus pure grant-validation and chunked/cancellable progress-body tests; `IYugmApi`/`YugmApi`/`RoomApi`/`AuthRepository` now expose managed avatar upload with narrow `503`/`501` legacy fallback. Create Profile and Edit Profile show progress and Cancel; network work stays in ViewModels.
- **Contracts/docs:** OpenAPI media schemas/routes, `.env.example`, `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, `SECURITY_RULES.md`, `REALTIME_EVENTS.md`, `INDEX.md`, a new [centralized R2 media feature doc](features/r2-centralized-media.md), updated [avatar storage doc](features/avatar-r2-storage.md), `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-r2-media-foundation.md).
- **Verification:** `npm.cmd --workspace @yugm/api run typecheck` exit 0; API tests 221/221 (seven R2/media unit tests, four deterministic quota/staged-byte/failure-classification/access-decision tests, six in-memory Mongo + fake-S3 service integration tests including concurrent-grant quota coverage, five HTTP route integration tests, and sync assertions); hardening 34/34; admin typecheck exit 0; admin production build succeeded (generated `dist/` reverted); Android Studio JBR compiles of `:core:api`, `:feature:auth`, `:feature:profile` and `:core:api`/`:core:ui` unit-test tasks BUILD SUCCESSFUL (`:core:api:testDebugUnitTest` 38/38, including five new media-upload client tests); `git diff --check` clean apart from LF/CRLF notices.
- **OpenAPI:** `npx --yes swagger-cli validate apps/api/openapi.yaml` initially found comma-bearing inline descriptions parsed as extra keys plus missing referral response descriptions; all were corrected (including the new media download response) and the spec now validates cleanly.
- **Remaining:** no R2 provisioning, migration 6�9 application, live upload?publish?read?archive, R2 CORS/public-policy checks, device/emulator QA, full lint/assemble, other media categories, admin media tooling, reconciliation tooling, or account-switch Coil cache isolation. Working tree is uncommitted; no deploy or production data change. Untracked `yugm-cleanup/` was left untouched.

## 2026-11-22 -- Android asset-aware renderer Phase 4 first slice (YUGM-COSMETICS-001)

- **Shared renderer:** new `AssetArtwork` in `core:ui` is the single asset-aware image entry point; `selectAssetArtworkUrl()` chooses a named variant, then `full`, then the direct URL, resolves relative paths with `resolveMediaUrl()` and ignores emoji/gift keys that are not URLs. No second image loader was introduced.
- **Models/parsers:** `ProfileCosmetic`, `InventoryCosmetic` and `Achievement` gained `assetId`/`assetVersion`/`assetVariants[]`; `AssetParser` resolves URLs at read time and skips malformed variants. Managed URLs fall back to the existing procedural art, icon or emoji when absent or on load failure.
- **Consumers:** store/customize previews, inventory cosmetic tiles, badge art and gift tiles now use `AssetArtwork`. Equip moved from the inventory composable into `GiftViewModel`; the store clears errors on refresh and shows an error/retry state. Store merchandising stays static by decision.
- **Verification:** Android Studio JBR, `--console=plain --max-workers=2`: compiles of `:core:model`, `:core:api`, `:core:ui`, `:feature:profile`, `:feature:gift` � BUILD SUCCESSFUL; `:core:api:testDebugUnitTest` 33/33 and `:core:ui:testDebugUnitTest` 11/11 � BUILD SUCCESSFUL (six new tests: three parser + three renderer selection). `git diff --check` clean.
- **Remaining:** device/emulator visual QA, full lint/assemble, public profile/chat/room asset pass, live DB/storage flow, migrations 6�8 application, OpenAPI parser validation, and separately approved badge blob cleanup/upload retirement. Committed locally as `7f7182f` (not pushed; Phase 3 `0d145c3` is also local); no deploy, migration or production data change.

## 2026-11-22 -- Additive badge asset references Phase 3 (YUGM-COSMETICS-001)

- **Backend:** `Achievement.assetRef` (optional published `AssetObject` id) with additive migration 8 (sparse index only, no document rewrite) and explicit production indexing. `badgeCatalog()` now batch-resolves published badge art by id; `badgePublicArt()`/`publicBadge()` expose `assetId`, `assetVersion` and `assetVariants[]`, resolving `imageUrl` from managed `publicUrl` ? `full` variant ? legacy `imageUrl`. Earned/worn state and expirations are unchanged. Admin badge create/update validate that a linked asset is published and owned by that badge; "remove custom image" clears both legacy fields and the managed reference. `archiveAsset()` returns `409` while a cosmetic or badge references the asset.
- **Admin UI:** the Badges form links a published badge asset from **Managed Assets**; managed art overrides an uploaded image and the table marks linked badges.
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, OpenAPI badge-gallery response note, `features/cosmetics-ecosystem-audit.md` (�9), `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-badge-asset-references.md).
- **Verification:** API typecheck exit 0; API tests 199/199 (seven new badge tests: four DTO mapping + three asset-reference validation); hardening 34/34; admin typecheck exit 0; admin production build succeeded (generated `dist/` artifacts reverted to `HEAD` afterwards).
- **Remaining:** live DB/storage flow, migrations 6�8 application, admin integration tests, runtime UI QA, OpenAPI parser validation, Android renderer phase 4, and separately approved badge blob cleanup/upload retirement. Committed locally as `0d145c3` (not pushed); no deploy, no migration applied, no production data changed.

## 2026-11-22 -- Cosmetic asset references Phase 2 (YUGM-COSMETICS-001)

- **Backend:** `Cosmetic.assetRef` (optional published `AssetObject` id) with additive migration 7 (sparse index only, no document rewrite) and explicit production indexing. Public cosmetic DTOs now resolve managed art through a batched published-asset lookup and expose `assetId`, `assetVersion` and `assetVariants[]`, with legacy `assetUrl` as fallback; single-cosmetic wallet purchase responses use the same resolver. Admin cosmetic create/update validate that a linked asset is published and owned by that cosmetic, and archive now returns `409` while a cosmetic still references the asset.
- **Admin UI:** new **Managed Assets** page (stage/publish/archive, published-variant link), Cosmetics drawer asset selector with LINKED status, and `PROFILE_BANNER` in the type dropdown.
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, OpenAPI (`409` on archive), audit �8, `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-cosmetic-asset-references.md).
- **Verification:** API typecheck exit 0; API tests 192/192; hardening 34/34; admin typecheck exit 0; admin production build succeeded (generated `dist/` artifacts reverted to `HEAD` afterwards). `git diff --check` clean apart from LF/CRLF notices.
- **Remaining:** live DB/storage flow, migration 6/7 application, admin integration tests, runtime UI QA, OpenAPI parser validation, the additive Phase 3 badge slice recorded above, and Phase 4 Android renderer. Committed locally as `0e17033` (not pushed); no deploy, no migration applied, no production data changed.

## 2026-11-22 -- Cosmetics asset foundation Phase 1 (YUGM-COSMETICS-001)

- **Backend:** extended the shared storage service with a generic `assets` namespace and private `assets-staging` area (no second object-storage client). Added the additive `AssetObject` registry and asset service: MIME/signature/dimension validation, 8 MB cap, SHA-256 dedupe, atomic version allocation, private staging, immutable versioned WebP `full`/`preview` variants on publish, and archive cleanup. Added permission-audited `/api/admin/assets` routes (stage, read, staging read, publish, archive) using existing `cosmetics.read`/`cosmetics.write` and `auditLog()`. Registered additive migration 6 (index-only) and mounted the router.
- **Audit follow-ups (third audit reconciled):** `adminAudit.ts` now records non-ObjectId string/UUID entity IDs in `metadata.entityId` instead of silently losing the entry to an ObjectId cast error; `adminCosmetics.ts` and `adminReactions.ts` now use the shared `auditLog()` helper (with request IP/UA) instead of direct `AdminAuditLog.create()`; `archiveAsset()` clears the DB reference before deleting objects; `AssetObject` added to the explicit `productionIndexes.ts` set. Covered by a new `adminAudit.test.ts`.
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, `openapi.yaml`, audit document (incl. �7 reconciliation), `CURRENT_TASK.md`, and a new handoff.
- **Dependencies:** promoted `sharp` from transitive to an explicit `@yugm/api` dependency in `package.json` and the workspace lock.
- **Verification:** `npm.cmd --workspace @yugm/api run typecheck` exit 0; `npm.cmd --workspace @yugm/api test` 186/186 passing (six asset + one audit test); `npm.cmd --workspace @yugm/api run test:hardening` 34/34 passing; `git diff --check` clean apart from LF/CRLF notices.
- **Decisions resolved (user):** keep seeded external avatar URLs as provenance, keep store SKUs static, retire the disconnected bundle-purchase path. Still open: target environment/storage driver, and separate approval for the badge `imageData` cleanup.
- **Remaining:** live upload/migration verification, admin UI, Android renderer migration, Phase 2/3 backfill, asset route/integration tests. Committed and pushed as `e0c9c42`; no deploy, no migration applied, no production data changed.

## 2026-11-22 -- Cosmetics ecosystem Phase 1 audit (YUGM-COSMETICS-001)

- **Docs:** added [cosmetics ecosystem audit](features/cosmetics-ecosystem-audit.md) with a per-feature status matrix (fully implemented / backend-driven / partial / hardcoded / disconnected), architecture findings, a six-phase additive migration plan, data-preservation rules, rollback gates, and open decisions. Updated `CURRENT_TASK.md` and `INDEX.md`.
- **Key findings:** server authority for catalogue/ownership/balances/gifts/badges is already correct; the visual layer is hardcoded procedural art; there is no generic store/product/category catalogue; badge artwork uses a second upload path and is stored as `imageData` in the primary DB; admin mutations are excluded from sync invalidation; migrations 1�5 exist but cover only indexes/TTLs.
- **Verification:** read-only source audit plus completed Android and backend audit reports. No source, schema or database changes. No typecheck/test/build was run for this documentation-only step.
- **Remaining at the time:** outstanding data/admin/test audit; user decisions on re-hosting seeded external avatars, granular permissions, store catalogue, bundle purchase and badge-blob cleanup; then Phase 1 implementation. (Superseded by the Phase 1 implementation entry above, which records the audit reconciliation and resolved decisions.)

## 2026-11-22 -- Compact empty Clans card (YUGM-CLAN-EMPTY-021)

- **Android:** the own-profile clan card's empty state now mirrors the compact Bonds card: a horizontal `GlassCard` (18dp radius, ~76�84dp tall) with a **Clans** title, "Find a clan that feels like home." subtitle, and a small themed **Explore clans** primary button. Removed the "User has not joined clan yet" text, outlined button, and tall stacked layout. The populated clan card and both navigation callbacks are unchanged.
- **Docs:** `DESIGN_SYSTEM.md`, `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-compact-empty-clans-card.md).
- **Verification:** Android Studio JBR `:feature:profile:compileDebugKotlin --console=plain --max-workers=2` BUILD SUCCESSFUL (pre-existing deprecation warnings only); `git diff --check` clean (LF/CRLF notices only).
- **Remaining:** device/emulator visual QA of the empty card in light/dark/system themes, font scaling, narrow widths, TalkBack, and the button tap target; full lint/assemble. No backend changes. Committed and pushed as `e182854`; no deploy.

## 2026-11-22 -- Compact empty Bonds card (YUGM-BONDS-EMPTY-020)

- **Android:** the completely empty own-profile Bonds state now renders a single compact horizontal `GlassCard` (18dp radius, ~76�84dp tall) with the **Bonds** title, inline `0/capacity` counter, subtitle "Add people you feel connected to.", and a small theme-colored **Add bond** button. Removed the centered heart icon, "Add your bonds" heading, separate pill/badge, reserved slots, and decorative padding. Populated/pending states keep the existing three-slot layout; invite/accept/manage flows are untouched. Repurposed `bonds_profile_empty` and removed the unused `bonds_profile_hint`.
- **Docs:** `DESIGN_SYSTEM.md`, `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-compact-empty-bonds-card.md).
- **Verification:** Android Studio JBR `:feature:profile:compileDebugKotlin --console=plain --max-workers=2` BUILD SUCCESSFUL (pre-existing deprecation warnings only); `git diff --check` clean (LF/CRLF notices only).
- **Remaining:** device/emulator visual QA of the empty card in light/dark/system themes, font scaling, narrow widths, TalkBack, and the button tap target; full lint/assemble. No backend changes. Committed and pushed as `e182854`; no deploy.

## 2026-11-22 -- Five worn badges in the profile header (YUGM-BADGE-SLOTS-019)

- **Backend:** raised the authoritative worn-badge cap from 3 to 5 for automatic grants, stored `showcasedBadgeIds`, validation, and public reads. Badge responses now expose `capacity`; `/experience` mutations invalidate `TASKS` and `PROFILE` for the actor and broadcast topic-only `PROFILE` to connected viewers. Hardening test now covers six earned badges, automatic wear capped at five, invalid sixth/duplicate/unearned selections, and public/persisted capacity and order.
- **Android:** parsed server `capacity` with a five-slot fallback; Achievements wear slots and copy use that capacity. `WornBadgeRow` no longer truncates to three. Own and public profile headers load badges and render the shared horizontal icon row between ID/level and description; the separate public Badges card is removed and the Your Yugm Achievements shortcut remains.
- **Docs:** `API_CONTRACTS.md`, `REALTIME_EVENTS.md`, `DESIGN_SYSTEM.md`, `COMPONENT_REGISTRY.md`, backend `progression-contract.md`, OpenAPI badge endpoints, `CURRENT_TASK.md`, and a new [handoff](handoffs/2026-11-22-five-worn-badges.md).
- **Verification:** backend typecheck exit 0, API unit tests 179/179, hardening integration 34/34. Android JBR compile of affected modules plus app and `:core:api:testDebugUnitTest` BUILD SUCCESSFUL (30/30 core API tests); `git diff --check` clean.
- **Remaining:** device/emulator visual QA, live two-client realtime refresh, full lint/assemble, OpenAPI parser validation. Committed and pushed as `10cf4d7`; no deploy.

## 2026-11-22 -- Commit record

- `e0c9c42` � `feat(assets): centralized asset registry and admin upload pipeline`. Pushed to `origin/master`; no deploy. Included the additive asset registry/storage/admin routes, migration 6, audit-ID fix, explicit production indexes, seven unit tests, and all audit/contract/handoff docs. Local Gradle output captures are now gitignored; files left untouched.
- `e182854` � `feat(profile): compact empty Bonds and Clans cards`. Pushed to `origin/master`; no deploy. Included the compact horizontal empty cards, string cleanup, design/task/progress docs, and both 2026-11-22 handoffs. Untracked local build logs remain untouched.
- `10cf4d7` � `feat(badges): expand worn showcase to five slots`. Pushed to `origin/master`; no deploy. Included the five-slot backend cap, server-sourced capacity, sync invalidation, profile-header badge row, tests, and docs. Untracked local build logs remain untouched.
- `76dbfe8` � `feat(profile): unify Bonds and add profile shortcuts`. Pushed to `origin/master`; no deploy. Included the Bonds merge, Close Friends API/storage removal, profile shortcut changes, global spinner scale, tests, docs, and 2026-11-22 handoffs. Untracked local build logs remain untouched.

## 2026-11-22 -- Achievements shortcut in Your Yugm (YUGM-PROFILE-SHORTCUT-018)

- **Android:** removed the own-profile **Achievements & badges** card and its self-profile badge fetch. Added a trophy **Achievements** tile to the `Your Yugm` profile-shortcut menu, wired through the existing `onOpenAchievements` callback to `Screen.Achievements`. Other users' public **Badges** showcase remains unchanged.
- **Docs:** `DESIGN_SYSTEM.md`, `CURRENT_TASK.md`, and new [handoff](handoffs/2026-11-22-profile-achievements-shortcut.md).
- **Verification:** Android JBR `:feature:profile:compileDebugKotlin` BUILD SUCCESSFUL (pre-existing deprecation warnings only).
- **Remaining:** device/emulator visual and touch-target QA for the Your Yugm grid. Committed/pushed as `76dbfe8`; no deploy.

## 2026-11-22 -- Unified Bonds profile section (YUGM-BONDS-MERGE-017)

- **Android:** one own-profile Bonds card reads `/bonds/me` and renders server-sized active/pending/empty slots, `active/capacity` pill, Manage, and empty/loading/error/retry. Occupied/pending slots open the Bonds flow at that partner; empty slots open Bonds home. Added `BondsProfileRules` + 4 unit tests. Removed `feature/profile/closefriends`, `Screen.CloseFriends`, its nav/callbacks, and close-friend API wrappers; `closeFriendsCount` became `bondsCount`.
- **Backend:** removed close-friend routes/service/tests/shared constant and `User.closeFriendIds` (including the block-pair `$pull`). Public profiles derive `bondsCount`/`isBonded` from active `Bond` rows; `PATCH /me` returns authoritative `bondsCount`. OpenAPI replaced removed paths with Bonds endpoints. Breaking API removal was user-approved.
- **Docs:** `API_CONTRACTS.md`, `DESIGN_SYSTEM.md`, `NAVIGATION_MAP.md`, `bonds.md`, `CURRENT_TASK.md`, prior handoff marked superseded, and new [handoff](handoffs/2026-11-22-bonds-merge.md).
- **Verification:** backend `tsc` exit 0; API tests 178/178 passed. Android JBR compiles passed (including a final `:feature:profile:compileDebugKotlin` recheck); `BondsProfileRulesTest` 4/4, `core:navigation` 12/12, `MainTabsNavigationTest` 4/4. `git diff --check` clean apart from LF/CRLF notices.
- **Follow-up fix:** matched the profile Bonds card width to sibling cards by removing duplicate horizontal padding under the LazyColumn padding; removed the `slot` route argument and auto-opened invite sheet so opening Bonds from the profile lands on Bonds home. Android compile and the same targeted unit suites were re-run and passed.
- **Remaining:** device/emulator visual and realtime QA, MongoDB concurrent-slot integration rerun, OpenAPI YAML parser validation, full lint/assemble. Committed/pushed as `76dbfe8`; no deploy.

## 2026-11-22 -- Profile close-friends section and three-person cap (YUGM-PROFILE-CLOSEFRIENDS-015, superseded)

- **Android:** added `feature/profile/closefriends` with a compact own-profile section (count pill, empty invitation, three equal brand-pastel slots with avatar/name/presence, plus-slots, loading/error/retry) and a management screen (accepted-friend picker, remove confirmation, max-3 guard, immediate refresh after authoritative add/remove). Added `Screen.CloseFriends` secondary route and wired Profile/MainTabs callers; occupied cards open member profiles. Renamed the Bonds profile section/hero to avoid confusion while preserving the Bonds route.
- **Backend:** shared `closeFriendsLimit = 3`; atomic conditional add enforces the cap, verifies accepted friendship and no block, returns 409 when full, and is idempotent without duplicate notifications. Added transient `isOnline` to close-friend/friend payloads.
- **Verification:** backend typecheck and full API test suite (182/182) passed; Android JBR compile, `CloseFriendsRulesTest` (7/7), `core:navigation` navigation tests, and `MainTabsNavigationTest` passed.
- **Docs/handoff:** `API_CONTRACTS.md`, OpenAPI, design system, component registry, navigation map, `CURRENT_TASK.md`, [handoff](handoffs/2026-11-22-close-friends-section.md).
- **Remaining:** device/emulator visual QA and Mongo integration test for concurrent cap adds. Historical record; committed/pushed as `76dbfe8`.

## 2026-11-22 -- Global Lottie loading-spinner scale (YUGM-UI-SPINNER-SCALE-016)

- **Source:** `YugmLoadingSpinnerDefaults` now owns `BaselineSize = 40.dp` and global `SizeScale = 1.25f`; `YugmLoadingSpinner` scales every caller-supplied baseline once for the box and animation (16dp renders 20dp, 40dp renders 50dp). No call-site churn; determinate progress bars untouched.
- **Verification:** Android JBR compile passed; `:core:ui:testDebugUnitTest` 8/8 passed (new spinner test 2/2, geometry tests 6/6).
- **Docs/handoff:** root/Android design system and component registry updated; [handoff](handoffs/2026-11-22-loading-spinner-global-scale.md).
- **Remaining:** visual review of dense inline slots and large font scale. Committed/pushed as `76dbfe8`; no deploy.

## 2026-11-21 -- Premium curved-dock polish: geometry, icon family, motion, feedback (YUGM-NAV-DOCK-PREMIUM-013)

- **Source (`core/ui`):** added `BottomDockIcons.kt` � rounded custom vector family (outlined inactive / filled active) for Arcade game controller, Party studio mic, Discover compass, Chat bubble, Profile silhouette. Reworked `YugmBottomDock`: embedded 50dp active circle (center on surface top boundary, 28dp active icon, 2dp ring) inside a genuine 78�36dp concave cradle; selected-only 11sp label in a reserved slot with fade+slide (no clipping/layout shift); inactive icons on a fixed baseline rising/fading into the notch; controlled spring (~300ms)/reduced-motion snap driving notch+circle+icons+label; circular press feedback, chat badge, light haptic; clamped shoulders for first/last tabs/narrow widths.
- **Tests/docs:** `BottomDockGeometryTest` extended/updated (7/7 passed); `NAVIGATION_ARCHITECTURE.md` dock conventions updated; `CURRENT_TASK.md`/handoff updated.
- **Verification:** `:core:ui:testDebugUnitTest :app:compileDebugKotlin` **BUILD SUCCESSFUL**. Human visual/Layout Inspector validation still pending (agent cannot inspect screenshots).
- **Remaining:** visual QA across five tabs/themes/nav modes/font scales, runtime touch/haptics, lint re-run.

## 2026-11-21 -- Bottom navigation icon-first refinement (YUGM-NAV-DOCK-REFINE-012)

- **Refinement (source, `core/ui`):** `YugmBottomDock` redesigned to a minimal icon-first bar � 26dp icons, 50dp elevated active circle with 76�34dp notch cradle, inactive icons vertically centered in a stable slot (no layout shift), labels hidden for inactive destinations and shown only for the selected destination with fade-and-slide, subtle circular press feedback (no rectangular ripple/overlay), retained chat unread badge, and light haptic tick on interaction. Theme tokens, edge-to-bottom/inset behavior, whitelist visibility, and navigation semantics preserved.
- **Verification:** `:core:ui:compileDebugKotlin :app:compileDebugKotlin :core:ui:testDebugUnitTest` **BUILD SUCCESSFUL** (`BottomDockGeometryTest` updated/passing); `:app:installDebug` **BUILD SUCCESSFUL** (emulator-5554, screenshot captured but not visually inspectable by agent). Human visual/a11y/runtime sign-off pending.
- **Docs:** `docs/NAVIGATION_ARCHITECTURE.md`, `docs/CURRENT_TASK.md`; handoff [2026-11-21 bottom nav icon-first refinement](handoffs/2026-11-21-bottom-nav-icon-first-refinement.md).

## 2026-11-21 -- Bottom navigation insets fix, geometry hardening, and architecture docs (YUGM-NAV-AUDIT-011 continuation)

- **Root cause fixed (elevated dock / gap above system gesture handle):** `NavGraph` consumed full `safeDrawing` insets, so `WindowInsets.navigationBars` was 0 inside the main-tabs host and the dock surface stopped above the nav area. Fix: destination-derived root insets � `MainTabs` applies `safeDrawing.only(Top + Horizontal)` (dock paints to physical bottom and pads content above nav inset); other destinations keep full `safeDrawing`. Hidden-dock case (Chat clan subtab) applies `navigationBarsPadding()` to the pager.
- **Navigation hardening (source):** `MainTabsRoutes.isDockVisible(...)` centralizes the whitelist+clan visibility contract; `TopLevelNavigationTargets` (pure mapping) + refactored `TopLevelNavigation` for idempotent, no-prefix-match tab/secondary routing; `BottomDockGeometry` + clamped `CurvedDockShape` for correct first/last-tab shoulders and animated notch center; dock touch feedback made shape-aware (`indication=null`, subtle press alpha) with semantic ring color; `MainTabsScreen` uses `tabScrollTarget` and the centralized visibility helper.
- **Tests added/passing:** `core/navigation` `MainTabsRoutesTest` (8) + `TopLevelNavigationTargetsTest` (4), `core/ui` `BottomDockGeometryTest` (6), `app` `MainTabsNavigationTest` (4) � 23 tests/0 failures in exercised suites; `:app:installDebug` succeeded.
- **Runtime exercised (emulator-5554, gesture nav):** launched debug build, cycled root tabs, verified secondary (Notifications) hides dock and back restores it, Chat clan subtab hides dock, dark mode capture; UIAutomator confirmed five tab content-descs. Screenshots saved to local temp but **not visually inspectable by the agent** � human/Layout Inspector sign-off still required.
- **Docs:** added [NAVIGATION_ARCHITECTURE.md](NAVIGATION_ARCHITECTURE.md); updated `NAVIGATION_MAP.md`, [features/navigation-audit.md](features/navigation-audit.md), `INDEX.md`, `AGENTS.md`, `CURRENT_TASK.md`; handoff [2026-11-21 bottom nav insets and polish](handoffs/2026-11-21-bottom-nav-insets-and-polish.md).
- **Remaining:** human visual confirmation (edge-to-bottom, first/last notch, contrast/overlay), 3-button nav, keyboard/IME, font scaling/TalkBack, predictive back, deep links (F6), notification mapper unification/launchSingleTop (F9), dead-route cleanup (F8), full runtime regression pass, lint.

## 2026-11-21 -- Comprehensive navigation architecture and UI/UX audit (YUGM-NAV-AUDIT-011)

- **Audit:** complete end-to-end trace � route inventory (�1), user-specified visibility matrix (�2.1), findings F1�F10 (�3), behavior table (�4), standardization decisions (�5). Details in [navigation audit](features/navigation-audit.md); predecessor record: [2026-11-21 bottom navigation redesign](#).
- **Android fixes (source):** new `core/navigation/MainTabsRoutes.kt` (explicit five-root whitelist + `normalizeTab`); `MainTabsScreen` derives dock visibility from the actual current destination (`destination.route` whitelist, chat clan-subtab condition), derives selected tab from the pager, persists selected page (`main_tab_page`) for process-death restoration, `goTo` idempotent; layout standardized to in-flow `Column` (pager `weight(1f)` + dock � structural no-overlap, dock flush to screen bottom, full pager height when dock hidden). `TopLevelNavigation` restructured (dead branch removed, explicit destination-based main-tabs branch, no duplicate stacks). Standalone docks: `ProfileDetailScreen`/`DatingDiscoveryScreen` default `showBottomDock = false`; `MatchesScreen` dock removed.
- **Tests added:** `core/navigation/src/test/.../MainTabsRoutesTest.kt` � 6/6 passed.
- **Verification:** Android (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`) `.\gradlew.bat :core:navigation:compileDebugKotlin :app:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin` � **BUILD SUCCESSFUL**; `:core:navigation:testDebugUnitTest` � **6/6 passed**; `:app:testDebugUnitTest` � **BUILD SUCCESSFUL**. Not run: device/emulator runtime (dock visuals on five tabs, clan-chat dock hiding, rapid taps, back nav, push routes, process-death restoration); deep-link runtime (none registered � documented); lint/`git diff --check` on changed files.
- **Status:** Source fixes implemented, compile + unit gates pass; device/emulator runtime gates pending. Handoff: [2026-11-21 navigation audit](handoffs/2026-11-21-navigation-audit.md).

## 2026-11-21 -- Bottom navigation audit and redesign (YUGM-NAV-BOTTOMDOCK-010, in progress)

- **Audit:** reviewed `MainTabsScreen` (pager-backed 5 tabs, `initialTab`/`tab_request` handling, clan-chat dock hiding, chat unread badge sourcing), `core/ui` `YugmBottomDock`/`YugmDockTab` implementation, tab screen dock embeddings/padding, `TopLevelNavigation`/legacy tab-route redirects, push/in-app notification routing touchpoints, and standalone dock consumers (`DatingDiscoveryScreen`, `MatchesScreen`).
- **Redesign (Android, source):** replaced `YugmBottomDock` with a centralized 60dp floating adaptive capsule for **Yugm Arcade / Party / Discover / Chat / Profile** (icon-only inactive, active icon + compact label with expanding animated indicator/pill), theme-aware minimal styling, reduced-motion-aware transitions, `Role.Tab`/selected semantics, chat badge description/count handling, and `YugmBottomDockDefaults` for reserved content clearance. Removed main-dock `WALLET`/`compactSet` branches and migrated to `onTabSelected`/`onTabReselected` + `chatUnreadCount`.
- **Navigation/state behavior:** centralized tab normalization/mapping in `MainTabsScreen`, synchronized pager selection with nav-provided `initialTab`/`requestedTab`, added reselect handling (scroll-to-top/list-state and reselect signals for tab screens), and preserved pager state, clan-chat dock visibility behavior, and existing `navigateTopLevel`/`tab_request`/legacy redirect compatibility.
- **Screens updated:** `MainTabsScreen`, `DiscoverScreen`, `VoiceRoomsScreen`, `ChatListScreen`, `ProfileDetailScreen`, `GamesScreen`, `DatingDiscoveryScreen`, `MatchesScreen`, and `feature/social/navigation/SocialNavGraph` updated to new dock API/reselect hooks and **structural no-overlap layout** (content above dock in layout flow for main tabs and standalone docked screens; simplified bottom padding).
- **Docs:** updated `docs/NAVIGATION_MAP.md`, `docs/COMPONENT_REGISTRY.md`, `docs/CURRENT_TASK.md`; handoff `docs/handoffs/2026-11-21-bottom-navigation-redesign.md`.
- **Verification (run):** `cd android-client; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat :core:ui:compileDebugKotlin :core:navigation:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` � **BUILD SUCCESSFUL**. Follow-up overlap-fix compile `:core:ui :app :feature:discover :feature:room :feature:chat :feature:profile :feature:social compileDebugKotlin` � **BUILD SUCCESSFUL** (existing warnings in unrelated/profile code and Gradle deprecations).
- **Not run:** device/emulator runtime, deep-link/push/back-stack/reselect/state-restoration verification, dock visibility in all required contexts, badge runtime behavior, no-overlap confirmation in all affected screens/states, Light/Dark/System + a11y/TalkBack/font-scale/IME/insets/small-screen/reduced-motion checks, targeted tests/lint/regression.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 18, in progress)

- **Edit Profile UI polish (Android):** `feature/profile` `ProfileDetailScreen.kt` Edit Profile now uses icon-labeled buttons for **Change photo** (`FilledTonalButton`, camera icon) and **Generate avatar** (primary button, `AutoAwesome` icon) instead of text labels; removed stale leading arrow icon from the profile-tip banner; moved **ID** above **Name** in BASIC INFO with a clearer aligned read-only block and copy action. Existing handlers, avatar generator flow, Yugm theme/colors, and save/validation behavior preserved.
- **Verification (run):** Android `:feature:profile:compileDebugKotlin` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`; existing deprecation warnings only).
- **Not run:** on-device/emulator visual/runtime verification (layout, light/dark, font scaling/a11y, tap states, end-to-end edit/create avatar actions). Task-level Multiavatar runtime parity/verification and licensing/provenance blockers remain.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 17, in progress)

- **Android SVG rendering repair (source):** registered `coil.decode.SvgDecoder.Factory()` in `YugmApplication` ImageLoader and added `coil-svg` to `:app`; reworked `GeneratedAvatar` for shared engine/cache, async cached SVG rendering, explicit SVG `ImageRequest`/decoder config, and fallback container.
- **Avatar dialog redesign (source):** redesigned `AvatarGeneratorDialog` with compact premium Material3/Yugm-token layout, icon-based 6-category selector (Hair/Face/Eyes/Mouth/Clothes/Background), decorative preview, randomize/shuffle/reset actions, lazy 4-column thumbnails with selected border/checkmark, and fixed primary confirm action (close/back/outside cancel preserves prior selection).
- **Backend cleanup:** `users.ts` account tombstone delete now unsets `avatarType`/`avatarParts`.
- **Verification (run):** Android `:core:ui:compileDebugKotlin :app:compileDebugKotlin` **BUILD SUCCESSFUL**; final `:app:compileDebugKotlin` consistency check **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**.
- **Not run / blocking for runtime claim:** device/emulator verification of SVG preview/thumbnail rendering, HWUI/logcat behavior, all 6 categories, lazy/cached thumbnail behavior, stale-preview prevention, cancel/confirm flow in create/edit profile, light/dark/small-screen/a11y checks.
- **Not run / remaining:** tests/lint/release, perf/memory/APK size, live backend/socket/migration checks, systematic parity audit, licensing provenance/notices (blocking), diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 16, in progress)

- **Backend profile validation parity (functional):** `packages/shared` `profileSchema` now accepts `avatarType`, `avatarParts` (0�47 ints), and nullable `avatar`, preventing `validateBody(profileSchema.partial())` on PATCH profile routes from stripping generated-avatar descriptors before `profileUpdate` service handling.
- **Docs:** updated `docs/features/avatar/API_CONTRACT.md` and `docs/features/avatar/README.md`.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. `node --test apps/api/src/services/authProfileContract.test.ts` **2/2 passed**. Direct TS-source runs of `profileCompletion.test.ts`/`profileFeatures.test.ts` failed in this env due ESM `.js` sibling resolution (not this change). Android not modified.
- **Not run / remaining:** full backend test suite, systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, Android/tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 15, in progress)

- **Backend leaderboard parity:** `giftLeaderboard.ts` top-senders/top-receivers `$project` stages now include `user.avatarType`/`user.avatarParts`.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified.
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 14, in progress)

- **Backend admin parity:** `admin.ts` referral-stats top-referrers `$project` now includes `user.avatarType`/`user.avatarParts`.
- **Docs:** updated `docs/features/avatar/README.md` handoff reference and provenance-gap note.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified (docs-only edits aside).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices (blocking), semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 13, in progress)

- **Provenance/licensing status docs (factual):** added `core/ui/avatar/UPSTREAM_PROVENANCE.md` and provenance comments in `MultiAvatar.kt`, `MultiavatarEngine.kt`, `ValueObjectCreator.kt`; updated `docs/features/avatar/LICENSING.md`. No upstream commit/version or license notices fabricated.
- **Verification (run):** Android `.\\gradlew.bat :core:ui:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\\Program Files\\Android\\Android Studio\\jbr'`).
- **Not run / remaining:** other-module compiles/tests/lint/release, backend verification, systematic parity/socket semantics audit, verified upstream commit/licenses/notices, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 12, in progress)

- **Audit-only (no source changes):** reviewed plan/licensing-provenance requirements and repo state (no pinned upstream `mew22/Multiavatar` commit/version or LICENSE/NOTICE files in integrated avatar paths; engine files lack upstream headers). Scanned for profile-updated socket events in backend/shared/android (none found in scanned paths). Spot-checked backend avatar payload grep hits as largely line-based false positives after prior fixes.
- **Blocker:** licensing/provenance cannot be completed from repo state alone without verified upstream source/commit and license details.
- **Verification (run):** none (audit-only).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, semantics verification, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 11, in progress)

- **Backend realtime/activity parity:** `rooms.ts` JOIN/LEAVE `RoomActivity` metadata (emitted via `roomActivityNew`) now includes `avatarType`/`avatarParts` with existing user avatar/name fields.
- **Audit:** other `addActivity` call sites in `rooms.ts` do not currently include user avatar metadata; gift chat message sender population in `wallet.ts` already includes descriptors.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified.
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 10, in progress)

- **Audit-only (no source changes):** Android parser/`Avatar(...)` scans found no additional descriptor gaps in scanned user-avatar contexts; backend spot-check confirmed `pk` discovery payload includes host descriptors.
- **Licensing/provenance:** �Avatars by Multiavatar� present in `feature/settings` About UI source, but no pinned upstream `mew22/Multiavatar` commit/version and no LICENSE/NOTICE files for integrated engine/artwork found in repo; remains incomplete/blocking per plan.
- **Verification (run):** none (audit-only).
- **Not run / remaining:** systematic app-wide/backend/socket parity audit, licensing provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 9, in progress)

- **Backend parity (targeted):** `experience.ts` local `publicUser` and badge-gallery user payload now include `avatarType`/`avatarParts`; `games.ts` leaderboard aggregate projects user avatar descriptors.
- **Android audit:** targeted `Avatar(...)` scan reviewed flagged cases (uploaded/cover/clan-entity/non-user contexts or already-descriptorized call sites); no additional Android source fixes applied.
- **Verification (run):** Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**. Android not modified/re-run (continuation 8 compile **BUILD SUCCESSFUL**).
- **Not run / remaining:** systematic app-wide model/parser/API/UI/socket parity audit, licensing/provenance/notices, tests/lint/release, runtime visual-SVG-a11y QA, perf/size, migration/backward-compat/runtime checks, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 8, in progress)

- **Chat self-avatar plumbing:** `MessageBubble`/`ChatTimelineMessageItem`/`ChatScreen`/`ChatNavGraph` now accept and forward session/self avatar descriptors for outgoing message avatars; app `NavGraph` passes `MainViewModel` avatar fields (parsed `userAvatarPartsJson`) into chat navigation.
- **Profile customization preview:** `CustomizeProfileScreen` live preview passes `userProfile` avatar descriptors to `Avatar`.
- **Backend:** no source changes this continuation; spot-checked auth and dating payloads include avatar descriptors.
- **Verification (run):** Android `.\gradlew.bat :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only).
- **Not run / remaining:** other-module compiles/tests/lint/release, runtime/device visual-SVG-a11y QA, perf/size, full model/parser/API/socket parity audit, licensing provenance/notices, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 7, in progress)

- **Shared components:** Extended `SeatCard`, `VideoTile`, `SpeakerGrid`, and `VideoGrid` in `core/ui/components/SharedComponents.kt` to accept/pass avatar descriptors.
- **UI propagation:** Passed descriptors in profile clan details (`ProfileDetailScreen`), voice-room mic-seat participant (`ActiveVoiceRoomScreen`), and both blocked-users screens (`feature:settings`, `feature:social`).
- **Backend:** no source changes this continuation.
- **Verification (run):** Android `.\gradlew.bat :core:ui:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:room:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:social:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only).
- **Not run / remaining:** `:app`/other-module compiles this continuation, tests/lint/release, runtime/device visual-SVG-a11y QA, perf/size, full model/parser/API/socket parity audit, licensing provenance/notices, and diff cleanup.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 6, in progress)

- **Android UI propagation:** Passed avatar descriptors in additional surfaces - `NavGraph` minimized room bubble, `GiftPanel`, room header/voice/video participant and entry-overlay avatars, clan chat/detail/list, waves, level leaderboard, achievements badge gallery, vibe graph matches, matches, subscriptions, dating discovery candidate/partner fallbacks. Extended bonds `BondPerson`/parsing and `BondAvatar` to carry/render descriptors.
- **Settings self-avatar:** `SettingsScreen`/`SettingsHome` now render session avatar descriptors; `SettingsNavGraph` and app `NavGraph` pass `MainViewModel` session avatar fields (including parsed `userAvatarPartsJson`).
- **Backend:** no source changes this continuation (continuation 5 payload/parity edits remain in source).
- **Verification (run):** Android `.\gradlew.bat :core:ui:compileDebugKotlin :feature:room:compileDebugKotlin :feature:social:compileDebugKotlin :feature:settings:compileDebugKotlin :feature:discover:compileDebugKotlin :feature:profile:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, warnings only). Backend not modified/re-run (continuation 5 `tsc` **exit 0**).
- **Not run / remaining:** full app-wide model/parser/UI/socket propagation and parity audit, migration/backward-compat verification, licensing provenance and preserved notices, tests/lint/release/runtime visual-SVG-a11y/perf/size checks, and diff cleanup (widespread unrelated whitespace-only tracked diffs remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 5, in progress)

- **Android models/parsers/APIs:** Added avatar descriptors to clan/group models (`Clan`, `ClanSummary`, `ClanInvitation` clan avatar, `ClanRankingEntry`) and updated `SocialParser`, `ClanApi`, and `CreatorApi` badge-gallery parsing. Builds on prior `AvatarFieldParser` and Events/Feed/Social/Vibe/Subscriptions/Referral/Room API coverage.
- **UI consumer updates:** Passed descriptors in selected surfaces � `FriendsScreen` (friends/requests/sent), `GiftLeaderboardScreen` (room hosts, podiums, rows), `DiscoverScreen` host cards, chat partner typing and forward-target avatars, and `ActiveVoiceRoomScreen` selected participant/invite/follower/user avatars.
- **Backend/API parity:** Added avatar descriptor fields to bond people payloads (`services/bonds.ts`, `routes/bonds.ts`), vibe match target/match user responses, users level-overview leaderboard and recommended-chat projection/response, PK side/member/opponent payloads, and dating explore/match partner responses.
- **Verification (run):** Android targeted compiles **BUILD SUCCESSFUL** � `:core:api :feature:chat :feature:social :feature:discover :feature:room` and `:core:api` recheck (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`, `--console=plain --max-workers=2`, warnings only). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` **exit 0**.
- **Not run / remaining:** full app-wide model/parser/UI/socket propagation and parity audit, migration/backward-compat verification, licensing provenance and preserved notices, tests/lint/release/runtime visual-SVG-a11y/perf/size checks, and diff cleanup (widespread unrelated whitespace-only tracked diffs remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 4, in progress)

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 3, in progress)

- **Model/parser expansion:** Added avatar descriptor fields to additional non-Host models: room chat `ChatMessage.authorAvatar*`, `RoomActivityItem`, `RoomRecording`/`YugmEvent` host avatars, story user/item/comment avatars, `FeedUser`, PK side/member/opponent/leaderboard avatars, `WaveSender`/`DailyQuestionAnswer`/`VoicePoll` user avatars, `VibeTargetUser`, `BadgeGallery`, `SubscriptionCreator`. Updated selected parsers/APIs to populate descriptors (`RoomParser` chat/activity, `PkParser`, `StoryApi`, `RecordingsApi`) alongside prior `FriendsApi`/`GiftLeaderboardApi`/`ClanApi`/`ProfileParser`/`RoomParser.toHost` work.
- **UI consumer updates:** Passed descriptors to key `Avatar(...)` consumers in PK components, recordings list/player, story viewer, events list/detail, daily question answers, voice poll, and referral detail.
- **Verification (run):** `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** and `.\gradlew.bat :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** (`JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`).
- **Not run / remaining:** many API parsers/clients still omit descriptors (events/feed/social/vibe/subscriptions/discover/match/notification/etc.), many UI consumers (chat rendering, room activity/feed/discover/matches/clans/notifications/leaderboards and other surfaces) still don�t pass them, backend/socket/event payload parity and migration/backward-compat audit incomplete, licensing/attribution and `docs/features/avatar/*` missing, and tests/lint/release/runtime-visual-SVG/perf/size checks not run. Working tree remains heavily modified/uncommitted with unrelated whitespace-only diffs.

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation 2, in progress)

- **Session/core plumbing:** Extended `YugmUser` (`core:model`) with `avatar`/`avatarType`/`avatarParts`; updated `ProfileParser.toUser()` and `RoomParser.toHost()`-aligned parsing; persisted/restored session avatar fields in `SessionManager`; updated `MainViewModel` and `NavGraph` login handoff to track/pass session avatar through update/validate/refresh flows.
- **Non-Host model/parser coverage (initial):** Added descriptor fields and parsing for `FriendUser`, `LeaderboardUser`, `ReferralUser` (SocialModels + Friends/Gift leaderboard APIs) and `ClanSentInvitation.inviteeAvatar*` (GroupModels + `ClanApi`).
- **Backend:** `publicUser` builders in `apps/api/src/routes/auth.ts` and `apps/api/src/routes/users.ts` now include `avatarType`/`avatarParts` (in addition to prior schema/validation/upload/select/populate work).
- **Verification (run):** `android-client` `.\gradlew.bat :core:model:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin :app:compileDebugKotlin --console=plain --max-workers=2` **BUILD SUCCESSFUL** with `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'`. Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` exited 0 (no output).
- **Not run / remaining:** broad non-Host model/parser/consumer propagation (chat/feed/story/recording/PK/event/discover/match/notification/clan UI, `authorAvatar`/`userAvatar`/`hostAvatar`-style fields), backend/socket/event contract parity and migration/backward-compat audit, licensing/attribution and `docs/features/avatar/*`, tests/lint/release/runtime-visual-SVG/perf/size checks, and diff cleanup (widespread unrelated whitespace-only changes remain).

## 2026-11-20 -- Integrate Multiavatar generation/customization (continuation, in progress)

- **Engine/UI:** Integrated pinned upstream `mew22/Multiavatar` engine into `android-client/core/ui/src/main/java/com/yugm/app/core/ui/avatar/` (adapted from upstream sample deps) with `AvatarDescriptor`/`AvatarParts`, cache, `GeneratedAvatar`, and shared `AvatarGeneratorDialog`. Added `coil-svg`.
- **Profile flows:** Profile creation (`CreateProfileScreen`/`AuthNavGraph`) can generate, preview, and submit generated avatars. Edit Profile (`ProfileDetailScreen`) now persists generated descriptors on Save (hoisted draft, `updateProfile` sends `avatarType=GENERATED` + `avatarPartsJson`, local profile state updated); immediate photo upload clears generated draft and marks avatar as `UPLOADED`.
- **Data/API plumbing:** Added `avatarType`/`avatarParts` to `Host` and `AuthProfileUpdate`, parsed in `RoomParser.toHost()`, and extended shared `Avatar` to render generated descriptors. Backend `User` schema and `profileUpdate` validate/store generated descriptors; `POST /upload/avatar` sets `avatarType=UPLOADED` and unsets `avatarParts`. Added `avatarType avatarParts` to many backend user/avatar `select`/`populate` field lists for exposure.
- **Rendering propagation:** Propagated descriptor params to key Host-based `Avatar(...)` consumers (shared components, profile/profile social/public preview, room host/speakers/selected participant cases, settings/hosts/selected social cases). Repaired compile breakage from prior automated propagation scripts.
- **Verification (run):** `:core:ui:compileDebugKotlin`, `:feature:profile:compileDebugKotlin`, targeted module compiles, and `:app:compileDebugKotlin` BUILD SUCCESSFUL (latest run). Backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed.
- **Not run / remaining:** non-Host model/parser/consumer coverage (chat/friends/clans/matches/leaderboards/notifications/realtime payloads), full backend response/event/migration/backward-compat audit, licensing/attribution and upstream version docs, `docs/features/avatar/*`, tests/lint/release checks, visual/runtime/device QA, performance/memory, and APK/AAB size measurement. Working tree includes broad unrelated whitespace-only diffs from earlier scripts.

## 2026-11-20 -- Standardize loading spinners on approved Lottie animation

- Imported the provided Desktop `loading.lottie` as `android-client/core/ui/src/main/res/raw/loading_spinner.json`.
- Added `lottie-compose` dependency to `:core:ui` and `YugmLoadingSpinner` (motion-aware, default 40dp, size/modifier parameters).
- Replaced indeterminate `CircularProgressIndicator` spinner usages across `app` and feature modules with `YugmLoadingSpinner`, scaling via `size`/`modifier` and removing color/strokeWidth.
- Retained determinate `LinearProgressIndicator` progress bars and non-spinner loading/decorative animations.
- Updated `DESIGN_SYSTEM.md` and `COMPONENT_REGISTRY.md`.
- Verification (run): `:core:ui:compileDebugKotlin` and `:app:compileDebugKotlin` BUILD SUCCESSFUL in this session (including latest compile after subsequent edits).
- Not run: device/emulator visual/runtime verification, accessibility/TalkBack/motion checks, APK size impact.

## 2026-11-20 -- Decompose ChatScreen into smaller composables

- Extracted `ChatTimelineMessageItem` (per-message swipe-to-reply + MessageBubble rendering) into `ChatScreenMessageItem.kt`.
- Extracted `ChatScreenHeader` (header/selection-mode bar) into `ChatScreenHeader.kt`.
- Extracted `ChatScreenComposer` (emoji bar + input/composer) into `ChatScreenComposer.kt`.
- `ChatScreen.kt` reduced from ~1388 lines to ~1091 lines; behavior/wiring/state ownership unchanged (state stays in ChatScreen, subcomposables receive values/callbacks).
- Verification: `:feature:chat:compileDebugKotlin` BUILD SUCCESSFUL; `:feature:chat:testDebugUnitTest` 3/3; `:app:compileDebugKotlin` BUILD SUCCESSFUL; `git diff --check` clean (aside from pre-existing LF/CRLF note).

## 2026-11-20 -- Frontend UI/UX polish for pre-Home auth flow

- **Shared primitives:** `PrimaryButton` now dims clearly when disabled and exposes a content description; `BrandHeader` tagline uses the active theme accent (preserves gold in dark mode, improves light-mode contrast); `YugmTextField`'s default accent resolves to `LocalYugmColors.current.accent` instead of a fixed gold (nullable default keeps existing callers working).
- **Onboarding:** primary CTA uses proper button role/ripple instead of a manual press-timing guard; Skip target enlarged; illustration container marked decorative for screen readers.
- **Splash:** added a subtle, motion-aware progress indicator after the reveal while session validation runs.
- **Login:** provider actions are tappable to surface the consent error; labels clarified ("Continue with �"); inline helper appears when terms are unchecked; password toggle has semantics and a 48dp target; consent label toggles the checkbox; footer text enlarged; Facebook mark color standardized; disabled borders dim.
- **Phone auth:** consent row uses primary text with accent legal links and whole-row toggle; fields have descriptive labels plus format helper text; resend/back actions use the accent color.
- **Profile setup:** step and consent text enlarged/promoted; bio marked required; avatar upload shows a spinner.
- **Verification:** auth compile and unit tests pass (14/14); app compile passes; `git diff --check` clean. Visual/TalkBack/accessibility-scanner checks remain unrun.

## 2026-11-20 -- Pre-Home onboarding/auth audit: restore self email, consent, and flow edge cases

- **Self email wiring:** `apps/api/src/middleware/auth.ts` now selects `+email` for the authenticated user, so `/auth/me` and `/auth/verify-email` actually include the address that `User` marks `select: false`. `apps/api/src/services/profileUpdate.ts` does the same on both reads, and `apps/api/src/routes/auth.ts` selects `+email` for existing and phone-linked Firebase identities. `handlePublicProfile`/`users.publicUser` still exclude email for other users.
- **Self profile payload:** `PATCH /users/me` now returns `email` and `emailVerified` alongside `publicUser`, so profile setup/edit responses no longer blank the cached address or regress the Settings verified state. `MainViewModel.validateAndUpdate` additionally preserves the cached email when a response omits it.
- **Consent and pending verification:** Login no longer pre-checks the 18+/Terms box when opened directly in sign-up mode. `clearPendingVerification()` clears stale notice/error, and a failed non-verification attempt keeps the Firebase identity while verification is pending.
- **Edge cases:** splash routing is keyed on `Unit` so it cannot navigate twice; profile setup disables Finish while an avatar upload is running; phone/OTP edits clear stale errors; unreferenced `OtpScreen.kt` removed.
- **Onboarding decision:** intro completion remains install-scoped and now survives logout (`SessionManager.logout` restores the flag after clearing account data). The onboarding audit was updated from the earlier replay rule to this confirmed product decision.
- **Verification:** backend `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit` passed and `npm.cmd --workspace @yugm/api test` passed 178/178. Android with the Android Studio JBR: `.\gradlew.bat :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest :app:compileDebugKotlin --console=plain --max-workers=2` succeeded (auth 14/14, core API 29/29). `git diff --check` clean. Not run: live Firebase/Mongo/App Check, provider/OTP device flows, emulator instrumentation, TalkBack/visual review.

## 2026-11-20 -- Require email verification at creation/sign-in, settings email display, and Firebase user deletion on account delete

- **Email verification enforcement (anti-abuse):**
  - Backend `apps/api/src/routes/auth.ts`: `POST /auth/google` now rejects unverified Firebase `password`-provider tokens (`email_verified=false`) with 403 and does not create/link a Yugm account or issue a session, so email/password accounts must be verified before creation/use.
  - Backend `publicUser` responses now include `email`; `/auth/verify-email` remains the authenticated endpoint for syncing verification state from a fresh matching Firebase ID token.
  - Android `feature:auth`: email/password signup sends a verification email, enters a pending-verification UI state, and only completes backend exchange after the user verifies (reload + verified token exchange). Unverified email/password sign-in is also gated into the verification flow. `LoginScreen`/`AuthNavGraph`/`AuthViewModel` updated accordingly.
- **Settings profile card:** `feature:settings` now shows the user�s email in the first/profile card with a verified indicator (`?`) when verified, or a **Verify** action when not verified (wired via `SettingsNavGraph`, `NavGraph`, `MainViewModel`).
- **Client data plumbing:** added `email` to `core:model` `YugmUser`, parsed in `core:api` `ProfileParser.toUser()`, persisted/restored in `core:data` `SessionManager` (`userEmail`/`saveSession`), and propagated through `MainViewModel`/navigation.
- **Account deletion Firebase cleanup:** `apps/api/src/services/firebase.ts` adds `deleteFirebaseUser(uid)` (Firebase Admin). `DELETE /users/me` now tombstones/frees identifiers, revokes sessions/tokens, disconnects sockets, and attempts Firebase Auth user deletion (Mongo cleanup still completes if Admin is unconfigured; warned). Auth identity resolution releases identifiers for pending-deletion records matched by email/phone to allow clean re-registration.
- **Verification:** backend `cd backend-server && cmd /c "npx tsc -p apps/api/tsconfig.json --noEmit"` passed. Android Gradle compile/tests not run in this environment (`JAVA_HOME`/`java` unavailable). No live Firebase/Mongo/device/staging verification. Requires deployment/restart of updated API/Worker; Firebase Auth deletion requires configured Admin credentials; email delivery depends on Firebase mail/template/quota/domain configuration.

## 2026-11-20 -- Fix Google sign-in rejection and email reauth deadlock

- **Root Cause Analysis (from release device logcat):**
  - Device Logcat showed Google Sign-In succeeded in Firebase (`TYPE_GOOGLE_ID_TOKEN_CREDENTIAL`, Firebase user issued `Bo4vppehu1Nl5erReQuqq2m2Cok2`), but `POST /api/auth/google` with `mode: "login"` returned 404 because the account did not exist in MongoDB.
  - The client caught 404 and switched the UI to "Create Account" with email prefilled, but left the Google user signed into `FirebaseAuth.getInstance().currentUser`.
  - When the user entered a password to create an account, `emailAuth()` found `priorSignup = auth.currentUser` and called `priorSignup.reauthenticate(EmailAuthProvider.getCredential(normalizedEmail, password))`. Because the Firebase account was created via Google OAuth (without a password provider), Firebase rejected reauthentication with `FirebaseAuthInvalidCredentialsException: The supplied auth credential is incorrect, malformed or has expired.`.
  - In addition, failed auth exchanges left orphaned Firebase sessions on the client, creating state corruption on subsequent attempts.
- **Backend Fix:**
  - Removed the `if (mode === "login")` 404 rejection from `backend-server/apps/api/src/routes/auth.ts`: Google sign-in now delegates directly to `findOrCreateFirebaseUser()`, allowing both existing users to sign in and new users to seamlessly register without requiring a separate password.
- **Android Client Fix:**
  - `AuthViewModel.kt`:
    - Removed `mode = "login"` parameter from `googleAuth()`, enabling seamless sign-in/registration directly into discovery or profile setup (`isNewUser: true`).
    - Guarded `priorSignup` reauthentication in `emailAuth()` to only run if `priorSignup.providerData` explicitly contains `EmailAuthProvider.PROVIDER_ID` (`"password"`). If it is not a password account or if reauthentication fails, it signs out of Firebase.
    - Updated `launchAuth()` and `switchToSignUp()` to sign out of Firebase if a Yugm session exchange is not completed, preventing orphaned Firebase users.
- **Verification:**
  - Backend test suite: 178/178 passed (`npm.cmd --prefix backend-server test`).
  - Backend typecheck: Clean across all workspaces (`npm.cmd --prefix backend-server run typecheck`).
  - Android tests: `:feature:auth:testDebugUnitTest :core:api:testDebugUnitTest` passed.
  - Android compilation: `:feature:auth:compileDebugKotlin` and `:app:compileDebugKotlin` passed.

## 2026-11-20 -- Diagnose staging auth 404 from stale Worker deployment and add explicit deploy scripts

- **Live diagnosis (from provided Cloudflare log):** Release Android client (`okhttp/4.12.0`) reached staging `POST https://yugm-api-staging.sarveshkumar10101.workers.dev/api/auth/google` but the Worker returned **404 Route not found** (`scriptVersion.id: bc0ebaf6-af81-413d-9932-6a69bb6d4b8f`, `outcome: ok`). Current source mounts `/api/auth` with `POST /google`, indicating a stale deployed bundle rather than a source routing defect.
- **Client log evidence (provided):** latest release run completed Firebase Google sign-in and App Check preflight (`YugmAppCheck ... continuing request to server`) before backend exchange; release builds do not emit `YugmHttp` debug request logs, and no `YugmAuth` Google backend-exchange failure line was present in the captured slice. Earlier debug/emulator runs in the same log targeted `http://10.0.2.2:4000/api/auth/google` (404) per `YugmApplication` debug-emulator override, not Cloudflare.
- **Repo fix:** added root workspace deploy scripts in `backend-server/package.json` (`deploy`, `deploy:staging`, `deploy:production`, `deploy:dry-run:staging`, `deploy:dry-run:production`) using explicit `--config apps/cloudflare-worker/wrangler.staging.jsonc` / production config to avoid `npx wrangler deploy` failures when invoked from the npm workspace root.
- **Required follow-up (not run/verified here):** update Cloudflare/dashboard or external deploy command to `npm run deploy:staging` (or explicit config), redeploy staging, and verify `/api/health` plus non-404 `/api/auth/google` behavior and release-client auth. CI workflow already calls `npm --workspace apps/cloudflare-worker run deploy:staging`.

## 2026-11-20 -- Resolve staging worker deploy failure, rate-limit 500 & Google API key restrictions

- **Cloudflare Worker Deploy Repair:**
  - `wrangler.jsonc` had a duplicate trailing JSON root block (`"observability": { ... }` appended after the closing brace), resulting in invalid JSONC and preventing Wrangler deployment.
  - Merged the `observability` configuration cleanly into the single root configuration in `backend-server/apps/cloudflare-worker/wrangler.jsonc` and added it to `wrangler.staging.jsonc`.
  - Pushed to `master` and successfully deployed to the staging Cloudflare Worker (`startedAt: 2026-11-19T20:44:02.483Z`).
  - Confirmed the rate-limiter undefined IP fix (`YUGM-AUTH-RATELIMIT-002`) is live: `POST /api/auth/google` now returns HTTP 422 (validation error on dummy token) rather than HTTP 500 internal server error.
- **Firebase Auth / Google Identity Toolkit API Key Unblocking:**
  - Android release APK experienced 30s timeouts on `Tasks.await` for both Google and Email authentication (`AuthViewModel.kt:300`).
  - Probed Google Identity Toolkit endpoints directly using the project's Firebase API key (`AIzaSyC_RIUaKdjUcnACza1XEZ3hXXGFyfO0fGU`). Discovered Google returned `403 PERMISSION_DENIED: API_KEY_SERVICE_BLOCKED` and `API_KEY_ANDROID_APP_BLOCKED`.
  - The API key was missing the `Identity Toolkit API` in its allowed API list, and the Android package restrictions only listed `91:E4:...`, omitting the active upload signing certificate SHA-1 (`62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6`).
  - Allowed `Identity Toolkit API` and added SHA-1 `62:3C:DB:7F:07:BA:17:3A:E8:40:D0:2F:C6:EF:34:A9:09:9D:9D:F6` to the Google Cloud Console API key.
  - Updated `android-client/app/google-services.json` with the updated OAuth client hashes and committed the changes.
- **Verification:**
  - Staging worker `/health` returns `ok: true`, `db.ready: true`.
  - Direct HTTP test with the release APK certificate header now successfully reaches the Identity Toolkit API (returns 400 invalid credentials instead of 403 blocked).

## 2026-11-19 -- Diagnose & resolve infinite hang on manual login and Google Credential Manager rejection

- **Root Cause of Infinite Hang in Manual Sign-In:**
  - The local backend API server was not running on port 4000 (http://192.168.1.2:4000/api), causing OkHttp TCP connect attempts to hang until timeout (up to 60s). Started local backend dev server with MongoDB Atlas, Redis, and Firebase Auth active.
  - Compounding the delay, AppCheckReadiness.requireReady had an 8-second blocking timeout and YugmApplication.appCheckTokenProvider had a 10-second blocking timeout (18s total before the HTTP request even began). Reduced both timeouts to 2 seconds.
  - Eliminated redundant getIdToken(true) network call immediately following signInWithEmailAndPassword, reusing the freshly issued token via getIdToken(false).
  - Tuned OkHttp timeouts in YugmHttpClient (connectTimeout: 10s, eadTimeout: 25s, writeTimeout: 20s).
- **Google Sign-In / HiddenActivity Immediate Exit:**
  - Diagnosed from device Logcat (HiddenActivity launched and killed after 2 seconds): Google Identity Credential Manager verifies the client package name and signing keystore SHA-1 against Google Cloud / Firebase Console.
  - Neither the debug keystore (9B:FC:C9:2B:A9:59:25:73:21:CE:40:EA:82:65:8D:F0:54:10:BE:D2) nor the release keystore (91:E4:CE:9A:22:94:93:6D:DC:91:2F:CF:1B:D4:E7:A3:3A:ED:C7:C5) are registered in google-services.json (only older hashes 69:9e:... and 80:55:... exist).
  - Updated AuthNavGraph.kt so that when GetCredentialException occurs, it gracefully triggers switchToSignUp with a clear message: "Could not sign in with Google. Create an account with your email and password."
- **Verification:**
  - Local backend API running on http://localhost:4000 & http://192.168.1.2:4000 (/api/health 200 OK in 16ms).
  - :app:compileDebugKotlin, :feature:auth:compileDebugKotlin, :core:api:compileDebugKotlin all BUILD SUCCESSFUL.
  - Auth unit tests passed (13/13).
## 2026-11-19 -- Rework Google sign-in fallback to email signup with password & fix release token validation

- **Google Login to Email Signup Transition:**
  - When a user tries to log in using Google on the "Sign in" tab and no account exists on Yugm, the app no longer fails or throws errors.
  - The client sends mode: "login" to /api/auth/google. If no account exists with that Firebase UID or email, the backend returns a 404 (ErrorCode.NOT_FOUND).
  - Android AuthViewModel catches the 404 or missing user, and invokes switchToSignUp(email, name, "No account found for this Google email. Create a password to sign up.").
  - LoginScreen automatically transitions to "Create account" mode, pre-fills the email address from the Google account, retains accepted terms, and displays the password and confirm password fields ("ask to create password").
  - Once the user enters and confirms their password and taps "Create account", an account is created with their email, password, and Google display name, directly entering onboarding (ProfileSetupScreen).
- **Credential Manager New User Selection:**
  - In AuthNavGraph.kt, updated GetGoogleIdOption.Builder() from setFilterByAuthorizedAccounts(true) to setFilterByAuthorizedAccounts(false) so that new users who have never used the app can pick any Google account on their device instead of encountering a hard NoCredentialException.
  - Added fallback in NoCredentialException to smoothly direct users to email signup.
- **Release APK "firebase token invalid" Resolution:**
  - In irebase.ts, added 60-second clock skew tolerance (clockTolerance: 60) to jwt.verify and added clock leeway (iat <= now + 60, uth_time <= iat + 60) in erifyFirebaseIdTokenWithoutServiceAccount to eliminate clock drift rejections between Google/Firebase and Cloudflare Workers.
  - Added support for Google public signing certs (https://www.googleapis.com/oauth2/v1/certs) when verifying tokens with Google issuer (ccounts.google.com / https://accounts.google.com), allowing both Google ID tokens and Firebase ID tokens to verify cleanly.
  - In AuthViewModel.kt, switched token retrieval from cached getIdToken(false) to force-refreshed getIdToken(true) so stale tokens are never transmitted.
  - Cleaned up auth error mapping in mapAuthError so internal Firebase errors return user-friendly guidance instead of raw technical strings.
- **Verification:**
  - Backend API: 173/173 tests pass (
pm --workspace @yugm/api test); TypeScript typecheck passes clean (
pm --workspace @yugm/api run typecheck).
  - Android Unit Tests: :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest passed.
  - Android Kotlin Compilation: :app:compileDebugKotlin :feature:auth:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin all BUILD SUCCESSFUL.
## 2026-11-19 � Fix auth rate limiter crash in Cloudflare Worker, social name propagation, and release App Check resilience

- **Cloudflare Worker rateLimitStore crash:** Investigated 500 error (Cannot read properties of undefined (reading 'replace')) on /api/auth/* routes in staging. In Cloudflare Workers, eq.ip is undefined. The default key generator in express-rate-limit passed undefined to ateLimitStore.safeKey(), throwing an exception. Added a clientIp() helper reading cf-connecting-ip and x-forwarded-for headers, configured keyGenerator on uthLimiter, and added a fallback guard in safeKey().
- **Social auth name propagation:** Wired Google and Facebook auth flows to pass Firebase display name through AuthApi / AuthRepository to backend /google and /facebook endpoints. Backend updates existing users if name was blank or default "Yugm User". Android AuthViewModel ensures the session user has the account name for the subsequent profile setup step if needed.
- **Release build auth / App Check resilience:** Addressed failure in release/production builds where App Check token generation failure or unregistered debug tokens blocked login. Made YugmHttpClient token attachment non-throwing (proceeds without X-Firebase-AppCheck header; server decides enforcement via APP_CHECK_ENFORCE). Updated AppCheckReadiness.requireReady() to log a warning rather than throwing an exception.
- **Facebook SDK token safety:** Updated FacebookLoginCoordinator to safely fallback from ccessToken?.token to uthenticationToken?.token for newer Facebook SDK Limited Login flows.
- **Keystores & Key Hashes identified:** Extracted SHA1 and Base64 hashes for debug (~/.android/debug.keystore), release (D:\Keystores\yugm-release.jks), and upload (ndroid-client/app/release/yugm-upload.jks) to verify Facebook Developer dashboard configuration.
- **Verification:** Backend tests: 173/173 passed, typecheck clean. Android: :feature:auth:testDebugUnitTest :core:api:testDebugUnitTest passed; :feature:auth:compileDebugKotlin :core:api:compileDebugKotlin :core:data:compileDebugKotlin passed (BUILD SUCCESSFUL). No staging deploy or physical device testing run.
## 2026-11-19 � Release builds no longer run lint

- Set `lint { checkReleaseBuilds = false }` in `android-client/app/build.gradle.kts`, so AGP no longer attaches the release vital lint pass to `:app:assembleRelease`.
- Removed the explicit `-x lintVital*` exclusions from the tagged release workflow; debug lint still runs in CI via `:app:lintDebug`.
- Verified with `:app:assembleRelease --dry-run`: configuration succeeded and the task graph contained no `lint*Release` tasks. No release APK was assembled in this check.

## 2026-11-19 � Release/production endpoints moved to Cloudflare

- Switched the Android release/production API and Socket.IO defaults to the Cloudflare staging Worker: `https://yugm-api-staging.sarveshkumar10101.workers.dev/api` and `https://yugm-api-staging.sarveshkumar10101.workers.dev` (`android-client/app/build.gradle.kts`).
- Updated the tagged release workflow to build the signed APK against the same Worker endpoints (`.github/workflows/android-release.yml`).
- Recorded the current admin panel origin as `https://yugm-admin-staging.pages.dev` in the Pages deployment guide and migration audit; the staging Worker already allows it via `CORS_ORIGIN`.
- Updated the legal hosting references to the Worker-served pages (`/legal/privacy`, `/legal/account-deletion`).
- Left the Worker's `YUGM_STAGE=production` startup guard and the separate production Wrangler config unchanged; the given Worker identifies as staging, so enabling a production Worker remains a separate authorized cutover.
- Verification: URL/config source review only. No Android release build or Cloudflare deployment was run in this change.

## 2026-11-19 � Profile avatars stored in Cloudflare R2 object storage

- Replaced the inline MongoDB avatar thumbnail in `POST /upload/avatar` with the existing storage abstraction. Avatars are now persisted under the `avatars/` folder and `User.avatar` stores the returned public URL. With `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, and `S3_PUBLIC_BASE_URL`, this is the configured R2 bucket/public domain.
- Added strict managed-object cleanup: an upload or profile PATCH deletes the previous `avatars/` object only when the old URL matches the configured public base and prefix. Legacy `data:image/...`, cosmetic assets, external images, and sibling media are never deleted. Blank optional profile values remain omissions, so a profile PATCH cannot accidentally erase the committed avatar.
- Made public S3-compatible URL construction explicit: the public base is preferred and a custom endpoint without `S3_PUBLIC_BASE_URL` now fails loudly instead of emitting an unusable AWS hostname. `/health` exposes `endpointConfigured` and `publicUrlReady`; startup warns when the pair is incomplete.
- Kept auth/permission, signature/type/220 KB validation, temp-file cleanup, the existing avatar `PROFILE`/`TASKS` realtime invalidation, and client compatibility intact. Android already accepts absolute hosted URLs through `resolveMediaUrl`, profile-setup validation, Coil rendering, and the profile-edit upload path; regression tests now pin those behaviors.
- Added operations and contract documentation in [avatar R2 storage](features/avatar-r2-storage.md), [API contracts](API_CONTRACTS.md), and the [auth flow audit](features/auth-flow-audit.md).
- Verification: from `backend-server/`, `npm --workspace @yugm/api test` passed 173/173 (including new storage URL/key tests) and `npm --workspace @yugm/api run typecheck` passed. From `android-client/`, `.\gradlew.bat :core:api:testDebugUnitTest :feature:auth:testDebugUnitTest --console=plain` passed (`BUILD SUCCESSFUL`; 29 core API tests, 13 auth tests, 0 failures). `git diff --check` reported no whitespace errors.
- Not exercised: a live R2 upload/read/delete, Mongo-backed route persistence and replacement cleanup, public bucket/CORS behavior, real Android upload/display, and device visual/accessibility review. See the [handoff](handoffs/2026-11-19-avatar-r2-storage.md).

## 2026-11-19 � Profile setup contract and shared server update path

- Locked required profile completion fields with the user: name, normalized username, age 18�80, gender (`Male`/`Female`/`Non-Binary`), city, at least one language and interest, bio, canonical `lookingFor` (`Friendship`/`Dating`/`Relationship`/`Networking`), and accepted terms. Avatar and other optional profile fields do not gate completion; legacy `profileCompletedAt` remains authoritative.
- Added server normalization for names/usernames/optional text and arrays; completion now requires all documented fields including consent. Shared schema now aligns age and enum values. `/users/me` and retained `/auth/profile` delegate to one profile update service with terms timestamp, profile timestamp, username conflict handling, idempotent XP and response behavior.
- Updated the Android profile DTO/API to carry all supported fields and omit blank optional values. The setup requires gender, `lookingFor`, and terms; it exposes a confirmed sign-out exit and preserves canonical preference values.
- Verification: from `backend-server/`, `npm --workspace @yugm/api test` passed (168/168) and `npm --workspace @yugm/api run typecheck` passed. From `android-client/`, `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed. No connected Mongo/Firebase/profile navigation runtime was run.
- Remaining profile form state ownership and visual redesign are tracked in [handoff](handoffs/2026-11-19-profile-setup.md); this task is not fully closed.

## 2026-11-19 � Profile setup async state ownership and contract verification

- Added route-scoped `ProfileSetupViewModel` ownership for avatar upload and profile submission, including session-token lookup at operation time, one-flight guards, cancellation handling, image type/5 MB checks, retryable failures, and navigation only after the returned user confirms `profileCompleted`.
- Kept user-entered form fields in `rememberSaveable` so a setup form survives configuration changes and saved-state restoration; an upload interrupted by process death can be retried by selecting the image again.
- Required gender in client validation to match the previously agreed gender + looking-for completion contract. Removed the obsolete auth-graph token-provider parameter now that setup actions use the session repository boundary.
- Verification: from `android-client/`, `:feature:auth:testDebugUnitTest :app:compileDebugKotlin` passed (`BUILD SUCCESSFUL`; tests executed as part of the task). From `backend-server/`, `npm --workspace @yugm/api test` passed (168/168) and `npm --workspace @yugm/api run typecheck` passed. `git diff --check` passed. No Mongo/Firebase/API runtime, provider callback, or device visual/accessibility scenario was exercised.
- Remaining live integration and device review is documented in [profile setup handoff](handoffs/2026-11-19-profile-setup.md).

## 2026-11-19 � Profile avatar completion regression

- Confirmed `/upload/avatar` stores the authenticated user's thumbnail immediately and returns a `data:image/{jpeg,png,webp,gif};base64,...` URL. Step-four validation incorrectly allowed only HTTP(S), which could trap users after a successful upload. Added strict, bounded validation for server-supported image data URLs and valid hosted HTTP(S) references.
- Wired successful `/upload/avatar` mutations into the existing per-user `PROFILE` realtime invalidation while keeping other upload endpoints excluded; added a middleware regression test.
- Added upload-ready and retryable-failure copy. Kept the large avatar data URL out of `rememberSaveable` state and omitted it from the later profile PATCH because the upload endpoint has already persisted it; blank optional profile fields therefore do not erase the avatar.
- Added JVM regression tests for accepted data URLs and hosted URLs plus malformed/unsupported/empty/oversized values. `:core:model:compileDebugKotlin :core:api:testDebugUnitTest :core:data:compileDebugKotlin :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` passed (auth tests 13/13; core API tests 26/26; all requested Kotlin compile targets passed). Backend check from `backend-server/`: `npm --workspace @yugm/api test` passed 169/169 and `npm --workspace @yugm/api run typecheck` passed. `git diff --check` passed. No connected Firebase/App Check/Mongo or device onboarding flow was run.

## 2026-11-19 � Skip App Check for local Android debug sessions

- Removed the Firebase debug-token registration requirement only when a debuggable Android build targets cleartext loopback (`10.0.2.2`, localhost, or loopback). In that mode the app skips the auth preflight, request header, and startup token warm-up; the local API's existing `NODE_ENV=development/test` bypass is consistent with this behavior.
- Release builds and debug builds using remote/LAN APIs continue requesting App Check. Backend production enforcement remains controlled by `APP_CHECK_ENFORCE`; production deployment configuration must keep it enabled.
- Added core API tests for local debug bypass and release/remote target enforcement. Verification: from `android-client/`, ` .\gradlew.bat :core:api:testDebugUnitTest :feature:auth:testDebugUnitTest :app:compileDebugKotlin --console=plain` passed. Core API unit tests: 26 passed; auth unit tests: 8 passed; app Kotlin compilation passed. No Firebase token, API request, or backend runtime was exercised.

## 2026-11-19 � Auth boundary re-audit and session cleanup

- Rechecked provider operation ownership/settlement, root navigation reset, server-confirmed profile completion, App Check readiness/error mapping, startup `/auth/me` validation, session revocation messaging, and Socket.IO handshake/reconnect session checks against current source.
- Closed a server-side realtime revocation gap: logout, account deletion, admin ban, and report-driven ban now disconnect a user's live sockets after revoking sessions/token generation. New login already disconnects older session sockets.
- Hardened logout/account-switch cleanup: Android clears in-app notification state, session-scoped caches and sync topics along with Firebase/session/socket/media state. The authenticated logout request now includes the install FCM token for server-side deletion before session revocation.
- Verification after these changes: from `android-client/`, ` .\gradlew.bat :feature:auth:testDebugUnitTest :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin :app:connectedDebugAndroidTest --console=plain` passed (8 auth unit tests; Android and instrumentation Kotlin compilation; 3 connected API 37 emulator instrumentation tests). From `backend-server/`, `npm --workspace @yugm/api test` passed (167/167) and `npm --workspace @yugm/api run typecheck` passed.
- No live Firebase provider/OTP/App Check scenario, backend/Mongo persistence or race test, real profile navigation trace, or manual second-device test was run. The auth audit remains open for those runtime gates; see [handoff](handoffs/2026-11-19-auth-boundary-audit.md).

## 2026-11-19 � Auth error provider mismatch repair

- Fixed the shared Firebase invalid-credential mapping so email errors no longer incorrectly say Facebook; provider-specific messages now match the active email, Google, Facebook, phone, or password-reset operation.
- Added focused auth error mapping regression tests for provider-specific wording and unrelated error pass-through.
- Verification: `:feature:auth:testDebugUnitTest :app:installDebug` passed; all 8 auth unit tests passed, and the corrected debug app installed on the connected API 37 emulator. Real credential entry and Firebase/backend account exchange still need user/runtime configuration.

## 2026-11-19 � Auth flow system-theme and visibility repair

- Changed the native app theme to Android platform light/dark styles selected by `values/` and `values-night/` resource qualifiers, and edge-to-edge bars to automatic system appearance at launch. The Compose theme helper also defaults to `isSystemInDarkTheme`; new installs continue using the existing `SYSTEM` preference, while explicit light/dark settings remain honored.
- Repaired login/email signup/provider controls, field foreground/focus, profile setup labels/options/progress/errors, and phone/OTP text contrast using the active Yugm palette. Added system-bar and IME-aware scrolling for the phone/OTP auth shell.
- Shared text field components gained optional auth-specific accent and outline colors with existing non-auth defaults preserved.
- Replaced the unsupported `Theme.Material.DayNight` platform parent with supported `Theme.Material.Light.NoActionBar` and `Theme.Material.NoActionBar` parents selected through `values/` and `values-night/` resources after an AAPT link failure.
- Verification: `:feature:auth:compileDebugKotlin :app:compileDebugKotlin` passed before that correction; `:app:compileDebugKotlin` passed again after the resource-qualified fix. No device rendering, contrast measurement, or accessibility inspection was run.

## 2026-11-19 � Onboarding-to-authentication reliability repair

- Unified provider exclusivity and loading ownership in `AuthViewModel` across UI credential acquisition, Firebase sign-in, and backend exchange. Added duplicate-start guards; routed phone credential exchange through the same ViewModel/repository path.
- Added bounded `/auth/me` validation before startup routing, reconciling server profile completion and missing legacy user IDs. Network/App Check failures fall back to locally restored session state; confirmed unauthorized responses clear it.
- Reset successful login and profile completion to the root navigation graph anchor. Session revocation now provides a user message and clears local session/Firebase/socket state.
- Made App Check replay protection consistent: fresh limited-use client tokens, Admin `consume: true`, no verification cache, and explicit rejection of consumed tokens. Auth error mapping separates App Check, account conflicts, and revoked sessions.
- Added a shared backend profile-completion contract and used the server-returned `profileCompleted` value to gate exit from profile setup. The completion timestamp is set only for the documented required fields; client age bounds match server 18�80 and gender remains optional.
- Added the injected auth repository API boundary and typed profile update request. Failed Firebase-to-Yugm exchange preserves Firebase identity for provider retry because the API may have committed despite a lost response.
- Verification at that stage: auth unit suite 5 passed; app and instrumentation Kotlin compile passed; emulator suite 3 passed; API suite 167 passed; API TypeScript typecheck passed. The auth suite now has 8 tests after the provider-mismatch regression repair. Firebase provider/App Check runtime, live Mongo persistence/session rotation/account linking, and full profile navigation were not exercised. See [auth flow audit](features/auth-flow-audit.md).

## 2026-11-19 � First-launch splash and onboarding repair

- Updated splash text to use theme-aware foreground colors, accessible saffron on light backgrounds, reduced-motion handling, and a 250 ms animation.
- Updated onboarding cards to use theme foreground tokens; added compact sizing/scroll behavior, slide heading/artwork semantics, pager progress state, and theme-aware inactive dots; removed the unused looping animation.
- Followed the user's abandonment rule: completing the slides opens Login in the current session, but no completion flag is persisted. A cold launch without an authenticated session replays onboarding; an authenticated session routes to profile setup or discovery. Backend API, realtime, permissions, and server/database persistence are not applicable to this static intro flow.
- Added route unit tests and emulator UI/edge coverage. The original onboarding audit covered 3 startup route tests and 3 emulator tests. Current auth suite also contains 2 provider-operation reducer tests; see the latest auth entry above for final verification counts.
- Fresh light-theme emulator capture showed readable brand and slide copy. TalkBack, real signup/sign-in, physical-device review, cold/warm launch timing, and the separate OS system splash remain unverified.

## 2026-11-19 � Canonical engineering context

- Added a root agent entry point, documentation index, and initial project, coding, design, component, feature, contract, realtime, security/business, error, testing, and handoff guidance.
- Consolidated links to the detailed production audit, which already contains static API/socket/schema inventories, prioritized findings, requirement coverage, and prior scoped implementation results.
- Captured that the Compose theme and shared components already exist; broad screen migration and complete spacing tokens remain follow-up work.
- Verification for this documentation task is static review only. No tests/builds were run.
- User's pre-existing modifications in Android/Backend files were observed and preserved.

## Existing scoped implementation evidence

See [production/current-progress.md](production/current-progress.md) for the last recorded source baseline, implemented remediation, exact prior test/build results, and outstanding runtime gates. That record is dated and must be reconciled against current source before relying on it.

## 2026-11-21 - Unified main-tab background and dock clearance

- **MainTabsScreen shared background:** Added a single `YugmBackground(style = YugmBackgroundStyle.Ambient)` as the first child of the root `Box`, behind the `HorizontalPager` and bottom dock overlay. The background is stationary relative to the root viewport; only pager content moves horizontally.
- **Tab roots made transparent:** Removed per-tab `YugmBackground` wrappers from `DiscoverScreen`, `VoiceRoomsScreen`, `GamesScreen`, and `ChatListScreen` (main-tab-only). `ChatListScreen` `PrimaryTabRow` container color set to `Color.Transparent`. `ProfileDetailScreen` now accepts `backgroundStyle: YugmBackgroundStyle? = YugmBackgroundStyle.Ambient`; MainTabs passes `None` and Scaffold container is `Color.Transparent`.
- **YugmBackground:** Ambient uses `LocalYugmColors.current.background` base with restrained brand radial glows (violet upper-right, pink lower-left, subtle orange warmth). Added `YugmBackgroundStyle.None` for shared-background hosts. No animated blobs.
- **Dock safe clearance:** Added `mainDockBottomClearance()` and `LocalMainDockBottomClearance` in `core/ui` (`YugmBottomDockBarHeight + YugmBottomDockActiveIconProtrusion + navBarInset + breathingSpace`). MainTabs provides it; main tab scrollable containers consume it via `contentPadding`/trailing scroll padding. Dock bar touch targets constrained to painted bar area; active indicator remains clickable for reselect.
- **Notch geometry:** `CurvedDockShape` redesigned as a circular cradle derived from the active indicator (50dp, 2dp border, 3.5dp clearance, 28.5dp radius, 22dp shoulders, 38� junction, symmetric edge scaling, G1 cubic shoulders). `BottomDockGeometry`/`BottomDockGeometryTest` updated.
- **Verification:** `:core:ui:compileDebugKotlin :core:ui:compileDebugUnitTestKotlin :feature:discover:compileDebugKotlin :feature:room:compileDebugKotlin :feature:chat:compileDebugKotlin :feature:profile:compileDebugKotlin :feature:social:compileDebugKotlin :app:compileDebugKotlin` BUILD SUCCESSFUL; `:core:ui:testDebugUnitTest --tests BottomDockGeometryTest` BUILD SUCCESSFUL (Android Studio JBR, `--console=plain --max-workers=2`).
- **Build-state recovery (not a source defect):** `:app:compileDebugKotlin` intermittently failed with `Unresolved reference 'ClanChatScreen'` in `ChatListScreen.kt` because `feature:social`'s incremental ASM transform output was incomplete (compiled-classes jar missing ~205/538 classes while `tmp/kotlin-classes/debug` had all 538). Fixed with `:feature:social:clean`, a fresh `:feature:social:bundleLibCompileToJarDebug --no-build-cache`, then `:app:compileDebugKotlin --no-build-cache` � BUILD SUCCESSFUL. No Kotlin source changes were needed; avoid running Android Studio and CLI builds against the same module concurrently.
- **Not run:** device/emulator visual QA for seamless pager transitions, notch/content-behind-dock, light/dark/system, gesture/3-button nav, font scaling, keyboard/IME, TalkBack, and dock touch-through behavior. Lint/broader tests not run. Task changes committed and pushed; local build-log `.txt` files remain untracked.

## 2026-11-25 - D1 recordings

- Mounted all seven /api/recordings routes in the shared D1 Worker (backend-server/apps/api/src/migration/d1Recordings.ts, mounted in d1App.ts) with auth-before-validation, host-only guards, LIVE-room start check, legacy DTO shape, pre-increment view response, and no D1 socket fan-out for ecording:started/ecording:stopped.
- Added recordings coverage to pps/cloudflare-worker/test/d1-endpoints.mjs.
- Verification:
npm.cmd run typecheck (backend-server) pass;
npm.cmd run audit:d1-endpoints -- --missing 638/555/549/89 with /api/recordings 7/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass on rerun (first run hit intermittent unrelated d1-reports count assertion);
npm.cmd run secrets:check:strict pass; scoped git diff --check pass.
- Boundaries: no new migration (uses oom_recordings in 0001_initial); no realtime recording broadcast; no hosted data ops/deploy/credentials. 89 legacy routes remain unmounted.

## 2026-11-25 - D1 user discovery and profile-media

- Mounted 6 /api/users routes in the shared D1 Worker (backend-server/apps/api/src/migration/d1UserDiscovery.ts, mounted in d1App.ts): search, hosts suggested, recommended chat, PK history, profile-media add/delete.
- Preserved auth-before-validation, legacy search/profile-media validation, D1 profile-media position/slice behavior, and PK history via D1 battle presenter. ecommended-chat returns empty on D1 due no live presence source.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/561/555/83 with /api/users 48/5;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass on rerun (intermittent unrelated d1-reports count assertion on intermediate run);
npm.cmd run secrets:check:strict pass; scoped git diff --check pass.
- Boundaries: no new migration; live presence for recommended-chat remains legacy-only; remaining users routes are DELETE /me, friend-match (3), messages/:userId/call.

## 2026-11-25 - D1 creator payout-kyc and withdrawals

- Mounted all 7 /api/creator routes in the shared D1 Worker (backend-server/apps/api/src/migration/d1Creator.ts, mounted in d1App.ts, wired PAYOUT_KYC_ENCRYPTION_KEY in Worker env/config) for payout KYC, status, submit/update, withdrawal eligibility, list, and creation.
- Preserved auth-before-validation, creator role gates, legacy KYC validation, encrypted sensitive KYC fields, D1 fraud checks, and guarded withdrawal/review batch writes.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/568/562/76 with /api/creator 7/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1);
npm.cmd run secrets:check:strict pass; scoped git diff --check pass.
- Boundaries: no new migration; D1 schema lacks Mongo partial unique indexes for creator KYC user and active withdrawal lock (guarded in code); MongoDB remains authoritative.

## 2026-11-25 - D1 gifts mutations

- Mounted 5 /api/gifts mutation routes in shared D1 Worker (backend-server/apps/api/src/migration/d1GiftCatalog.ts): purchase, combo, room-wide, surprise-box, upgrade.
- Preserved auth/validation, wallet-frozen/insufficient-balance guards, guarded wallet/inventory writes, combo fail-closed 409, and room-wide pre-validation/compensation behavior.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/573/567/71 with /api/gifts 8/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1);
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warning only.
- Boundaries: no new migration; D1 gift_inventories lacks unique(user_id,gift_id) schema parity; room-wide XP grants not wired; mid-loop room-wide partial failures need reconciliation; MongoDB remains authoritative.

## 2026-11-26 - D1 v1 moderation and API root

- Mounted 3 /api/v1/moderation routes in backend-server/apps/api/src/migration/d1Moderation.ts (report, appeal, status) and the /api discovery root in d1App.ts.
- Preserved auth-before-validation, legacy report + moderation queue inserts, appeal ownership/UNBAN checks, status field defaults/recent actions, and the legacy root payload.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/577/571/67 with /api/v1 5/0 and /api/ 1/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1);
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warning only.
- Boundaries: report now requires a target (400 instead of D1 NOT NULL 500); no D1 push/socket side effects; no new migration; MongoDB remains authoritative.

## 2026-11-26 - D1 payout webhook

- Mounted POST /api/payments/webhook/payout in backend-server/apps/api/src/migration/d1PayoutWebhook.ts, registered before express.json() with express.raw for HMAC verification.
- Preserved 501/401/400/200 responses, processed and reversed/rejected/failed transitions, idempotent duplicate replay, and linked withdrawal settlement/rejection; writes and audit rows commit in one D1 batch.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/578/572/66 with /api/payments 1/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1);
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warning only.
- Boundaries: no new migration; MongoDB remains authoritative.

## 2026-11-26 - D1 Arcade write routes

- Mounted all 5 remaining /api/games write routes in backend-server/apps/api/src/migration/d1Games.ts (mounted in d1App.ts): score save, challenge create/accept/decline and score share. /api/games is now 9/9 in the HTTP inventory.
- Preserved auth-before-work, chat limiter before validation, per-game score caps, legacy score/challenge/message DTOs, XP cap and idempotency key, personal best, block/self-message and clan guards, and guarded score/share/challenge commits.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/583/577/61 with /api/games 9/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1) with games persistence and clean-bundle assertions;
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warnings only.
- Boundaries: no new migration; no D1 socket emitter for directMessageNew, score-share invalidation or challenge notification fan-out; deterministic personal-best tie order differs from legacy undefined order; MongoDB remains authoritative.

## 2026-11-26 - D1 durable user matching and private calls

- Mounted GET /api/users/friend-match, POST /api/users/friend-match/cancel and POST /api/users/messages/:userId/call in backend-server/apps/api/src/migration/d1UserMatching.ts (mounted in d1App.ts with limits.chat). /api/users is now 51/2.
- Preserved auth-before-limiter ordering, legacy friend-match state/DTO behavior, WAITING-only cancel, stale MATCHED room cancellation, private-call muted/validation/ID/self/receiver/VIP/block order, legacy error messages, and guarded room/participant/speaker/DM batch with post-commit notification. The VIP check intentionally mirrors the legacy field selection (tier/expiry only).
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/586/580/58 with /api/users 51/2;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1) with unauthenticated ordering, 429 limiter behavior, friend-match persistence/cancel/stale-room checks, private-call room/participant/DM/notification rows and clean-bundle assertions;
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warnings only.
- Boundaries: no new migration; friend-match/search stays legacy-only pending live presence; DELETE /me stays legacy-only pending Firebase identity deletion and socket invalidation; no D1 socket emitter replaces private-call directMessageNew; MongoDB remains authoritative.

## 2026-11-26 - D1 AI wingman routes

- Mounted all ten /api/ai/wingman routes in backend-server/apps/api/src/migration/d1AiWingman.ts (mounted in d1App.ts at /api/ai). /api/ai is now 10/0.
- Extracted schemas, defaults and response builders into backend-server/apps/api/src/services/aiWingman.ts; legacy routes/aiWingman.ts and the D1 router now share that service. Auth remains router scoped and precedes validation; no limiter was added. No external AI provider call or D1 write.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/596/590/48 with /api/ai 10/0;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1) with unauthenticated 401-before-validation, 422 boundaries and response shapes for all ten patterns plus clean-bundle assertions;
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warnings only.
- Boundaries: random values remain per-request as in legacy; fixture asserts deterministic fields and ranges. No new migration or D1 writes. Legacy emits sync:invalidate after successful AI POSTs; D1 has no socket emitter for it. MongoDB remains authoritative.

## 2026-11-26 - D1 trust verification state routes

- Mounted nine /api/trust-verification state routes in backend-server/apps/api/src/migration/d1TrustVerification.ts (mounted in d1App.ts at /api/trust-verification). /api/trust-verification is now 9/1; GET /media/:fileName stays legacy-only because it needs legacy R2 authorization and provider fallback.
- Extracted schemas, consent version, voice prompts and public DTOs into backend-server/apps/api/src/services/trustVerificationShared.ts; the legacy service/router and D1 router now share them. Auth precedes validation, no limiter was added, lazy creation uses a conditional insert, and verification plus submission writes commit in guarded batches. No new migration or external provider call.
- Verification:
npm.cmd run typecheck pass;
npm.cmd run audit:d1-endpoints -- --missing 638/605/599/39 with /api/trust-verification 9/1;
npm.cmd run test:auth-worker --workspace apps/cloudflare-worker pass (1/1) with unauthenticated 401-before-validation, 422 boundaries, empty-face 400, all nine response shapes, consent/face/voice guard order, review/retry transitions, submission DTOs and persisted rows plus clean-bundle assertions;
npm.cmd run secrets:check:strict pass; scoped git diff --check LF/CRLF warnings only.
- Boundaries: the D1 user index is non-unique, so imported duplicate rows need reconciliation; D1 has no sync:invalidate emitter for successful POSTs. MongoDB remains authoritative.

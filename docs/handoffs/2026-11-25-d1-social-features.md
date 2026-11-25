# 2026-11-25 — D1 social features

## Scope

Mounted all 20 `/api/social` HTTP patterns on the shared D1 Worker:

- Mood and activity: `GET`/`POST`/`DELETE /api/social/mood`, `POST /api/social/activity`
- Waves: `POST /api/social/wave`, `GET /api/social/waves`, `GET /api/social/waves/unread-count`, `POST /api/social/waves/:waveId/read`
- Daily question: `GET /api/social/daily-question`, `POST /api/social/daily-question/answer`, `GET /api/social/daily-question/answers/:questionId`, `GET /api/social/daily-question/my-answer/:questionId`
- Voice polls: `POST`/`GET /api/social/voice-polls`, `GET /api/social/voice-polls/mine`, `GET /api/social/voice-polls/:pollId`, `POST /api/social/voice-polls/:pollId/vote`, `POST /api/social/voice-polls/:pollId/close`
- Countdowns: `GET`/`POST /api/social/countdowns`

The existing `d1Social.ts` router continues to own friends, follows and blocks. The audit reports `/api/social` at 20 mounted / 0 missing.

MongoDB remains authoritative. No hosted migration, data import, deploy, provision, credential change, commit or push was performed.

## Behavior characterized from source and a disposable MongoDB probe

- The legacy social router applies `requireAuth` before every handler. Zod body failures use `422 { code: "VALIDATION" }`; manual option, ID, index and replay failures use the legacy `400` or `409` messages. Unauthenticated requests fail before validation or database work.
- Mood and activity are one upserted document per user. Re-posting preserves `createdAt`, advances `updatedAt`, defaults the mood emoji from the option list and extends expiry. The activity response explicitly includes `activityRoomId: null` when no room was supplied; other absent fields are omitted.
- Wave send persists a `WAVE` notification for the receiver with legacy title, body and `senderId`/`type`/`waveId`/`roomId` data. Re-reading a wave is receiver-scoped and replay simply returns the already-read document.
- The daily question uses local midnight and the deterministic 20-question rotation. Answer replay returns `409 Already answered today`; public answers and `my-answer` use different population shapes.
- Voice polls return option and ballot `_id` fields, unpopulated IDs on create/mine/read-own responses and compact populated authors on list/detail/vote/close responses. A repeat vote returns `409 Already voted` without another tally. Only the poll creator can close, and closing twice remains a successful no-op.
- Compact populated users and child documents omit unset or null values, matching the legacy Mongoose lean projections. `expiresAt`, `createdAt` and `updatedAt` are omitted when absent.

## D1 implementation

- `backend-server/apps/api/src/migration/d1SocialFeatures.ts` owns the routes and is mounted with `app.use("/api", createD1SocialFeaturesRouter(db))` in `d1App.ts`.
- The session guard is scoped with `router.use("/social", requireSession)`. An unscoped guard challenged unrelated `/api/*` fetch-level routes such as `/api/users` before those routes could answer; the scoped form preserves the legacy auth order without that side effect.
- `backend-server/apps/api/migrations/d1/0029_social_unique.sql` adds uniqueness for `user_moods.user_id`, `daily_questions.date`, `user_daily_answers(user_id, question_id)` and `voice_poll_votes(voice_polls_id, value)` where the voter value is non-null. It also adds `user_moods.activity_room_id_present` so a null activity room can be distinguished from a legacy row that never had the field. The `activity_room_id_present` discriminator is written only by the activity route.
- DTOs go through one `present()` helper that drops null and undefined values. Wave senders, answer users and poll authors use the same compact projection and omit empty `avatarParts`.
- Poll children are read by direct, position-ordered queries. SQLite cannot correlate the nested `FROM` subqueries originally drafted for the JSON child arrays, so the DTO is assembled in TypeScript with the same order and `_id` fields.
- A vote uses a fresh per-attempt `source_id` plus the `0029` unique voter key as its concurrency discriminator. A deterministic ID would make a replay look like a successful claim and double-count the tally. The guarded batch inserts the vote, increments the option, inserts the ballot and updates the poll together.
- Daily-question seeding uses `INSERT OR IGNORE` with the unique date key; answering uses the unique user/question key. Both classify replay races back to the legacy active question or `409`.
- Wave send inserts the wave and its notification in one D1 batch. There is still no D1 Socket.IO replacement, so no legacy `wave`/`nudge`/`vibe_ping` room or user event is emitted; only the persisted notification is available.

## Verification run

From `backend-server`:

- `node --check apps\\cloudflare-worker\\test\\d1-social-features.mjs` — passed.
- `node --check apps\\cloudflare-worker\\test\\auth-worker.mjs` — passed.
- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, 1/1. The new fixture asserts auth before validation, `422` bodies, manual `400` messages, mood/activity defaults and replay, `activityRoomId: null`, wave list/unread/read plus the single `WAVE` notification, local-day question seeding and `409` replay, poll DTOs/create/list/detail/mine/vote/close, vote replay with unchanged tallies, countdown filtering/defaults, compact populated fields with nulls omitted and an unchanged unrelated notification count. The suite also asserts the emitted Worker bundle contains no `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` or `redis.ts` input. Expected schema-unavailable, config-required, 500, scheduled-maintenance and push-delivery logs were present.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; legacy 638 / D1 327 / matched 322 / missing 316; `/api/social` is 20 mounted / 0 missing. The audit is an inventory and reports the remaining patterns rather than failing the command.
- `git diff --check` from the repository root — no errors; only benign LF/CRLF notices.

The temporary `apps/api/social-characterization.ts` MongoDB probe was deleted after capturing the legacy responses. `npm.cmd run secrets:check:strict` had passed earlier in the session with no tracked credential-bearing assignments. `npm.cmd run worker-config:check` remains report-only and unchanged with two pre-existing query-string-redaction findings. Neither config check was rerun for this route slice.

## Not run / open

- Hosted verification, data import, deploy, provision, credential changes and MongoDB retirement.
- `0029` is applied in fresh Worker fixtures only. The recovered emulator database remains at `0019`; run `npm run d1:setup:local -- --persist-to <existing-directory>` before exercising the activity route against that database. Hosted application of `0003` through `0029` remains unverified.
- Before hosted `0029`, audit existing rows for duplicate `user_moods.user_id`, `daily_questions.date`, `user_daily_answers(user_id, question_id)` and non-null `voice_poll_votes(voice_polls_id, value)` values.
- No D1 realtime emitter replaces legacy social wave events or `notification:new`. Live FCM delivery and receiving-client behavior remain open.

## Next action

Continue with the next bounded durable-state route group only after its behavioral boundary is checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.

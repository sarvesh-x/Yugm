# 2026-11-26 — D1 trust verification state routes

## Scope

Mounted the nine durable user routes under `/api/trust-verification` on the shared D1 Worker:

- `GET /me`
- `POST /start`
- `POST /consent`
- `GET /voice-prompt`
- `POST /face`
- `POST /voice`
- `POST /submit-review`
- `POST /retry`
- `GET /status`

`GET /api/trust-verification/media/:fileName` remains legacy-only. It needs the legacy private-media R2 authorization, file-name assertion and local/S3 provider fallback; moving it would be a separate managed-media slice. `/api/trust-verification` is now 9/1 in the HTTP inventory. MongoDB remains authoritative. No hosted migration, data import, deploy, provision, credential change, commit or push was performed in this slice. The earlier commit/push of `24eb56c` remains the last authorization consumed.

## Behavior preserved

- Router-scoped authentication runs before body validation on every route, matching legacy `trustVerificationRouter.use(requireAuth)`. The legacy flow has no rate limiter, so none was added.
- Zod schemas, defaults and bounds moved unchanged into `services/trustVerificationShared.ts` and are imported by both the legacy router and the D1 router. Invalid bodies still return `422 Validation failed` with field issues.
- Lazy creation keeps the legacy defaults: `NOT_STARTED`, `BASIC`, all check statuses `NOT_SUBMITTED`, score/risk null, badge flags false.
- `start` always sets `INCOMPLETE`; `consent` moves only `NOT_STARTED` to `INCOMPLETE` and stores the supplied or default consent version with an acceptance timestamp.
- `face` requires at least one media URL after schema validation, sets `faceStatus` to `SUBMITTED`, sets `livenessStatus` only when a liveness URL is supplied, and leaves other statuses alone.
- `voice` requires an audio URL and prompt text, then sets `voiceStatus` to `SUBMITTED`.
- `submit-review` checks consent, face and voice in that order before committing `PENDING_REVIEW` and `submittedAt`.
- `retry` resets the three check statuses and clears the rejection reason while preserving consent and other verified state.
- `GET /voice-prompt` keeps the same three local prompts and random selection; no external provider is called.
- Responses keep the legacy `sendOk` envelope, `publicTrustVerification` shape, submission field names, omitted optional Mongoose paths, explicit provider-response values and `__v: 0`.

## D1 implementation

- Added `backend-server/apps/api/src/services/trustVerificationShared.ts` with the schemas, consent version, voice prompts and public DTO shared by legacy and D1.
- Refactored `backend-server/apps/api/src/services/trustVerification.ts` and `routes/trustVerification.ts` to import those contracts without changing route order, auth or business methods.
- Added `backend-server/apps/api/src/migration/d1TrustVerification.ts` and mounted it in `d1App.ts` at `/api/trust-verification`.
- Lazy creation uses a conditional insert before re-reading the row; face and voice submissions and their verification-state updates commit in one guarded `db.batch`. The successful response is built from `RETURNING` rows and the re-read submission, never before commit.
- Submission JSON is stored in the existing `provider_response` TEXT columns and parsed back into the response. SQL NULL means an omitted field; JSON `"null"` is preserved as an explicit null.
- No new migration. Existing `trust_verifications`, `face_verification_submissions` and `voice_verification_submissions` tables are used unchanged. No R2, Firebase, FCM, LiveKit or payment provider is involved.

## Boundaries and divergence

- Legacy has a unique `userId` index on `TrustVerification`; D1 has a non-unique `idx_trust_verifications_user`. Conditional insert covers new writes, but imported duplicate rows would need reconciliation before cutover.
- Legacy Mongoose writes for verification state and submissions are separate operations. D1 commits them atomically in one batch, which is stricter on partial failure.
- The legacy global `syncInvalidation` middleware emits `sync:invalidate` with topics `SETTINGS`, `PROFILE` and `TASKS` after successful trust POSTs; the D1 Worker has no socket emitter, so receiving clients are not invalidated. GET routes emit nothing in either runtime.
- D1 access sessions expose identity and authorization only; these routes perform no profile reads. Random voice prompt selection is unchanged.
- MongoDB remains authoritative until route/job parity, reconciliation, recovery rehearsal and live acceptance pass.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1) on the final run. Fixtures cover unauthenticated 401 before validation, 422 schema boundaries, the empty-face 400 business rule, all nine route shapes, default values, consent/face/voice guard order, review/retry transitions, submission DTOs and persisted D1 rows. Existing clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 605 D1 / 599 matched / 39 missing; `/api/trust-verification` 9/1.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; benign LF/CRLF notices appeared in previously modified source files.

One intermediate Worker run failed an unrelated `d1-reports.mjs` count assertion (`4 !== 3`) after the new fixtures had passed; the immediately following clean run passed 1/1 with the same source. Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared. No hosted request, migration application, data transfer or Android build was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh local fixtures while the recovered local database remains at `0019`.
- Remaining missing routes: `/api/pk` (22), `/api/upload` (7), `/api/discover` (6), `/api/users` (2), `/api/dating/explore` (1) and `/api/trust-verification/media/:fileName` (1).
- D1 realtime invalidation for successful trust mutations.

## Next action

Continue only with another bounded group whose auth, side effects and realtime boundary are checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.

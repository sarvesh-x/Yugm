# D1 progression APIs and scheduled jobs

## HTTP routes

- `GET /api/users/me/level` and `GET /api/users/me/level-overview` use the existing level and streak rules. The overview reports the XP cap totals and position on the level leaderboard.
- `GET /api/users/leaderboard/levels` and the Android client's `/api/leaderboard/levels` use the same paginated D1 result. Accounts pending deletion and blocked accounts are excluded. Realtime presence remains pending.
- `POST /api/users/me/check-in` claims the UTC day and commits the streak, cosmetic, XP, Battle Pass grant and wallet ledger credits in one D1 batch. Repeated and concurrent requests preserve one successful claim.

## Scheduled work

- Every 15 minutes, the shared D1 Worker prunes expired sessions, expires active stories and pending clan invites, clears expired suspensions, reviews VIP cycles, deletes clan messages past the existing 30-day retention period and prunes stale push jobs. Story expiry keeps the row for related records. The retention write removes reactions with their message. The job bounds each batch. [Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- The same job expires pending and abandoned R2 uploads, releases quota with the D1 session transition, and retries removal of staging bytes until R2 confirms deletion. It gives recent processing and terminal uploads a 15-minute grace period. Finalizing an avatar checks the live session and upload state in the D1 transaction.
- A D1 trigger queues per-device FCM deliveries with new unread inbox records. A one-minute Cron Trigger leases up to eight deliveries per invocation, checks current device ownership and notification preferences, and retries the affected device up to three attempts. It removes tokens only when FCM reports them as unregistered. Jobs expire after 24 hours. FCM can still receive a duplicate if a Worker finishes the external send and loses its D1 acknowledgement. The Android payload includes the original notification ID. [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- The production-target Worker enables the FCM dispatcher when its Firebase service settings and production HTTPS origin are present. `YUGM_FCM_PUSH_ENABLED=false` pauses delivery. Local development leaves FCM delivery disabled by default. Keep delivery paused during any future import that includes recently created inbox records until those jobs have been reviewed.

## Verification and remaining work

- Both isolated Worker fixtures passed. The debug fixture exercises concurrent check-in, injected wallet failure and rollback, leaderboard paging, repeated maintenance, abandoned versus recent uploads, R2 deletion, and concurrent push invocations with mocked Firebase OAuth and FCM responses. It verifies that only the retryable device is retried.
- Workspace typechecks, the backend suite, the production Worker dry run, `git diff --check`, and the credential scan passed.
- Applied `0006_scheduled_maintenance.sql` and `0007_notification_push_jobs.sql` to the default local `yugm` and the emulator's sign-in recovery persistence directory. Hosted application of those migrations remains open, along with the previously pending `0003` through `0005`. Live production FCM delivery remains unverified.
- `npm run audit:d1-endpoints` reports 116 shared and 522 legacy-only method and path patterns out of 638. The next D1 work includes room lifecycle and RealtimeKit, Bonds, payments, admin and the other remaining API groups. Bonds maintenance, weekly honors, account-deletion cleanup, and stale-room, Socket.IO and PK lifecycle jobs still use the legacy stack.

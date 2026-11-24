# Handoff — Local push Queues and recovery

**Date:** 2026-11-23

The existing inbox and Socket.IO behavior is characterized through the real notification service and disposable MongoDB. Message opt-out and default-off marketing leave the inbox intact while suppressing both transports. Bonds push opt-out leaves socket fan-out intact. The fixture also covers registered-device targeting, unchanged push data and notification identity, provider failure and persistence failure. [Characterization](../../backend-server/apps/api/src/services/notifications.characterization.test.ts)

## Local Worker path

- The default [local Wrangler configuration](../../backend-server/apps/cloudflare-worker/wrangler.jsonc) wires a SQLite Durable Object binding and a Queue. The producer is selected only with `YUGM_LOCAL_PUSH_QUEUE=true` in the local Worker. The default is `false`. The existing BullMQ/inline path and staging and production configurations still select their established paths.
- One outbox object per notification ID stores the original push payload and remaining device IDs. The broker message carries the notification ID. The outbox persists dispatch state and its watchdog alarm before publishing. Replayed Queue messages can be acknowledged after the job is processed, while transient device failures are retried through the persisted alarm and the existing FCM delivery contract. [Outbox and consumer](../../backend-server/apps/cloudflare-worker/src/pushDispatchDo.ts) · [Cloudflare delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)
- Three attempts retain the existing 60-second base backoff. A 15-minute watchdog republish recovers a missed Queue delivery. Pending jobs expire after 24 hours. Terminal state is retained for 24 hours and failed jobs can be replayed through internal RPC. Completed jobs, including those with permanent device failures, are excluded from replay.
- A crash before the notification reaches the outbox remains a gap. An ambiguous FCM send before the result is checkpointed can repeat a device push. The local fixture advances time to exercise expiry and recovery, and does not establish deployed alarm timing or recovery across a real process restart.

## Verification

- `npm.cmd run test --workspace @yugm/api` passed 475/475 with loopback test configuration, including the notification entry point and substitute dispatcher fixture.
- `npm.cmd run test:push-queue --workspace @yugm/cloudflare-worker` passed 6/6 using an ephemeral Wrangler Queue, SQLite Durable Objects and controlled FCM results.
- `npm.cmd run test:realtime --workspace @yugm/cloudflare-worker` passed on the local Worker with disposable MongoDB and the default queue setting. The `-- --push-queue` variant also passed, reported `cloudflare-queues` readiness and asserted the Bond inbox record with a registered fixture device. That variant disables Firebase credentials. The dedicated queue fixture covers the consumer and retry outcomes.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` passed the Worker entry and API runtime checks. `git diff --check` passed.

Staging activation still needs explicit approval, real FCM/device behavior, queue and outbox quota measurements, restart/interruption evidence and an approved legacy queue drain and rollback. No cloud resources were provisioned, and no live FCM message was sent.

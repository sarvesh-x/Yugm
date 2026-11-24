# Handoff — Push delivery retry contract

**Date:** 2026-11-23

The first BullMQ replacement slice fixed the delivery contract shared by a future Cloudflare Queues dispatcher. BullMQ sent each job through the inline helper, which caught provider errors and made failed attempts appear complete. The FCM multicast path removed unregistered tokens but did not expose per-device failures to the job.

- [Job processing](../../backend-server/apps/api/src/services/jobs.ts) still uses the existing queue and stable notification-derived IDs. Queue attempts now fail when the provider call rejects. A partial multicast result saves only the retryable device IDs before retry, and the next attempt checks current registrations for the same recipient. In-app notification persistence and the best-effort inline path continue through the existing entry points.
- [The delivery contract](../../backend-server/apps/api/src/services/pushDelivery.ts) classifies transient and terminal per-device outcomes. Queue errors omit raw provider details. The retry base changed from 5 seconds to 60 seconds for rate-limit failures under the shared backoff. An external send followed by ambiguous delivery, a crash or failed checkpoint can still result in a repeat send. [Firebase error codes](https://firebase.google.com/docs/cloud-messaging/error-codes)
- Ran `npm.cmd exec --workspace @yugm/api -- tsx --test src/services/pushDelivery.test.ts` (5/5), `npm.cmd run test --workspace @yugm/api` (467/467 with loopback test settings), and `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` (passed).

Next, wire a local Queues producer and consumer with recoverable dispatch state. Test through the actual notification entry point with controlled provider responses, then exercise duplicate delivery, enqueue failure, retention expiry and replay. Live Firebase, a broker-backed retry and the Cloudflare Queues path were not tested in this slice. No remote resources were created or changed.

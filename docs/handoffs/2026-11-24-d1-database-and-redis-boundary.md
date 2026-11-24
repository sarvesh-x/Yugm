# D1 database identity and Redis migration

## Database binding

| Environment | D1 name | Target |
| --- | --- | --- |
| Android debug | `yugm` | Wrangler simulation with the existing local ID and `remote: false`. Keep using the existing persistence directory. |
| Production target | `yugm` | Existing hosted D1 under the UUID returned by Wrangler. |

Both configurations expose the database through `AUTH_DB`. Debug can target the binding or the `yugm` name when invoking Wrangler with the debug config and `--local`. A disposable local schema load by name executed 227 statements and returned 148 SQLite tables. [Emulator startup](2026-11-24-local-d1-auth-emulator.md) · [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/)

## Production seed status

`wrangler d1 list --json` identified the hosted database and returned `num_tables: 0`. `npm.cmd run audit:d1-endpoints` found 65 shared routes, 573 legacy-only routes and 4 D1-only routes at this checkpoint. The latest Profile/social slice reports 90 shared and 548 legacy-only routes with the same legacy total of 638. These are method/path patterns. The production origin and provider secrets still require configuration, and the schema remains a local draft. The owner conditioned production seed generation on the models and APIs working in production. That condition remains open, so there is no production seed script. Repository seed commands such as `seed` and `seed:admin` target the legacy backend. [Endpoint coverage](2026-11-24-hosted-r2-d1-endpoint-audit.md) · [Production setup](2026-11-24-production-cloudflare-builds.md)

Finish and review the schema and API ports, rehearse schema and data setup in isolated D1, and verify the configured production Worker. Then generate an idempotent seed for required reference data. Production schema and data changes require separate authorization.

## Redis replacement

The shared Auth router accepts rate limiters from its host. The D1 Workers use Cloudflare Rate Limiting bindings for sign-in by client IP, sign-in by hashed identifier, and refresh by client IP and a token hash prefix. The limits are 20, 10 and 30 per minute respectively. The debug Worker uses a single loopback client bucket and distinct local namespaces. Production uses the Cloudflare-provided client IP and overwrites the internal header before forwarding to Express. The middleware returns `429` with `Retry-After: 60` on rejection. Cloudflare counters are approximate and scoped to each Cloudflare location. [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

Build metadata confirms that both D1 Worker bundles exclude the Redis client, Socket.IO Redis adapter and BullMQ. The legacy staging Worker and Node runtime still carry those dependencies for their existing routes.

| Remaining legacy use | Cloudflare cutover work |
| --- | --- |
| Push retries and maintenance jobs | Connect the tested Queues and SQLite Durable Object outbox to the migrated notification path. Verify FCM delivery, restart recovery and legacy job drain before retiring BullMQ. |
| Presence, socket fan-out and room-disconnect grace | Finish and verify Durable Object realtime with reconnects, concurrent devices and role changes. |
| Public room and wallet caches | Verify expiration and invalidation contracts before moving any needed cache to the Workers Cache API. |
| Legacy HTTP and socket rate limits | Verify each legacy key and time window. Use SQLite Durable Objects where the contract requires strict counters across locations. |

Redis service retirement and legacy dependency removal are pending those cutovers. [Push outbox evidence](2026-11-23-local-push-queues.md) · [Redis and realtime migration plan](../migration/implementation-plan.md#2-redis-and-application-realtime)

## Verification

- `npm.cmd test` passed all 551 backend tests, including the MongoDB and D1 Auth contract checks. `npm.cmd run typecheck`, the tracked-secret scan and `git diff --check` passed.
- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker suites with simulated bindings. The debug fixture exercised all three auth limits and verified that changing forwarded IP headers cannot bypass the loopback client bucket. The production fixture verified the hosted ID, distinct limiter namespaces, D1 readiness after fixture schema load, and Firebase App Check rejection.
- Wrangler generated declarations for both configurations. The route audit and named local D1 schema check passed.
- `npm.cmd run test:push-queue --workspace @yugm/cloudflare-worker` passed 6 local Queues and Durable Object outbox checks. The `test:realtime -- --push-queue` compatibility fixture passed with Redis disabled and disposable MongoDB. Live FCM and staged drain remain unverified.

The hosted check used Cloudflare database metadata. The work did not apply production migrations, seed data, deploy a Worker, or alter Redis resources.

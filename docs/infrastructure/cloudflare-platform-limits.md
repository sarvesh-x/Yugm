# Cloudflare platform limits and pricing snapshot

**Date:** 2026-11-22  
**Status:** Phase 0 evidence snapshot. Source documentation is authoritative and can change; re-check before provisioning or committing to a plan.

This page records only official Cloudflare documentation fetched during Phase 0. It is used by [the D1 capacity assessment](../database/d1-capacity-assessment.md) and the Cloudflare migration plan. It does not claim that Yugm currently uses any of these limits or that any resource has been provisioned.

## Official sources

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) and [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Workers KV limits](https://developers.cloudflare.com/kv/platform/limits/) and [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Hyperdrive](https://developers.cloudflare.com/hyperdrive/), [limits](https://developers.cloudflare.com/hyperdrive/platform/limits/) and [pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Durable Objects WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Workers

| Concern | Free | Paid |
|---|---|---|
| Requests | 100,000/day | No general limit |
| CPU per HTTP request | 10 ms | 5 min maximum, default 30 s |
| CPU per Cron Trigger | 10 ms | 5 min for schedules under 1 hour; 15 min for 1 hour or more |
| Memory per isolate | 128 MB | 128 MB |
| Subrequests per invocation | 50 | 10,000 default, configurable up to 10M |
| Simultaneous connections waiting for headers | 6 | 6 |
| Environment variables per Worker | 64, 5 KB each | 128, 5 KB each |
| Worker size | 64 MiB uncompressed | 64 MiB uncompressed |
| Startup time | 1 s | 1 s |
| Workers per account | 100 | 500 |
| Cron Triggers per account | 5 | 1,000 |
| Cache API calls per request | 50 | 1,000 |
| Log data per request | 256 KB | 256 KB |

HTTP request duration has no hard wall-time limit while the client remains connected. Cron, queue consumers and Durable Object alarms have a 15-minute wall-time limit. `waitUntil()` can extend post-response work for up to 30 seconds. Runtime updates allow existing requests and connections up to a 20-minute drain period, but crashes or resource pressure can interrupt work earlier.

Incoming request body limits depend on the Cloudflare zone plan: 100 MB on Free and Pro, 200 MB on Business, up to 5 GB self-serve on Enterprise. Durable Object outbound `fetch()` bodies default to 100 MiB and cannot be made larger by raising the domain upload limit.

Compatibility dates on or after `2026-08-04` enable `nodejs_compat` and `nodejs_compat_v2` by default. Workers provides a subset of Node APIs natively and non-functional stubs for modules such as `node:child_process`, `node:worker_threads`, `node:sqlite`, `node:dgram`, `node:cluster`, `node:inspector`, `node:readline`, `node:repl`, `node:tty` and `node:v8`. A stub allowing an import does not mean the code can execute.

**Migration implication:** Bundling Express, Mongoose and Socket.IO into a Worker is not equivalent to running them in Node. It requires compatibility testing, careful dependency locking, and a replacement for long-lived in-process state.

## D1

| Concern | Free | Paid |
|---|---|---|
| Maximum database size | 500 MB | 10 GB, cannot be increased |
| Maximum account storage | 5 GB | 1 TB included; increase by request |
| Databases per account | 10 | First 100,000 included; $0.10/month each above that |
| Time Travel retention | 7 days | 30 days |
| Queries per Worker invocation | 50 | 1,000 |
| Maximum row/string/BLOB size | 2 MB | 2 MB |
| Maximum SQL statement length | 100 KB | 100 KB |
| Maximum bound parameters per query | 100 | 100 |
| Maximum query duration | 30 s | 30 s |
| Maximum file import via `d1 execute` | 5 GB | 5 GB |
| Maximum query result size | 50 MB from 2026-11-04 | 50 MB from 2026-11-04 |

Billing on Paid: first 25 billion rows read/month included, then $0.001 per million; first 50 million rows written/month included, then $1.00 per million; first 5 GB storage included, then $0.75/GB-month. Free includes 5 million rows read/day and 100,000 rows written/day; exceeding a daily limit stops queries until reset or upgrade.

D1 is single-threaded per database. Throughput is approximately `1 / average query duration` queries per second for one database; a 1 ms query suggests at most about 1,000 QPS, while a 100 ms query suggests about 10 QPS. Overloaded requests queue and then fail. `db.batch()` counts as one query against the per-invocation query limit, but each statement has its own 100 KB statement and 100-parameter limits. DDL, indexes and imports consume billable row operations. Indexes add at least one extra written row when indexed columns change.

Time Travel provides point-in-time recovery within its retention window; it is not a substitute for independent backups before destructive migrations.

**Migration implication:** D1 is suitable only if the measured relational dataset fits comfortably below 10 GB per database, row sizes stay below 2 MB, query patterns remain index-driven, and peak write throughput fits a single-threaded database or a deliberate per-tenant sharding plan. Otherwise use PostgreSQL through Hyperdrive.

## R2

| Concern | Value |
|---|---|
| Standard storage | $0.015/GB-month |
| Infrequent Access storage | $0.01/GB-month, 30-day minimum storage duration and $0.01/GB retrieval |
| Class A operations | $4.50/million Standard; $9.00/million Infrequent Access |
| Class B operations | $0.36/million Standard; $0.90/million Infrequent Access |
| Egress from R2 | Free |
| Free tier (Standard only) | 10 GB-month storage, 1M Class A and 10M Class B operations/month |
| Buckets | First 100,000 included; $0.10/month each above that |

Class A includes object listing, uploads, multipart operations and bucket configuration. Class B includes `HeadObject`, `GetObject` and bucket reads. `DeleteObject`, `DeleteBucket` and `AbortMultipartUpload` are free. Usage rounds up to the next billing unit. Failed authentication/authorization is not charged, but authenticated failures such as `412 PreconditionFailed` or `400 BadDigest` are.

**Migration implication:** Immutable versioned keys, staging prefixes and lifecycle rules must be designed around operation classes. Public assets can use a custom domain or managed public access; private media must be served through an authenticated Worker or short-lived signed URLs and must not be cached publicly.

## Queues

| Concern | Free | Paid |
|---|---|---|
| Included operations | 10,000/day | 1,000,000/month, then $0.40/million |
| Message retention | 24 hours, fixed | 4 days default, configurable up to 14 days |
| Queue count | 10,000 | First 10,000 included; $0.10/month each above that |

Common limits: 128 KB message size, 100 retries, 100 messages per consumer batch, 100 messages or 256 KB per `sendBatch`, 60-second maximum batch wait, 5,000 messages/s per queue, 25 GB backlog per queue, 250 concurrent push consumers, and 15-minute consumer wall time. Operations are counted per 64 KB chunk; a normal delivery is roughly three operations (write, read, delete), and retries add read operations.

**Migration implication:** Queue payloads must be small references and idempotent commands, never media bytes or full financial state. Consumers must tolerate at-least-once delivery, retries, DLQ and 24-hour Free retention.

## Durable Objects

| Concern | Free | Paid |
|---|---|---|
| SQLite-backed classes | Only SQLite backend available | SQLite available; legacy KV backend only for existing accounts |
| Classes per account | 100 | 500 |
| Storage per account | 5 GB | Unlimited |
| Storage per object | 1 GB on Free per FAQ / 5 GB total plan limit | 10 GB |
| Requests | 100,000/day | 1M/month, then $0.15/million |
| Duration | 13,000 GB-s/day | 400,000 GB-s/month, then $12.50/million GB-s |
| SQLite rows read | 5M/day | First 25B/month included, then $0.001/million |
| SQLite rows written | 100,000/day | First 50M/month included, then $1.00/million |
| SQLite stored data | 5 GB total | 5 GB-month included, then $0.20/GB-month |
| Received WebSocket message | 32 MiB | 32 MiB |

An object is single-threaded with a soft limit near 1,000 requests/s and can return `overloaded`. WebSocket messages count as requests for billing at a 20:1 ratio. Hibernation-compatible WebSockets remain connected while the object leaves memory and avoid duration charges while idle. Incoming messages, alarms and pending I/O prevent hibernation; outgoing WebSockets do not hibernate. `serializeAttachment`/`deserializeAttachment` can carry up to 16 KB per connection and must be used to restore connection state after hibernation.

**Migration implication:** Scope objects by conversation, room, user presence or other coordination boundary. Use the hibernation API for Socket.IO-compatible transports only after a protocol adapter plan exists. Do not use a Durable Object as a financial ledger; D1 or PostgreSQL remains authoritative.

## Workers KV

| Concern | Free | Paid |
|---|---|---|
| Reads | 100,000/day | 10M/month, then $0.50/million |
| Writes / deletes / lists | 1,000/day each | 1M/month each, then $5.00/million |
| Same-key writes | 1/s | 1/s |
| Storage | 1 GB | 1 GB included, then $0.50/GB-month |
| Value size | 25 MiB | 25 MiB |
| Key size | 512 bytes | 512 bytes |
| Minimum `cacheTtl` | 30 s | 30 s |

**Migration implication:** KV is only for non-critical cache/config. It is not suitable for balances, idempotency keys, ownership, membership, queues, or any state requiring immediate read-after-write consistency.

## Hyperdrive / PostgreSQL fallback

Hyperdrive is included in both plans. Free allows 100,000 queries/day and up to 10 configurations; Paid allows unlimited queries and up to 25 configurations. Connection pools are roughly 20 per configuration on Free and 100 on Paid, with a 15-second initial connection timeout and 10-minute idle timeout. Queries have a 60-second maximum duration and 50 MB cached response size. Hyperdrive adds connection pooling and query caching without separate service charges; the origin database is billed by its provider.

**Migration implication:** If D1 capacity or throughput is insufficient, use PostgreSQL with Hyperdrive rather than forcing relational data into D1. Financial atomicity and multi-table transactions remain in the origin database; Workers call it through a typed repository boundary.

## Cron Triggers

Cron expressions use UTC, support five fields plus Quartz-like extensions, and take up to 15 minutes to propagate after configuration changes. On Wrangler-managed Workers, cron triggers should be managed exclusively in the configuration file; an empty `crons` array removes all triggers. Cron Events stores the 100 most recent invocations. Scheduled handlers have a 15-minute wall-time limit.

**Migration implication:** Maintenance jobs must be idempotent, bounded, checkpointed and protected against overlap. Cron is a trigger, not a guarantee of exactly-once execution.

## Cross-cutting conclusions

- Free tier is acceptable for isolated prototypes and disposable tests, not for the production financial and social state described in the migration objective.
- Workers Paid is required before committing to production D1 storage, Durable Object hibernation cost control, uncapped requests, and useful CPU headroom.
- Provisioning, plan changes and paid resources are approval gates; none were performed in Phase 0.

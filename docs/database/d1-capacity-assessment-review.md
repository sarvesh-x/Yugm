# D1 capacity assessment review (local)

**Date:** 2026-11-22
**Status:** Review of `docs/database/d1-capacity-assessment.md` against current repository facts. No production metrics were collected, no D1 database was provisioned, and no capacity gate is satisfied.

## Summary

The assessment correctly identifies D1 as a hard-capped, single-threaded database and preserves PostgreSQL/Hyperdrive as a fallback. However, it remains an input-gathering document: every quantitative gate is still unanswered because production MongoDB metrics were not available.

## What is already strong

- Clear required metrics by area: size, growth, users, messages, writes, finance, media, admin, queries, transactions and recovery.
- Explicit D1 thresholds mapped to official limits.
- Explicit stop conditions and fallback to PostgreSQL/Hyperdrive.
- Correct statement that Time Travel is not an independent backup.
- Correct warning that Workers Paid is required before production D1 traffic.

## Missing or underspecified items

1. **No baseline inventory from the current schema**
   - The assessment does not compare the 146-table draft schema to expected row counts, indexes or JSON payload sizes.
   - Add per-table estimated row counts and average row size for `users`, `wallet_transactions`, `gift_transactions`, `chat_messages`, `direct_messages`, `clan_messages`, `stories`, `rooms`, `media_objects`, `assets`, `achievements`, `reports`, `support_tickets` and their child tables.

2. **No write-path budget**
   - The assessment asks for writes per collection but does not define a peak write budget or a maximum acceptable queue depth.
   - Add peak writes/second by domain and a target headroom percentage, for example 50% below the estimated single-database QPS.

3. **No read-path budget**
   - Top queries are requested, but there is no list of required latency SLOs for auth, profile, chat, room list, wallet, leaderboard and admin screens.
   - Add p50/p95/p99 targets and maximum rows scanned per request.

4. **No financial transaction volume model**
   - Wallet, gift, purchase and payout flows need a concrete model: transactions per day, concurrent financial operations, idempotency-key volume and journal rows per account.
   - Add a reconciliation sample size and expected variance threshold of zero.

5. **No media/reference reconciliation baseline**
   - Media counts and bytes are requested, but there is no baseline for orphan candidates or reference density.
   - Add counts for `MediaObject`, `MediaUploadSession`, `MediaQuotaReservation`, and `AssetObject` variants, plus referenced-vs-unreferenced media.

6. **No growth model**
   - 30/90/180-day growth is requested, but there is no retention/deletion policy decision.
   - Add retention windows for messages, audit logs, notifications, sessions, upload sessions and expired media.

7. **No recovery objective**
   - Backup frequency is requested, but RPO/RTO values are not stated.
   - Add explicit RPO and RTO for financial state, user content, media metadata and audit logs.

8. **No cost model**
   - D1 pricing is listed, but there is no estimated monthly cost for reads, writes, storage and Time Travel.
   - Add a cost estimate for current volume and 12-month projection, including Workers Paid.

9. **No throughput test plan**
   - The single-threaded QPS estimate is theoretical.
   - Add a staging load test plan with realistic query mixes and measured p95 latency before production approval.

10. **No decision trigger table**
    - The fallback rule is present, but the exact trigger values are not numeric.
    - Add explicit fail triggers, for example dataset > 8 GB projected, p95 query > 1 s, peak writes > 50% of estimated QPS, or restore rehearsal failure.

## Recommended additions to the assessment document

- A "Current schema footprint" section with table counts and estimated row sizes.
- A "Latency SLOs" table by endpoint family.
- A "Financial volume model" table.
- A "Retention and deletion policy" table.
- A "Recovery objectives" table with RPO/RTO.
- A "Cost estimate" table for current and projected volume.
- A "Load test plan" section.
- A "Fail triggers" table that automatically requires PostgreSQL/Hyperdrive reconsideration.

## Gate status

Still blocked:

- Production metrics unavailable.
- Workers Paid not confirmed.
- Backup/restore rehearsal not run.
- No real snapshot or restore test.
- No load or throughput measurement.
- D1 remains selected by owner decision, but the capacity gate is not satisfied.

## Recommendation

Do not treat D1 as approved for production data until the missing metrics, SLOs, recovery objectives, cost estimate and load test are completed. If any fail trigger is hit, revisit ADR-0001 and consider PostgreSQL through Hyperdrive before schema or repository cutover work proceeds.

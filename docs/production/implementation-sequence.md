# Staged implementation and acceptance gates

This is the recommended sequence after the first source audit, not a claim that the work has been implemented or that the whole blueprint is approved for deployment. Preserve the current UI while closing verified server authorization/accounting defects first.

## Prerequisite: finish the executable baseline

1. Establish an explicitly non-production Mongo replica set and isolated database name; provision deterministic fixtures and safe cleanup constrained to that database. The checked-in standalone Compose service is inadequate for transactions.
2. Provide provider sandbox/fakes and a controllable clock; prevent provider/network fallback to live configuration in tests.
3. Confirm product policy: who funds combo gifts; bilateral trade acceptance; purchased/promotional/creator reward units and platform fee accounts; call acceptance/device ownership; block behavior; private attachment access.
4. Verify deploy topology and disable unintended rollout for the work branch. Both Render configuration and the master deployment workflow can independently deploy source pushes. Use the existing `codex/` branch prefix for implementation work.
5. Run and record the existing backend/Android baseline in that environment, then add focused regressions for each changed invariant. Do not call schema-only tests concurrency proof. No APK release is part of this work.

## Package H1: third-party asset authorization (GIFT-001/002)

**First priority.** Prevent any command from spending another user's wallet or transferring their inventory without authenticated consent.

- Trace mounted `/api/gifts/combo` and `/api/inventory/trade`, service callers and Android flows before selecting the compatible response.
- Reject unsupported charged group/immediate bilateral commands until an actor-funded or explicit offer/accept protocol is implemented. Keep ordinary authorized gifting usable.
- If trading is retained, store an immutable offer and require target acceptance with status/version/expiry plus atomic ownership/quantity checks. A pending offer has no asset effect.
- Tests: cross-account requests, forged payer IDs, invalid/duplicate item IDs, self-trade, repeated acceptance, changed offer after acceptance, expired/rejected offer, concurrent inventory consumption. Assert no unauthorized or repeated effect using real test datastore.
- Migration: additive offer model/index only if needed; inspect inventory quantity/ownership data. Rollback prevents new unsafe writes and preserves all committed history.

**Exit:** both actual HTTP paths enforce actor/consent policy with negative route tests and transaction tests; no helper exists merely unused. Product decision and old-client result behavior documented.

## Package H2: atomic wallet boundary and valid sources (WALLET-001)

- Define a typed canonical ledger source list and require positive safe integer units before any mutation; audit every credit/debit caller.
- Callers with multiple domain writes own one Mongo transaction. Helpers must join a supplied active transaction or create their own for standalone balance+journal operations. Do not silently nest transactions or keep one open across provider calls.
- Fix referral/theme callers so referral status, both rewards, balance/journal, and entitlement changes satisfy the relevant atomic workflow.
- Tests: invalid source/units, frozen/missing account, insufficient funds, ledger insert failure, concurrent unique-key reservation, retryable transaction conflict, referral/theme retry. Assert full rollback and consistent before/after journal snapshots.
- Existing financial discrepancy assessment is read-only until authorized reconciliation; never invent journal history or adjust balances automatically.

**Exit:** every inspected helper call site is categorized, no nontransactional critical write remains, and injected ledger failure has zero partial financial effect.

## Package H3: scoped identities and monotonic payments (GIFT-003/004, PAYMENT-001)

- Persist stable client intention IDs before network attempts. Namespace ledger legs by actor/command/operation/leg; store canonical semantically relevant input hash and original result reference.
- Add compatible server handling across room/direct/PK/alternate gift paths; replay performs current authorization checks and rejects payload mismatch.
- Use conditional transitions for payment verification, capture, refund and fulfillment. Refunded/refund-pending state must never become creditable due to a delayed capture.
- Tests: 100 repeats, parallel distinct actors with same raw key/same receiver, changed recipient/gift/currency under same key, lost ACK, duplicate/reordered capture/refund callbacks, ledger/outbox failure.
- Migration: additive fields/partial indexes only after read-only duplicate preflight; preserve old replay and financial history. Rollback pauses incompatible writes rather than removes committed data.

**Exit:** one business effect per scoped intent; no receiver credit collision; terminal purchase states cannot regress; clear uncertain-operation lookup/reconciliation.

## Package H4: bounded functional fixes

Independent after their own contracts are clear:

- **EVENT-001/002:** compatible event mounts, atomic conditional capacity/membership updates, idempotent join and atomic leave. Test Android endpoint contracts, last seat, retry at full capacity, join/leave/cancel races.
- **AND-005:** one active-room socket owner with independently removable mode listeners. Test repeated mode open/close preserves chat/poll/participant updates and media ownership.
- **CALL-001/003:** private VIDEO permission grant parity and separation of committed call result from post-commit fanout. Test private/public roles and injected notification failure.
- **SOCKET-001/002/003:** shared HTTP/socket auth policy, expiry/revocation/suspension, blocked typing, subscription cleanup; align Android refreshed session reconnection before enforcing tighter expiry.

**Exit:** regressions hit actual integration paths; existing successful room/chat flows remain compatible. Compile and static checks alone do not close these entries.

## Package H5: durable messaging and effect recovery (F1/M1/M2/R1)

- Agree source-of-truth, sequence/revision/change-cursor and receipt semantics across all message creators, including forwarding and gift messages.
- Add message identity/atomic persistence + result/outbox, then account-scoped local message/command store and recovery worker. Do not add blind POST retry first.
- Add tombstone-aware sync and composite paging, monotonic read/delivery, atomic reaction set, and visible conversation read gating.
- Bind media to authorized READY attachment records and private download policy. Preserve drafts/queued work across process death and account changes.
- Worker publication remains at-least-once: preserve event ID, use bounded leases/backoff, dedupe consumer effect and reconcile gaps. Existing BullMQ push alone is not a transactional outbox.

**Exit:** blueprint T01–T09, T17, T20–T23 pass in appropriate isolated integration/device tests, including server/app crashes and lost ACK. Report any unsupported old-client behavior explicitly.

## Package H6: calls, operations and final production gates

- Add authoritative call lifecycle/device acceptance/terminal immutability/expiry, backed by provider media lifecycle and Android OS-appropriate presentation.
- Bound metrics cardinality, protect operational diagnostics, make queue retry propagation real, and add redacted trace/operation/event IDs.
- Measure query plans, capacity/latency, reconnect/load, Android builds/resources and provider failure behavior under declared workloads. Configure alerts/runbooks with real owners.
- Verify backups and restore into isolation; validate record counts, schema, ledger/capacity/message invariants and measured recovery targets.
- Rehearse additive migration and rollback with representative sanitized data and old clients before any production rollout.

**Exit:** applicable blueprint T10–T24, security/financial gates, restore and compatibility evidence recorded; all P0/P1 findings closed or explicitly block readiness. No claim of "production ready" from a successful build.

## Per-package completion record

Record requirement/finding IDs, actor and invariant, real integration call sites, before/after behavior, API/schema compatibility, migration/data preflight, actual commands/results, failed/passed failure-injection scenarios, deploy/rollback conditions, owner and residual unknowns. Update the matrix and register in the same change. A new class/configuration without executable integration is incomplete.

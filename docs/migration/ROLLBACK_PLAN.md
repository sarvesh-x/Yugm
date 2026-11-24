# Migration rollback plan (Phase 1)

**Date:** 2026-11-22
**Status:** Planning artifact. No rollback has been rehearsed and no production cutover has occurred. This plan does not authorize destructive operations, credential changes or a traffic switch. It supersedes nothing; the detailed local rehearsal sequence remains in `docs/migration/rollback-runbook.md`.

## 1. Principles

- Maintain exactly one authoritative writer per critical data domain. Uncontrolled dual writes are prohibited.
- Do not delete or disable a legacy service until its replacement is functional, integrated, tested, validated and explicitly approved for removal.
- Disabling an integration and permanently deleting its data are separate operations with separate approvals.
- Never redirect users back to stale data after new writes have landed in the authoritative store.
- Keep MongoDB, Render and other legacy services available for recovery during the documented stability period.
- Backups that have not been restored and verified are not recovery mechanisms (`docs/migration/BACKUP_AND_RECOVERY.md`).

## 2. Rollback points

| Point | State | Rollback action | Data risk |
|---|---|---|---|
| Before export | Source untouched | Abort; no rollback needed | None |
| After snapshot | Export artifacts exist | Discard snapshot directory after review | None to source |
| After dry-run transform | No target writes | Abort; inspect quarantine report | None |
| After isolated rehearsal import | Isolated D1/staging only | Recreate isolated database from snapshot | None to production |
| After validation failure | Isolated target inconsistent | Stop promotion, restore isolated target, investigate | None to production |
| Before production cutover | MongoDB still authoritative | Disable feature flag/adapter, keep last known-good snapshot | None if no dual writes occurred |
| After production cutover, before new D1 writes | D1 authoritative, legacy untouched | Restore legacy route/flag after reconciliation; verify no new writes were lost | Low if write freeze held |
| After production cutover with new D1 writes | D1 has authoritative new state | **Do not simply restore legacy.** Replay or reconcile D1 writes into legacy first, validate, then switch; requires owner approval | High |
| After legacy service disabled | Legacy integration off | Re-enable integration only from verified config; restore data from final backup if approved | High |
| After legacy data deletion | Data removed | Recovery only from verified independent backup | Very high |

## 3. Cutover sequence and rollback checkpoints

The controlled order from the directive is preserved:

1. Create final migration backups (checkpoint: verified snapshot manifest).
2. Pause or stop legacy writes (checkpoint: write freeze confirmed).
3. Drain or pause legacy background jobs (checkpoint: no in-flight duplicate producers).
4. Capture remaining database changes (checkpoint: delta export).
5. Apply final D1 synchronization (checkpoint: import validation PASS).
6. Verify record mappings (checkpoint: ID map checksum).
7. Reconcile financial records (checkpoint: wallet/ledger balance equality).
8. Verify R2 media references (checkpoint: object HEAD and checksum verification).
9. Activate authoritative Cloudflare API (checkpoint: smoke tests).
10. Activate approved realtime architecture (checkpoint: two-client parity tests).
11. Activate approved RTC architecture (checkpoint: two-participant device tests).
12. Run smoke tests (checkpoint: acceptance suite green).
13. Resume normal traffic (checkpoint: monitoring stable).
14. Resume approved background jobs (checkpoint: no duplicate rewards/notifications).
15. Monitor errors and consistency (checkpoint: agreed stability period).

At every checkpoint, failure means stop at the previous checkpoint, not continue and repair later.

## 4. Service-specific rollback

| Service | Rollback before cutover | Rollback after cutover | Removal gate |
|---|---|---|---|
| Render API hosting | Keep blueprint and disabled auto-deploy | Re-enable route/DNS to Render only after reconciling any Cloudflare writes | No production traffic to Render and validated stability period |
| MongoDB | Remains authoritative | Replay/reconcile D1 writes before treating restored MongoDB as authoritative | Data migrated and validated, no supported client dependency, approved removal |
| Redis / BullMQ | Legacy jobs continue | Drain queues; do not re-enable producers unless replacement fails and state is reconciled | No required path initializes Redis; jobs drained; approval |
| Socket.IO / Engine.IO bridge | Legacy protocol continues | Re-enable adapter only after replaying missed events from durable store | DCR-3 decision, protocol parity tests, client support window |
| LiveKit | Remains active | Re-enable tokens only for sessions not yet migrated; avoid mid-session provider switch | Realtime parity and reliability on devices |
| Local/GridFS media | Legacy URLs continue | Restore URL mapping and objects from verified backup | R2 migration manifest verified and references updated |
| Sharp in Node API | Isolated offline provider remains | Keep for local/offline tools only | No runtime path requires it; Worker bundle verified clean |

## 5. Stop conditions

Stop immediately and escalate if any of the following occurs:

- Any unaccounted source row or failed checksum.
- Any financial reconciliation failure or negative/duplicate balance.
- Any unauthorized dual write or two authoritative writers for the same domain.
- Any orphaned reference that is not explicitly approved.
- Any unexpected quarantine growth.
- Any attempt to write to production MongoDB, D1, R2, DNS or provider configuration without authorization.
- Any credential exposure or environment mismatch.
- Any production Error 1101, Worker initialization failure or essential scheduled-job failure.

Production cutover stops while Worker initialization or essential scheduled jobs are failing. See the [current release gates](implementation-plan.md#production-acceptance-and-rollback).

## 6. Financial invariants during rollback

- Never compensate a financial inconsistency by editing a balance directly; use an append-only correcting entry with an audit record.
- Refunds and reversals must be represented as compensating ledger entries.
- Conditional updates affecting zero rows must fail the enclosing operation; they must never allow later steps to succeed.
- Idempotency keys and replay protection must survive rollback; a replay after restore must not double-credit.

## 7. Verification status

No rollback step in this plan has been rehearsed against production-shaped data or deployed infrastructure. The local `migrate:rehearse` CLI has only been run against generated fixtures. A documented stability period and acceptance criteria must be agreed by the owner before legacy retirement.

## 8. Related documents

- `docs/migration/rollback-runbook.md` — detailed local rehearsal sequence.
- `docs/migration/BACKUP_AND_RECOVERY.md` — backup inventory and verification status.
- `docs/migration/BASELINE_REPORT.md` — checkpoint and observed baseline.
- `docs/migration/implementation-plan.md` — phase exit gates.

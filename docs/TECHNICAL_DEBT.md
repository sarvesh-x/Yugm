# Technical debt and recovery roadmap

This is a prioritized map into the evidence-backed audit, not a new product backlog. Confirm current status and dependencies before starting work.

## P0 — Integrity and stabilization

- Close any remaining authorization/accounting issues in the [finding register](production/findings.md); the [current progress](production/current-progress.md) records prior gift/wallet containment and remaining financial recovery/reconciliation work.
- Establish durable command identity and recovery for messaging and valuable operations.
- Prove transaction, security, and build behavior in isolated environments; production state is unverified.

## P1 — End-to-end correctness

- Shared socket authorization/session policy and durable notification recovery.
- Authoritative call state, private video permissions, and device/process lifecycle.
- Chat reconnect/read/delete convergence and account-bound local recovery.
- Event policy, invitations, lifecycle, and reliable fanout.
- Provider sandbox, reconciliation, backup/restore, and operational recovery evidence.

## P2 — Cohesive experience

- Audit and incrementally migrate frequent screens onto `:core:ui` tokens/components.
- Complete central spacing/dimension guidance; test light/dark, accessibility, and font scaling.
- Reduce oversized hot-path Kotlin functions and measure build performance before refactoring.

Detailed implementation order and gates: [production/implementation-sequence.md](production/implementation-sequence.md). The Cloudflare Worker remains an experimental scaffold per [migration audit](cloudflare-migration/audit.md).

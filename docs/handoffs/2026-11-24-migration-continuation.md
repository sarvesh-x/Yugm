# Continue the Yugm Cloudflare migration

Start from the `codex/cloudflare-migration-checkpoint` branch or a descendant of that checkpoint. The branch contains the migration work after `5a519fe`. Read `git status`, `AGENTS.md`, the docs index and the first section of `CURRENT_TASK.md` before editing. [Agent guide](../../AGENTS.md) · [Docs index](../INDEX.md) · [Current task](../CURRENT_TASK.md)

## Resume with Profile

The local D1 Profile reads, edits and first-completion effects passed. Verify Android setup and Edit Profile against the loopback Worker. Settings, Chat and Rooms follow in that order. Arcade is deferred. [Profile reads](2026-11-24-d1-profile-reads.md) · [Local D1 Profile edits](2026-11-24-d1-profile-edits.md) · [Journey order and implementation gates](../migration/implementation-plan.md#journey-order)

- **Auth evidence.** The isolated Worker ran sign-in, `/auth/me`, refresh and logout on local D1 using generated Firebase keys and in-memory limits. Shared limits, live Firebase, Worker App Check and full Android Auth parity are open. [Auth Worker handoff](2026-11-24-local-d1-auth-worker.md)
- **Navigation evidence.** The debug app on Android 17 passed a system notification tap, session validation before restored chat requests, Back to the selected Profile tab and revoked-session routing from a saved Settings stack. Live FCM is open. [Full-app Navigation handoff](2026-11-24-navigation-process-restart.md)
- **Production boundary.** MongoDB remains authoritative. Use synthetic fixtures for local parity and record their limits. Production capacity and verified recovery evidence are still missing. R2 and Realtime require approved, enforceable zero-spend limits. Resource provisioning, real data access, production import, deployment, traffic switches, dependency removal and commit/push each require their own authorization. [Budget decision](../decisions/0008-zero-spend-cloudflare-migration.md) · [Production D1 decision](../decisions/0007-dcr2-capacity-gate-not-approved.md)

## Update the record with each slice

Update the affected feature and contract references when implementation evidence changes. Keep `CURRENT_TASK.md` current with the active slice and next action, `DEVELOPMENT_PROGRESS.md` with completed work, and the migration trackers with the state of each gate. Each technical handoff should include the fixture or environment, exact commands, observed results, checks still open and the next action. Distinguish source inspection, local runtime verification, staging evidence and production acceptance. [Work log](../../MIGRATION_PROGRESS.md) · [Gate tracker](../migration/MIGRATION_PROGRESS.md)

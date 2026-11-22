# Handoff — DCR decisions and DCR-1 credential guard preparation

**Date:** 2026-11-22
**Task:** YUGM-MIGRATION-000 — record owner decisions and prepare DCR-1 remediation under the local-code-and-tests authorization.

## Owner decisions recorded

| Gate | Response | Record |
|---|---|---|
| DCR-1 | Option A — owner rotates, agent prepares; no history rewrite | [ADR-0003](../decisions/0003-credential-remediation-approach.md) |
| DCR-3 | Option C — staged hybrid (compatibility bridge + native versioned DO protocol) | [ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md) |
| DCR-5 | Local code + tests only; no commit, push, provision, deploy or data change | [ADR-0004](../decisions/0004-local-code-and-tests-authorization.md) |
| DCR-2 | D1 (earlier response) | [ADR-0001](../decisions/0001-d1-and-r2-target.md) |
| DCR-4 | No response yet | — |

## Done

- Added a value-free credential guard: `backend-server/scripts/check-tracked-secrets.mjs` and unit tests `backend-server/scripts/check-tracked-secrets.test.mjs`.
- Added npm scripts `secrets:check`, `secrets:check:strict` and `test:secrets` to `backend-server/package.json`.
- Added report-only credential-guard steps to `backend-server`'s job in `.github/workflows/ci.yml`, with a comment to switch to strict mode after rotation is confirmed.
- Recorded the decisions in `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.
- No credential value was printed, modified, rotated or removed. No secret was added to any file.

## Verification performed

- `npm.cmd run test:secrets` — 8/8 unit tests passed.
- `npm.cmd run secrets:check` — scanned 30 tracked config files; 8 findings, all in `backend-server/apps/cloudflare-worker/wrangler.jsonc`, reported by variable name and line only.
- `npm.cmd run secrets:check:strict` — exit code 1, confirming the gate will block once enabled.
- No build, deploy, provision, migration or production data operation was run.

## Remaining / next

1. Owner rotates/revokes every affected provider credential and confirms completion.
2. Remove credential-bearing `vars` from tracked `wrangler.jsonc`; configure ignored `.dev.vars*` and per-environment Wrangler secrets; verify with `git check-ignore`.
3. Switch the CI step from `secrets:check` to `secrets:check:strict` and confirm the guard reports zero findings.
4. Obtain DCR-4 R2 scope/environment inputs, DCR-3 support window and event-inventory sign-off, and DCR-2 capacity metrics plus Workers Paid.
5. Create and verify backups and rehearse a restore before any destructive migration step.
6. Continue only with local, testable slices. Commit, push, deploy, provisioning, credential rotation and data migration each require separate explicit approval.

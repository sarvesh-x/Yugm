# Handoff — OpenAPI structural guard

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — Phase 0 CI gap closure, local code and workflow only.

## Done

- Added `backend-server/scripts/check-openapi.mjs`: a dependency-free structural guard for `apps/api/openapi.yaml`. It checks the OpenAPI 3 version, required auth/media/admin paths, duplicate paths or schemas, local `#/components/...` ref targets and embedded server credentials.
- Added `npm run openapi:check` and `npm run test:openapi` scripts plus 6 unit tests in `scripts/check-openapi.test.mjs`.
- Added two steps to the backend job in `.github/workflows/ci.yml`: guard unit tests and the check against the committed spec.
- Updated `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/implementation-plan.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- `npm.cmd run test:openapi` — 6/6 passed locally.
- `npm.cmd run openapi:check` — PASS against the real spec: 90 paths, 16 schemas, 23 local refs.
- No network, credential, database, Cloudflare account, deploy or production data access. Workflow YAML was inspected manually; no CI run was triggered because nothing was pushed.

## Important limitation

This is a structural guard, **not** full OpenAPI validation. It uses regex-based inspection of a YAML subset and can miss exotic syntax. Full `swagger-cli` validation remains a manual step; adding it to CI would require a pinned dependency and network handling. The CI YAML was not parser-validated locally.

## Remaining / next

1. Owner approves commit/push if these CI steps should become active.
2. Decide whether to pin and add `swagger-cli` to CI for full validation.
3. Observe the first CI run with the new guard steps and fix any runner-only failures.
4. DCR-2/DCR-3/DCR-4 inputs, verified backups, restore rehearsal, schema approval and credential rotation remain open.

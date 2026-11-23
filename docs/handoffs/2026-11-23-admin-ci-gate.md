# Handoff — Admin CI typecheck/test/build gate

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — Phase 0 CI gap closure, local workflow change only.

## Done

- Added a separate `admin` job to `.github/workflows/ci.yml`. On push/PR to `master` it installs workspace dependencies, then runs:
  - `npm --workspace apps/admin run typecheck`
  - `npm --workspace apps/admin run test`
  - `npm --workspace apps/admin run build`
- This mirrors the admin build already performed by `.github/workflows/cloudflare-pages.yml`, but now runs on PR CI without any deploy.
- Updated `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- `npm.cmd run typecheck --workspace @yugm/admin` — passed locally.
- `npm.cmd run test --workspace @yugm/admin` — 5/5 passed locally (added later on 2026-11-23).
- `npm.cmd run build --workspace @yugm/admin` — passed locally (Vite build). Generated `dist/` changes were restored to HEAD because some dist files are tracked despite the ignore rule; no build artifacts are part of this change.
- Workflow YAML structure inspected manually. No YAML parser/actionlint was available locally, and no CI run was triggered because the change was not pushed.
- No credential, database, Cloudflare account, deploy or production data access.

## Important limitation

The admin test gate covers API-client error handling, formatting helpers and the extracted view-permission helper used by both the sidebar and the direct view guard; runtime component rendering/UI QA remains pending. Strict secret scanning remains gated on owner credential rotation; the existing credential guard in CI is still report-only. Passing local commands do not prove the GitHub Actions job will pass until it is committed/pushed and observed.

## Remaining / next

1. Owner approves commit/push if this workflow change should become active.
2. Observe the first CI run with the `admin` job and fix any runner-only failures.
3. Run runtime admin UI permission QA, plus strict secret scanning after credential rotation.
4. DCR-2/DCR-3/DCR-4 inputs, verified backups, restore rehearsal and schema approval remain open.

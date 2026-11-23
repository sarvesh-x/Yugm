# ADR-0003 — Credential remediation approach for tracked Worker config

**Date:** 2026-11-22
**Status:** Complete under Option A. Owner confirmed provider-side rotation/revocation on 2026-11-23; tracked-source removal and strict CI were committed in `d4b0510` and pushed. Owner confirmed the deployment succeeded with strict CI active. No Git history rewrite was performed.
**Decision request:** DCR-1 in [decision-request.md](../cloudflare-migration/decision-request.md).
**Evidence:** [tracked Worker credentials finding](../infrastructure/tracked-worker-credentials-finding.md).

## Decision

Adopt **Option A**:

1. The owner rotates/revokes every credential-bearing value in `backend-server/apps/cloudflare-worker/wrangler.jsonc` at its provider.
2. Credentials move to ignored `.dev.vars*` locally and Wrangler secrets or a secret manager per environment; staging and production values must differ.
3. Credential-bearing values are removed from tracked configuration.
4. A CI secret-scanning/guard gate blocks regressions before deploy.

A coordinated Git history rewrite (Option B) was **not** selected. No history has been rewritten. Option C (keep values, restrict access) was rejected.

## Owner instruction for this task

The owner selected "owner rotates, agent prepares": the owner performs provider-side rotation and secret-store changes; the agent may stage configuration and CI changes **without exposing, printing, copying or modifying secret values**. The credential guard parses tracked config text only to detect key patterns and emits variable names and line numbers; it never emits or stores an assigned value.

## Preparation performed (2026-11-22)

- Added a value-free regression guard at `backend-server/scripts/check-tracked-secrets.mjs` with unit tests at `backend-server/scripts/check-tracked-secrets.test.mjs`.
- Added npm scripts `secrets:check`, `secrets:check:strict` and `test:secrets`.
- Added report-only guard steps to `.github/workflows/ci.yml`. The strict command exists and was verified to exit 1 locally, but CI remains report-only until the owner confirms rotation.
- Verified locally (8/8 unit tests pass). The report scans 30 tracked config files and reports exactly the 8 known credential-bearing variables in the tracked local Worker config, by name and line only. No value was printed.

## Local cleanup staged 2026-11-23

- Owner confirmed that every affected provider credential was rotated/revoked and moved to ignored `.dev.vars*` / Wrangler secrets with separate staging and production values.
- Removed all secret-bearing `vars` from tracked `wrangler.jsonc` without printing, copying or storing any value. Ten secret-named keys were removed, including placeholder values.
- Added root ignore rules for `wrangler.local.jsonc` and `wrangler.*.local.jsonc`; `.dev.vars*` was already ignored. `git check-ignore` verified representative local secret-file paths.
- Switched the CI guard step from report-only `secrets:check` to blocking `secrets:check:strict`.
- `npm.cmd run secrets:check:strict` reports zero findings across 30 tracked config files.

## Completion verification

- Commit `d4b0510` containing the cleanup and strict CI guard was pushed to `origin/master`.
- Owner confirmed on 2026-11-23 that the deployment succeeded with the strict credential guard active.
- Local strict guard reported zero findings across 30 tracked config files before commit.
- No Git history rewrite was performed.

## Optional follow-up

- Broader entropy-based scanning such as gitleaks; the current guard targets the known key-name regression class only.
- Periodic owner review that staging and production credentials remain distinct and that the staging DB isolation assertion stays enforced.

Full entropy-based scanning (for example gitleaks) remains a separate follow-up; the guard targets the known key-name regression class only.

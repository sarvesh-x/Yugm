# ADR-0003 — Credential remediation approach for tracked Worker config

**Date:** 2026-11-22
**Status:** Accepted. Rotation and source removal are **pending owner action**; only preparation has been performed.
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

## Still required before the gate becomes blocking

- Owner confirmation that every affected provider credential has been rotated/revoked.
- Removal of the credential-bearing `vars` from tracked `wrangler.jsonc` and confirmation that `.dev.vars*` / Wrangler secrets are configured per environment.
- `git check-ignore` verification for local secret files.
- Confirmation that staging and production use different credentials and that the staging DB isolation assertion remains enforced.
- Switch the CI step from `secrets:check` to `secrets:check:strict`.

Full entropy-based scanning (for example gitleaks) remains a separate follow-up; the guard targets the known key-name regression class only.

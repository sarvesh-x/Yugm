# Phase 0 security finding: tracked Worker credentials

**Date:** 2026-11-22  
**Severity:** Critical, immediate remediation required before any further Cloudflare work.  
**Status:** DCR-1 Option A accepted by the owner on 2026-11-22 ([ADR-0003](../decisions/0003-credential-remediation-approach.md)). Owner confirmed provider rotation/revocation on 2026-11-23; tracked-source removal and strict CI were staged locally the same day. Changes remain uncommitted. No credential value has been printed, copied or stored by the assistant.

## Finding

`backend-server/apps/cloudflare-worker/wrangler.jsonc` is tracked by Git and is not ignored. Its `vars` block contains plaintext credentials and connection strings, including database, cache, JWT, admin, LiveKit, Razorpay and related secrets. The values are deliberately not reproduced here.

Evidence checked:

- `git ls-files --error-unmatch backend-server/apps/cloudflare-worker/wrangler.jsonc` returned the file path, confirming it is tracked.
- `git check-ignore -v backend-server/apps/cloudflare-worker/wrangler.jsonc` returned no ignore rule and exit code 1.
- Last touching commit observed: `d0b358a0021d99758317a365764221cd271300fd` dated 2026-11-20. Earlier history was not rewritten or audited in Phase 0.

This contradicts the existing [Cloudflare migration audit](../cloudflare-migration/audit.md), which says never to put secrets in source control or logs, and the repository constraint against exposing credentials.

## Impact

Anyone with read access to this repository or its history may have usable credentials. The blast radius depends on whether each value is still active and what permissions it grants. Do not assume test labels mean the values are harmless. Do not paste the values into chat, tickets, docs, logs or new configuration files.

## Required remediation before proceeding

1. Treat every value in that `vars` block as compromised. Rotate/revoke them at their providers, starting with database, cache, JWT/admin signing, LiveKit and payment credentials.
2. Replace the tracked file's secrets with non-sensitive defaults or references only. Use ignored local files for development and Wrangler secrets or a secret manager for deployed environments.
3. Add ignore rules for `.dev.vars*`, local Wrangler overlays and any credential-bearing config pattern; verify with `git check-ignore`.
4. Review Git history and decide, with explicit approval, whether history scrubbing/rotation is required. Do not rewrite shared history without authorization and coordination.
5. Confirm staging and production bindings use different credentials and that the staging database isolation assertion remains enforced.
6. Add a CI secret-scanning gate so a regression fails before deploy.

No remediation was performed in Phase 0 because rotation, secret-store changes and history rewrites require owner authorization and provider access.

## Preparation performed (2026-11-22)

Under the owner's "owner rotates, agent prepares" instruction, a value-free regression guard was added without reading or reproducing any secret value:

- `backend-server/scripts/check-tracked-secrets.mjs` — scans tracked config-like files via `git ls-files`; denylists known credential key names and sensitive suffixes; ignores placeholders, environment references, generated values and loopback endpoints. It reports **variable names and line numbers only**.
- `backend-server/scripts/check-tracked-secrets.test.mjs` — 8 unit tests covering JSONC detection, remote connection strings, placeholders, allowlisted identifiers, sensitive suffixes, CI secret references and candidate-file selection.
- npm scripts `secrets:check` (report), `secrets:check:strict` (fail on findings) and `test:secrets`.
- `.github/workflows/ci.yml` — report-only guard steps. CI stays green until the owner confirms rotation; strict mode is then enabled by switching the step to `secrets:check:strict`.

**Verification actually run:** `npm.cmd run test:secrets` passed 8/8; `npm.cmd run secrets:check` scanned 30 tracked config files and reported 8 findings, all in `backend-server/apps/cloudflare-worker/wrangler.jsonc`, by name and line only; `npm.cmd run secrets:check:strict` returned exit code 1 as designed. No build, deploy, provision or credential change was performed.

**Remediation staged 2026-11-23:** owner-confirmed provider rotation/revocation; secret-bearing `vars` removed from tracked `wrangler.jsonc` without exposing values; `.dev.vars*` ignore verified and additional local Wrangler overlay ignore rules added; CI guard switched to `secrets:check:strict`; strict guard reports zero findings across 30 tracked config files. No Git history was rewritten.

**Still required:** commit/push after explicit approval, first CI run with strict mode active, and owner confirmation in the secret store that staging/production credentials are distinct. Broader entropy-based scanning remains an optional follow-up.

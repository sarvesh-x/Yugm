# Phase 0 security finding: tracked Worker credentials

**Date:** 2026-11-22  
**Severity:** Critical, immediate remediation required before any further Cloudflare work.  
**Status:** Observed during Phase 0; no credentials were used, transmitted, rotated, removed, or provisioned.

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

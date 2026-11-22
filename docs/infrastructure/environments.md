# Cloudflare environments and operations plan

**Date:** 2026-11-22  
**Status:** Phase 0 plan. No resources were provisioned and no secrets were changed.

## Current observed state

| Environment | Worker config | Observed status |
|---|---|---|
| Local | `backend-server/apps/cloudflare-worker/wrangler.jsonc` | Experimental local development config. Its tracked `vars` block contains plaintext credentials; see [finding](tracked-worker-credentials-finding.md). |
| Staging | `backend-server/apps/cloudflare-worker/wrangler.staging.jsonc` | Deployed prototype at `https://yugm-api-staging.sarveshkumar10101.workers.dev`. Admin at `https://yugm-admin-staging.pages.dev`. Uses isolated `YugmStaging` MongoDB name, staging LiveKit project, `STAGING_DB_ISOLATED=true`, and restricted admin-origin CORS. |
| Production | `backend-server/apps/cloudflare-worker/wrangler.production.jsonc` | Source config only. Runtime deliberately refuses `YUGM_STAGE=production`. No production cutover has been authorized. |

Pushes to `master` currently deploy only to Cloudflare staging according to the existing [migration audit](../cloudflare-migration/audit.md); the Render blueprint is retained for rollback with automatic deploy disabled.

## Target environment rules

### Isolation

- Each environment has separate Cloudflare account resources where the account permits it: Worker name/environment, D1 database or PostgreSQL database/schema, R2 buckets, KV namespaces, queues, Durable Object namespaces, LiveKit project, Firebase project/config, payment credentials and admin users.
- Staging must never point at production databases, buckets, queues or provider projects. The existing `STAGING_DB_ISOLATED` flag is an operator assertion, not a technical guarantee.
- Development uses local simulation or disposable remote resources. A local Worker with remote bindings can still write real data; verify binding targets before any command that mutates state.
- Production secrets are never copied down for staging or local debugging.

### Bindings

Wrangler config is the source of truth for non-secret bindings and environment selection. Planned binding categories:

| Binding | Use | Notes |
|---|---|---|
| D1 database or Hyperdrive config | Authoritative relational state | Choice blocked by [capacity assessment](../database/d1-capacity-assessment.md). Use database name rather than binding name in migration commands where supported to avoid targeting the wrong resource. |
| R2 buckets | Assets, public media, private media, originals, staging | Do not omit IDs in config; Wrangler can auto-provision. Verify target bucket before any write/delete. |
| Durable Object namespaces | Realtime/stateful coordination | SQLite-backed classes; use Wrangler migrations; scope IDs by conversation/room/user as designed. |
| Queues | Async producers/consumers | Separate producer and consumer bindings; configure DLQ, retries and batching deliberately. |
| KV namespaces | Non-critical cache/config only | Never for financial or ownership state. |
| Service bindings | Internal Worker-to-Worker calls | Prefer over public `fetch()` for same-account Workers. |
| Secrets | JWT/admin signing, provider credentials, webhook secrets | Deployed via Worker secrets/secret manager; local via ignored `.dev.vars*`. |

Environment inheritance must be checked explicitly. Some Wrangler fields do not inherit from the top level into named environments; a working default config does not prove staging or production bindings are correct.

### Domains, DNS, HTTPS and CORS

- Use distinct API and admin origins per environment. Record exact domains only after provisioning approval; do not invent IDs or zone records.
- Enforce HTTPS and HSTS where applicable. Verify certificate issuance before routing traffic.
- Configure CORS as an explicit allowlist. Current production prototype uses `CORS_ORIGIN=*`; that is not acceptable for admin/private operations in the target design.
- Cloudflare Access or equivalent protection should be considered for non-public admin tooling and preview URLs.
- DNS/traffic cutover requires explicit approval; keep the legacy rollback path until validation passes.

### Secrets

- Treat all current values in the tracked local Worker config as compromised and rotate them at their providers before proceeding.
- Remove secrets from tracked files. Add and verify ignore rules for `.dev.vars*`, local Wrangler overlays and credential-bearing configs.
- Use interactive/protected-file secret input, not command-line arguments or chat.
- `wrangler secret put/delete` is a deployment operation; use staged version-secret workflows when a change needs review.
- Never log tokens, credentials, private content, object keys containing sensitive data, or signed URLs.

### Local development

- Run project-local Wrangler through existing npm scripts so the pinned version is used.
- Use local D1/R2/KV/DO simulation for normal development; mark explicitly when a command targets remote resources.
- Use disposable MongoDB or test databases for compatibility harnesses. The existing realtime test creates a loopback-only in-memory replica set and must never be pointed at user data.
- Generate Worker types with the project's `wrangler types` command after config/binding changes; do not hand-edit generated declarations.

### Observability and cost controls

- Enable structured logs and issues in staging and production. Keep redaction on for query strings and sensitive headers.
- Add correlation IDs from API requests through queues, DO events and admin audit logs.
- Monitor Workers CPU/memory/subrequests, D1 rows read/written and storage, DO requests/duration/hibernation, R2 class A/B operations and storage, queue retries/DLQ/backlog, KV operations, and provider quotas.
- Configure account spending limits and billing alerts before production. Free-plan limits are for prototypes only.
- Use `wrangler deploy --dry-run` with the intended config as a packaging check. A dry run does not prove remote bindings or runtime behavior.

## Approval gates

Stop and request explicit approval before:

1. Creating or changing paid Cloudflare resources or upgrading the plan.
2. Rotating, moving or deleting credentials in provider accounts.
3. Creating production DNS records, routes, custom domains or traffic cutovers.
4. Applying production database migrations, imports, deletes or R2 lifecycle rules.
5. Deploying production Worker/admin code or changing release channels.
6. Rewriting Git history to remove exposed credentials.

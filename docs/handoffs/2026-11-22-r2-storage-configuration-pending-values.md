# Handoff: R2 backend configuration pending owner values

**Date:** 2026-11-22  
**Status:** Unfinished; storage is still unconfigured. No credentials, buckets, domains, deploys or production data were changed.

## What was done

- Extended `backend-server/apps/api/src/scripts/check-env.ts` to list all 11 `R2_*` keys and validate R2/S3 configuration whenever `STORAGE_DRIVER=s3`. Output contains key names and set/blank status only, never values.
- Documented the configuration procedure in [R2 centralized media](../features/r2-centralized-media.md#configuration-procedure): ignored local `.env`/`.dev.vars`, Wrangler secrets for deployed environments, Cloudflare-side prerequisites and verification steps.
- Recorded the task in `docs/CURRENT_TASK.md` (YUGM-R2-002) and `docs/DEVELOPMENT_PROGRESS.md`.

## Verification performed

- `npm.cmd run env:check`: passed with the existing local config; all R2 keys reported `MISSING`.
- Same command with a temporary `STORAGE_DRIVER=s3` override: exit 1 with four storage problems naming the missing endpoint, credentials, all five buckets and public URL.
- `npm.cmd run typecheck --workspace apps/api`: passed.
- `git diff --check`: clean apart from pre-existing LF/CRLF notices.

No R2 request, bucket operation, credential change, migration or deploy was performed.

## What the owner must supply

Write values into the ignored local files yourself; do not paste secrets into chat, tracked config, CI logs or analytics.

1. `backend-server/apps/api/.env` (local Node API) and/or `backend-server/apps/cloudflare-worker/.dev.vars` (local Worker):
   - `STORAGE_DRIVER=s3`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_ASSETS_BUCKET`
   - `R2_PUBLIC_MEDIA_BUCKET`
   - `R2_PRIVATE_MEDIA_BUCKET`
   - `R2_ORIGINALS_BUCKET`
   - `R2_STAGING_BUCKET`
   - `R2_ASSETS_PUBLIC_URL`
   - `R2_MEDIA_PUBLIC_URL`
2. Confirm the target environment (local API, local Worker or staging) and that the five buckets already exist with the required CORS/public-domain setup.
3. For deployed environments, set token secrets interactively via Wrangler secrets; do not add them to tracked `vars`.

## Next agent action

1. Confirm the files are populated without reading or reproducing values.
2. Rerun `npm.cmd run env:check`, API unit/integration tests and typecheck.
3. Only after the owner authorizes the environment: switch `STORAGE_DRIVER` where required, deploy, and run a live create→PUT→complete→download→cancel cycle with signed URLs kept out of logs.

## Constraints

Do not invent account IDs, bucket names, credentials or domains. Do not provision paid resources, change credentials, deploy, apply migrations or touch production media without explicit approval. Phase 0 remains unaccepted and its decision gates are unchanged.

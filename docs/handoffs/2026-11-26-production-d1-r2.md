# Production D1 and R2 deployment

Cloudflare deployment `21db6b26-431a-4022-88c9-3f115c855d1a` runs `yugm-api-production` with the hosted `yugm` D1 database and five existing R2 buckets. Applied migrations `0003`–`0041`. Wrangler listed zero pending migrations and a read-only D1 query returned 41 migrations, 118 cosmetics, eight gifts and zero users. The owner confirmed there is no legacy production data to transfer. [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

The repository removes the Render blueprint and the default Node start command. `npm run deploy` and `npm run deploy:production` target the Cloudflare production Worker. Explicit legacy staging and development commands retain their separate configuration. Previously provisioned external services were outside the repository change. Android release uses `YUGM_PRODUCTION_ORIGIN`; missing settings and the known legacy staging or Render hosts resolve to the reserved placeholder for local builds. Tagged CI requires a valid production origin and upload signing before publishing.

## Remaining production inputs

- Replace `YUGM_PRODUCTION_ORIGIN` in `apps/cloudflare-worker/wrangler.production.jsonc` with the public Cloudflare HTTPS origin and attach that hostname to the production Worker. Set the same origin for Android release and use its `/api/admin` path for the production Pages build.
- Configure the Firebase project and App Check settings, Worker signing secrets and the separate media grant secret. Credential names and placeholders are documented in the [production setup guide](2026-11-24-production-cloudflare-builds.md).
- Verify live `/ready` reports `storage: "d1"` and `managedMedia: true`, then exercise authentication and a managed R2 upload. Live realtime and RealtimeKit client acceptance remain separate.

## Checks run

- `npm run d1:setup:production`, the hosted migration list and read-only catalog query passed.
- Wrangler listed all five configured R2 buckets. `npm run deploy:dry-run:production`, `npm run deploy:production` and the production Worker fixture passed.
- `:app:generateDebugBuildConfig` and `:app:generateReleaseBuildConfig` passed with bounded Gradle workers. The generated debug URL used emulator loopback, and the generated release URL used the placeholder with the old staging setting present.
- A tagged `:app:assembleRelease --dry-run` rejected the old staging URL before building an APK.
- The Worker was deployed with public ingress disabled and the origin placeholder in place. Live requests and signed Android artifacts were outside these checks.

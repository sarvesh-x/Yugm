# Backend Server

This directory is the standalone server project. It contains the Node.js API, admin app, shared TypeScript package, npm workspace, and Docker Compose services.

## Development

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```

## Cloudflare migration

The target is Cloudflare Workers and Pages on the free plan. The API Worker is an experimental compatibility scaffold and is not ready for production; see the [migration audit](../docs/cloudflare-migration/audit.md) for the remaining work and acceptance gates. The [Pages admin guide](apps/admin/CLOUDFLARE_PAGES.md) describes the separate staging and production builds.

The existing hosting configuration is retained solely for the current deployment and rollback until the replacement has passed staging and the cutover is approved. Do not use the Worker scaffold with production data or switch DNS yet.

See the repository [README](../README.md) and `docs/` for configuration and architecture details.

# Backend Server

This directory is the standalone server project. It contains the Node.js API, admin app, shared TypeScript package, npm workspace, and Docker Compose services.

## Development

```bash
npm install
npm run dev
```

## Cloudflare migration

The default development command applies pending migrations to the local `yugm` database, then starts the D1/R2 Worker on port 4000. Use `npm run dev -- --persist-to <path>` to keep using an existing emulator D1/R2 directory. Prepare Firebase test settings and the local signing secret as described in the [emulator runbook](../docs/handoffs/2026-11-24-local-d1-auth-emulator.md). Run `npm run audit:d1-endpoints -- --missing` to check route coverage. [Current cutover status](../docs/CURRENT_TASK.md)

Production uses the Cloudflare Worker with hosted D1 and R2. Run `npm run deploy:production` to deploy it and `npm run d1:setup:production` when applying pending hosted schema migrations. The deployed Worker needs a public production hostname and its Firebase and signing credentials before it can serve the release clients. [Production startup](../docs/handoffs/2026-11-26-production-d1-r2.md) · [Pages admin guide](apps/admin/CLOUDFLARE_PAGES.md)

The legacy Node API is available for development through `npm run dev:api` and has separate MongoDB configuration. `npm run deploy:staging` explicitly deploys the legacy staging Worker.

See the repository [README](../README.md) and `docs/` for configuration and architecture details.

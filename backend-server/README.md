# Backend Server

This directory is the standalone server project. It contains the Node.js API, admin app, shared TypeScript package, npm workspace, and Docker Compose services.

## Development

```bash
npm install
npm run dev
```

## Cloudflare migration

The default development command applies pending migrations to the local `yugm` database, then starts the D1/R2 Worker on port 4000. Use `npm run dev -- --persist-to <path>` to keep using an existing emulator D1/R2 directory. Prepare Firebase test settings and the local signing secret as described in the [emulator runbook](../docs/handoffs/2026-11-24-local-d1-auth-emulator.md). Run `npm run audit:d1-endpoints -- --missing` to check route coverage. [Current cutover status](../docs/CURRENT_TASK.md)

Production uses one Cloudflare Worker with hosted D1 and R2. The production GitHub workflow checks both Worker entrypoints, applies pending D1 migrations, and deploys `yugm-api-production`. The deployed Worker needs a public production hostname and Firebase and signing credentials before it can serve the release clients. [Worker setup](apps/cloudflare-worker/README.md) · [Pages admin guide](apps/admin/CLOUDFLARE_PAGES.md)

The legacy Node API is available for compatibility tooling through `npm run dev:api` and has separate MongoDB configuration. Local emulator development uses `npm run dev` and the D1/R2 Worker.

See the repository [README](../README.md) and `docs/` for configuration and architecture details.

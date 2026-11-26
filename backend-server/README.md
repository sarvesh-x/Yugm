# Backend Server

This directory is the standalone server project. It contains the Node.js API, admin app, shared TypeScript package, npm workspace, and Docker Compose services.

## Development

```bash
npm install
npm run dev
```

## Cloudflare migration

The default development command applies pending migrations to the local `yugm` database, then starts the D1/R2 Worker on port 4000. Use `npm run dev -- --persist-to <path>` to keep using an existing emulator D1/R2 directory. Prepare Firebase test settings and the local signing secret as described in the [emulator runbook](../docs/handoffs/2026-11-24-local-d1-auth-emulator.md). Run `npm run audit:d1-endpoints -- --missing` to check route coverage. [Current cutover status](../docs/CURRENT_TASK.md)

The target is Workers Free, D1, R2, Firebase and RealtimeKit, with the admin app on Pages. The legacy Node API still runs via `npm run dev:api` with its separate MongoDB and environment configuration. Hosted verification, recovery and legacy-data transfer remain prerequisites for switching traffic. [Pages admin guide](apps/admin/CLOUDFLARE_PAGES.md)

See the repository [README](../README.md) and `docs/` for configuration and architecture details.

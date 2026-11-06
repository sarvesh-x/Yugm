# Backend Server

This directory is the standalone server project. It contains the Node.js API, admin app, shared TypeScript package, npm workspace, and Docker Compose services.

## Development

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```

## Deploy to Render

The repository includes a Render Blueprint at [`../render.yaml`](../render.yaml). Create a Blueprint in Render from this repository and provide `MONGODB_URI` when prompted. The Blueprint generates persistent JWT and payout-encryption secrets, builds the admin panel and API, and checks `/health` after deployment.

The API can start without Redis or third-party credentials; those features stay unavailable until their environment variables are configured. The default local upload storage is ephemeral on Render, so configure `STORAGE_DRIVER=s3` and the `S3_*` variables before relying on uploaded media in production.

Render uses the Node range declared in `package.json` (`>=22.18.0 <25`). The lower bound includes Node's built-in TypeScript stripping support used by the shared workspace package.

See the repository [README](../README.md) and `docs/` for configuration and architecture details.

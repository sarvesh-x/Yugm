# Cloudflare Pages admin deployment

The hosted admin is a static Pages site connected to `yugm-api-production`. The **Cloudflare Pages admin** workflow runs manually and deploys the website. The **Cloudflare production API** workflow deploys the Worker separately.

In the `cloudflare-production` GitHub environment, set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, and `YUGM_ADMIN_API_URL`. The last value must be the production Worker HTTPS origin followed by `/api/admin`. Set `CLOUDFLARE_PAGES_READY=true` once the API and Pages project are ready. Give the `CLOUDFLARE_API_TOKEN` environment secret permission to deploy the Pages project. Set `ADMIN_PANEL_ORIGIN` on the Worker to the exact HTTPS origin of the admin site.

For local development, run `npm run dev` and `npm run dev:admin` from `backend-server`. The Vite app runs on port 5173 against the local D1/R2 Worker on port 4000. The [D1 admin setup](../../../docs/handoffs/2026-11-25-d1-admin-auth-and-media.md) covers the first admin account and Firebase settings.

# Cloudflare Pages admin deployment

The admin app can be built as a static Cloudflare Pages site. It needs a
separately deployed, validated YUGM API; this project does not proxy to another
backend. Nothing in this file provisions resources or changes production DNS.

Pushes to `master` run the **Cloudflare staging** workflow.
It tests the backend, deploys the staging Worker, verifies the staging database
health, and uploads the admin build to `yugm-admin-staging`. Set the
`CLOUDFLARE_ACCOUNT_ID` variable and `CLOUDFLARE_API_TOKEN` secret in the
`cloudflare-staging` GitHub environment, with deployments restricted to that
branch. The token needs permission to deploy the staging Worker and Pages
project. The Worker retains its existing runtime secrets in Cloudflare.

Current release/production endpoints:

- API: `https://yugm-api-staging.sarveshkumar10101.workers.dev` (Android uses `/api`)
- Admin: `https://yugm-admin-staging.pages.dev`

## Prepare separate environments

1. Create two Pages projects on Cloudflare's Free plan: one for staging and one
   for production. Set `main` as each project's production branch. Do not turn
   on Pages Git integration for these projects when using the workflow below;
   the workflow uses direct uploads and is intentionally manual during the
   migration.
2. Configure GitHub environments named `cloudflare-staging` and
   `cloudflare-production`. Protect the production environment with required
   reviewers before using it. GitHub environment protection availability
   depends on the repository and GitHub plan.
3. In each environment set these **variables** to values belonging only to
   that environment:
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
   - `CLOUDFLARE_PAGES_PROJECT`: the corresponding Pages project name.
   - `YUGM_ADMIN_API_URL`: HTTPS Worker URL ending in `/api/admin`.
   - `CLOUDFLARE_PAGES_READY`: `true` only after that environment's API and
     Pages project have passed the checks below.
4. Add the environment secret `CLOUDFLARE_API_TOKEN` with permission to deploy
   Pages projects. Never put this token or backend secrets in Vite variables.
   The API URL is public and is embedded in the JavaScript bundle.
5. Allow the exact Pages origin in the corresponding API's `CORS_ORIGIN` and
   configure `ADMIN_PANEL_ORIGIN` if the API uses it. Keep the staging API and
   its database separate from production.

Dispatch **Cloudflare Pages admin** for `cloudflare-staging` after the staging
Worker is working. The workflow builds with `VITE_ADMIN_BASE_PATH=/` and deploys
to that Pages project. It does not deploy the API. Sign in and check admin
navigation, API authorization, refresh, uploads, and browser CORS using staging
accounts. Record the Worker and Pages versions and results.

Only after the full migration acceptance checks succeed, enable the production
environment, select `cloudflare-production`, check the staging confirmation,
and obtain the configured environment approval. A successful Pages upload is
not a production API cutover. Follow the migration cutover and rollback plan
before changing production traffic.

For local development the default base remains `/admin/`; the existing Node
deployment continues to serve that path. To inspect the Pages build locally:

```sh
cd backend-server
VITE_ADMIN_BASE_PATH=/ VITE_ADMIN_API_URL=https://your-staging-worker.example/api/admin npm run build:admin
```

Free Pages limits apply. If usage exceeds a free allowance, availability may
be affected. Do not upgrade the Cloudflare plan as part of this migration.

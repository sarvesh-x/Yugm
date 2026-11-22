# Admin, infrastructure and CI/CD audit

**Date:** 2026-11-22  
**Status:** Phase 0 read-only source audit. No build, test, deploy, migration, secret change or runtime request was performed. Paths are relative to the repository root unless stated otherwise.

## 1. Scope

Inspected the admin SPA, Cloudflare Worker configuration, Render blueprint, GitHub Actions workflows, environment/secret handling and the relationship between admin routes and server-side RBAC. Existing project documentation was used as background; current source remained authoritative. No secret values are reproduced.

## 2. Admin application

### 2.1 Build and configuration

`backend-server/apps/admin` is a React 18 + Vite 5 + TypeScript SPA using `lucide-react`.

| File | Relevant facts |
|---|---|
| `package.json` | Scripts: `dev`, `build` (`tsc && vite build`), `preview`, `typecheck`. There is **no test or lint script**. |
| `vite.config.ts` | `base` comes from `VITE_ADMIN_BASE_PATH` (default `/admin/`); dev proxy maps `/api` to `http://127.0.0.1:4000`. Deploy workflows set `VITE_ADMIN_BASE_PATH=/` when publishing to Pages root. |
| `.env.example` | Only two build-time values: `VITE_ADMIN_API_URL` and `VITE_ADMIN_BASE_PATH`. No server secrets should ever enter `VITE_*` variables. |
| `src/api.ts` | `API_BASE` defaults to `/api/admin`; adds `Authorization: Bearer <token>`; parses the `{ success, data, meta, error }` envelope. |
| Session handling | Uses `sessionStorage` key `yugm.admin.session`, removes a stale `localStorage` key, refreshes every 12 minutes, and handles a 2FA challenge in login. |

### 2.2 Navigation and reusable components

`src/App.tsx` defines 29 navigation items across Control, Safety, Money, Operations, Intelligence and System groups. Only nine set `requiredPermission`; these guards hide navigation links. `ViewRenderer` does not itself check permissions, so direct view state is not blocked by UI gating. Server-side RBAC remains the real boundary.

Reusable UI already lives inline in `App.tsx`: `ResourceFrame`, `SimpleResource`, `DataTable`, `Drawer`, `Panel`, `StatusBadge`, `RiskBadge`, `ProfileSummary`, `ReviewDetail`, `StatsCard`, `MiniSignal`, `LoadingState`, `ErrorState`, `EmptyState`, `useResource` and `useResourceWithMeta`. New admin screens should reuse these rather than the stale `src/components/Navigation.tsx` and `src/components/LoginScreen.tsx`, which are unused by `App.tsx` and omit assets, badges and reactions.

### 2.3 Management gaps

Several server operations exist but have no corresponding admin action or a read-only view:

- Profile approval/rejection/verification/photo-control routes exist in `admin.ts`; no dedicated profile review view exposes them.
- Withdrawal and payment verification/credit/refund routes exist; payments and suspicious wallets are read-only from the UI.
- Room feature/lock/remove-user/mute/ban routes exist; room and PK views expose only limited actions.
- Moderation queue assign/escalate/dismiss/resolve/action routes exist; the queue view is read-only.
- Message delete/restore and restrict/unrestrict routes exist; room messages are read-only.
- Fraud review and config deletion have no UI action.
- Admin user invite and list exist, but role/status/permission editing is not exposed.

This is a migration planning input: the centralized asset/media admin tooling must either reuse the existing component patterns or justify a new pattern; it must not introduce a second admin shell.

### 2.4 2FA

`SettingsPage` implements TOTP setup, QR display, verification, disable and status. `requireTwoFactor` in `middleware/adminAuth.ts` is applied to a small set of high-value operations such as user ban and wallet adjust/freeze, not globally. `docs/admin-system.md` still describes mandatory 2FA as pending. Confirm the intended policy before migration; do not silently strengthen or weaken it during infrastructure work.

## 3. Admin API mounting, RBAC and audit

`backend-server/apps/api/src/app.ts` mounts admin routers in this order:

```text
/api/admin  adminVerificationRouter
/api/admin  adminDmReviewsRouter
/api/admin  adminRouter
/api/admin  adminSupportRouter
/api/admin  adminCosmeticsRouter
/api/admin  adminAssetsRouter
/api/admin  adminBadgesRouter
/api/admin  adminReactionsRouter
```

`adminRouter` installs `requireAdminAuth` partway through the file. Because Express middleware order is global to the mounted app, the routers mounted after `adminRouter` rely on that earlier `adminRouter.use(requireAdminAuth)` to populate `req.admin`; `requirePermission` then fails closed with 401 if `req.admin` is absent. This is a fragile implicit dependency, not an auth bypass, but reordering the mounts would break several admin routers. The verification and DM-review routers are mounted before the guard and enforce their own auth/permissions.

`middleware/adminAuth.ts` verifies HS256 admin access JWTs, active admin status and an unrevoked/unexpired `AdminSession`, then populates `req.admin`, `req.adminSessionId` and computed permissions. `modules/admin/permissions.ts` defines 47 permissions and eight roles. Superadmins bypass permission checks.

Write-route audit coverage is thorough but uses three helpers: `services/adminAudit.ts` (`auditLog()`), `services/auditLog.ts` (`recordAuditLog()`) and direct `AdminAuditLog.create()` in `adminSupport.ts`. High-value money actions are audited, including wallet adjustments/freezes, manual dual approval for large adjustments, payment credit/refund and withdrawal transitions. Many sensitive reads are not individually audited; if compliance requires attributable bulk PII/chat export, add that in a separate reviewed change.

A functional issue was observed: `GET /api/admin/progression/health` is registered before the router-level `requireAdminAuth`, with no earlier middleware setting `req.admin`, so `requirePermission("analytics.read")` returns 401. It appears dead rather than exposed. Confirm at runtime and fix separately.

## 4. Cloudflare Worker configuration

| File | Observed state |
|---|---|
| `wrangler.jsonc` | Local prototype config. Contains plaintext credential-bearing `vars`; tracked and not ignored. See [the critical finding](tracked-worker-credentials-finding.md). |
| `wrangler.staging.jsonc` | Deployed staging prototype. Non-secret vars; `MONGODB_DB_NAME=YugmStaging`; staging-only CORS; secrets expected outside source. |
| `wrangler.production.jsonc` | Source-only. `MONGODB_DB_NAME=Yugm`; `STORAGE_DRIVER=mongodb`; `CORS_ORIGIN=*`; runtime refuses production startup. |

The Worker uses one SQLite-backed Durable Object (`API_SERVICE` / `YugmApi`) with a global ID. It has no D1, R2, queue, KV or Cron binding. Maintenance and PK deadlines run through Durable Object alarms rather than a `scheduled()` handler. See [the Worker prototype audit](worker-prototype-audit.md).

Observability is enabled for staging logs/issues, with traces disabled and query-string redaction disabled. Review query strings for PII before carrying this configuration into production. The production wildcard CORS value must be replaced by an explicit allowlist.

## 5. Render and container deployment

`render.yaml` declares the legacy `yugm-api` web service:

- Root: `backend-server`.
- Build: `npm ci --include=dev && npm --workspace apps/api run build`.
- Start: `npm start`.
- Health check: `/health`.
- Auto-deploy is off.
- Generated secrets include JWT/admin/refresh/KYC-encryption values.
- Operator-supplied values include FCM, LiveKit, Google Play and MongoDB credentials.
- Fixed values include `NODE_ENV=production`, `TRUST_PROXY=1`, token TTLs, `APP_CHECK_ENFORCE=true`, `FCM_PROJECT_ID` and `GOOGLE_PLAY_PACKAGE_NAME`.

`GOOGLE_PLAY_PACKAGE_NAME` in Render is `com.example.yugm`, while the production Worker config uses `com.yugm.app`; reconcile this before any subscription entitlement cutover.

Render does not declare `CORS_ORIGIN`/`ADMIN_PANEL_ORIGIN`, `REDIS_URL`, R2 variables, Razorpay keys or `DEV_BYPASS_OTP`. The uncommitted R2/media work would require new Render secret wiring if that host remains in the rollout path.

`backend-server/Dockerfile` and `docker-compose.yml` are present but are not the active Cloudflare path.

## 6. CI/CD workflows

| Workflow | Trigger and behavior |
|---|---|
| `.github/workflows/ci.yml` | Push/PR to `master`. Runs backend `npm ci`, typecheck, unit tests with dummy `MONGODB_URI`, hardening, Worker staging dry-run, Worker realtime test against isolated MongoDB, and Android lint/unit tests/assemble. Admin is typechecked via workspace `typecheck` but not built or tested in PR CI. |
| `.github/workflows/cloudflare-staging.yml` | Push to `master` in the `cloudflare-staging` environment. Runs typecheck/unit/hardening/realtime, builds admin with staging API URL and root base path, deploys the Worker, then gates on `/health` asserting `ok`, DB readiness, `YugmStaging` name and storage readiness before deploying Pages admin and checking it. |
| `.github/workflows/cloudflare-pages.yml` | Manual `workflow_dispatch` with staging/production target and explicit production validation checkbox. Gates on `CLOUDFLARE_PAGES_READY`, all Cloudflare vars, HTTPS admin API URL ending `/api/admin`, rejection of `.onrender.com` and rejection of embedded credentials. Deploys only the Pages admin. |
| `.github/workflows/android-release.yml` | Tag-triggered signed APK using keystore secrets. Builds against staging Worker URLs. Release lint is disabled in Gradle. |

The staging deploy gate is useful evidence but is not a full migration acceptance gate. Add secret scanning, admin build/tests, OpenAPI validation and migration-specific checks before production work.

## 7. Deployed versus source-only state

Per source configuration and dated docs:

- Staging Worker and staging admin are deployed at the documented Cloudflare URLs.
- Production Worker is source-only and deliberately disabled.
- Production admin Pages deployment is manual and gated; no production deploy is documented in this audit.
- Render is declared with auto-deploy off; no current deploy was proven here.
- R2, D1, Queues, KV and Cron are not provisioned or bound.
- Production database, DNS, webhooks and traffic are unchanged according to the historical migration audit.

## 8. Migration implications

1. Remove and rotate the tracked credentials before any further Cloudflare work.
2. Make admin auth order-independent by applying explicit guards to each admin router.
3. Fix or remove the dead `progression/health` route.
4. Add admin build/test and secret-scanning CI gates.
5. Preserve the existing admin component patterns when adding asset/media tooling.
6. Use explicit per-environment CORS allowlists and redact query strings in production observability.
7. Reconcile the Google Play package-name difference before entitlement cutover.
8. Keep the production Worker guard until migration acceptance checks actually pass.

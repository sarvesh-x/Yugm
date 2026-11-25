# D1 admin route coverage, setup and verification

The D1 Worker mounts all 215 legacy admin HTTP patterns. This change adds the final 81 admin patterns and badge and reaction art delivery. Across the Worker, 534 legacy HTTP patterns match and 104 remain outside admin. Run `npm run audit:d1-endpoints -- --missing` from `backend-server` for the route inventory.

## Environment setup

Both environments use the D1 database name `yugm` with separate binding IDs. Apply the ordered migrations for the intended environment before creating the first admin. Migration `0031` adds uniqueness for normalized admin email, Firebase UID and invitation tokens. Migration `0032` restores managed asset version uniqueness. Migration `0033` separates dashboard and app-user report reviewers. Migration `0034` adds the durable refund journal. Resolve any existing duplicates before applying the new uniqueness constraints.

The recovered emulator state at `apps/cloudflare-worker/auth-local/.wrangler/local-sign-in-2026-11-24` was backed up and migrated through `0034`. Wrangler reports no pending migrations. The integrity-checked SQLite backup is in the adjacent ignored `.wrangler` directory. Use that same state path with `npm run dev -- --persist-to <local-state-path>` from `backend-server`. This database currently has zero active admin accounts. Use the bootstrap SQL to set up the first local dashboard login.

Generate bootstrap SQL from `backend-server` with `npm run --silent d1:admin:sql -- local` or `npm run --silent d1:admin:sql -- production`. Set `YUGM_BOOTSTRAP_ADMIN_EMAIL` in the process environment. For local D1, set `YUGM_BOOTSTRAP_ADMIN_PASSWORD`. For hosted D1, provision the Firebase email/password account first and set `YUGM_BOOTSTRAP_FIREBASE_UID` to its exact UID. The generator only outputs SQL, and the SQL inserts the initial super admin only when `admin_users` is empty. Keep generated SQL containing a local password hash outside source control. Review the target and apply the file using Wrangler with its corresponding `--local` or `--remote` option.

Configure the hosted Worker with these settings. Keep the actual values in Wrangler secrets or the deployment environment configuration.

| Setting | Value |
| --- | --- |
| `ADMIN_PANEL_ORIGIN` | `https://<admin-pages-domain>` |
| `ADMIN_FIREBASE_WEB_API_KEY` | The Firebase Web API key for `FCM_PROJECT_ID`, used for the existing dashboard email/password form |
| `ADMIN_JWT_SECRET` | A dedicated access signing secret. The Worker can also use its existing `JWT_SECRET` |
| `ADMIN_REFRESH_SECRET` | A dedicated refresh signing secret. If omitted, the admin access secret is used |

The hosted Worker verifies Firebase tokens and resolves an explicit D1 Firebase UID link. Existing password-only admin rows must be linked to the intended Firebase accounts during cutover. New hosted invitations that provision Firebase accounts require Firebase Auth account creation access for the service account. Local credentials stay local. Two-factor challenges are single-use, logout revokes D1 sessions, and password changes revoke existing sessions. The admin app continues using its existing login form.

## Admin behavior

- Managed assets are staged privately in R2 and published as immutable full and preview variants. The D1 registry gates publication and archive. Clearing a cosmetic or badge reference allows archive. Badge and reaction uploads also use R2.
- Media registry, upload sessions, quota reservations and reconciliation use read-only D1 queries. Upload tokens and signed URLs stay server-side.
- Wallet adjustments use an atomic balance, ledger and audit batch. The dashboard retains the idempotency key on retry. Both the current and legacy wallet paths require a stored admin session with two-factor setup. The older path still accepts `direction` and returns the legacy envelope. Amounts of 10,000 coins or more require a different admin with wallet-adjust permission and an active session.
- Trust review and creator KYC use D1 records. The admin API masks payout fields and serves existing face and voice uploads only from private R2 with a matching D1 submission and an audited media permission check. Legacy media still needs to be copied into that bucket. The user-facing submission routes are outside this checkpoint.
- DM review reads and mutations are scoped to the selected message or explicit chat pair. Older chat queue entries without an identifiable pair require review before deletion. PK force-end persists abort and close events and clears the active room pointers. Clan chat cleanup deletes messages and reactions together. Legacy Socket.IO fan-out is still outside the D1 Worker.
- Recharge verification and credit use provider proof or an already verified paid record. Refunds reserve ledger balance in D1 before provider submission. Razorpay uses the same idempotency key on retry. Google Play retries read order state after submission. A refund with an ambiguous provider response stays pending until it can be reconciled. The D1 journal records the original reason and the provider reference.
- Payout review and withdrawals use synchronized D1 state changes. Mark-paid records an already processed Razorpay payout for a positive cash amount. Use the withdrawal ID or `wd_<withdrawal-id>` as the provider reference when arranging the payout, then submit its `pout_…` ID. A provider ID already stored on the review can also be verified. Finance operators arrange transfers through the existing payout provider.
- Matches analytics counts creation of D1 match rows over the requested period. Retention reports UTC registration cohorts with observed D1 session creation or last-use on days 1, 7 and 30. Each row includes the eligible and returning user counts.

## Verification

- The route audit reports 215 mounted admin patterns and zero unmatched admin patterns.
- Workspace type checks, the admin build to a temporary folder and all nine admin unit tests passed.
- The isolated local Worker suite covers admin sessions, 2FA, permissions, R2 image lifecycle, wallet replay, review scope, verified payout recording, refund replay and PK force-end. The production-entrypoint suite verifies migration setup, Firebase password sign-in with a provider fixture, Pages preflight and authenticated reads.
- Bootstrap SQL generation passed for both modes with disposable credentials.
- Hosted D1 migration, admin account linking, private-media copy and live end-to-end checks are pending. Keep the legacy backend available for the unmatched non-admin routes during cutover.

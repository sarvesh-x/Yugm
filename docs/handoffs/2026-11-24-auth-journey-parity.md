# Local Auth journey parity

The existing Express app and the isolated D1 candidate used the same Auth route handlers. The fixture compared MongoDB and D1 through loopback HTTP using Firebase-issued token shapes signed with local fixture keys. The default API selects MongoDB. [Auth router](../../backend-server/apps/api/src/routes/auth.ts) · [Local D1 router](../../backend-server/apps/api/src/migration/d1AuthRouter.ts)

- Verified Google and phone claims linked to the same Yugm IDs on both stores. Facebook signup returned the same starter wallet and incomplete-profile state, and email verification updated the existing account. A new verified identity could reclaim an email from a pending-deletion fixture while the retired account kept its balance. An unverified email was denied.
- The restored account's complete `GET /api/auth/me` response matched, including wallet and level fields, nested avatar and cosmetics values, explicit nulls, ordered arrays, and the server-confirmed profile flag. The serializer excluded the Firebase UID and phone. D1's reader reuses Mongoose casting and defaults in memory for this response. [Profile reader](../../backend-server/apps/api/src/migration/d1AuthAccounts.ts)
- Two Firebase identities racing to link the same legacy email produced one accepted linkage and one conflict in the D1 fixture. The candidate rejects a phone lookup when both normalized and legacy aliases belong to different accounts. This makes ambiguous candidate matches an explicit conflict for review. [Identity rules](../../backend-server/apps/api/src/services/authAccounts.ts)
- Refresh and logout ran through both routers. A caller could remove their own registered device, and the other user's registration survived. D1 groups device deletion, generation advance and session revocation in one batch. [D1 session adapter](../../backend-server/apps/api/src/migration/d1AuthSessionStore.ts) · [D1 batch behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- The draft `users` table has 100 columns. The initial schema extension exceeded the limit in the local runtime. The one-to-one `user_auth_profile` table stores explicit-null metadata and keeps profile query projections below D1's result-column limit. The importer retains signed VIP EXP for frozen accounts and surfaces uniqueness conflicts. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

## Verification

From `backend-server`, the API suite ran with `NODE_ENV=test`, `YUGM_RUNTIME=cloudflare`, a loopback-only fallback database URI, and empty Redis and Firebase Admin credentials. The test fixtures controlled their own connections.

```powershell
npm.cmd exec --workspace @yugm/api -- tsx --test --test-concurrency=4 "src/**/*.test.ts"
npm.cmd run typecheck --workspace @yugm/api --workspace @yugm/cloudflare-worker
npm.cmd run schema:d1 --workspace @yugm/api
```

All 505 API tests and both workspace typechecks passed. The generator produced 147 tables from 97 roots with zero import failures. The candidate fixture applied the complete draft to a fresh local D1 binding. From the repository root, `node backend-server/scripts/production-inventory.cjs` and `git -c core.safecrlf=false diff --check` passed.

## Rollout boundary

This closes the local Auth journey milestone and advances the local work to Navigation. Live Firebase and Android devices, Worker-isolate wiring, D1 recovery and capacity, idle outbound socket revocation, and production cutover remain open. Account registration and logout were tested using fixtures. The FCM provider's live delivery and the legacy profile-write alias are outside the D1 Auth fixture. [Access and revocation evidence](2026-11-24-auth-access-revocation.md) · [Navigation baseline](2026-11-24-navigation-baseline.md)

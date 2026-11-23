# Handoff — Explicit admin router auth guards

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — Phase 0 admin auth hardening, local code and tests only.

## Done

- Added `router.use(requireAdminAuth)` to five admin routers that previously relied on `adminRouter`'s late catch-all guard:
  `adminAssetsRouter`, `adminBadgesRouter`, `adminCosmeticsRouter`, `adminReactionsRouter` and `adminSupportRouter`.
- Left `badgeArtRouter` intentionally public; only `adminBadgesRouter` is guarded.
- Added `backend-server/apps/api/src/routes/adminRouterGuards.test.ts` with 5 tests that mount each router alone and assert `401` for an unauthenticated request.
- Updated the backend source audit, Phase 0 report, admin deployment audit, private-media authorization audit, feature matrix, task/progress docs and the earlier private-media handoff to remove the stale mount-order finding.

## Verification performed

- Targeted guard tests — 5/5 passed.
- Full API suite — 395/395 passed.
- Hardening suite — 34/34 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- No credential, database, Cloudflare account, deploy or production data access. These changes are uncommitted.

## Important limitation

The unauthenticated tests prove each router fails closed when mounted alone. Two follow-up tests in `adminRouterJwtReachability.test.ts` prove that a signed super-admin JWT is accepted by `requireAdminAuth` and that each formerly dependent router carries an explicit guard layer while the public badge-art router does not. They do **not** execute the real route handlers under a valid JWT, nor do they cover the admin SPA's component rendering; its extracted view-permission helper is now covered by 4 separate tests. Effective permissions and routes were not changed. Routers mounted after `adminRouter` now run `requireAdminAuth` twice in normal `createApp()` flow; this is correctness-preserving but adds a small per-request JWT/DB lookup.

## Remaining / next

1. Add a valid-JWT reachability test for every mounted admin router.
2. Keep the public badge-art router public during any mount reordering.
3. Add admin SPA tests and strict secret scanning after credential rotation.
4. DCR-2/DCR-3/DCR-4 inputs, verified backups, restore rehearsal and schema approval remain open.
5. Commit/push of this slice requires separate explicit authorization.

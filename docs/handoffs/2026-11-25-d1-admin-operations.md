# D1 admin operations

The shared D1 Worker now mounts 134 of 215 legacy admin patterns. This change adds 59 patterns to the admin core checkpoint. Across the entire Worker, 452 of 638 legacy patterns match and 186 remain.

| Area | Added | Behavior |
| --- | ---: | --- |
| Dashboard, progression, analytics, fraud and referrals | 23 | Reads come from D1. Fraud review refreshes the persisted safety status and records the admin action. System health reports D1 readiness. The overview retains the legacy zero values for average resolution time, pending withdrawal totals and daily refunds. |
| Finance | 15 | Wallet and recharge lookup, provider revenue, failed purchases, refund audit history, gift earnings, withdrawals and payout reviews. The recharge response includes order references and balances. Provider signatures, purchase tokens and raw provider metadata stay server-side. |
| Gifts | 7 | List, detail, create, update, activate, deactivate and delete. Mutations and audit writes use D1 batches. Deletion deactivates gifts referenced by purchase history or another catalog record. |
| Cosmetics | 6 | List, detail, CRUD and insertion of missing default items. Asset references must resolve to a published asset owned by the cosmetic. |
| Notifications | 8 | Immediate sends and manual campaign creation, reading, sending and cancellation. D1 writes inbox rows and its existing trigger enqueues device delivery. Campaign send and status update commit together, so a repeat request does not create duplicate inbox rows. Legacy scheduling stores a planned date. Automatic scheduled sending and open or click tracking require separate work. |

Admin campaign counters track inbox records created, consistent with legacy dispatch counts. Firebase delivery and device preferences are handled by the existing Worker push job. Custom campaign audiences support exact matches on city, role, VIP tier and verification status. Drafts with unsupported MongoDB filters require review before sending. A city audience requires an explicit city. In the admin app the custom audience form exposes its city filter.

## Verification

- `npm run audit:d1-endpoints` reports 457 Worker patterns, 452 matched legacy patterns, 186 remaining and 81 remaining admin patterns. Use `npm run audit:d1-endpoints -- --missing` for the exact list.
- `npm run typecheck` passed for admin, API, Worker and shared workspaces.
- `npm run test:auth-worker --workspace @yugm/cloudflare-worker` passed against isolated D1 and R2. The fixture covers route access, filtered reads, payment credential omission, gift audit and deletion behavior, cosmetic asset ownership, audience targeting and campaign send replay.
- `npm run test:production-worker --workspace @yugm/cloudflare-worker` passed its isolated production entrypoint fixture. The fixture applies the full migration directory, verifies the admin guard, and exercises dashboard, payment, gift, cosmetic and campaign reads with a stored admin session.
- `npm run test --workspace @yugm/admin` passed all nine tests.
- `npm run build:admin` passed.
- Hosted admin sign-in, browser interaction and production data were outside these checks. This change introduces no D1 migration.

## Remaining admin cutover work

- D1-native dashboard sign-in, refresh, 2FA, invitation and admin account management. Admin endpoint fixtures currently start with signed sessions. Keep the existing access controls and verify sign-in through the dashboard before cutover.
- Wallet changes, recharge verification, credit and refunds, and withdrawal and payout transitions. Verify authorization, replay and provider outcomes against the authoritative ledgers.
- Trust verification and creator KYC, protected media and asset staging and publication, badge and reaction management, DM review, clan chat cleanup, PK administration, and the legacy user-role moderation endpoints.
- The legacy matches and retention analytics endpoints return constant empty arrays. Their D1 metrics need definitions before they can be counted as implemented.
- Verify the remaining hosted migration sequence and matching admin permissions before live smoke tests. Keep the legacy backend available for admin flows while those dependencies remain.

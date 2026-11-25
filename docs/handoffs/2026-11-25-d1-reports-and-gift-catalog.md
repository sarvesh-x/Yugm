# D1 reports and gift browsing

The debug and production Worker entrypoints share these ten mounts.

| Routes | Behavior |
| --- | --- |
| `POST /api/reports` and `POST /api/rooms/:id/report` | Store reports, capture bounded evidence and create queue entries in one transaction. The existing policy issues one 12-hour mute when a target reaches three distinct reporters within 24 hours and has no active mute. Room reports check private-room access and both routes share the report rate limit. |
| `GET /api/admin/reports`, `GET /api/admin/reports/:reportId`, `GET /api/admin/users/:userId/reports`, and `GET /api/admin/rooms/:roomId/reports` | Require the staff `reports.read` permission. They expose evidence to staff with that permission. The detail route returns queue, related reports and any existing safety record. |
| `GET /api/gifts`, `GET /api/gifts/v2`, and `GET /api/gifts/collections` | Serve the existing D1 gift catalog and collection data. Catalog reads exclude inactive, expired and Bonds-only items, and v2 supports category, rarity and pagination. |
| `GET /api/inventory` | Returns only the caller’s owned gift items with quantity, upgrade level and upgrade cost. |

Report submission responses return a receipt without evidence, staff notes or other users’ review data. This closes the legacy exposure of evidence in submission responses while retaining the response fields the Android client uses. The staff detail route reads the existing D1 safety snapshot. Staff moderation actions still need migration.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both fixtures. They cover private-room permission, evidence privacy, distinct reporters, concurrent auto-mute, rollback, shared rate limiting, staff permission, catalog filters, collection order and inventory ownership.
- API and Worker `typecheck` scripts and `git diff --check` passed.
- `npm run audit:d1-endpoints -- --missing` reported 638 legacy patterns, 226 D1 patterns, 221 shared and 417 legacy-only. Room routes are at 58 out of 59. The remaining room route is `POST /api/rooms/:id/send-gift`.
- Applied `0017_report_review_indexes.sql` and `0018_gift_catalog_indexes.sql` to the recovered local `yugm` emulator database. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

Room gift transfers, manual report actions, hosted deployment and Android UI verification remain open.

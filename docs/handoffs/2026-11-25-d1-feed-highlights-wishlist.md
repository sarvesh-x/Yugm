# D1 feed, highlights, comments and wishlist routes

## Scope

Mounted the next small D1 HTTP slices on 2026-11-25: feed, gift leaderboard, story-comment deletion, inventory trade refusal, story highlights and wishlist. MongoDB remains authoritative for all other surfaces. No deploy, hosted migration, seed or hosted data operation was performed.

## Routes added

| Surface | Patterns | Notes |
| --- | ---: | --- |
| `GET /api/feed` | 1 | Accepted friends plus followed hosts, merged live rooms, active stories and room activities. |
| `GET /api/gift-leaderboard` | 1 | `period`, `skip` and capped `limit`; sender and receiver aggregates. |
| `DELETE /api/comments/:commentId` | 1 | Owner-only delete and story `reply_count` adjustment. |
| `POST /api/inventory/trade` | 1 | Validation then the legacy fail-closed `409`. |
| `/api/highlights` | 6 | Create, list by user, update, delete, append stories and remove one story. |
| `/api/wishlist` | 5 | Add, list by user, own list, delete and send. |

The audit now reports `legacy 638 / d1 242 / matched 237 / missing 401`.

## Behavior notes

- **Feed.** Friend IDs are the union of accepted friendship rows from either side. Followed IDs are added only for live rooms; stories require accepted friends. The feed keeps 30 recent activities, 10 active friend stories and 10 live friend/followed rooms ordered by participant count, merges them as `FRIEND_LIVE`, `FRIEND_STORY` and `ACTIVITY`, orders by `createdAt` descending and slices to 50.
- **Leaderboard.** Daily, weekly and monthly boundaries use server-local midnight/week-start/month-start like the legacy handler. Results are grouped by sender and receiver, ordered by summed coins then ID, and the limit is clamped to 1–50.
- **Comment delete.** Ownership is checked first. `story_comments.parent_id` is a self reference without `ON DELETE` behavior, so D1 deletes the selected comment and its replies in one batch and decrements `reply_count` by the number removed. The legacy `deleteMany({ _id, parentId: _id })` removed only the top-level row, leaving the replies orphaned while still decrementing by `1 + reply count`. The D1 form keeps the visible thread and counter consistent rather than reproducing the dangling rows.
- **Inventory trade.** Zod validation runs before authentication, matching the legacy `validateBody` mount. Invalid target or item IDs return the legacy messages; a valid request always returns the legacy `409` because no offer/accept workflow exists.
- **Highlights.** Story links are stored in `story_highlight_stories`; deleting a highlight removes links before the parent. Story replacement preserves legacy ordering. `coverMediaUrl` is the first story's media URL at creation time.
- **Wishlist.** The legacy router declares `/wishlist/:userId` before `/wishlist/me`, so the parameterized route captures `me`; the D1 router keeps that order and does not silently redefine the contract. Sending a wishlist item debits the sender, credits the receiver with `creatorShare`, adds the receiver `charm_exp` equal to the gift value, records the gift transaction and deletes the item in one guarded D1 batch. Insufficient funds return `402 INSUFFICIENT_FUNDS`. Migration `0020_wishlist_unique.sql` adds the `(user_id, gift_id)` uniqueness that the MongoDB model already declares.

## Legacy-only by design

`GET /api/badge-art/:id/:version` is not mounted. Badge bytes still live in the legacy `Achievement.imageData`/`imageMime` document; D1 retains `image_url` and `asset_ref` as provenance. Porting it requires the separately approved R2 badge-blob cutover.

## Files

- `backend-server/apps/api/src/migration/d1Feed.ts`
- `backend-server/apps/api/src/migration/d1StoryPresentation.ts`
- `backend-server/apps/api/src/migration/d1Stories.ts`
- `backend-server/apps/api/src/migration/d1Highlights.ts`
- `backend-server/apps/api/src/migration/d1Wishlist.ts`
- `backend-server/apps/api/src/migration/d1Rooms.ts` (`readD1LiveRoomsForHosts`)
- `backend-server/apps/api/src/migration/d1GiftCatalog.ts` (leaderboard and trade)
- `backend-server/apps/api/src/migration/d1App.ts` (mounts)
- `backend-server/apps/api/migrations/d1/0020_wishlist_unique.sql`
- `backend-server/apps/cloudflare-worker/test/d1-feed.mjs`
- `backend-server/apps/cloudflare-worker/test/d1-highlights.mjs`
- `backend-server/apps/cloudflare-worker/test/d1-wishlist.mjs`
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs`

## Verification (run)

- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed (both configs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — 1/1 passed. The fixture covers feed auth, friend stories/rooms/activities, leaderboard totals, period filtering and paging, comment ownership and reply-count semantics, trade validation and `409`, highlight ownership and ordering, wishlist privacy, duplicate rejection, insufficient funds, the guarded transfer, ledger rows, `charm_exp`, item deletion and the `/wishlist/me` shadowing.
- `npm.cmd run audit:d1-endpoints` — 237 shared / 401 legacy-only; `/api/inventory` 2/0, `/api/highlights` 6/0, `/api/wishlist` 5/0, `/api/feed` 1/0 and `/api/gift-leaderboard` 1/0.

## Not run / open

- Full API suite, production Worker fixture, push queue suite, production dry-run bundle, Android journeys, hosted migrations, live payments, FCM, realtime fan-out and data import.
- D1 has no realtime emitter for feed, gift, comment or wishlist side effects. Wishlist send matches the legacy absence of a notification but is not broadcast.
- Hosted `0003`–`0020` remain unapplied. The local recovered database remains at `0019` until the owner applies `0020`.
- MongoDB remains authoritative. Do not deploy, apply hosted migrations, import production data or retire MongoDB without explicit authorization.

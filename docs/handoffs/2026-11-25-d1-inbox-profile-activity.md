# D1 inbox mutations and profile activity

## Routes

| Method and path | D1 behavior |
| --- | --- |
| `PUT /api/users/messages/:userId/:messageId` | Sender-only edit of text within 15 minutes, with conversation access and moderation checks. |
| `POST /api/users/messages/:userId/forward` | Copies visible text messages into an eligible conversation. Private attachments return HTTP 415 until the destination's access grants can be created. |
| `POST /api/users/messages/:userId/delete-selected` | Hides selected messages for the caller or deletes the caller's own messages for everyone. |
| `DELETE /api/users/messages/:userId/:messageId` | Deletes the caller's own message and clears its reactions, hidden markers, and excerpts in existing replies. |
| `POST /api/users/messages/:userId/:messageId/reactions` | Toggles or replaces one reaction per user and message, checks VIP eligibility, and respects notification mutes. |
| `GET /api/users/:id/stats` | Returns hosted and live room counts. |
| `GET /api/users/:id/visitors` | Lists visible profile visitors for an authenticated owner with active VIP access. |
| `POST /api/users/me/feedback` | Creates a support ticket and its initial message in one D1 batch. Feedback categories map to the existing support categories in `d1ProfileActivity.ts`. |

Migration `0035_direct_message_reaction_catalog.sql` expands stored reaction IDs to accept the managed catalog and enforces uniqueness per message and user. It keeps the newest row for each duplicate pair. Inbox mutations persist for subsequent history reads. Live inbox edits, reactions, and deletions still need the Cloudflare event-delivery path.

## Verification

- `npm run typecheck` passed.
- `npm run test:auth-worker --workspace @yugm/cloudflare-worker` passed. The fixture covers all eight routes, including message ownership, hidden messages, private attachment rejection, VIP checks, and feedback ticket visibility.
- `npm run test:production-worker --workspace @yugm/cloudflare-worker` passed against the production entrypoint fixture.
- `npm run audit:d1-endpoints` reported 548 D1 patterns, 542 of 638 legacy patterns matched, and 96 remaining. All 215 admin patterns are still mounted.
- Backed up the recovered emulator's `yugm` D1 database to `auth-local/.wrangler/d1-before-0035-20261125151207.sqlite` and verified the backup with SQLite `quick_check`. Applied `0035` with `npm run d1:setup:local -- --persist-to <recovered-state-directory>`. Wrangler reported no pending migrations afterward.

Live hosted acceptance, Android emulator interaction with the eight new routes, private attachment access grants, and live inbox event delivery remain open. The latest recorded hosted migration is `0002`. Use `npm run audit:d1-endpoints -- --missing` from `backend-server` for the remaining route inventory.

# D1 room invitations

`POST /api/rooms/:id/invites` now writes the pending invite, room activity, inbox notification, push jobs and `ROOM_INVITE:<roomId>` chat message in one D1 transaction. Active participants in a live room can invite one or more accounts. The whole request is rejected if a recipient is unavailable or blocked in either direction. Repeat sends reuse the pending invite ID and deliver a fresh notification and chat message, matching the legacy client behavior. [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

`POST /api/rooms/invites/:inviteId/respond` updates a pending invite for its recipient only. Accept returns the existing room ID. Decline removes that invite's access to the private room, and the join transaction rechecks private-room access before creating a participant.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker fixtures. The invite fixture covered mute and block checks, rollback, repeated sends, recipient authorization, inbox and chat reads, push job enqueueing, decline and accepted private-room join.
- `npm run typecheck --workspace @yugm/cloudflare-worker` and `git diff --check` passed.
- `npm run audit:d1-endpoints` reported 205 D1 patterns and 200 shared with legacy. There are 438 legacy-only patterns, including 12 room routes.
- Applied `0012_room_invite_index.sql` to the recovered local emulator database `yugm`. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

The existing Android room invite card and notification use these routes and payloads. Android UI acceptance, live Firebase delivery, realtime room and chat fan-out, hosted migration and deployed API verification remain open.

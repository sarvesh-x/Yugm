# D1 room messages

- `POST /api/rooms/:id/messages` stores moderated chat for active participants in live rooms, using the existing Worker chat rate limit. The message and any eligible chat XP commit in one transaction. Legacy room chat applied XP as a separate asynchronous side effect. Chat photo URLs keep the existing VIP 4 rule.
- `POST /api/rooms/:id/messages/direct` sends guest messages to the host and lets the host address an active participant. It rechecks membership and blocking on the write, then commits the message, inbox notification and eligible progression. The existing inbox shows the room ID, and the public room chat history excludes direct messages.
- Migration `0014_room_message_progression.sql` adds a persistent daily cap for room DM relationship XP and indexes room chat history. The room DM cap is 80 XP per pair per UTC day and produces 8 XP per eligible send. Ordinary inbox sends retain their separate cap.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker fixtures. Coverage includes public history, private inbox delivery, host routing, membership and block checks, moderation, photo URL entitlement, XP rollback, and concurrent direct sends at the cap.
- API and Worker `typecheck` scripts and `git diff --check` passed.
- `npm run audit:d1-endpoints` reported 638 legacy patterns, 210 D1 patterns, 205 shared and 433 legacy-only, including eight remaining room paths.
- Applied `0014` to the emulator’s recovered local `yugm` database. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

The room photo picker still uses the legacy upload entrypoint. Managed R2 uploads for chat attachments, live chat broadcasts, Android UI verification and hosted production verification remain open.

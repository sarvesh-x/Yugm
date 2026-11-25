# D1 room polls

The debug and production Worker entrypoints share four room poll routes. `GET /api/rooms/:id/polls` lists the last ten polls for active participants with room access. Hosts and platform admins can create and close polls in live rooms. Active participants can vote once. Poll creation records room activity in the same transaction. The vote and tally also commit together. [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

D1 computes the existing 45-second deadline from the creation time, so requests enforce it across Worker restarts. Scheduled maintenance records expired polls in batches of up to 100 and uses the deadline as the recorded close time. Migration `0011_room_poll_indexes.sql` indexes room history, voter lookup and the expiry sweep without rewriting imported poll rows.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both fixtures. The poll fixture checked private access, host controls, activity, concurrent votes, transactional rollback, manual close and the 45-second deadline. The Cron fixture verified that an expired poll closes and a fresh poll stays open.
- `npm run typecheck --workspace @yugm/cloudflare-worker` and `git diff --check` passed.
- `npm run audit:d1-endpoints` reported 203 D1 patterns, 198 shared with legacy and 440 legacy-only. The room group has 45 mounts with 14 pending.
- Applied `0011` with `npm run d1:setup:local -- --persist-to <recovered-local-state>` to the recovered emulator database named `yugm`. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

The existing Android client can refresh polls on room load and after its own actions. Cross-client delivery of the poll and room activity events still needs the D1 realtime publisher. Hosted application of the migration, deployed route acceptance, and Android UI testing remain open. MongoDB retirement still depends on the rest of the API and data cutover.

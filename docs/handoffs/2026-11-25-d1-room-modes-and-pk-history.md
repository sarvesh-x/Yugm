# D1 room modes and PK history

The debug and production Worker entrypoints share these routes.

| Method and path | Behavior |
| --- | --- |
| `GET /api/rooms/modes` | Returns the existing five-mode catalog. |
| `POST /api/rooms/:id/mode` | Lets the host or an admin select a mode with enough distinct players in a live room. |
| `GET /api/rooms/:id/mode-state` | Returns the room's stored game state for viewers with room access. |
| `POST /api/rooms/:id/mode/action` | Handles start, next round, answer, dare, vote and finish. Host controls and player membership are checked in the write. Both nested action data and the installed Android client's top-level fields are accepted. |
| `POST /api/rooms/mode/random` | Returns live public rooms, preferring the selected mode when it has candidates. |
| `GET /api/rooms/:roomId/pk-history` | Returns ended and force-ended battles with their scores and sides. A battle is visible only when both rooms are accessible to the viewer. |

Migration `0015` adds the score map used by the existing import mapping and a revision for concurrent updates. New rounds clear previous answers and dares, and finishing clears the room's mode while preserving the game record. Migration `0016` indexes ended battles by room and indexes participants used by history.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both fixtures. They cover room-mode authorization, concurrent creation, votes and answers, round changes, discovery, and PK history visibility and response shape.
- API and Worker `typecheck` scripts and `git diff --check` passed.
- `npm run audit:d1-endpoints -- --missing` reported 638 legacy patterns, 216 D1 patterns, 211 shared and 427 legacy-only. The room group has 57 of 59 patterns. Room report and gift submission remain.
- Applied `0015_room_mode_state.sql` and `0016_pk_room_history_indexes.sql` to the recovered emulator database, `yugm`. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

Realtime room-mode broadcasts, live PK battle flows, hosted deployment and Android UI verification remain open.

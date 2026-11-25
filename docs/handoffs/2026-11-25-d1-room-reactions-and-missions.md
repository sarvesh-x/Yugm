# D1 room reactions and missions

- `GET /api/reactions` serves the existing reaction catalog with optional authentication. The Worker fills missing defaults and backfills empty legacy emoji without replacing operator labels, assets, order or disabled settings.
- `POST /api/rooms/:id/reactions` records reaction activity for active participants in live rooms. It checks chat restrictions, current catalog availability, and active VIP level 3 or higher for VIP reactions. The success payload reflects the stored activity.
- `GET /api/rooms/:id/missions` returns the three existing progress measures for reactions, gifts and active participants. Counts stop at each mission target. The route now checks room access before returning private-room progress. The gift count reflects stored gift activity while D1 room gift submission is still pending.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both fixtures. Checks covered anonymous catalog access, preservation of edited and disabled entries, frozen and expired VIP denial, active VIP access, chat restrictions, membership, private-room access and mission count caps.
- API and Worker `typecheck` scripts and `git diff --check` passed.
- `npm run audit:d1-endpoints` reported 638 legacy patterns, 208 D1 patterns, 203 shared and 435 legacy-only, including 10 remaining room paths.
- Applied `0013_room_activity_indexes.sql` to the emulator’s recovered local `yugm` database. The running debug Worker returned 16 reactions for an anonymous request, with 12 usable. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

The Android client reads the same catalog and mission payloads. Realtime reaction broadcasts, hosted deployment and runtime acceptance, and Android UI testing remain open.

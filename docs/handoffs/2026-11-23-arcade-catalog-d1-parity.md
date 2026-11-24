# Handoff — Local D1 parity for Arcade catalog

**Date:** 2026-11-23

The first D1 read adapter is exercised through the existing `GET /api/games/catalog` handler. Default startup still uses MongoDB. The [D1 adapter](../../backend-server/apps/api/src/migration/d1GameCatalog.ts) reads indexed best/recent scores. The [draft DDL](../../backend-server/apps/api/migrations/d1/0001_initial.sql) and mapper preserve wire-only legacy fields and field presence. A disposable database made with the earlier draft needs source reimport to recover values the old mapping omitted.

## Evidence

- [One shared HTTP fixture](../../backend-server/apps/api/src/routes/gamesCatalog.characterization.test.ts) passed against both providers. It seeds two users and 267 scores, runs source mapping and batched import into the full draft D1 schema, and compares HTTP auth errors, game/best-score selection, scoped recent history and serialized legacy fields. It checks that score records in both stores are unchanged after the calls.
- Wrangler `getPlatformProxy` uses a temporary config, ephemeral persistence and disabled remote bindings. D1 reported 10 rows read for best scores, 10 for recent scores and zero rows written by the read. `size_after` was 1,601,536 bytes for the complete local draft schema and fixture. These are local binding measurements. They do not establish account quota usage, production dataset size, peak throughput or Worker CPU and latency.

## Verification

- `npm.cmd exec --workspace @yugm/api -- tsx --test src/routes/gamesCatalog.characterization.test.ts` passed.
- `npm.cmd run test --workspace @yugm/api` passed 468/468 with loopback test settings.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` passed the Worker entry and API runtime typechecks.
- `npm.cmd run openapi:check` and `git diff --check` passed.

Next, characterize the notification entry point before local Queues wiring and exercise D1 beyond this read slice with characterized score writes and a larger isolated workload. No deployed Worker, remote D1 binding, Android device or production data was exercised. DCR-2, verified recovery and production cutover remain separately gated.

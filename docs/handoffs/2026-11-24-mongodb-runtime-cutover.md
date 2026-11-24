# MongoDB runtime cutover status

`npm run dev` starts the Android debug Worker on port 4000 with local D1 and R2. Both the debug Worker and the production-target Worker bundle without Mongoose, the MongoDB driver, or BSON. Auth and Profile now construct their responses from D1 rows. Legacy Firebase device lookup, Mongo-specific errors and the Mongo session store stay with legacy callers. The shared season rules run without the Season model. The isolated Worker tests check the actual Wrangler bundle manifests. [Cloudflare local bindings](https://developers.cloudflare.com/workers/local-development/#bindings-during-local-development)

## Routes migrated

- All 23 legacy `/api/clans` method and path patterns now have a D1 handler. This slice adds role changes, member removal, clan deletion, chat history, sends, reactions, message deletion, chat cleanup and reports. The write batches recheck membership or role and preserve related records together. Chat inbox notices are persisted in D1. Clan realtime events, Firebase push delivery, and review of D1 reports from the admin panel remain open.
- The Auth profile compatibility endpoint reuses the D1 Profile transaction and returns the Auth profile contract. VIP users can read or update chat privacy and the mysterious-visitor setting through D1. Updates recheck the active session and VIP snapshot.

## Remaining dependencies

| Runtime or tool | Current boundary |
| --- | --- |
| Android debug and D1 release target | The implemented routes run without MongoDB. The release config still has a placeholder origin and needs live Firebase, D1, and R2 acceptance. The hosted migration list shows `0003`, `0004` and `0005` pending for `yugm`. |
| Legacy staging Worker | The staging configuration uses `YugmStaging` and MongoDB-backed storage. The default-branch staging workflow still deploys it and the existing admin panel depends on it. |
| Legacy Node/Render and admin | `npm run dev:api`, `npm start` and `render.yaml` use the legacy API. The Node runtime still opens a MongoDB connection for application state and background jobs. All 215 admin API patterns still need D1 implementations. |
| Migration and legacy verification | The source snapshot exporter, schema generator and Mongo comparison fixtures still use MongoDB models or the driver. The legacy source is needed for an export and reconciled import if it holds data to retain. |

`npm run audit:d1-endpoints -- --missing` lists exact methods and paths. It reports 112 shared and 526 legacy-only patterns out of 638. Major gaps include 215 admin, 46 rooms, 23 users, 22 PK, 20 social, 16 Bonds and six wallet patterns. The mount count covers HTTP only. Realtime delivery, RealtimeKit admission and Android RTC, FCM, scheduled maintenance, payments and account lifecycle still need verification or implementation before the legacy service can be retired.

To retire MongoDB safely, port the remaining active workflows and jobs, rehearse export/import and restore with reconciled account, wallet, membership and media records, and verify the actual release origin and Android journeys against hosted D1 and R2. After cutover, remove MongoDB from the legacy deploy paths and retire the driver from offline tooling when the ability to read the legacy source is no longer required.

## Verification

- Both isolated D1 Worker fixtures passed. The local fixture exercised clan role permission checks, membership removal, invite cancellation, history paging, chat writes, reactions, reports, cleanup and rollback after an injected deletion failure. It also exercised the Auth profile alias and VIP settings.
- Workspace typechecks and 551 backend tests passed. Staging and production Worker dry runs passed. The bundle manifest checks and the API route audit passed. The report-only Worker config checker still flags query-string redaction in staging and production.
- `npm run d1:setup:local` applied `0005_clan_chat_indexes.sql` to local `yugm`. The local migration list showed zero pending migrations. `npm run dev` started the D1 Worker on port 4000, and the emulator received HTTP 200 at `/ready` and HTTP 401 for anonymous clan history.
- Wrangler's read-only remote migration list confirmed the three pending migrations on hosted `yugm`. Live authenticated Android, deployment, data transfer and hosted route acceptance remain open.

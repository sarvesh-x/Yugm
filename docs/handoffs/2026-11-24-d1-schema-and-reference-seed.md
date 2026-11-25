# D1 schema and reference catalog setup

The counts below record the initial setup. The recovered emulator database later reached `0019`. Hosted application after `0002` remains unverified. [Current schema and coverage checkpoint](2026-11-25-d1-route-coverage-checkpoint.md)

Both Wrangler configurations bind `AUTH_DB` to a database named `yugm`. Android debug uses the local simulation. The production config points to the existing hosted database. Both configurations load the same versioned SQL under `backend-server/apps/api/migrations/d1`. [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

## Run setup

From `backend-server`:

```powershell
npm.cmd run d1:setup:local
npm.cmd run d1:setup:production
```

Wrangler records applied versions in `d1_migrations`. An environment with a custom local persistence directory needs the same `--persist-to <directory>` for setup and `dev:auth`. The production command uses the production config and `--remote`. [Emulator setup](2026-11-24-local-d1-auth-emulator.md)

`0001_initial.sql` creates the application schema. `0002_reference_catalogs.sql` inserts cosmetics, achievements, achievement tiers and gifts from the same definitions as the legacy seed. Missing rows are inserted using stable catalog identities. Existing catalog prices, stock, IDs and overrides are preserved. Catalog asset references retain the current product definitions. Accounts, wallets, room state, provider credentials, and media imports are separate operations. Reconcile legacy gift and achievement catalog IDs against these reference rows during any future import rehearsal so historical references keep resolving.

Use `npm.cmd run d1:seed:sql` to render SQL from the current catalog definitions. Review changes and place additions in a new numbered migration. `npm.cmd run schema:d1 --workspace @yugm/api` writes its model-derived draft to a temporary directory for review. Keep applied SQL files immutable.

## Verified targets

The following counts record the schema and seed setup. The emulator has since applied the direct-message index migration. [Current messaging migration](2026-11-24-d1-direct-conversation.md)

| Check | Local emulator database | Hosted production D1 |
| --- | ---: | ---: |
| Applied migration versions | 2 | 2 |
| Application tables in the tracked schema | 148 | 148 |
| Cosmetics | 118 | 118 |
| Achievement definitions, including honors | 13 | 13 |
| Achievement tiers | 35 | 35 |
| Gifts | 8 | 8 |

- A disposable Wrangler database applied both migrations and reported zero pending migrations on rerun. The replay test preserved a customized achievement, an edited cosmetic price and remaining limited-edition stock.
- The existing emulator database was backed up under `auth-local/.wrangler/backups` before setup. The user count was one before and after the migrations. The emulator Worker passed `/ready` against the seeded database.
- The hosted preflight reported zero application tables. After setup, all 148 tables from the checked-in schema were present, no migrations were pending, and `PRAGMA foreign_key_check` returned no violations. Hosted users and admins remain at zero.
- `npm.cmd test` passed 551 backend tests. Both Worker integration suites, workspace typechecks, the reference seed test and the tracked credential scan passed.

## API progress

The shared D1 Worker now handles `GET /api/dating/matches` and `GET` and `PUT /api/dating/preferences`. Match reads preserve the existing lazy creation of relationships and their participant rows. The fixtures cover blocked partners, concurrent match reads, account-scoped preferences and preference validation.

The mount audit counts 93 shared and 545 legacy-only method/path patterns out of 638 legacy patterns. Remaining work includes room lifecycle, Bonds, direct-message delivery, and admin. The live API still needs its configured origin and provider secrets, along with separate deployment and end-to-end verification. The D1 setup operated on database bindings only. [Production Worker inputs](2026-11-24-production-cloudflare-builds.md)

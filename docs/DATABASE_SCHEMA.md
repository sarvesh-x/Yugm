# Database schema map

The backend uses MongoDB through Mongoose. Model definitions are in `backend-server/apps/api/src/models/`; startup migration/index logic is in `src/config/migration.ts` and related services. Shared runtime contracts are separate from persisted schema.

The [generated schema inventory](production/schema-inventory.csv) records discovered declarations and explicit indexes. It is a static source inventory, not a report of live collections, installed indexes, data quality, or migration safety. The production architecture and finding register document startup index changes, transaction requirements, and unverified deployment state.

Before schema/index changes: inspect all readers/writers, old-client compatibility, duplicate existing keys, backfill strategy, rollback behavior, and whether a production-safe preflight is needed. Never run a migration against an unknown database. Do not represent standalone local Mongo as proof of transaction support.

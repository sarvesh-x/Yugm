# Backup and recovery inventory (Phase 1)

**Date:** 2026-11-22
**Status:** Planning inventory only. **No backup has been created and no restore has been tested.** Recovery procedures are unverified; the Phase 1 gate is not satisfied. No credential, production snapshot, export or data operation is authorized by this document.

## 1. Purpose

Record what must be backed up, what tooling exists, what verification has actually happened, and what remains before destructive migration work is allowed. This document complements `docs/migration/rollback-runbook.md` and `docs/migration/ROLLBACK_PLAN.md`.

## 2. Backup domains

| Domain | Source of truth today | Required backup | Verification status |
|---|---|---|---|
| User accounts and Firebase UID links | MongoDB `users` and related auth collections | Bounded export with stable IDs and Firebase UID mapping | Not created |
| Relationships, blocks, follows, bonds | MongoDB social collections | Full collection export with referential manifest | Not created |
| Conversations, DMs, clan messages | MongoDB message collections | Full export with per-conversation counts | Not created |
| Wallets and append-only ledger | MongoDB wallet/ledger collections | Export plus balance reconciliation report | Not created; reconciliation unverified |
| Purchases, gifts, inventory, equipped cosmetics | MongoDB commerce collections | Full export with ownership and entitlement manifest | Not created |
| Badges and achievement progress | MongoDB progression collections | Full export with award history | Not created |
| Rooms, events, game/PK results | MongoDB rooms/events/game collections | Full export with deadline/state snapshot | Not created |
| Admin records and audit logs | MongoDB admin collections | Full export with retention metadata | Not created |
| Media binaries | Local filesystem, legacy GridFS/S3 references, locally configured R2 | Object inventory with checksums, sizes, visibility and legacy URL mapping | Not created; missing historical `/uploads` files cannot be reconstructed from DB references alone |
| Store and asset definitions | MongoDB catalog/cosmetic/asset collections plus hardcoded Android catalogs | Export plus a copy of the source constants | Not created |
| Configuration | Wrangler configs, ignored `.env`/`.dev.vars`, Gradle properties, GitHub Actions variables | Owner-managed protected copy; **never paste values into docs, chat or logs** | Not created |
| Firebase project configuration | External Firebase project | Owner-managed export/config record | Not created |

Historical evidence: `docs/cloudflare-migration/audit.md` records that existing missing `/uploads` files cannot be reconstructed from database references alone. Treat this as an unresolved recovery gap, not a solved problem.

## 3. Existing local tooling

| Tool | Location | Capability |
|---|---|---|
| Snapshot store | `backend-server/apps/api/src/migration/snapshot.ts` | Deterministic checksums and filesystem snapshots |
| Read-only export | `backend-server/apps/api/src/migration/export.ts` | Bounded batches, count/checksum verification |
| Transformation | `backend-server/apps/api/src/migration/transform.ts`, `mappings.ts` | Reviewed transforms for 97 root collections with quarantine and source-row accountancy |
| Validation | `backend-server/apps/api/src/migration/validate.ts` | Counts, uniqueness, orphans, balance reports |
| Import | `backend-server/apps/api/src/migration/import.ts` | Checkpoint-backed, idempotent, dry-run capable |
| Rehearsal CLI | `backend-server/apps/api/src/scripts/rehearse-migration.ts`, npm script `migrate:rehearse` | Local fixture-snapshot dry rehearsal with PASS/exit-0 output |
| Snapshot-copy verifier | `backend-server/apps/api/src/migration/verifyBackup.ts`, CLI `src/scripts/verify-backup.ts`, npm script `backup:verify` | Read-only check that a copied snapshot matches its manifest: batch presence, record counts, byte counts, per-batch checksums, unexpected batch files, and an optional top-level integrity digest (`--expect-digest`) |
| Media inventory reporter | `backend-server/apps/api/src/migration/mediaInventory.ts`, CLI `src/scripts/media-inventory.ts`, npm script `inventory:media` | Read-only aggregation of exported MediaObject records into counts/bytes by category, bucket, visibility, owner and status, plus duplicate-key and checksum data-quality findings. Does not enumerate legacy `/uploads` files or verify that binaries exist |
| D1 draft schema | `backend-server/apps/api/migrations/d1/0001_initial.sql` | Review draft, not approved |

These tools were exercised only against generated fixtures during earlier work (138 migration tests and local `migrate:rehearse` smokes). They have **not** been run against a production snapshot, D1 instance or R2 bucket.

The snapshot-copy verifier was added on 2026-11-22 to cover procedure step 7 (top-level checksum verification after copy). It reads only a local directory: it never connects to MongoDB, D1, R2 or any remote service and never modifies the snapshot. `verifyBackup` detects missing or unreadable batch files, record/byte count drift, changed batch content, unexpected batch files and a digest mismatch when the source digest is supplied. Its 4 unit tests and a CLI smoke against a generated fixture passed, but this is **fixture-only evidence**. It does not create a backup, prove a restore, or change any item in section 5. Usage:

```
npm run backup:verify -- --snapshot <snapshot-directory> [--expect-digest <sha256>]
```

Record the printed integrity digest from the source snapshot, then pass it as `--expect-digest` when verifying a copy. The digest covers declared batch checksums in manifest order; a matching digest is evidence of an intact copy, not of a successful restore.

## 4. Required backup procedure (not yet performed)

1. Obtain explicit owner approval for the specific export and backup targets.
2. Identify the exact source environment and verify it is the intended one; never rely on an ambient `MONGODB_URI`.
3. Export every collection in bounded batches with a manifest of IDs, counts, timestamps and checksums.
4. Export a media-object manifest with source URL, target bucket/key, checksum, size, visibility and verification state.
5. Preserve configuration separately in the owner's protected secret store; do not commit values or print them.
6. Encrypt backups at rest, restrict access to named operators, and record retention and deletion policy.
7. Compute and verify a top-level checksum manifest after copy.
8. Restore into an **isolated** environment and run the validation gates: counts, identities, message counts by conversation, relationships, wallet/ledger reconciliation, purchases, gifts, inventory, badges, achievements and media reference resolution.
9. Record operator, command, environment, approval, checksums and observed RPO/RTO.
10. Only after a successful restore rehearsal may the backup be treated as a valid recovery mechanism.

## 5. Verification status

| Requirement | Status |
|---|---|
| Verified MongoDB backups | **No** |
| Verified media backups | **No** |
| Verified configuration backup | **No** |
| Restore rehearsal in isolated environment | **No** |
| Financial reconciliation against restored copy | **No** |
| Media reference resolution against restored copy | **No** |
| RPO/RTO measured | **No** |
| Backup access controls and encryption confirmed | **No** |

## 6. Gate

Do not begin destructive migration operations until items 1–10 of section 4 are completed and the verification table is updated with real results. Time Travel is not an independent backup. Source presence, a local fixture rehearsal or a green dry run is not proof of recovery.

## 7. Related documents

- `docs/migration/BASELINE_REPORT.md`
- `docs/migration/ROLLBACK_PLAN.md`
- `docs/migration/rollback-runbook.md`
- `docs/migration/data-migration-tooling.md`
- `docs/database/d1-capacity-assessment.md`

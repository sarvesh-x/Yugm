/** Checkpoint-backed, idempotent batch importer. All IO is injected; no production data is accessed. */
import { advanceCheckpoint, batchId, completeCheckpoint, newCheckpoint, shouldApplyBatch } from "./checkpoint.js";
import { getMapping } from "./mappings.js";
import { checksum } from "./snapshot.js";
import { TransformContext } from "./transform.js";
import type {
  Checkpoint as CheckpointState,
  CheckpointStore,
  SnapshotManifest,
  SnapshotSource,
  SourceRecord,
  TargetRow,
  TargetWriter
} from "./types.js";

export interface ImportOptions {
  snapshot: SnapshotManifest;
  collection: string;
  table: string;
  source: SnapshotSource;
  target: TargetWriter;
  checkpoints: CheckpointStore;
  transformRow: (record: SourceRecord) => TargetRow | undefined;
  dryRun?: boolean;
}

export interface MappedImportOptions {
  snapshot: SnapshotManifest;
  collection: string;
  source: SnapshotSource;
  target: TargetWriter;
  checkpoints: CheckpointStore;
  dryRun?: boolean;
  /** Observation hook for rehearsal reports; receives rows even in dry-run. */
  onWrite?: (table: string, rows: readonly TargetRow[]) => void;
}

export interface ImportResult {
  collection: string;
  processed: number;
  quarantined: number;
  batchesApplied: number;
  batchesSkipped: number;
  dryRun: boolean;
  checkpointStatus: CheckpointState["status"];
}

interface ImportBase {
  snapshot: SnapshotManifest;
  collection: string;
  source: SnapshotSource;
  target: TargetWriter;
  checkpoints: CheckpointStore;
  dryRun?: boolean;
}

async function runImport(
  base: ImportBase,
  processBatch: (records: SourceRecord[], write: (table: string, rows: readonly TargetRow[]) => Promise<void>) => Promise<number>
): Promise<ImportResult> {
  const { snapshot, collection, source, target, checkpoints, dryRun = true } = base;
  /** Dry-run still transforms and validates; the write itself is suppressed. */
  const write = async (table: string, rows: readonly TargetRow[]) => {
    if (!dryRun) await target.write(table, rows);
  };
  if (!snapshot.collections.some((entry) => entry.name === collection)) {
    throw new Error(`${collection} is not part of snapshot ${snapshot.snapshotId}`);
  }

  const key = `${snapshot.snapshotId}:import:${collection}`;
  let checkpoint = (await checkpoints.load(key)) || newCheckpoint(snapshot.snapshotId, "import", collection);
  const result: ImportResult = {
    collection,
    processed: 0,
    quarantined: 0,
    batchesApplied: 0,
    batchesSkipped: 0,
    dryRun,
    checkpointStatus: checkpoint.status
  };

  let batchIndex = 0;
  for await (const records of source.readCollectionBatches(collection)) {
    if (!records.length) continue;
    const expected = snapshot.collections.find((entry) => entry.name === collection)?.batches[batchIndex];
    if (!expected || expected.checksum !== checksum(records)) {
      throw new Error(`${collection} batch ${batchIndex} checksum does not match the snapshot manifest`);
    }
    const id = batchId(snapshot.snapshotId, "import", collection, String(records[0]._id));
    batchIndex += 1;

    if (!shouldApplyBatch(checkpoint, id)) {
      result.batchesSkipped += 1;
      result.processed += records.length;
      continue;
    }

    result.quarantined += await processBatch(records, write);
    if (!dryRun) {
      checkpoint = advanceCheckpoint(
        checkpoint,
        id,
        records.length,
        String(records[records.length - 1]._id),
        expected.checksum
      );
      await checkpoints.save(key, checkpoint);
    }
    result.batchesApplied += 1;
    result.processed += records.length;
  }

  if (batchIndex !== (snapshot.collections.find((entry) => entry.name === collection)?.batches.length ?? 0)) {
    throw new Error(`${collection}: snapshot batch count does not match the manifest`);
  }

  if (!dryRun && checkpoint.status !== "complete") {
    checkpoint = completeCheckpoint(checkpoint, snapshot.snapshotId);
    await checkpoints.save(key, checkpoint);
  }
  result.checkpointStatus = checkpoint.status;
  return result;
}

/** Legacy single-table importer, retained for simple collections and existing callers. */
export function importCollection(options: ImportOptions): Promise<ImportResult> {
  const { table, transformRow } = options;
  return runImport(options, async (records, write) => {
    const rows: TargetRow[] = [];
    let quarantined = 0;
    for (const record of records) {
      const row = transformRow(record);
      if (row) rows.push(row);
      else quarantined += 1;
    }
    if (rows.length) await write(table, rows);
    return quarantined;
  });
}

/**
 * Maps each source record to a root row plus normalized child rows, grouped by
 * table and written through the injected TargetWriter. The supplied context
 * accumulates quarantine details and row accountancy for the whole import.
 */
export function importMappedCollection(
  options: MappedImportOptions,
  context: TransformContext = new TransformContext(options.snapshot.snapshotId)
): Promise<ImportResult> {
  const { collection, onWrite } = options;
  const mapping = getMapping(collection);
  if (!mapping) throw new Error(`No reviewed transform mapping for collection ${collection}`);
  return runImport(options, async (records, write) => {
    const byTable = new Map<string, TargetRow[]>();
    let quarantined = 0;
    for (const record of records) {
      context.source(collection);
      const mapped = mapping(record, context);
      if (mapped.rejected) {
        quarantined += 1;
        continue;
      }
      for (const write of mapped.writes) {
        if (!write.rows.length) continue;
        const rows = byTable.get(write.table) || [];
        rows.push(...write.rows);
        byTable.set(write.table, rows);
      }
    }
    for (const [table, rows] of byTable) {
      onWrite?.(table, rows);
      await write(table, rows);
    }
    return quarantined;
  });
}

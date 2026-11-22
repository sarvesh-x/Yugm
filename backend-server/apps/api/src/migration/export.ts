/** Read-only collection export with counts and checksums. Source is injected; nothing connects to MongoDB here. */
import { checksum } from "./snapshot.js";
import type { CollectionSnapshot, SnapshotManifest, SnapshotSink, SourceCollectionReader } from "./types.js";

export interface ExportOptions {
  snapshotId: string;
  sourceDatabase: string;
  watermark: string;
  toolVersion: string;
  batchSize?: number;
}

function recordId(record: { _id?: unknown }): string {
  if (record._id === undefined || record._id === null) throw new Error("source record is missing _id");
  const id = record._id as { toHexString?: () => string };
  return typeof id.toHexString === "function" ? id.toHexString() : String(id);
}

export async function exportCollection(
  reader: SourceCollectionReader,
  sink: SnapshotSink,
  options: { batchSize?: number } = {}
): Promise<CollectionSnapshot> {
  const batchSize = options.batchSize ?? 500;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("batchSize must be an integer between 1 and 5000");
  }
  const expected = await reader.count();
  const batches: CollectionSnapshot["batches"] = [];
  let afterId: string | undefined;
  let written = 0;
  let index = 0;

  while (true) {
    const records = await reader.readBatch(afterId, batchSize);
    if (!records.length) break;
    const { bytes, checksum: digest } = await sink.writeCollection(reader.name, index, records);
    batches.push({ index, count: records.length, bytes, checksum: digest });
    written += records.length;
    afterId = recordId(records[records.length - 1]);
    index += 1;
    if (written > expected) throw new Error(`${reader.name}: exported more records than the source count`);
  }

  if (written !== expected) {
    throw new Error(`${reader.name}: source count ${expected} but exported ${written}`);
  }
  return { name: reader.name, count: written, batches };
}

export async function writeSnapshotManifest(
  sink: SnapshotSink,
  options: ExportOptions,
  collections: readonly CollectionSnapshot[]
): Promise<SnapshotManifest> {
  if (!options.snapshotId || !options.watermark) throw new Error("snapshotId and watermark are required");
  const manifest: SnapshotManifest = {
    snapshotId: options.snapshotId,
    sourceDatabase: options.sourceDatabase,
    watermark: options.watermark,
    toolVersion: options.toolVersion,
    createdAt: new Date().toISOString(),
    collections: [...collections]
  };
  await sink.writeManifest(manifest);
  return manifest;
}

/** Verifies a snapshot batch against its recorded checksum before import. */
export function verifyBatch(records: readonly import("./types.js").SourceRecord[], batch: { checksum: string }) {
  return checksum(records) === batch.checksum;
}

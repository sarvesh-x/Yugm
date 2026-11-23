/**
 * Read-only MongoDB snapshot export CLI.
 *
 * Usage:
 *   npm run snapshot:export -- --out <dir> --confirm-isolated-export <label>
 *     (--collections <c1,c2,...> | --all-reviewed)
 *     [--batch-size <n>] [--snapshot-id <id>] [--source-label <label>]
 *     [--string-id <collection> ...]
 *
 * Safety: an explicit confirmation label is required, only reviewed collections
 * from MAPPINGS can be exported, an existing manifest is never overwritten, and
 * only aggregate counts/checksums/bytes are printed. The MongoDB URI is never
 * read or printed by this script; connectDatabase() resolves it from env.
 * Connect to an isolated staging instance or a restored backup, not production
 * directly, unless separately authorized.
 */
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { MAPPINGS } from "../migration/mappings.js";
import { NativeCollectionReader } from "../migration/nativeCollectionReader.js";
import { FileSystemSnapshotStore } from "../migration/snapshot.js";
import { exportCollection, writeSnapshotManifest } from "../migration/export.js";
import type { CollectionSnapshot } from "../migration/types.js";

function values(name: string): string[] {
  const flag = `--${name}`;
  const found: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) found.push(process.argv[index + 1]);
  }
  return found;
}

const DEFAULT_STRING_ID_COLLECTIONS = new Set([
  "assets",
  "media_objects",
  "media_upload_sessions",
  "media_quota_reservations",
]);

async function main() {
  const out = values("out")[0];
  const confirmation = values("confirm-isolated-export")[0];
  if (!out || !confirmation) {
    console.error("Missing --out <dir> or --confirm-isolated-export <label>. Refusing to export.");
    process.exit(1);
  }

  const allReviewed = process.argv.includes("--all-reviewed");
  const requested = (values("collections")[0] ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  if (!allReviewed && !requested.length) {
    console.error("Supply --collections <c1,c2,...> or --all-reviewed.");
    process.exit(1);
  }
  const reviewed = new Set(Object.keys(MAPPINGS));
  const collections = allReviewed ? [...reviewed] : requested;
  const unknown = collections.filter((name) => !reviewed.has(name));
  if (unknown.length) {
    console.error(`Unreviewed collection(s) refused: ${unknown.join(", ")}`);
    process.exit(1);
  }

  const batchSize = Number(values("batch-size")[0] ?? 500);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    console.error("--batch-size must be an integer between 1 and 5000.");
    process.exit(1);
  }

  const directory = path.resolve(out);
  await mkdir(directory, { recursive: true });
  try {
    await access(path.join(directory, "snapshot-manifest.json"));
    console.error("Refusing to overwrite an existing snapshot-manifest.json in --out.");
    process.exit(1);
  } catch {
    // No manifest yet: safe to write.
  }

  const stringIds = new Set([...DEFAULT_STRING_ID_COLLECTIONS, ...values("string-id")]);
  const snapshotId = values("snapshot-id")[0] ?? `snapshot-${Date.now()}`;
  const sourceLabel = values("source-label")[0] ?? "isolated-mongo-export";

  await connectDatabase();
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection has no database handle");

    const store = new FileSystemSnapshotStore(directory);
    const results: CollectionSnapshot[] = [];
    for (const name of collections) {
      const reader = new NativeCollectionReader(name, db.collection(name), { stringIds: stringIds.has(name) });
      const result = await exportCollection(reader, store, { batchSize });
      results.push(result);
      console.log(`Exported ${name}: ${result.count} records, ${result.batches.length} batches`);
    }

    await writeSnapshotManifest(store, {
      snapshotId,
      sourceDatabase: sourceLabel,
      watermark: new Date().toISOString(),
      toolVersion: "snapshot:export",
    }, results);

    const totalBytes = results.reduce(
      (sum, collection) => sum + collection.batches.reduce((part, batch) => part + batch.bytes, 0), 0);
    console.log(`Snapshot ${snapshotId}: ${results.length} collections, ${totalBytes} bytes`);
    console.log(`Confirmation label: ${confirmation}; dry export only, no source writes.`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});

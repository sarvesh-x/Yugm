import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { exportCollection, writeSnapshotManifest } from "./export.js";
import { importCollection } from "./import.js";
import { FileSystemSnapshotStore, checksum, stableStringify } from "./snapshot.js";
import type {
  Checkpoint,
  CheckpointStore,
  CollectionSnapshot,
  SnapshotManifest,
  SnapshotSink,
  SnapshotSource,
  SourceCollectionReader,
  SourceRecord,
  TargetRow,
  TargetWriter
} from "./types.js";

const ID = "507f1f77bcf86cd799439011";
const records: SourceRecord[] = Array.from({ length: 5 }, (_, index) => ({
  _id: String(index).padStart(24, "0"),
  name: `user-${index}`,
  coins: index * 10
}));

function memoryReader(name: string, rows: SourceRecord[]): SourceCollectionReader {
  return {
    name,
    count: async () => rows.length,
    readBatch: async (afterId, limit) => {
      const start = afterId ? rows.findIndex((row) => String(row._id) === afterId) + 1 : 0;
      return rows.slice(start, start + limit);
    }
  };
}

class MemorySink implements SnapshotSink {
  readonly batches = new Map<string, SourceRecord[][]>();
  manifest?: SnapshotManifest;

  async writeCollection(name: string, batchIndex: number, rows: readonly SourceRecord[]) {
    const key = `${name}-${batchIndex}`;
    const list = this.batches.get(name) || [];
    list[batchIndex] = [...rows];
    this.batches.set(name, list);
    return { bytes: Buffer.byteLength(stableStringify(rows), "utf8"), checksum: checksum(rows) };
  }

  async writeManifest(manifest: SnapshotManifest) {
    this.manifest = manifest;
  }
}

class MemorySource implements SnapshotSource {
  constructor(private readonly sink: MemorySink) {}

  async *readCollectionBatches(name: string) {
    for (const batch of this.sink.batches.get(name) || []) yield batch;
  }
}

class MemoryCheckpoints implements CheckpointStore {
  readonly map = new Map<string, Checkpoint>();
  async load(key: string) {
    return this.map.get(key);
  }
  async save(key: string, checkpoint: Checkpoint) {
    this.map.set(key, checkpoint);
  }
}

class MemoryTarget implements TargetWriter {
  readonly writes: Array<{ table: string; rows: TargetRow[] }> = [];
  async write(table: string, rows: readonly TargetRow[]) {
    this.writes.push({ table, rows: [...rows] });
  }
  get rowCount() {
    return this.writes.reduce((total, write) => total + write.rows.length, 0);
  }
}

const options = {
  snapshotId: "snap-1",
  sourceDatabase: "Yugm",
  watermark: "2026-11-22T00:00:00.000Z",
  toolVersion: "test-1",
  batchSize: 2
};

async function exportedFixture() {
  const sink = new MemorySink();
  const collection = await exportCollection(memoryReader("users", records), sink, { batchSize: 2 });
  const manifest = await writeSnapshotManifest(sink, options, [collection]);
  return { sink, collection, manifest };
}

test("stableStringify is deterministic and normalizes dates and ObjectId-like values", () => {
  const objectId = { toHexString: () => ID };
  assert.equal(stableStringify({ b: 1, a: objectId }), stableStringify({ a: objectId, b: 1 }));
  assert.equal(stableStringify(new Date("2026-01-01T00:00:00.000Z")), JSON.stringify("2026-01-01T00:00:00.000Z"));
  assert.equal(stableStringify([1, 2, 3]), "[1,2,3]");
});

test("exportCollection writes bounded batches with matching counts and checksums", async () => {
  const { sink, collection } = await exportedFixture();
  assert.equal(collection.count, 5);
  assert.deepEqual(collection.batches.map((batch) => batch.count), [2, 2, 1]);
  assert.equal(sink.batches.get("users")?.length, 3);
  for (const batch of collection.batches) {
    assert.equal(batch.checksum, checksum(sink.batches.get("users")![batch.index]));
  }
});

test("exportCollection fails when source count and exported count disagree", async () => {
  const reader = memoryReader("users", records);
  reader.count = async () => 99;
  await assert.rejects(() => exportCollection(reader, new MemorySink(), { batchSize: 2 }), /source count 99/);
});

test("file system snapshot store round-trips batches and manifest", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-snapshot-"));
  try {
    const store = new FileSystemSnapshotStore(directory);
    const collection = await exportCollection(memoryReader("users", records), store, { batchSize: 2 });
    const manifest = await writeSnapshotManifest(store, options, [collection]);
    assert.equal(manifest.collections[0].count, 5);

    const loaded: SourceRecord[][] = [];
    for await (const batch of store.readCollectionBatches("users")) loaded.push(batch);
    assert.deepEqual(loaded.map((batch) => batch.length), [2, 2, 1]);
    assert.deepEqual(loaded.flat(), records);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("importer is idempotent: replaying a completed snapshot writes no duplicate rows", async () => {
  const { sink, manifest } = await exportedFixture();
  const target = new MemoryTarget();
  const checkpoints = new MemoryCheckpoints();
  const base = {
    snapshot: manifest,
    collection: "users",
    table: "users",
    source: new MemorySource(sink),
    target,
    checkpoints,
    transformRow: (record: SourceRecord): TargetRow => ({ source_id: String(record._id), name: String(record.name) }),
    dryRun: false
  };

  const first = await importCollection(base);
  assert.equal(first.processed, 5);
  assert.equal(first.batchesApplied, 3);
  assert.equal(target.rowCount, 5);
  assert.equal(first.checkpointStatus, "complete");

  const second = await importCollection(base);
  assert.equal(second.batchesSkipped, 3);
  assert.equal(second.batchesApplied, 0);
  assert.equal(target.rowCount, 5);
});

test("dry run validates batches without writing rows or checkpoints", async () => {
  const { sink, manifest } = await exportedFixture();
  const target = new MemoryTarget();
  const checkpoints = new MemoryCheckpoints();
  const result = await importCollection({
    snapshot: manifest,
    collection: "users",
    table: "users",
    source: new MemorySource(sink),
    target,
    checkpoints,
    transformRow: (record: SourceRecord): TargetRow => ({ source_id: String(record._id) }),
    dryRun: true
  });
  assert.equal(result.processed, 5);
  assert.equal(result.dryRun, true);
  assert.equal(target.rowCount, 0);
  assert.equal(checkpoints.map.size, 0);
  assert.equal(result.checkpointStatus, "pending");
});

test("importer counts quarantined rows and rejects manifest checksum mismatches", async () => {
  const { sink, manifest } = await exportedFixture();
  const target = new MemoryTarget();
  const result = await importCollection({
    snapshot: manifest,
    collection: "users",
    table: "users",
    source: new MemorySource(sink),
    target,
    checkpoints: new MemoryCheckpoints(),
    transformRow: (record: SourceRecord) =>
      Number(record.coins) > 20 ? undefined : ({ source_id: String(record._id) }),
    dryRun: false
  });
  assert.equal(result.quarantined, 2);
  assert.equal(target.rowCount, 3);

  const tampered: CollectionSnapshot = {
    ...manifest.collections[0],
    batches: [{ ...manifest.collections[0].batches[0], checksum: "bad" }, ...manifest.collections[0].batches.slice(1)]
  };
  await assert.rejects(
    () => importCollection({
      snapshot: { ...manifest, collections: [tampered] },
      collection: "users",
      table: "users",
      source: new MemorySource(sink),
      target: new MemoryTarget(),
      checkpoints: new MemoryCheckpoints(),
      transformRow: (record: SourceRecord): TargetRow => ({ source_id: String(record._id) }),
      dryRun: false
    }),
    /checksum does not match/
  );
});

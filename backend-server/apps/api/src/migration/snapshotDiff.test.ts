import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import { diffSnapshots } from "./snapshotDiff.js";
import type { CollectionSnapshot, SourceRecord } from "./types.js";

const A = "507f1f77bcf86cd799439011";
const B = "507f1f77bcf86cd799439012";
const C = "507f1f77bcf86cd799439013";

async function writeSnapshot(
  recordsByCollection: Record<string, SourceRecord[]>,
  meta: { snapshotId: string; watermark: string }
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-snapdiff-"));
  const store = new FileSystemSnapshotStore(directory);
  const collections: CollectionSnapshot[] = [];
  for (const [name, records] of Object.entries(recordsByCollection)) {
    const batch = await store.writeCollection(name, 0, records);
    collections.push({
      name,
      count: records.length,
      batches: [{ index: 0, count: records.length, ...batch }],
    });
  }
  await writeSnapshotManifest(
    store,
    {
      snapshotId: meta.snapshotId,
      sourceDatabase: "diff-fixture",
      watermark: meta.watermark,
      toolVersion: "test",
    },
    collections
  );
  return directory;
}

test("identical snapshots produce a zero delta and stable digest", async () => {
  const before = await writeSnapshot(
    { users: [{ _id: A, name: "Aarav" }] },
    { snapshotId: "snap-a", watermark: "2026-11-22T00:00:00.000Z" }
  );
  const after = await writeSnapshot(
    { users: [{ _id: A, name: "Aarav" }] },
    { snapshotId: "snap-b", watermark: "2026-11-23T00:00:00.000Z" }
  );
  try {
    const first = await diffSnapshots(before, after);
    const second = await diffSnapshots(before, after);

    assert.deepEqual(first.summary, {
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 1,
      invalidIds: 0,
      duplicateIds: 0,
      watermarkAdvanced: true,
    });
    assert.equal(first.digest, second.digest);
    assert.match(first.digest, /^[a-f0-9]{64}$/);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("reports added, removed and changed records with field names only", async () => {
  const before = await writeSnapshot(
    {
      users: [
        { _id: A, balanceCents: 100, name: "Aarav", note: "old" },
        { _id: B, balanceCents: 50 },
      ],
    },
    { snapshotId: "before", watermark: "2026-11-22T00:00:00.000Z" }
  );
  const after = await writeSnapshot(
    {
      users: [
        { _id: B, balanceCents: 50 },
        { _id: A, balanceCents: 200, name: "Aarav" },
        { _id: C, balanceCents: 10 },
      ],
      gifts: [{ _id: A, name: "Rose" }],
    },
    { snapshotId: "after", watermark: "2026-11-23T00:00:00.000Z" }
  );
  try {
    const report = await diffSnapshots(before, after);
    const users = report.collections.find((entry) => entry.name === "users")!;
    const gifts = report.collections.find((entry) => entry.name === "gifts")!;

    assert.equal(report.summary.added, 2);
    assert.equal(report.summary.removed, 0);
    assert.equal(report.summary.changed, 1);
    assert.equal(report.summary.unchanged, 1);
    assert.deepEqual(users.addedExamples, [C]);
    assert.deepEqual(users.changedExamples[0].changedFields, ["balanceCents", "note"]);
    assert.equal(gifts.beforeCount, 0);
    assert.equal(gifts.afterCount, 1);
    assert.deepEqual(gifts.addedExamples, [A]);
    assert.ok(!JSON.stringify(report).includes("Aarav"));
    assert.ok(!JSON.stringify(report).includes("balanceCents\": 200"));
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("reports removed records when a collection shrinks", async () => {
  const before = await writeSnapshot(
    { users: [{ _id: A }, { _id: B }] },
    { snapshotId: "shrink-before", watermark: "2026-11-22T00:00:00.000Z" }
  );
  const after = await writeSnapshot(
    { users: [{ _id: A }] },
    { snapshotId: "shrink-after", watermark: "2026-11-23T00:00:00.000Z" }
  );
  try {
    const report = await diffSnapshots(before, after);
    assert.equal(report.summary.removed, 1);
    assert.deepEqual(report.collections[0].removedExamples, [B]);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("reports duplicate and invalid IDs and caps examples", async () => {
  const before = await writeSnapshot(
    { users: [{ _id: A }, { _id: A }] },
    { snapshotId: "dupe-before", watermark: "2026-11-22T00:00:00.000Z" }
  );
  const after = await writeSnapshot(
    {
      users: [
        { _id: A },
        { name: "missing id" },
        { _id: C },
        { _id: B },
      ],
    },
    { snapshotId: "dupe-after", watermark: "2026-11-23T00:00:00.000Z" }
  );
  try {
    const report = await diffSnapshots(before, after, { maxExamples: 1 });
    const users = report.collections[0];

    assert.equal(users.added, 2);
    assert.equal(users.addedExamples.length, 1);
    assert.deepEqual(users.duplicateIds, [A]);
    assert.equal(users.invalidIds, 1);
    assert.equal(report.summary.duplicateIds, 1);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("rejects a negative example limit", async () => {
  const snapshot = await writeSnapshot({}, { snapshotId: "empty", watermark: "2026-11-23T00:00:00.000Z" });
  try {
    await assert.rejects(() => diffSnapshots(snapshot, snapshot, { maxExamples: -1 }), /non-negative integer/);
  } finally {
    await rm(snapshot, { recursive: true, force: true });
  }
});

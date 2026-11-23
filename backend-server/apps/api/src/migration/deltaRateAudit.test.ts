import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { auditDeltaRates } from "./deltaRateAudit.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

async function snapshot(
  id: string,
  watermark: string,
  collections: Record<string, SourceRecord[]>
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-delta-rate-"));
  const store = new FileSystemSnapshotStore(directory);
  const entries = [];
  for (const [name, records] of Object.entries(collections)) {
    const batch = await store.writeCollection(name, 0, records);
    entries.push({ name, count: records.length, batches: [{ index: 0, count: records.length, ...batch }] });
  }
  await writeSnapshotManifest(
    store,
    { snapshotId: id, sourceDatabase: "fixture", watermark, toolVersion: "test" },
    entries
  );
  return directory;
}

test("computes average rates from a valid watermark window", async () => {
  const before = await snapshot("rate-before", "2026-11-23T00:00:00.000Z", {
    users: [{ _id: "u1", name: "Aarav" }],
  });
  const after = await snapshot("rate-after", "2026-11-23T04:00:00.000Z", {
    users: [{ _id: "u1", name: "Meera" }, { _id: "u2", name: "New" }],
  });
  try {
    const report = await auditDeltaRates(before, after);

    assert.equal(report.hours, 4);
    assert.equal(report.totalChanged, 1);
    assert.equal(report.totalAdded, 1);
    assert.equal(report.totalPerHour, 0.5);
    assert.equal(report.collections[0].changedPerHour, 0.25);
    assert.equal(report.collections[0].addedPerHour, 0.25);
    assert.deepEqual(
      report.reviewItems.map((item) => item.id),
      ["average-is-not-peak", "online-vs-window", "financial-peak"]
    );
    assert.ok(!JSON.stringify(report).includes("Meera"));
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("reports an invalid watermark window without dividing", async () => {
  const before = await snapshot("invalid-before", "not-a-date", { users: [{ _id: "u1" }] });
  const after = await snapshot("invalid-after", "2026-11-23T04:00:00.000Z", { users: [{ _id: "u1", x: 1 }] });
  try {
    const report = await auditDeltaRates(before, after);

    assert.equal(report.hours, null);
    assert.equal(report.totalPerHour, null);
    assert.equal(report.collections[0].changedPerHour, null);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("digest is stable for the same snapshots", async () => {
  const before = await snapshot("stable-before", "2026-11-23T00:00:00.000Z", { users: [{ _id: "u1" }] });
  const after = await snapshot("stable-after", "2026-11-23T01:00:00.000Z", { users: [{ _id: "u1" }] });
  try {
    const first = await auditDeltaRates(before, after);
    const second = await auditDeltaRates(before, after);

    assert.equal(first.totalPerHour, 0);
    assert.equal(first.digest, second.digest);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

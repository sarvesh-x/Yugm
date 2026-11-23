import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { auditDeletions } from "./deletionAudit.js";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

async function snapshot(
  id: string,
  collections: Record<string, SourceRecord[]>
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-deletion-audit-"));
  const store = new FileSystemSnapshotStore(directory);
  const entries = [];
  for (const [name, records] of Object.entries(collections)) {
    const batch = await store.writeCollection(name, 0, records);
    entries.push({ name, count: records.length, batches: [{ index: 0, count: records.length, ...batch }] });
  }
  await writeSnapshotManifest(
    store,
    { snapshotId: id, sourceDatabase: "fixture", watermark: id, toolVersion: "test" },
    entries
  );
  return directory;
}

test("lists hard removals and whole-collection removal", async () => {
  const before = await snapshot("before", {
    users: [{ _id: "u1" }, { _id: "u2" }],
    gifts: [{ _id: "g1" }],
  });
  const after = await snapshot("after", { users: [{ _id: "u1" }] });
  try {
    const report = await auditDeletions(before, after);

    assert.equal(report.hardRemoved, 2);
    const users = report.collections.find((entry) => entry.name === "users")!;
    const gifts = report.collections.find((entry) => entry.name === "gifts")!;
    assert.deepEqual(users.removedIds, ["u2"]);
    assert.deepEqual(gifts.removedIds, ["g1"]);
    assert.equal(gifts.collectionAbsentAfter, true);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("counts soft-delete markers without treating them as hard removals", async () => {
  const before = await snapshot("before-soft", { users: [{ _id: "u1" }, { _id: "u2" }] });
  const after = await snapshot("after-soft", {
    users: [
      { _id: "u1", deletedAt: "2026-11-23T00:00:00.000Z" },
      { _id: "u2", status: "DELETED" },
    ],
  });
  try {
    const report = await auditDeletions(before, after);

    assert.equal(report.hardRemoved, 0);
    assert.equal(report.softDeleted, 1);
    assert.deepEqual(report.collections[0].softDeletedIds, ["u1"]);

    const statusReport = await auditDeletions(before, after, { softField: "status" });
    assert.equal(statusReport.softDeleted, 1);
    assert.deepEqual(statusReport.collections[0].softDeletedIds, ["u2"]);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("digest is stable across repeated audits", async () => {
  const before = await snapshot("stable-before", { users: [{ _id: "u1" }, { _id: "u2" }] });
  const after = await snapshot("stable-after", { users: [{ _id: "u1" }] });
  try {
    const first = await auditDeletions(before, after);
    const second = await auditDeletions(before, after);

    assert.match(first.digest, /^[a-f0-9]{64}$/);
    assert.equal(first.digest, second.digest);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("rejects an empty soft field", async () => {
  const directory = await snapshot("empty-field", {});
  try {
    await assert.rejects(() => auditDeletions(directory, directory, { softField: "  " }), /non-empty string/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

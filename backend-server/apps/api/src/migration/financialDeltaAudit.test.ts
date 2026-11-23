import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { auditFinancialDelta } from "./financialDeltaAudit.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

async function snapshot(id: string, collections: Record<string, SourceRecord[]>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-finance-audit-"));
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

test("sizes only authoritative financial collections", async () => {
  const before = await snapshot("finance-before", {
    wallet_transactions: [{ _id: "w1", amount: 100 }],
    purchases: [{ _id: "p1", amount: 200 }],
    users: [{ _id: "u1", name: "Aarav" }],
  });
  const after = await snapshot("finance-after", {
    wallet_transactions: [{ _id: "w1", amount: 150 }, { _id: "w2", amount: 50 }],
    purchases: [{ _id: "p1", amount: 200 }],
    users: [{ _id: "u1", name: "Aarav" }],
  });
  try {
    const report = await auditFinancialDelta(before, after);

    assert.deepEqual(report.byCollection.map((entry) => entry.name), ["purchases", "wallet_transactions"]);
    assert.equal(report.summary.added, 1);
    assert.equal(report.summary.changed, 1);
    assert.equal(report.summary.unchanged, 1);
    assert.equal(report.summary.removed, 0);
    assert.deepEqual(
      report.reviewItems.map((item) => item.id),
      ["ledger-reconciliation", "maintenance-window", "idempotency-replay"]
    );
    assert.ok(!JSON.stringify(report).includes("Aarav"));
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

test("digest is stable and reflects financial changes", async () => {
  const before = await snapshot("stable-before", { wallet_transactions: [{ _id: "w1" }] });
  const after = await snapshot("stable-after", { wallet_transactions: [{ _id: "w1", extra: true }] });
  const unchanged = await snapshot("stable-unchanged", { wallet_transactions: [{ _id: "w1" }] });
  try {
    const first = await auditFinancialDelta(before, after);
    const repeated = await auditFinancialDelta(before, after);
    const none = await auditFinancialDelta(before, unchanged);

    assert.match(first.digest, /^[a-f0-9]{64}$/);
    assert.equal(first.digest, repeated.digest);
    assert.notEqual(first.digest, none.digest);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
    await rm(unchanged, { recursive: true, force: true });
  }
});

test("returns zero summary when no financial collections are present", async () => {
  const before = await snapshot("empty-before", { users: [{ _id: "u1" }] });
  const after = await snapshot("empty-after", { users: [{ _id: "u1" }] });
  try {
    const report = await auditFinancialDelta(before, after);

    assert.deepEqual(report.byCollection, []);
    assert.deepEqual(report.summary, { added: 0, removed: 0, changed: 0, unchanged: 0 });
    assert.equal(report.collections.length, 6);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
  }
});

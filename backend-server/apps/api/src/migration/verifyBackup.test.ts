import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { CollectionSnapshot, SourceRecord } from "./types.js";
import { backupIntegrityDigest, verifyBackup } from "./verifyBackup.js";

async function snapshotFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-backup-"));
  const store = new FileSystemSnapshotStore(directory);
  const users: SourceRecord[] = [
    { _id: "u1", name: "Aarav" },
    { _id: "u2", name: "Meera" },
  ];
  const wallets: SourceRecord[] = [{ _id: "u1", balanceCents: 500 }];

  const userBatch = await store.writeCollection("users", 0, users);
  const walletBatch = await store.writeCollection("wallets", 0, wallets);
  const collections: CollectionSnapshot[] = [
    { name: "users", count: users.length, batches: [{ index: 0, count: users.length, ...userBatch }] },
    { name: "wallets", count: wallets.length, batches: [{ index: 0, count: wallets.length, ...walletBatch }] },
  ];
  const manifest = await writeSnapshotManifest(
    store,
    {
      snapshotId: "snap-test",
      sourceDatabase: "YugmBackupFixture",
      watermark: "2026-11-22T00:00:00.000Z",
      toolVersion: "test",
    },
    collections
  );
  return { directory, manifest };
}

test("verifies an intact snapshot copy with a stable integrity digest", async () => {
  const { directory, manifest } = await snapshotFixture();
  try {
    const first = await verifyBackup(directory);
    const second = await verifyBackup(directory, first.integrityDigest);

    assert.equal(first.passed, true);
    assert.equal(second.passed, true);
    assert.equal(first.snapshotId, "snap-test");
    assert.equal(first.sourceDatabase, "YugmBackupFixture");
    assert.equal(first.collectionCount, 2);
    assert.equal(first.recordCount, 3);
    assert.match(first.integrityDigest, /^[a-f0-9]{64}$/);
    assert.equal(first.integrityDigest, backupIntegrityDigest(manifest));
    assert.equal(first.integrityDigest, second.integrityDigest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detects a modified record through its batch checksum", async () => {
  const { directory } = await snapshotFixture();
  try {
    const file = path.join(directory, "users-000000.jsonl");
    const content = await readFile(file, "utf8");
    await writeFile(file, content.replace("Aarav", "TAMPERED"), "utf8");

    const result = await verifyBackup(directory);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((check) => check.name === "batch-0-checksum" && !check.passed));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detects a truncated batch and a missing batch file", async () => {
  const { directory } = await snapshotFixture();
  try {
    const file = path.join(directory, "users-000000.jsonl");
    await writeFile(file, '{"_id":"u1","name":"Aarav"}\n', "utf8");
    const truncated = await verifyBackup(directory);
    assert.equal(truncated.passed, false);
    assert.ok(truncated.checks.some((check) => check.name === "batch-0-records" && check.expected === 2 && check.actual === 1));

    await rm(file);
    const missing = await verifyBackup(directory);
    assert.equal(missing.passed, false);
    assert.ok(missing.checks.some((check) => check.name === "batch-0-present" && !check.passed));
    assert.ok(missing.checks.some((check) => check.name === "collection-records" && check.expected === 2 && check.actual === 0));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detects an unexpected batch file and a digest mismatch", async () => {
  const { directory } = await snapshotFixture();
  try {
    await writeFile(path.join(directory, "orphan-000000.jsonl"), '{"_id":"x"}\n', "utf8");
    const result = await verifyBackup(directory, "0".repeat(64));

    assert.equal(result.passed, false);
    assert.ok(result.checks.some((check) => check.name === "no-unexpected-batch-files" && !check.passed));
    const digestCheck = result.checks.find((check) => check.name === "integrity-digest");
    assert.ok(digestCheck && !digestCheck.passed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

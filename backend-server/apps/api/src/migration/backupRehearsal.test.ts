import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { rehearseBackup } from "./backupRehearsal.js";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import { backupIntegrityDigest } from "./verifyBackup.js";
import type { SourceRecord } from "./types.js";

const user: SourceRecord = {
  _id: "507f1f77bcf86cd799439011",
  name: "Aarav",
  username: "aarav",
  role: "USER",
  walletBalance: 100,
  interests: ["music"],
};

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-backup-rehearsal-"));
  const output = await mkdtemp(path.join(tmpdir(), "yugm-backup-rehearsal-out-"));
  const store = new FileSystemSnapshotStore(directory);
  const batch = await store.writeCollection("users", 0, [user]);
  const manifest = await writeSnapshotManifest(
    store,
    {
      snapshotId: "snap-rehearsal",
      sourceDatabase: "fixture",
      watermark: "2026-11-23T00:00:00.000Z",
      toolVersion: "test",
    },
    [{ name: "users", count: 1, batches: [{ index: 0, count: 1, ...batch }] }]
  );
  return { directory, output, manifest };
}

test("chains integrity verification and dry-run rehearsal into one passing report", async () => {
  const { directory, output, manifest } = await fixture();
  try {
    const result = await rehearseBackup(directory, output, backupIntegrityDigest(manifest));

    assert.equal(result.passed, true);
    assert.equal(result.verification.passed, true);
    assert.ok(result.rehearsal);
    assert.equal(result.rehearsal.validation.passed, true);
    assert.deepEqual(result.rehearsal.collections, ["users"]);
    for (const artifact of result.rehearsal.artifacts) await access(artifact);
    const validation = JSON.parse(await readFile(path.join(output, "validation-report.json"), "utf8")) as { passed: boolean };
    assert.equal(validation.passed, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(output, { recursive: true, force: true });
  }
});

test("skips rehearsal when the snapshot copy fails its checksum", async () => {
  const { directory, output } = await fixture();
  try {
    const file = path.join(directory, "users-000000.jsonl");
    const content = await readFile(file, "utf8");
    await writeFile(file, content.replace("Aarav", "Tampered"), "utf8");

    const result = await rehearseBackup(directory, output);

    assert.equal(result.passed, false);
    assert.equal(result.verification.passed, false);
    assert.equal(result.rehearsal, null);
    assert.ok(result.verification.checks.some((check) => check.name === "batch-0-checksum" && !check.passed));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(output, { recursive: true, force: true });
  }
});

test("rejects an expected digest mismatch before rehearsing", async () => {
  const { directory, output } = await fixture();
  try {
    const result = await rehearseBackup(directory, output, "0".repeat(64));

    assert.equal(result.passed, false);
    assert.equal(result.rehearsal, null);
    assert.ok(result.verification.checks.some((check) => check.name === "integrity-digest" && !check.passed));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(output, { recursive: true, force: true });
  }
});

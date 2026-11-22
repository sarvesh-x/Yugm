import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { IdMapRegistry, makeIdMapEntry } from "./idMap.js";
import { MAPPING_VERSION } from "./mappings.js";
import { rehearseSnapshot } from "./rehearsal.js";
import { checksum, FileSystemSnapshotStore } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

const USER_ID = "507f1f77bcf86cd799439011";
const user: SourceRecord = {
  _id: USER_ID,
  name: "Aarav",
  username: "aarav",
  role: "USER",
  walletBalance: 100,
  interests: ["music"]
};

test("id_map entries are deterministic and reject conflicting duplicates", () => {
  const first = makeIdMapEntry("users", "users", USER_ID);
  const second = makeIdMapEntry("users", "users", USER_ID);
  assert.deepEqual(first, second);
  assert.equal(first.target_id, USER_ID);
  assert.equal(first.mapping_version, MAPPING_VERSION);
  assert.match(first.checksum, /^[a-f0-9]{64}$/);

  const registry = new IdMapRegistry();
  registry.add(first);
  registry.add(second);
  assert.equal(registry.size, 1);
  assert.equal(registry.lookup("users", USER_ID)?.target_table, "users");
  assert.throws(
    () => registry.add(makeIdMapEntry("users", "users", USER_ID, "different")),
    /Conflicting id_map entry/
  );
  assert.throws(() => makeIdMapEntry("", "users", USER_ID), /require collection/);
});

test("id_map JSONL is stable and writable", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-idmap-"));
  try {
    const registry = new IdMapRegistry();
    registry.addMany([
      makeIdMapEntry("users", "users", "507f1f77bcf86cd799439012"),
      makeIdMapEntry("users", "users", USER_ID)
    ]);
    const written = await registry.write(directory);
    const content = await readFile(written, "utf8");
    assert.equal(content, registry.toJsonl());
    assert.equal(content.split("\n").filter(Boolean).length, 2);
    assert.match(registry.checksum(), /^[a-f0-9]{64}$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function snapshotFixture(count: number) {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-rehearsal-"));
  const store = new FileSystemSnapshotStore(directory);
  const batch = await store.writeCollection("users", 0, [user]);
  await store.writeManifest({
    snapshotId: "snap-rehearsal",
    sourceDatabase: "Yugm",
    watermark: "2026-11-22T00:00:00.000Z",
    toolVersion: "test",
    createdAt: "2026-11-22T00:00:00.000Z",
    collections: [{
      name: "users",
      count,
      batches: [{ index: 0, count: 1, bytes: batch.bytes, checksum: checksum([user]) }]
    }]
  });
  return directory;
}

test("rehearsal runs the real importer in dry run and writes validation and id_map artifacts", async () => {
  const snapshotDirectory = await snapshotFixture(1);
  const outputDirectory = path.join(snapshotDirectory, "out");
  try {
    const result = await rehearseSnapshot({ snapshotDirectory, outputDirectory, collections: ["users"] });
    assert.equal(result.snapshotId, "snap-rehearsal");
    assert.deepEqual(result.collections, ["users"]);
    assert.equal(result.validation.passed, true);
    assert.equal(result.idMapCount, 1);
    assert.deepEqual(result.transform.collections.users, { source: 1, transformed: 1, quarantined: 0 });
    assert.deepEqual(result.transform.quarantine, []);

    const storedValidation = JSON.parse(await readFile(path.join(outputDirectory, "validation-report.json"), "utf8"));
    assert.equal(storedValidation.passed, true);
    const storedIdMap = await readFile(path.join(outputDirectory, "id-map.jsonl"), "utf8");
    assert.equal(JSON.parse(storedIdMap).source_id, USER_ID);
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
});

test("rehearsal defaults to only reviewed collections present in the snapshot", async () => {
  const snapshotDirectory = await snapshotFixture(1);
  const outputDirectory = path.join(snapshotDirectory, "out");
  try {
    const result = await rehearseSnapshot({ snapshotDirectory, outputDirectory });
    assert.deepEqual(result.collections, ["users"]);
    assert.equal(result.validation.passed, true);
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
});

test("rehearsal rejects an explicitly requested collection missing from the snapshot", async () => {
  const snapshotDirectory = await snapshotFixture(1);
  const outputDirectory = path.join(snapshotDirectory, "out");
  try {
    await assert.rejects(
      rehearseSnapshot({ snapshotDirectory, outputDirectory, collections: ["wallet_transactions"] }),
      /not in the snapshot manifest/
    );
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
});

test("rehearsal reports source count mismatches instead of hiding them", async () => {
  const snapshotDirectory = await snapshotFixture(2);
  const outputDirectory = path.join(snapshotDirectory, "out");
  try {
    const result = await rehearseSnapshot({ snapshotDirectory, outputDirectory, collections: ["users"] });
    assert.equal(result.validation.passed, false);
    const countCheck = result.validation.checks.find((check) => check.name === "users: processed");
    assert.equal(countCheck?.passed, false);
    assert.equal(countCheck?.expected, 2);
    assert.equal(countCheck?.actual, 1);
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
});

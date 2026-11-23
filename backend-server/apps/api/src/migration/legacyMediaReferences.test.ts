import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import {
  classifyMediaReference,
  readLegacyReferenceInput,
  scanLegacyMediaReferences,
} from "./legacyMediaReferences.js";

const records = [
  {
    _id: "u1",
    avatar: "/uploads/a.png",
    photo: "https://api.test/uploads/b.JPG?signature=redacted",
    managed: "/api/media/uploads/session-1/complete",
    inline: "data:image/png;base64,AAAA",
    external: "https://media.example.test/c.webp",
    nested: [
      { mediaUrl: "/api/trust-verification/media/trust.png" },
      { url: "/api/admin/assets/staging/staged.webp" },
      { imageUrl: "/api/badge-art/badge-1/2" },
    ],
  },
  { _id: "u2", note: "ordinary text", count: 7 },
];

test("classifies source-verified legacy and managed URL forms", () => {
  assert.equal(classifyMediaReference("/uploads/a.png"), "legacyPublicUploads");
  assert.equal(classifyMediaReference("https://api.test/uploads/b.jpg"), "legacyPublicUploads");
  assert.equal(classifyMediaReference("/api/media/uploads/s1/complete"), "managedUploadEndpoint");
  assert.equal(classifyMediaReference("/api/trust-verification/media/x.png"), "legacyPrivateTrust");
  assert.equal(classifyMediaReference("/api/admin/assets/staging/x.webp"), "legacyPrivateAssetsStaging");
  assert.equal(classifyMediaReference("/api/badge-art/b/1"), "legacyBadgeArt");
  assert.equal(classifyMediaReference("data:image/png;base64,AA"), "inlineDataUrl");
  assert.equal(classifyMediaReference("https://r2.example/c.webp"), "absoluteHttpUrl");
  assert.equal(classifyMediaReference("ordinary text"), null);
});

test("reports counts, field paths, extensions and URL digests without raw URLs", () => {
  const report = scanLegacyMediaReferences(records, "fixture");

  assert.equal(report.recordCount, 2);
  assert.equal(report.counts.legacyPublicUploads, 2);
  assert.equal(report.counts.legacyPrivateTrust, 1);
  assert.equal(report.counts.legacyPrivateAssetsStaging, 1);
  assert.equal(report.counts.legacyBadgeArt, 1);
  assert.equal(report.counts.inlineDataUrl, 1);
  assert.equal(report.counts.absoluteHttpUrl, 1);
  assert.equal(report.counts.managedUploadEndpoint, 1);
  assert.equal(report.totalReferences, 8);
  assert.equal(report.byField["avatar"], 1);
  assert.equal(report.byField["nested[].mediaUrl"], 1);
  assert.equal(report.byExtension.png, 2);
  assert.equal(report.uniqueLegacyDigests.length, 5);
  assert.ok(report.uniqueLegacyDigests.every((digest) => /^[a-f0-9]{64}$/.test(digest)));
  assert.ok(!JSON.stringify(report).includes("/uploads/a.png"));
  assert.ok(!JSON.stringify(report).includes("signature=redacted"));
});

test("skips large non-data strings and reports the skip count", () => {
  const report = scanLegacyMediaReferences(
    [{ imageData: `${"x".repeat(5_000)}/uploads/not-scanned.png` }],
    "skip-fixture"
  );

  assert.equal(report.longStringsSkipped, 1);
  assert.equal(report.counts.legacyPublicUploads, 0);
});

test("digest is stable and independent of record order", () => {
  const first = scanLegacyMediaReferences(records, "fixture");
  const reversed = scanLegacyMediaReferences([...records].reverse(), "fixture");

  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.digest, reversed.digest);
});

test("reads declared batch files from a copied snapshot directory", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-legacy-refs-"));
  try {
    const store = new FileSystemSnapshotStore(directory);
    await store.writeCollection("users", 0, [{ _id: "u1", avatar: "/uploads/snapshot.png" }]);
    const batch = await store.writeCollection("messages", 0, [{ _id: "m1", mediaUrl: "/uploads/chat.jpg" }]);
    const batchInfo = { index: 0, count: 1, ...batch };
    await writeSnapshotManifest(
      store,
      {
        snapshotId: "legacy-refs-snapshot",
        sourceDatabase: "fixture",
        watermark: "2026-11-23T00:00:00.000Z",
        toolVersion: "test",
      },
      [
        { name: "users", count: 1, batches: [{ index: 0, count: 1, ...(await store.writeCollection("users", 0, [{ _id: "u1", avatar: "/uploads/snapshot.png" }])) }] },
        { name: "messages", count: 1, batches: [batchInfo] },
      ]
    );

    const input = await readLegacyReferenceInput({ snapshot: directory });
    const report = scanLegacyMediaReferences(input.records, input.source);

    assert.equal(input.source, "legacy-refs-snapshot");
    assert.equal(report.recordCount, 2);
    assert.equal(report.counts.legacyPublicUploads, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires exactly one input mode", async () => {
  await assert.rejects(() => readLegacyReferenceInput({}), /exactly one of/);
  await assert.rejects(
    () => readLegacyReferenceInput({ input: "a.jsonl", snapshot: "b" }),
    /exactly one of/
  );
});

test("reads a single JSONL file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-legacy-jsonl-"));
  const file = path.join(directory, "records.jsonl");
  try {
    await writeFile(file, `${JSON.stringify(records[0])}\n`, "utf8");
    const input = await readLegacyReferenceInput({ input: file });

    assert.equal(input.source, "records.jsonl");
    assert.equal(input.records.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

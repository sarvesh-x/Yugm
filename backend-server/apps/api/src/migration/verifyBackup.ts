/**
 * Local, read-only integrity verification of an exported snapshot *copy*.
 *
 * Reads only the snapshot directory on disk. It never connects to MongoDB, D1,
 * R2 or any remote service, and it never modifies the snapshot. A passing result
 * means the copy matches its manifest, not that a restore has been rehearsed.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { checksum, readSnapshotManifest, snapshotBatchFileName } from "./snapshot.js";
import { ValidationReportBuilder } from "./validate.js";
import type { SnapshotManifest, SourceRecord, ValidationReport } from "./types.js";

export interface BackupVerificationResult extends ValidationReport {
  sourceDatabase: string;
  watermark: string;
  integrityDigest: string;
  collectionCount: number;
  recordCount: number;
}

const BATCH_FILE_NAME = /^(.+)-(\d{6})\.jsonl$/;

/**
 * Single fingerprint over the declared batch checksums in manifest order.
 * Record this at the source and pass it as `expectedDigest` when verifying a copy.
 */
export function backupIntegrityDigest(manifest: SnapshotManifest): string {
  const hash = createHash("sha256");
  for (const collection of manifest.collections) {
    for (const batch of collection.batches) {
      hash.update(`${collection.name}:${batch.index}:${batch.checksum}\n`);
    }
  }
  return hash.digest("hex");
}

export async function verifyBackup(
  directory: string,
  expectedDigest?: string
): Promise<BackupVerificationResult> {
  const manifest = await readSnapshotManifest(directory);
  const builder = new ValidationReportBuilder();
  const entries = new Set(await readdir(directory));
  const expectedFiles = new Set<string>();
  let totalRecords = 0;

  for (const collection of manifest.collections) {
    const domain = `backup/${collection.name}`;
    let collectionRecords = 0;

    for (const batch of collection.batches) {
      const file = snapshotBatchFileName(collection.name, batch.index);
      expectedFiles.add(file);

      if (!entries.has(file)) {
        builder.assert(domain, `batch-${batch.index}-present`, false, "declared batch file is missing");
        continue;
      }

      let content: string;
      let lines: string[];
      let records: SourceRecord[];
      try {
        content = await readFile(path.join(directory, file), "utf8");
        lines = content.split("\n").filter(Boolean);
        records = lines.map((line) => JSON.parse(line) as SourceRecord);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unreadable batch file";
        builder.assert(domain, `batch-${batch.index}-readable`, false, detail);
        continue;
      }

      builder.count(domain, `batch-${batch.index}-records`, batch.count, records.length);
      const checksumMatches = checksum(records) === batch.checksum;
      builder.assert(
        domain,
        `batch-${batch.index}-checksum`,
        checksumMatches,
        checksumMatches ? undefined : "batch content does not match the manifest checksum"
      );
      builder.count(
        domain,
        `batch-${batch.index}-bytes`,
        batch.bytes,
        Buffer.byteLength(lines.join("\n"), "utf8")
      );
      collectionRecords += records.length;
    }

    builder.count(domain, "collection-records", collection.count, collectionRecords);
    totalRecords += collectionRecords;
  }

  const unexpected = [...entries]
    .filter((name) => BATCH_FILE_NAME.test(name) && !expectedFiles.has(name))
    .sort();
  builder.assert(
    "backup",
    "no-unexpected-batch-files",
    unexpected.length === 0,
    unexpected.length ? `unexpected batch files: ${unexpected.slice(0, 10).join(", ")}` : undefined
  );

  const integrityDigest = backupIntegrityDigest(manifest);
  if (expectedDigest) {
    const expected = expectedDigest.trim().toLowerCase();
    builder.assert(
      "backup",
      "integrity-digest",
      expected === integrityDigest,
      `expected ${expected}, computed ${integrityDigest}`
    );
  }

  return {
    ...builder.report(manifest.snapshotId),
    sourceDatabase: manifest.sourceDatabase,
    watermark: manifest.watermark,
    integrityDigest,
    collectionCount: manifest.collections.length,
    recordCount: totalRecords,
  };
}

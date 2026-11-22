/**
 * Local-only snapshot copy verification CLI.
 *
 * Reads an already-copied snapshot directory; it never connects to MongoDB, D1,
 * R2 or any remote service and performs no writes. Record `--expect-digest` from
 * the source snapshot so a copied or restored directory can be compared against it.
 *
 * Usage:
 *   npm run backup:verify -- --snapshot <snapshot-directory> [--expect-digest <sha256>]
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { verifyBackup } from "../migration/verifyBackup.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const snapshotDirectory = argument("snapshot");
  if (!snapshotDirectory) {
    console.error("Missing --snapshot <directory>. This tool never reads MongoDB directly.");
    process.exit(1);
  }

  const resolved = path.resolve(snapshotDirectory);
  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) throw new Error("not a directory");
  } catch {
    console.error(`Snapshot directory is not readable: ${resolved}`);
    process.exit(1);
  }

  const result = await verifyBackup(resolved, argument("expect-digest"));

  console.log(`Snapshot: ${result.snapshotId}`);
  console.log(`Source database: ${result.sourceDatabase}`);
  console.log(`Watermark: ${result.watermark}`);
  console.log(`Collections: ${result.collectionCount}; records: ${result.recordCount}`);
  console.log(`Integrity digest: ${result.integrityDigest}`);
  console.log(`Verification: ${result.passed ? "PASS" : "FAIL"}`);
  for (const check of result.checks.filter((entry) => !entry.passed)) {
    const detail = check.detail ? ` (${check.detail})` : "";
    console.error(`  FAIL ${check.domain}/${check.name}: expected ${check.expected}, actual ${check.actual}${detail}`);
  }

  if (!result.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

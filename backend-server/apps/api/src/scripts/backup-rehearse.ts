/**
 * Local-only backup integrity + dry-run rehearsal CLI.
 *
 * Usage:
 *   npm run backup:rehearse -- --snapshot <dir> --out-dir <dir> [--expect-digest <sha256>]
 *
 * Exit 0 means snapshot verification and dry-run mapping validation passed.
 * It does not mean a production restore was tested.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { rehearseBackup } from "../migration/backupRehearsal.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const snapshot = argument("snapshot");
  const outDir = argument("out-dir");
  if (!snapshot || !outDir) {
    console.error("Missing --snapshot <directory> or --out-dir <directory>. This tool never reads a database directly.");
    process.exit(1);
  }

  await mkdir(path.resolve(outDir), { recursive: true });
  const result = await rehearseBackup(snapshot, outDir, argument("expect-digest"));

  console.log(`Snapshot: ${result.snapshotId}`);
  console.log(`Snapshot integrity: ${result.verification.passed ? "PASS" : "FAIL"}`);
  if (result.rehearsal) {
    console.log(`Dry-run rehearsal: ${result.rehearsal.validation.passed ? "PASS" : "FAIL"}`);
    console.log(`Collections: ${result.rehearsal.collections.join(", ") || "(none)"}`);
    console.log(`Artifacts: ${result.rehearsal.artifacts.join(", ")}`);
    for (const check of result.rehearsal.validation.checks.filter((entry) => !entry.passed)) {
      console.error(`  FAIL ${check.domain}/${check.name}: ${check.detail ?? "validation failed"}`);
    }
  } else {
    console.log("Dry-run rehearsal: SKIPPED (snapshot integrity failed)");
    for (const check of result.verification.checks.filter((entry) => !entry.passed)) {
      console.error(`  FAIL ${check.domain}/${check.name}: ${check.detail ?? "integrity check failed"}`);
    }
  }
  console.log(`Combined rehearsal: ${result.passed ? "PASS" : "FAIL"} (not a restore test)`);

  if (!result.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

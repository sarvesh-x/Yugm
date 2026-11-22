/**
 * Local-only migration rehearsal CLI.
 *
 * Reads an already-exported snapshot directory (never MongoDB or D1), runs the
 * reviewed mappings in dry-run mode and writes aggregate validation artifacts.
 * It performs no writes to any database, bucket or remote service.
 *
 * Usage:
 *   npm run migrate:rehearse -- --snapshot <snapshot-directory> [--out <output-directory>]
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { rehearseSnapshot } from "../migration/rehearsal.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const snapshotDirectory = argument("snapshot");
  if (!snapshotDirectory) {
    console.error("Missing --snapshot <directory>. Export a local snapshot first; this tool never reads MongoDB directly.");
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

  const outputDirectory = path.resolve(argument("out") ?? path.join(process.cwd(), ".migration", "rehearsal"));
  const result = await rehearseSnapshot({ snapshotDirectory: resolved, outputDirectory });

  console.log(`Snapshot: ${result.snapshotId}`);
  console.log(`Collections rehearsed: ${result.collections.join(", ")}`);
  console.log(`Transformed root rows (id_map): ${result.idMapCount}`);
  console.log(`id_map checksum: ${result.idMapChecksum}`);
  console.log(`Validation: ${result.validation.passed ? "PASS" : "FAIL"}`);
  for (const check of result.validation.checks.filter((entry) => !entry.passed)) {
    console.error(`  FAIL ${check.domain}/${check.name}: expected ${check.expected}, actual ${check.actual}${check.detail ? ` (${check.detail})` : ""}`);
  }
  for (const file of result.artifacts) console.log(`Artifact: ${file}`);

  if (!result.validation.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

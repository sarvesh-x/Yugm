/**
 * Local-only delta diff between two copied snapshots.
 *
 * Reads only manifest-declared batch files in two local directories. It never
 * connects to MongoDB, D1, R2 or any remote service. Exit 0 means the diff was
 * computed; it does not mean the two snapshots are identical.
 *
 * Usage:
 *   npm run snapshot:diff -- --before <dir> --after <dir> [--max-examples 20] [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { diffSnapshots } from "../migration/snapshotDiff.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const before = argument("before");
  const after = argument("after");
  if (!before || !after) {
    console.error("Missing --before <directory> or --after <directory>. This tool never reads a database directly.");
    process.exit(1);
  }

  const maxExamplesRaw = argument("max-examples");
  const maxExamples = maxExamplesRaw === undefined ? 20 : Number(maxExamplesRaw);
  if (!Number.isInteger(maxExamples) || maxExamples < 0) {
    console.error("--max-examples must be a non-negative integer");
    process.exit(1);
  }

  const report = await diffSnapshots(before, after, { maxExamples });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote snapshot diff to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `${report.before.snapshotId} -> ${report.after.snapshotId}: ` +
      `added ${report.summary.added}, removed ${report.summary.removed}, ` +
      `changed ${report.summary.changed}, unchanged ${report.summary.unchanged}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

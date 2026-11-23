/**
 * Local-only deletion inventory CLI for final delta-sync planning.
 *
 * Usage:
 *   npm run delta:deletions -- --before <dir> --after <dir> [--soft-field deletedAt] [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditDeletions } from "../migration/deletionAudit.js";

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

  const report = await auditDeletions(before, after, { softField: argument("soft-field") });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote deletion audit to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `${report.before} -> ${report.after}: hard removed ${report.hardRemoved}, ` +
      `soft deleted ${report.softDeleted} (${report.softField})`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

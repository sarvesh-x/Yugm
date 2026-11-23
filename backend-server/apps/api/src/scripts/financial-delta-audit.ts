/**
 * Local-only financial delta sizing CLI.
 *
 * Usage:
 *   npm run delta:finance -- --before <dir> --after <dir> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditFinancialDelta } from "../migration/financialDeltaAudit.js";

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

  const report = await auditFinancialDelta(before, after);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote financial delta audit to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `${report.before} -> ${report.after}: financial added ${report.summary.added}, ` +
      `removed ${report.summary.removed}, changed ${report.summary.changed}; ` +
      `${report.reviewItems.length} review items remain open`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Local-only child-row replacement impact CLI.
 *
 * Usage:
 *   npm run delta:child-tables -- [--manifest <path>] [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadChildTableAudit } from "../migration/childTableAudit.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const manifest = argument("manifest") ?? "migrations/d1/0001_initial.manifest.json";
  const report = await loadChildTableAudit(manifest);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote child-table impact report to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Child-table impact: ${report.impactedRootCount} root tables, ${report.childTableCount} child tables, ` +
      `${report.reviewItems.length} review items remain open`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

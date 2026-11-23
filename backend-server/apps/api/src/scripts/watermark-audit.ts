/**
 * Local-only watermark candidate audit for final delta-sync planning.
 *
 * Usage:
 *   npm run delta:watermark -- --snapshot <dir> --field updatedAt [--out <report.json>]
 *   npm run delta:watermark -- --input <records.jsonl> --field updatedAt [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditWatermark, readWatermarkInput } from "../migration/watermarkAudit.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const field = argument("field");
  if (!field) {
    console.error("Missing --field <name>. This tool never reads a database directly.");
    process.exit(1);
  }

  const { source, records } = await readWatermarkInput({ input: argument("input"), snapshot: argument("snapshot") });
  const report = auditWatermark(records, source, { field });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote watermark audit to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Source: ${report.source}; field: ${report.field}; records: ${report.recordCount}; ` +
      `viable: ${report.viable}; already sorted: ${report.alreadySorted}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

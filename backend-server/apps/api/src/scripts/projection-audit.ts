/**
 * Local-only DCR-2 projection cross-check CLI.
 *
 * Usage:
 *   npm run capacity:projection -- --before <dir> --after <dir> --metrics <file.json> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditProjection } from "../migration/projectionAudit.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const before = argument("before");
  const after = argument("after");
  const metrics = argument("metrics");
  if (!before || !after || !metrics) {
    console.error("Missing --before <dir>, --after <dir> or --metrics <metrics.json>. This tool never reads a database directly.");
    process.exit(1);
  }

  const report = await auditProjection(before, after, metrics);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote projection audit to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `${report.windowHours === null ? "invalid watermark window" : `${report.windowHours.toFixed(2)}h window`}: ` +
      `observed growth ${report.observedGrowthBytes} bytes; ` +
      `declared projection >= observed: ${report.declaredAtLeastObserved ?? "unknown"}; ` +
      `${report.reviewItems.length} review items remain open`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

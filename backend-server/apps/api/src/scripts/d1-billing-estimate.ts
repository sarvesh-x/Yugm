/**
 * Local-only D1 billing estimate CLI for DCR-2.
 *
 * Usage:
 *   npm run capacity:billing -- --queries <observations.jsonl> --metrics <metrics.json> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { estimateD1Billing, readBillingInputs } from "../migration/d1BillingEstimate.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const queries = argument("queries");
  const metrics = argument("metrics");
  if (!queries || !metrics) {
    console.error("Missing --queries <observations.jsonl> or --metrics <metrics.json>. This tool never reads a database directly.");
    process.exit(1);
  }

  const inputs = await readBillingInputs(queries, metrics);
  const report = estimateD1Billing(inputs.observations, inputs.metrics, inputs.source);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote D1 billing estimate to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `D1 billing estimate: reads ${report.rowsReadPerMonth}/month, writes ${report.rowsWrittenPerMonthUpperBound}/month upper bound; ` +
      `within included reads/writes/storage: ${report.withinIncludedReads}/${report.withinIncludedWrites}/${report.withinIncludedStorage}; ` +
      `${report.reviewItems.length} review items remain open`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

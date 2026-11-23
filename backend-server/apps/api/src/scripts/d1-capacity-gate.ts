/**
 * Local-only D1 hard-limit screening CLI.
 *
 * Reads an aggregate metrics JSON file supplied by the caller. It never reads
 * MongoDB, D1, Cloudflare or any remote service. Exit 0 means no documented
 * hard limit was exceeded; it does NOT mean DCR-2 capacity acceptance is complete.
 *
 * Usage:
 *   npm run capacity:gate -- --input <metrics.json> [--out <report.json>]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateD1CapacityGates, parseD1CapacityMetrics } from "../migration/d1CapacityGate.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const input = argument("input");
  if (!input) {
    console.error("Missing --input <metrics.json>. This tool never reads a database or Cloudflare account.");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.resolve(input), "utf8")) as unknown;
  } catch (error) {
    console.error(`Cannot read metrics JSON: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const metrics = parseD1CapacityMetrics(parsed);
  const report = evaluateD1CapacityGates(metrics);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote D1 capacity screening report to ${target}`);
  } else {
    process.stdout.write(json);
  }

  console.error(`Snapshot: ${report.snapshotId} (${report.sourceEnvironment})`);
  console.error(`D1 hard-limit screening: ${report.hardGatesPassed ? "PASS" : "FAIL"}`);
  console.error(`DCR-2 capacity gate: REVIEW REQUIRED (${report.reviewItems.length} items)`);
  for (const check of report.checks.filter((entry) => !entry.passed)) {
    console.error(`  FAIL ${check.domain}/${check.name}: ${check.detail ?? "hard limit exceeded"}`);
  }
  for (const item of report.reviewItems) {
    console.error(`  REVIEW ${item.id}: ${item.measurement}`);
  }

  if (!report.hardGatesPassed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

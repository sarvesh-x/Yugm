/**
 * Local-only DCR-2 metrics intake CLI.
 *
 * Usage:
 *   npm run capacity:intake -- --template [--out <file.json>]
 *   npm run capacity:intake -- --input <metrics.json>
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyDcr2MetricsTemplate, screenReadyMetrics } from "../migration/dcr2MetricsIntake.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const output = argument("out");
  const template = process.argv.includes("--template");
  if (template) {
    const json = `${JSON.stringify(emptyDcr2MetricsTemplate(), null, 2)}\n`;
    if (output) {
      const target = path.resolve(output);
      await writeFile(target, json, "utf8");
      console.log(`Wrote DCR-2 metrics template to ${target}`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  const input = argument("input");
  if (!input) {
    console.error("Missing --input <metrics.json> or --template. This tool never reads a database directly.");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.resolve(input), "utf8")) as unknown;
  } catch (error) {
    console.error(`Cannot read metrics JSON: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const { intake, report } = screenReadyMetrics(parsed);
  console.log(`DCR-2 metrics intake: ${intake.ready ? "READY" : "NOT READY"}`);
  for (const field of intake.missing) console.error(`  MISSING ${field}: ${intake.guidance[field]}`);
  for (const field of intake.invalid) console.error(`  INVALID ${field}: ${intake.guidance[field]}`);
  if (intake.extra.length) console.error(`  EXTRA keys ignored: ${intake.extra.join(", ")}`);

  if (!report) process.exit(1);
  console.log(`D1 hard-limit screening: ${report.hardGatesPassed ? "PASS" : "FAIL"}`);
  console.log(`Open review items: ${report.reviewItems.length}`);
  if (!report.hardGatesPassed) {
    for (const check of report.checks.filter((entry) => !entry.passed)) {
      console.error(`  FAIL ${check.domain}/${check.name}: ${check.detail ?? "hard limit exceeded"}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

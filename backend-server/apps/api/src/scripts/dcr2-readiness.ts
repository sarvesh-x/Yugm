/**
 * Local-only DCR-2 readiness summary CLI.
 *
 * Usage:
 *   npm run capacity:status -- --capacity <report.json> --projection <report.json> --queries <report.json> --billing <report.json> --recovery <report.json> --attestation <attestation.json> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeDcr2Readiness } from "../migration/dcr2Readiness.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const files = {
    capacity: argument("capacity"),
    projection: argument("projection"),
    queries: argument("queries"),
    billing: argument("billing"),
    recovery: argument("recovery"),
    attestation: argument("attestation"),
  };
  const missing = Object.entries(files).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    console.error(`Missing report argument(s): ${missing.join(", ")}`);
    process.exit(1);
  }

  const report = await summarizeDcr2Readiness(files as Parameters<typeof summarizeDcr2Readiness>[0]);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote DCR-2 readiness summary to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `DCR-2 readiness: ${report.ready ? "READY" : "NOT READY"} ` +
      `(${report.checks.filter((entry) => entry.passed).length}/${report.checks.length} checks); ` +
      `${report.openReviewItemCount} review items remain open (not production acceptance)`
  );
  if (!report.ready) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

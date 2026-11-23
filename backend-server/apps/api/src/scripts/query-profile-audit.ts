/**
 * Local-only query-profile audit CLI for DCR-2.
 *
 * Usage:
 *   npm run capacity:queries -- --input <observations.jsonl> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildQueryProfile, readQueryProfileInput } from "../migration/queryProfileAudit.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const input = argument("input");
  if (!input) {
    console.error("Missing --input <observations.jsonl>. This tool never reads a database directly.");
    process.exit(1);
  }

  const { source, records } = await readQueryProfileInput(input);
  const report = buildQueryProfile(records, source);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote query profile audit to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Source: ${report.source}; observations: ${report.recordCount}; ` +
      `hard gates: ${report.hardGatesPassed ? "PASS" : "FAIL"}; ` +
      `review items: ${report.reviewItems.length}`
  );
  if (!report.hardGatesPassed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

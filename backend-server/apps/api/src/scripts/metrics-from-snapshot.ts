/**
 * Read-only DCR-2 metric derivation from an exported snapshot directory.
 *
 * Usage:
 *   npm run metrics:from-snapshot -- --snapshot <dir> [--strip "<collection>.<field>" ...]
 *     [--detect-binary-like] [--out <report.json>] [--metrics-out <metrics.json>]
 *
 * It never connects to a database or reads credentials. Fields it cannot derive
 * remain null and are listed with a reason in the report.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveMetricsFromSnapshot } from "../migration/metricsFromSnapshot.js";

function values(name: string): string[] {
  const flag = `--${name}`;
  const found: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) found.push(process.argv[index + 1]);
  }
  return found;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const snapshot = values("snapshot")[0];
  if (!snapshot) {
    console.error("Missing --snapshot <directory>. This tool never reads a database directly.");
    process.exit(1);
  }

  const report = await deriveMetricsFromSnapshot(snapshot, {
    stripFields: values("strip"),
    detectBinaryLike: flag("detect-binary-like"),
  });

  const output = values("out")[0];
  if (output) {
    const target = path.resolve(output);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Wrote derivation report to ${target}`);
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }

  const metricsOutput = values("metrics-out")[0];
  if (metricsOutput) {
    const target = path.resolve(metricsOutput);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report.metrics, null, 2)}\n`, "utf8");
    console.log(`Wrote partially-filled metrics template to ${target}`);
  }

  console.error(
    `Derived ${report.provenance.filter((entry) => entry.status === "derived").length} fields; ` +
      `${report.provenance.filter((entry) => entry.status === "not-derivable").length} fields need owner input. ` +
      `Records: ${report.reconciliation.recordCount}; ` +
      `binary candidates: ${report.binaryCandidates.length}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

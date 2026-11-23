/**
 * Local-only legacy media reference scanner for DCR-4 input preparation.
 *
 * Reads a JSONL export or an already-copied snapshot directory. It never reads
 * MongoDB, R2, Cloudflare or any remote service, and emits counts and URL
 * digests rather than raw URLs or customer content. It does not verify binaries.
 *
 * Usage:
 *   npm run inventory:legacy-media -- --input <records.jsonl> [--out <report.json>]
 *   npm run inventory:legacy-media -- --snapshot <snapshot-directory> [--out <report.json>]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readLegacyReferenceInput, scanLegacyMediaReferences } from "../migration/legacyMediaReferences.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const { source, records } = await readLegacyReferenceInput({
    input: argument("input"),
    snapshot: argument("snapshot"),
  });
  const report = scanLegacyMediaReferences(records, source);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote legacy media reference report to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Source: ${report.source}; records: ${report.recordCount}; references: ${report.totalReferences}; ` +
      `legacy public uploads: ${report.counts.legacyPublicUploads}; unique legacy digests: ${report.uniqueLegacyDigests.length}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

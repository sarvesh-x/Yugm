/**
 * Local-only media inventory CLI for DCR-4 decision input.
 *
 * Reads a local JSONL file of exported MediaObject-shaped records. It never
 * connects to MongoDB, R2 or any remote service, and writes no state unless
 * --out is supplied. The source export itself still requires owner approval.
 *
 * Usage:
 *   npm run inventory:media -- --input <records.jsonl> [--out <report.json>]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMediaInventory, type MediaInventoryRecord } from "../migration/mediaInventory.js";

function argument(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredString(value: unknown, field: string, line: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`line ${line}: ${field} must be a non-empty string`);
  }
  return value;
}

function parseRecords(content: string): MediaInventoryRecord[] {
  const records: MediaInventoryRecord[] = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      throw new Error(`line ${index + 1}: invalid JSON`);
    }
    const fileSize = raw.fileSize;
    if (typeof fileSize !== "number" || !Number.isFinite(fileSize)) {
      throw new Error(`line ${index + 1}: fileSize must be a finite number`);
    }
    const variants = Array.isArray(raw.variants)
      ? raw.variants.map((variant, variantIndex) => {
          const entry = variant as Record<string, unknown>;
          if (typeof entry.bytes !== "number" || !Number.isFinite(entry.bytes)) {
            throw new Error(`line ${index + 1}: variants[${variantIndex}].bytes must be a finite number`);
          }
          return {
            bucket: requiredString(entry.bucket, "variants.bucket", index + 1),
            key: requiredString(entry.key, "variants.key", index + 1),
            bytes: entry.bytes,
          };
        })
      : [];

    records.push({
      id: requiredString(raw.id ?? raw._id, "id", index + 1),
      bucket: requiredString(raw.bucket, "bucket", index + 1),
      storageKey: requiredString(raw.storageKey, "storageKey", index + 1),
      category: requiredString(raw.category, "category", index + 1),
      ownerType: requiredString(raw.ownerType, "ownerType", index + 1),
      mediaType: requiredString(raw.mediaType, "mediaType", index + 1),
      visibility: requiredString(raw.visibility, "visibility", index + 1),
      processingStatus: requiredString(raw.processingStatus, "processingStatus", index + 1),
      moderationStatus: requiredString(raw.moderationStatus, "moderationStatus", index + 1),
      fileSize,
      checksum: typeof raw.checksum === "string" ? raw.checksum : undefined,
      deletedAt: typeof raw.deletedAt === "string" ? raw.deletedAt : null,
      variants,
    });
  }
  return records;
}

async function main() {
  const input = argument("input");
  if (!input) {
    console.error("Missing --input <records.jsonl>. Export media records first; this tool never reads MongoDB directly.");
    process.exit(1);
  }

  const records = parseRecords(await readFile(path.resolve(input), "utf8"));
  const report = buildMediaInventory(records);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = argument("out");
  if (output) {
    const target = path.resolve(output);
    await writeFile(target, json, "utf8");
    console.log(`Wrote media inventory to ${target}`);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Records: ${report.recordCount}; original bytes: ${report.originalBytes}; variant bytes: ${report.variantBytes}; digest: ${report.digest}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

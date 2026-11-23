/**
 * Read-only audit of a proposed watermark field for final delta sync.
 *
 * Validates caller-supplied exported records only. It does not choose the
 * watermark, read MongoDB or D1, and it does not implement delta export.
 * A viable result means the field can form a deterministic composite cursor
 * with `_id`; it does not prove that MongoDB can export by that cursor.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readDeclaredSnapshotRecords, type LocatedSnapshotRecord } from "./snapshot.js";

export interface WatermarkAuditOptions {
  field: string;
}

export interface WatermarkAuditReport {
  source: string;
  field: string;
  recordCount: number;
  covered: number;
  missing: number;
  invalid: number;
  uniqueCompositeKeys: number;
  duplicateCompositeKeys: number;
  inversions: number;
  alreadySorted: boolean;
  minValue: string | null;
  maxValue: string | null;
  missingIdExamples: string[];
  invalidValueExamples: string[];
  /** Deterministic ordering is possible, but MongoDB export support is not proven. */
  viable: boolean;
  digest: string;
}

function normalizeValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
    return value.trim();
  }
  return null;
}

function recordId(record: Record<string, unknown>): string | null {
  const value = record._id;
  if ((typeof value === "string" || typeof value === "number") && String(value).length > 0) return String(value);
  return null;
}

function examples(values: string[]): string[] {
  return values.slice(0, 10);
}

export function auditWatermark(
  records: readonly LocatedSnapshotRecord[],
  source: string,
  options: WatermarkAuditOptions
): WatermarkAuditReport {
  if (!options.field.trim()) throw new Error("field must be a non-empty string");

  const keys: string[] = [];
  const missingIdExamples: string[] = [];
  const invalidValueExamples: string[] = [];
  let covered = 0;
  let missing = 0;
  let invalid = 0;

  for (const { record } of records) {
    const id = recordId(record);
    const raw = record[options.field];
    const missingValue = raw === undefined || raw === null || raw === "";
    const value = missingValue ? null : normalizeValue(raw);

    if (value) covered += 1;
    if (missingValue) missing += 1;
    else if (!value && id) invalid += 1;

    if (!id) {
      missingIdExamples.push("<missing _id>");
      continue;
    }
    if (missingValue) {
      missingIdExamples.push(id);
      continue;
    }
    if (!value) {
      invalidValueExamples.push(id);
      continue;
    }
    keys.push(`${value}|${id}`);
  }

  const distinct = new Set(keys);
  const sortedKeys = [...keys].sort();
  let inversions = 0;
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index - 1] > keys[index]) inversions += 1;
  }

  const values = keys.map((key) => key.split("|", 1)[0] ?? "");
  const hash = createHash("sha256");
  hash.update(`${source}\n${options.field}\n${records.length}\n${covered}\n${missing}\n${invalid}\n`);
  for (const key of sortedKeys) hash.update(`${key}\n`);

  return {
    source,
    field: options.field,
    recordCount: records.length,
    covered,
    missing,
    invalid,
    uniqueCompositeKeys: distinct.size,
    duplicateCompositeKeys: keys.length - distinct.size,
    inversions,
    alreadySorted: inversions === 0,
    minValue: values.length ? [...values].sort()[0] : null,
    maxValue: values.length ? [...values].sort().at(-1) ?? null : null,
    missingIdExamples: examples(missingIdExamples),
    invalidValueExamples: examples(invalidValueExamples),
    viable:
      covered > 0 &&
      missing === 0 &&
      invalid === 0 &&
      missingIdExamples.length === 0 &&
      keys.length > 0 &&
      distinct.size === keys.length,
    digest: hash.digest("hex"),
  };
}

async function readJsonl(file: string): Promise<LocatedSnapshotRecord[]> {
  const content = await readFile(path.resolve(file), "utf8");
  const records: LocatedSnapshotRecord[] = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      records.push({ collection: path.basename(file), record: JSON.parse(line) as Record<string, unknown> });
    } catch (error) {
      throw new Error(`${file} line ${index + 1}: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
  }
  return records;
}

export async function readWatermarkInput(options: {
  input?: string;
  snapshot?: string;
}): Promise<{ source: string; records: LocatedSnapshotRecord[] }> {
  if (Boolean(options.input) === Boolean(options.snapshot)) {
    throw new Error("supply exactly one of --input <records.jsonl> or --snapshot <directory>");
  }
  if (options.input) {
    return { source: path.basename(path.resolve(options.input)), records: await readJsonl(options.input) };
  }
  const { manifest, records } = await readDeclaredSnapshotRecords(path.resolve(options.snapshot as string));
  return { source: manifest.snapshotId, records };
}

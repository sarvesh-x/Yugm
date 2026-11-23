/**
 * Read-only scan of exported records for legacy media URL references.
 *
 * This complements `mediaInventory.ts`: MediaObject documents do not fully
 * represent historical `/uploads` files, avatar data URLs or private verification
 * routes. The scanner reads only caller-supplied JSONL records or an already
 * copied snapshot directory; it never opens MongoDB, R2, Cloudflare or the
 * filesystem outside those inputs. It records counts and URL *digests*, never
 * raw URLs or customer content, and does not check that binaries still exist.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSnapshotManifest, snapshotBatchFileName } from "./snapshot.js";

export const LEGACY_REFERENCE_KINDS = [
  "legacyPublicUploads",
  "legacyPrivateTrust",
  "legacyPrivateAssetsStaging",
  "legacyBadgeArt",
  "inlineDataUrl",
  "absoluteHttpUrl",
  "managedUploadEndpoint",
] as const;

export type LegacyReferenceKind = (typeof LEGACY_REFERENCE_KINDS)[number];

export interface LegacyMediaReferenceReport {
  source: string;
  recordCount: number;
  stringValuesScanned: number;
  longStringsSkipped: number;
  counts: Record<LegacyReferenceKind, number>;
  totalReferences: number;
  byField: Record<string, number>;
  byExtension: Record<string, number>;
  /** SHA-256 digests of de-queried legacy URL strings; raw URLs are never emitted. */
  uniqueLegacyDigests: string[];
  digest: string;
}

function emptyCounts(): Record<LegacyReferenceKind, number> {
  return {
    legacyPublicUploads: 0,
    legacyPrivateTrust: 0,
    legacyPrivateAssetsStaging: 0,
    legacyBadgeArt: 0,
    inlineDataUrl: 0,
    absoluteHttpUrl: 0,
    managedUploadEndpoint: 0,
  };
}

/** One category per string; managed endpoints are explicitly not legacy binaries. */
export function classifyMediaReference(value: string): LegacyReferenceKind | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/(?:^|\/)media\/uploads(?:\/|$)/i.test(trimmed)) return "managedUploadEndpoint";
  if (/\/api\/trust-verification\/media\//i.test(trimmed)) return "legacyPrivateTrust";
  if (/\/api\/admin\/assets\/staging\//i.test(trimmed)) return "legacyPrivateAssetsStaging";
  if (/\/api\/badge-art\//i.test(trimmed)) return "legacyBadgeArt";
  if (/^data:image\//i.test(trimmed)) return "inlineDataUrl";
  if (/(?:^|\/)uploads\/[^/?#]+/i.test(trimmed)) return "legacyPublicUploads";
  if (/^https?:\/\//i.test(trimmed)) return "absoluteHttpUrl";
  return null;
}

function extensionOf(value: string): string {
  const pathPart = value.split(/[?#]/, 1)[0] ?? "";
  const lastSegment = pathPart.split("/").pop() ?? "";
  const match = /\.([a-z0-9]{1,10})$/i.exec(lastSegment);
  return match ? match[1].toLowerCase() : "none";
}

function digestOf(value: string): string {
  const withoutQuery = value.trim().split(/[?#]/, 1)[0] ?? "";
  return createHash("sha256").update(withoutQuery).digest("hex");
}

function walk(value: unknown, fieldPath: string, visit: (field: string, text: string) => void): void {
  if (typeof value === "string") {
    visit(fieldPath, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, fieldPath ? `${fieldPath}[]` : "[]", visit);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, fieldPath ? `${fieldPath}.${key}` : key, visit);
    }
  }
}

export function scanLegacyMediaReferences(
  records: Iterable<unknown>,
  source: string
): LegacyMediaReferenceReport {
  const counts = emptyCounts();
  const byField: Record<string, number> = {};
  const byExtension: Record<string, number> = {};
  const digests = new Set<string>();
  let recordCount = 0;
  let stringValuesScanned = 0;
  let longStringsSkipped = 0;

  for (const record of records) {
    recordCount += 1;
    walk(record, "", (field, text) => {
      // Inline blobs can be megabytes; only `data:image/` values need classification.
      if (text.length > 4_096 && !/^data:image\//i.test(text.trim())) {
        longStringsSkipped += 1;
        return;
      }
      stringValuesScanned += 1;
      const kind = classifyMediaReference(text);
      if (!kind) return;

      counts[kind] += 1;
      const fieldKey = field || "(root)";
      byField[fieldKey] = (byField[fieldKey] ?? 0) + 1;
      const extension = extensionOf(text);
      byExtension[extension] = (byExtension[extension] ?? 0) + 1;
      if (kind === "legacyPublicUploads" || kind.startsWith("legacyPrivate") || kind === "legacyBadgeArt") {
        digests.add(digestOf(text));
      }
    });
  }

  const sortedDigests = [...digests].sort();
  const totalReferences = LEGACY_REFERENCE_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  const hash = createHash("sha256");
  hash.update(`${source}\n${recordCount}\n${stringValuesScanned}\n`);
  for (const kind of LEGACY_REFERENCE_KINDS) hash.update(`${kind}:${counts[kind]}\n`);
  for (const field of Object.keys(byField).sort()) hash.update(`field:${field}:${byField[field]}\n`);
  for (const extension of Object.keys(byExtension).sort()) hash.update(`ext:${extension}:${byExtension[extension]}\n`);
  for (const digest of sortedDigests) hash.update(`url:${digest}\n`);

  return {
    source,
    recordCount,
    stringValuesScanned,
    longStringsSkipped,
    counts,
    totalReferences,
    byField,
    byExtension,
    uniqueLegacyDigests: sortedDigests,
    digest: hash.digest("hex"),
  };
}

async function parseJsonl(content: string, origin: string): Promise<unknown[]> {
  const records: unknown[] = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as unknown);
    } catch (error) {
      throw new Error(`${origin} line ${index + 1}: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
  }
  return records;
}

export async function readLegacyReferenceInput(options: {
  input?: string;
  snapshot?: string;
}): Promise<{ source: string; records: unknown[] }> {
  if (Boolean(options.input) === Boolean(options.snapshot)) {
    throw new Error("supply exactly one of --input <records.jsonl> or --snapshot <directory>");
  }
  if (options.input) {
    const resolved = path.resolve(options.input);
    return {
      source: path.basename(resolved),
      records: await parseJsonl(await readFile(resolved, "utf8"), path.basename(resolved)),
    };
  }

  const directory = path.resolve(options.snapshot as string);
  const manifest = await readSnapshotManifest(directory);
  const records: unknown[] = [];
  for (const collection of manifest.collections) {
    for (const batch of collection.batches) {
      const file = snapshotBatchFileName(collection.name, batch.index);
      const content = await readFile(path.join(directory, file), "utf8");
      records.push(...(await parseJsonl(content, file)));
    }
  }
  return { source: manifest.snapshotId, records };
}

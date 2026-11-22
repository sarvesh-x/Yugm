/** Immutable snapshot files with stable checksums. No database or network access. */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SnapshotManifest, SnapshotSink, SnapshotSource, SourceRecord } from "./types.js";

/** Deterministic JSON for checksums: sorted keys, ISO dates, hex ObjectIds. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== "object") return JSON.stringify(value);
  const maybeObjectId = value as { toHexString?: () => string };
  if (typeof maybeObjectId.toHexString === "function") return JSON.stringify(maybeObjectId.toHexString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function checksum(records: readonly SourceRecord[]): string {
  const hash = createHash("sha256");
  for (const record of records) hash.update(stableStringify(record)).update("\n");
  return hash.digest("hex");
}

/** Shared batch filename convention; the backup verifier uses this to locate declared files. */
export function snapshotBatchFileName(name: string, batchIndex: number): string {
  return `${name}-${String(batchIndex).padStart(6, "0")}.jsonl`;
}

export class FileSystemSnapshotStore implements SnapshotSink, SnapshotSource {
  constructor(private readonly directory: string) {}

  async writeCollection(name: string, batchIndex: number, records: readonly SourceRecord[]) {
    await mkdir(this.directory, { recursive: true });
    const content = records.map((record) => stableStringify(record)).join("\n");
    const bytes = Buffer.byteLength(content, "utf8");
    await writeFile(path.join(this.directory, snapshotBatchFileName(name, batchIndex)), content, "utf8");
    return { bytes, checksum: checksum(records) };
  }

  async writeManifest(manifest: SnapshotManifest) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      path.join(this.directory, "snapshot-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
  }

  async *readCollectionBatches(name: string): AsyncIterable<SourceRecord[]> {
    const prefix = `${name}-`;
    const files = (await readdir(this.directory))
      .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".jsonl"))
      .sort();
    for (const file of files) {
      const content = await readFile(path.join(this.directory, file), "utf8");
      yield content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as SourceRecord);
    }
  }
}

export async function readSnapshotManifest(directory: string): Promise<SnapshotManifest> {
  return JSON.parse(await readFile(path.join(directory, "snapshot-manifest.json"), "utf8")) as SnapshotManifest;
}

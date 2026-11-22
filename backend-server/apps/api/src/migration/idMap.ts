/**
 * Durable source-to-target ID map artifacts.
 *
 * The current mappings preserve ObjectId/string keys as `source_id`, so the
 * default target ID equals the source ID. The registry still records every
 * mapping explicitly and rejects conflicting duplicate keys, so a future
 * renumbering cannot silently produce ambiguous references.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAPPING_VERSION } from "./mappings.js";
import { stableStringify } from "./snapshot.js";

export interface IdMapEntry {
  source_collection: string;
  source_id: string;
  target_table: string;
  target_id: string;
  mapping_version: string;
  checksum: string;
}

function entryChecksum(entry: Omit<IdMapEntry, "checksum">): string {
  return createHash("sha256").update(stableStringify(entry)).digest("hex");
}

export function makeIdMapEntry(
  sourceCollection: string,
  targetTable: string,
  sourceId: string,
  targetId: string = sourceId,
  mappingVersion: string = MAPPING_VERSION
): IdMapEntry {
  if (!sourceCollection || !targetTable || !sourceId || !targetId) {
    throw new Error("id_map entries require collection, table and both IDs");
  }
  const base = {
    source_collection: sourceCollection,
    source_id: sourceId,
    target_table: targetTable,
    target_id: targetId,
    mapping_version: mappingVersion
  };
  return { ...base, checksum: entryChecksum(base) };
}

export class IdMapRegistry {
  private readonly entries: IdMapEntry[] = [];
  private readonly byKey = new Map<string, IdMapEntry>();

  add(entry: IdMapEntry): void {
    const key = `${entry.source_collection}:${entry.source_id}`;
    const existing = this.byKey.get(key);
    if (!existing) {
      this.byKey.set(key, entry);
      this.entries.push(entry);
      return;
    }
    // Exact replays are harmless; conflicting targets must never be accepted.
    if (existing.target_table === entry.target_table && existing.target_id === entry.target_id) return;
    throw new Error(`Conflicting id_map entry for ${key}`);
  }

  addMany(entries: readonly IdMapEntry[]): void {
    for (const entry of entries) this.add(entry);
  }

  lookup(sourceCollection: string, sourceId: string): IdMapEntry | undefined {
    return this.byKey.get(`${sourceCollection}:${sourceId}`);
  }

  get size(): number {
    return this.entries.length;
  }

  list(): readonly IdMapEntry[] {
    return [...this.entries];
  }

  toJsonl(): string {
    return this.entries.map((entry) => stableStringify(entry)).join("\n") + (this.entries.length ? "\n" : "");
  }

  checksum(): string {
    return createHash("sha256").update(this.toJsonl()).digest("hex");
  }

  async write(directory: string): Promise<string> {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, "id-map.jsonl");
    await writeFile(file, this.toJsonl(), "utf8");
    return file;
  }
}

/**
 * Read-only deletion inventory for final delta-sync planning.
 *
 * Compares two copied snapshots and lists source IDs present in the baseline
 * but absent from the later snapshot, plus soft-delete markers in the later
 * snapshot. It does not implement tombstones, deletion lists or D1 deletes,
 * and it never connects to MongoDB, D1, R2 or any remote service.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { readDeclaredSnapshotRecords } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

export interface CollectionDeletionAudit {
  name: string;
  beforeCount: number;
  afterCount: number;
  removedIds: string[];
  softDeletedIds: string[];
  collectionAbsentAfter: boolean;
}

export interface DeletionAuditReport {
  before: string;
  after: string;
  softField: string;
  hardRemoved: number;
  softDeleted: number;
  collections: CollectionDeletionAudit[];
  digest: string;
}

function idOf(record: SourceRecord): string | null {
  const value = record._id;
  if ((typeof value === "string" || typeof value === "number") && String(value).length > 0) return String(value);
  return null;
}

function isSoftDeleted(record: SourceRecord, field: string): boolean {
  const value = record[field];
  if (value === true) return true;
  if (typeof value === "string" && ["DELETED", "REMOVED", "ARCHIVED"].includes(value.toUpperCase())) return true;
  return value !== undefined && value !== null && value !== false && value !== "";
}

export async function auditDeletions(
  beforeDirectory: string,
  afterDirectory: string,
  options: { softField?: string } = {}
): Promise<DeletionAuditReport> {
  const softField = options.softField ?? "deletedAt";
  if (!softField.trim()) throw new Error("softField must be a non-empty string");

  const before = await readDeclaredSnapshotRecords(path.resolve(beforeDirectory));
  const after = await readDeclaredSnapshotRecords(path.resolve(afterDirectory));
  const beforeNames = new Set(before.manifest.collections.map((entry) => entry.name));
  const afterNames = new Set(after.manifest.collections.map((entry) => entry.name));
  const names = [...new Set([...beforeNames, ...afterNames])].sort();

  const beforeById = new Map<string, Map<string, SourceRecord>>();
  const afterById = new Map<string, Map<string, SourceRecord>>();
  const beforeCounts = new Map<string, number>();
  const afterCounts = new Map<string, number>();

  for (const { collection, record } of before.records) {
    const id = idOf(record);
    if (!id) continue;
    const map = beforeById.get(collection) ?? new Map<string, SourceRecord>();
    map.set(id, record);
    beforeById.set(collection, map);
    beforeCounts.set(collection, (beforeCounts.get(collection) ?? 0) + 1);
  }
  for (const { collection, record } of after.records) {
    const id = idOf(record);
    if (!id) continue;
    const map = afterById.get(collection) ?? new Map<string, SourceRecord>();
    map.set(id, record);
    afterById.set(collection, map);
    afterCounts.set(collection, (afterCounts.get(collection) ?? 0) + 1);
  }

  const collections: CollectionDeletionAudit[] = names.map((name) => {
    const baseline = beforeById.get(name) ?? new Map<string, SourceRecord>();
    const later = afterById.get(name) ?? new Map<string, SourceRecord>();
    const removedIds = [...baseline.keys()].filter((id) => !later.has(id)).sort();
    const softDeletedIds = [...later.entries()]
      .filter(([, record]) => isSoftDeleted(record, softField))
      .map(([id]) => id)
      .sort();
    return {
      name,
      beforeCount: beforeCounts.get(name) ?? 0,
      afterCount: afterCounts.get(name) ?? 0,
      removedIds,
      softDeletedIds,
      collectionAbsentAfter: !afterNames.has(name),
    };
  });

  const hash = createHash("sha256");
  hash.update(`${before.manifest.snapshotId}|${after.manifest.snapshotId}|${softField}\n`);
  for (const entry of collections) {
    hash.update(`${entry.name}|${entry.removedIds.length}|${entry.softDeletedIds.length}|${entry.collectionAbsentAfter}\n`);
    for (const id of entry.removedIds) hash.update(`-${entry.name}:${id}\n`);
    for (const id of entry.softDeletedIds) hash.update(`~${entry.name}:${id}\n`);
  }

  return {
    before: before.manifest.snapshotId,
    after: after.manifest.snapshotId,
    softField,
    hardRemoved: collections.reduce((sum, entry) => sum + entry.removedIds.length, 0),
    softDeleted: collections.reduce((sum, entry) => sum + entry.softDeletedIds.length, 0),
    collections,
    digest: hash.digest("hex"),
  };
}

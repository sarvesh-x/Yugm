/**
 * Read-only delta diff between two copied snapshots.
 *
 * Supports the final delta-sync gate by reporting added/removed/changed records
 * per collection. It reads only local snapshot directories declared by their
 * manifests, emits source IDs and content digests only (never record values),
 * and never connects to MongoDB, D1, R2 or any remote service.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { readDeclaredSnapshotRecords, stableStringify } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

export interface SnapshotIdentity {
  snapshotId: string;
  sourceDatabase: string;
  watermark: string;
  collectionCount: number;
  recordCount: number;
}

export interface ChangedRecord {
  id: string;
  beforeDigest: string;
  afterDigest: string;
  /** Top-level field names only; values are never emitted. */
  changedFields: string[];
}

export interface CollectionDiff {
  name: string;
  beforeCount: number;
  afterCount: number;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  invalidIds: number;
  duplicateIds: string[];
  addedExamples: string[];
  removedExamples: string[];
  changedExamples: ChangedRecord[];
}

export interface SnapshotDiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  invalidIds: number;
  duplicateIds: number;
  watermarkAdvanced: boolean;
}

export interface SnapshotDiffReport {
  before: SnapshotIdentity;
  after: SnapshotIdentity;
  summary: SnapshotDiffSummary;
  collections: CollectionDiff[];
  digest: string;
}

interface IndexedRecord {
  digest: string;
  record: SourceRecord;
}

function identity(record: SourceRecord): string | undefined {
  const value = record._id;
  if ((typeof value === "string" || typeof value === "number") && String(value).length > 0) return String(value);
  return undefined;
}

function recordDigest(record: SourceRecord): string {
  return createHash("sha256").update(stableStringify(record)).digest("hex");
}

function changedFields(before: SourceRecord, after: SourceRecord): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => stableStringify(before[key]) !== stableStringify(after[key]))
    .sort();
}

function indexRecords(records: readonly SourceRecord[]) {
  const byId = new Map<string, IndexedRecord>();
  const duplicateIds = new Set<string>();
  let invalidIds = 0;
  for (const record of records) {
    const id = identity(record);
    if (!id) {
      invalidIds += 1;
      continue;
    }
    if (byId.has(id)) duplicateIds.add(id);
    byId.set(id, { digest: recordDigest(record), record });
  }
  return { byId, duplicateIds: [...duplicateIds].sort(), invalidIds };
}

function examples<T>(values: readonly T[], limit: number): T[] {
  return values.slice(0, limit);
}

export async function diffSnapshots(
  beforeDirectory: string,
  afterDirectory: string,
  options: { maxExamples?: number } = {}
): Promise<SnapshotDiffReport> {
  const maxExamples = options.maxExamples ?? 20;
  if (!Number.isInteger(maxExamples) || maxExamples < 0) {
    throw new Error("maxExamples must be a non-negative integer");
  }

  const before = await readDeclaredSnapshotRecords(path.resolve(beforeDirectory));
  const after = await readDeclaredSnapshotRecords(path.resolve(afterDirectory));
  const beforeNames = new Set(before.manifest.collections.map((entry) => entry.name));
  const afterNames = new Set(after.manifest.collections.map((entry) => entry.name));
  const names = [...new Set([...beforeNames, ...afterNames])].sort();

  const beforeByCollection = new Map<string, SourceRecord[]>();
  const afterByCollection = new Map<string, SourceRecord[]>();
  for (const entry of before.records) {
    const list = beforeByCollection.get(entry.collection) ?? [];
    list.push(entry.record);
    beforeByCollection.set(entry.collection, list);
  }
  for (const entry of after.records) {
    const list = afterByCollection.get(entry.collection) ?? [];
    list.push(entry.record);
    afterByCollection.set(entry.collection, list);
  }

  const collections: CollectionDiff[] = [];
  const deltaFingerprint: string[] = [];
  for (const name of names) {
    const beforeRecords = beforeByCollection.get(name) ?? [];
    const afterRecords = afterByCollection.get(name) ?? [];
    const left = indexRecords(beforeRecords);
    const right = indexRecords(afterRecords);
    const addedIds: string[] = [];
    const removedIds: string[] = [];
    const changedRecords: ChangedRecord[] = [];
    let unchanged = 0;

    for (const id of [...right.byId.keys()].sort()) {
      const current = right.byId.get(id)!;
      const previous = left.byId.get(id);
      if (!previous) addedIds.push(id);
      else if (previous.digest === current.digest) unchanged += 1;
      else {
        changedRecords.push({
          id,
          beforeDigest: previous.digest,
          afterDigest: current.digest,
          changedFields: changedFields(previous.record, current.record),
        });
      }
    }
    for (const id of [...left.byId.keys()].sort()) {
      if (!right.byId.has(id)) removedIds.push(id);
    }

    for (const id of addedIds) deltaFingerprint.push(`+${name}:${id}`);
    for (const id of removedIds) deltaFingerprint.push(`-${name}:${id}`);
    for (const change of changedRecords) {
      deltaFingerprint.push(`~${name}:${change.id}|${change.beforeDigest}|${change.afterDigest}`);
    }

    collections.push({
      name,
      beforeCount: beforeRecords.length,
      afterCount: afterRecords.length,
      added: addedIds.length,
      removed: removedIds.length,
      changed: changedRecords.length,
      unchanged,
      invalidIds: left.invalidIds + right.invalidIds,
      duplicateIds: [...new Set([...left.duplicateIds, ...right.duplicateIds])].sort(),
      addedExamples: examples(addedIds, maxExamples),
      removedExamples: examples(removedIds, maxExamples),
      changedExamples: examples(changedRecords, maxExamples),
    });
  }

  const summary: SnapshotDiffSummary = {
    added: collections.reduce((sum, entry) => sum + entry.added, 0),
    removed: collections.reduce((sum, entry) => sum + entry.removed, 0),
    changed: collections.reduce((sum, entry) => sum + entry.changed, 0),
    unchanged: collections.reduce((sum, entry) => sum + entry.unchanged, 0),
    invalidIds: collections.reduce((sum, entry) => sum + entry.invalidIds, 0),
    duplicateIds: collections.reduce((sum, entry) => sum + entry.duplicateIds.length, 0),
    watermarkAdvanced: after.manifest.watermark > before.manifest.watermark,
  };

  const beforeIdentity: SnapshotIdentity = {
    snapshotId: before.manifest.snapshotId,
    sourceDatabase: before.manifest.sourceDatabase,
    watermark: before.manifest.watermark,
    collectionCount: before.manifest.collections.length,
    recordCount: before.records.length,
  };
  const afterIdentity: SnapshotIdentity = {
    snapshotId: after.manifest.snapshotId,
    sourceDatabase: after.manifest.sourceDatabase,
    watermark: after.manifest.watermark,
    collectionCount: after.manifest.collections.length,
    recordCount: after.records.length,
  };

  const hash = createHash("sha256");
  hash.update(`${beforeIdentity.snapshotId}|${beforeIdentity.watermark}\n`);
  hash.update(`${afterIdentity.snapshotId}|${afterIdentity.watermark}\n`);
  hash.update(`${summary.added}|${summary.removed}|${summary.changed}|${summary.unchanged}\n`);
  for (const entry of collections) {
    hash.update(`${entry.name}|${entry.beforeCount}|${entry.afterCount}|${entry.added}|${entry.removed}|${entry.changed}|${entry.unchanged}\n`);
  }
  for (const entry of deltaFingerprint) hash.update(`${entry}\n`);

  return { before: beforeIdentity, after: afterIdentity, summary, collections, digest: hash.digest("hex") };
}

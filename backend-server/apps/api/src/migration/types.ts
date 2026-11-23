/** Phase 2 migration artifact types. No production data is read or written by this module. */

export type SourceRecord = Record<string, unknown>;
/** `undefined` is tolerated for intermediate rows that are discarded on rejection; the writer normalizes it to NULL. */
export type TargetRow = Record<string, string | number | null | undefined>;

export interface SourceCollectionReader {
  readonly name: string;
  count(): Promise<number>;
  readBatch(afterId: string | undefined, limit: number): Promise<SourceRecord[]>;
}

export interface SnapshotBatch {
  index: number;
  count: number;
  bytes: number;
  checksum: string;
}

export interface CollectionSnapshot {
  name: string;
  count: number;
  batches: SnapshotBatch[];
}

export interface SnapshotManifest {
  snapshotId: string;
  sourceDatabase: string;
  watermark: string;
  toolVersion: string;
  createdAt: string;
  collections: CollectionSnapshot[];
}

export interface SnapshotSink {
  writeCollection(name: string, batchIndex: number, records: readonly SourceRecord[]): Promise<{ bytes: number; checksum: string }>;
  writeManifest(manifest: SnapshotManifest): Promise<void>;
}

export interface SnapshotSource {
  readCollectionBatches(name: string): AsyncIterable<SourceRecord[]>;
}

export interface TargetWriter {
  write(table: string, rows: readonly TargetRow[]): Promise<void>;
}

/** One source record can map to a root row plus several normalized child rows. */
export interface TargetWrite {
  table: string;
  rows: TargetRow[];
}

export interface MappedRecord {
  writes: TargetWrite[];
  /** True when a critical field failed and the whole source row must not be imported. */
  rejected: boolean;
}

export interface CheckpointStore {
  load(key: string): Promise<Checkpoint | undefined>;
  save(key: string, checkpoint: Checkpoint): Promise<void>;
}

export type QuarantineReason =
  | "INVALID_ID"
  | "INVALID_TIMESTAMP"
  | "NON_INTEGER_MONEY"
  | "NEGATIVE_MONEY"
  | "MONEY_OVERFLOW"
  | "UNKNOWN_ENUM"
  | "INVALID_REFERENCE"
  | "MISSING_REQUIRED"
  | "NON_INTEGER"
  | "NON_FINITE_NUMBER"
  | "OUT_OF_RANGE"
  | "INVALID_BOOLEAN";

export interface QuarantineEntry {
  collection: string;
  rowId?: string;
  field: string;
  reason: QuarantineReason;
  detail: string;
}

export interface CollectionCounts {
  source: number;
  transformed: number;
  quarantined: number;
}

export interface TransformReport {
  snapshotId: string;
  generatedAt: string;
  collections: Record<string, CollectionCounts>;
  quarantine: QuarantineEntry[];
}

export interface Checkpoint {
  snapshotId: string;
  phase: string;
  collection: string;
  status: "pending" | "in_progress" | "complete" | "failed";
  processed: number;
  lastSourceId?: string;
  completedBatches: string[];
  checksum: string;
  updatedAt: string;
}

export interface ValidationCheck {
  domain: string;
  name: string;
  passed: boolean;
  expected?: number | string;
  actual?: number | string;
  detail?: string;
}

export interface ValidationReport {
  snapshotId: string;
  generatedAt: string;
  passed: boolean;
  checks: ValidationCheck[];
}

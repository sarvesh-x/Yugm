/**
 * Read-only, descriptive media inventory used to supply DCR-4 decision inputs.
 *
 * Records are supplied by the caller (for example from a local snapshot export);
 * this module never connects to MongoDB, R2 or any remote service. It deliberately
 * does not assert a public/private bucket policy: that policy is an open owner
 * decision, so visibility is cross-tabulated against bucket instead.
 */
import { createHash } from "node:crypto";

export interface MediaInventoryRecord {
  id: string;
  bucket: string;
  storageKey: string;
  category: string;
  ownerType: string;
  mediaType: string;
  visibility: string;
  processingStatus: string;
  moderationStatus: string;
  fileSize: number;
  checksum?: string;
  deletedAt?: string | null;
  variants?: ReadonlyArray<{ bucket: string; key: string; bytes: number }>;
}

export interface MediaInventoryBucket {
  count: number;
  bytes: number;
  variants: number;
  variantBytes: number;
}

export interface MediaInventoryReport {
  recordCount: number;
  originalBytes: number;
  variantBytes: number;
  totalBytes: number;
  byCategory: Record<string, MediaInventoryBucket>;
  byBucket: Record<string, MediaInventoryBucket>;
  byVisibility: Record<string, MediaInventoryBucket>;
  byOwnerType: Record<string, MediaInventoryBucket>;
  byMediaType: Record<string, MediaInventoryBucket>;
  byBucketVisibility: Record<string, MediaInventoryBucket>;
  processingStatuses: Record<string, number>;
  moderationStatuses: Record<string, number>;
  dataQuality: {
    missingChecksum: number;
    nonPositiveBytes: number;
    deletedRecords: number;
    duplicateStorageKeys: string[];
  };
  /** Stable fingerprint of the input records, excluding generation time. */
  digest: string;
}

function emptyBucket(): MediaInventoryBucket {
  return { count: 0, bytes: 0, variants: 0, variantBytes: 0 };
}

function addOriginal(map: Record<string, MediaInventoryBucket>, key: string, bytes: number) {
  const entry = map[key] ?? (map[key] = emptyBucket());
  entry.count += 1;
  entry.bytes += bytes;
}

/** Variants can live in a different bucket from the original; account for that bucket's usage. */
function addVariant(map: Record<string, MediaInventoryBucket>, key: string, bytes: number) {
  const entry = map[key] ?? (map[key] = emptyBucket());
  entry.variants += 1;
  entry.variantBytes += bytes;
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export function buildMediaInventory(records: readonly MediaInventoryRecord[]): MediaInventoryReport {
  const report: MediaInventoryReport = {
    recordCount: records.length,
    originalBytes: 0,
    variantBytes: 0,
    totalBytes: 0,
    byCategory: {},
    byBucket: {},
    byVisibility: {},
    byOwnerType: {},
    byMediaType: {},
    byBucketVisibility: {},
    processingStatuses: {},
    moderationStatuses: {},
    dataQuality: {
      missingChecksum: 0,
      nonPositiveBytes: 0,
      deletedRecords: 0,
      duplicateStorageKeys: [],
    },
    digest: "",
  };

  const seenKeys = new Map<string, number>();
  for (const record of records) {
    const variants = record.variants ?? [];
    const variantBytes = variants.reduce((sum, variant) => sum + variant.bytes, 0);
    report.originalBytes += record.fileSize;
    report.variantBytes += variantBytes;

    addOriginal(report.byCategory, record.category, record.fileSize);
    addOriginal(report.byBucket, record.bucket, record.fileSize);
    addOriginal(report.byVisibility, record.visibility, record.fileSize);
    addOriginal(report.byOwnerType, record.ownerType, record.fileSize);
    addOriginal(report.byMediaType, record.mediaType, record.fileSize);
    addOriginal(report.byBucketVisibility, `${record.bucket}|${record.visibility}`, record.fileSize);
    for (const variant of variants) {
      addVariant(report.byCategory, record.category, variant.bytes);
      addVariant(report.byBucket, variant.bucket, variant.bytes);
      addVariant(report.byVisibility, record.visibility, variant.bytes);
      addVariant(report.byOwnerType, record.ownerType, variant.bytes);
      addVariant(report.byMediaType, record.mediaType, variant.bytes);
      addVariant(report.byBucketVisibility, `${variant.bucket}|${record.visibility}`, variant.bytes);
    }
    increment(report.processingStatuses, record.processingStatus);
    increment(report.moderationStatuses, record.moderationStatus);

    if (!record.checksum) report.dataQuality.missingChecksum += 1;
    if (!Number.isSafeInteger(record.fileSize) || record.fileSize <= 0) report.dataQuality.nonPositiveBytes += 1;
    if (record.deletedAt) report.dataQuality.deletedRecords += 1;

    const storageKey = `${record.bucket}/${record.storageKey}`;
    seenKeys.set(storageKey, (seenKeys.get(storageKey) ?? 0) + 1);
    for (const variant of variants) {
      const variantKey = `${variant.bucket}/${variant.key}`;
      seenKeys.set(variantKey, (seenKeys.get(variantKey) ?? 0) + 1);
    }
  }

  report.totalBytes = report.originalBytes + report.variantBytes;
  report.dataQuality.duplicateStorageKeys = [...seenKeys]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();

  const hash = createHash("sha256");
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(
      [record.id, record.bucket, record.storageKey, record.fileSize, record.checksum ?? "", record.visibility].join("|") + "\n"
    );
  }
  report.digest = hash.digest("hex");
  return report;
}

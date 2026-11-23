/**
 * Read-only derivation of DCR-2 metric fields from an exported snapshot.
 *
 * This module never connects to MongoDB, D1, R2 or any remote service. It fills
 * only fields a snapshot can honestly provide and marks every other field as
 * not derivable, with the reason. Binary-looking fields are reported for owner
 * review; they are stripped only when the owner supplies an explicit glob or
 * opts into the built-in detector. Derived values are evidence about the
 * snapshot, not a DCR-2 acceptance decision.
 */
import { readDeclaredSnapshotRecords, stableStringify } from "./snapshot.js";

export interface BinaryCandidate {
  path: string;
  kind: "base64-string" | "byte-array";
  occurrences: number;
  bytes: number;
}

export interface FieldProvenance {
  field: string;
  status: "derived" | "not-derivable";
  source: string;
  detail: string;
}

export interface DerivedMetricsReport {
  metrics: {
    snapshotId: string | null;
    sourceEnvironment: string | null;
    collectedAt: string | null;
    workersPaid: boolean | null;
    relationalBytes: number | null;
    indexBytes: number | null;
    projected12MonthTotalBytes: number | null;
    largestRowBytes: number | null;
    binariesInD1Bytes: number | null;
    largestStatementBytes: number | null;
    maxBoundParameters: number | null;
    largestQueryResultBytes: number | null;
    p99QueryDurationMs: number | null;
    averageWriteDurationMs: number | null;
    peakWritesPerSecond: number | null;
    peakQueriesPerInvocation: number | null;
  };
  provenance: FieldProvenance[];
  binaryCandidates: BinaryCandidate[];
  reconciliation: {
    manifestBytes: number;
    recomputedFullBytes: number;
    relationalBytes: number;
    binaryBytesStripped: number;
    recordCount: number;
    collectionCount: number;
  };
}

export interface DerivationOptions {
  /** Glob patterns matched against "<collection>.<dot.path>", e.g. "media.*.buffer". */
  stripFields?: string[];
  /** Auto-strip built-in base64/byte-array candidates. Off by default to avoid stripping legitimate text. */
  detectBinaryLike?: boolean;
}

const NOT_DERIVABLE: Array<[keyof DerivedMetricsReport["metrics"], string, string]> = [
  ["workersPaid", "Cloudflare plan / billing", "Owner must confirm Workers Paid is approved and configured."],
  ["indexBytes", "MongoDB index statistics", "Indexes are not part of an exported snapshot; use db.stats().indexSize."],
  ["projected12MonthTotalBytes", "Growth trend / capacity:projection", "A single snapshot has no growth trend; cross-check two snapshots with capacity:projection."],
  ["binariesInD1Bytes", "Design invariant", "Target is 0 after media moves to R2; not a snapshot measurement."],
  ["largestStatementBytes", "Query logs / generated SQL", "Not derivable from exported records; estimate from generated DDL and query shapes."],
  ["maxBoundParameters", "Generated D1 writer / query code", "The D1 writer caps at 100 parameters; confirm from code, not snapshot."],
  ["largestQueryResultBytes", "Query observations / APM", "Not derivable from exported records; use capacity:queries observations."],
  ["p99QueryDurationMs", "Monitoring / slow query log", "Not derivable from a snapshot; use APM or MongoDB profiler."],
  ["averageWriteDurationMs", "Application instrumentation", "Not derivable from a snapshot; measure write latency."],
  ["peakWritesPerSecond", "Monitoring (mongostat / Atlas Metrics)", "Not derivable from a snapshot; measure peak write rate."],
  ["peakQueriesPerInvocation", "Request tracing / code analysis", "Not derivable from a snapshot; count DB queries per request."],
];

function matchesPattern(target: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^.]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(target);
}

function looksBinary(value: unknown): BinaryCandidate["kind"] | null {
  if (typeof value === "string") {
    return value.length >= 64 && /^[A-Za-z0-9+/=\r\n]+$/.test(value) ? "base64-string" : null;
  }
  if (Array.isArray(value) && value.length >= 32) {
    return value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255) ? "byte-array" : null;
  }
  return null;
}

function collectCandidates(value: unknown, path: string, out: Map<string, BinaryCandidate>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, `${path}.${index}`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectCandidates(item, `${path}.${key}`, out);
    return;
  }
  const kind = looksBinary(value);
  if (!kind) return;
  const bytes = Buffer.byteLength(stableStringify(value), "utf8");
  const existing = out.get(path);
  if (existing) {
    existing.occurrences += 1;
    existing.bytes += bytes;
  } else {
    out.set(path, { path, kind, occurrences: 1, bytes });
  }
}

function stripFields(value: unknown, path: string, shouldStrip: (path: string) => boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => stripFields(item, `${path}.${index}`, shouldStrip));
  }
  if (value && typeof value === "object") {
    const stripped: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (shouldStrip(childPath)) continue;
      stripped[key] = stripFields(item, childPath, shouldStrip);
    }
    return stripped;
  }
  return value;
}

export async function deriveMetricsFromSnapshot(
  directory: string,
  options: DerivationOptions = {}
): Promise<DerivedMetricsReport> {
  const { manifest, records } = await readDeclaredSnapshotRecords(directory);

  const globalCandidates = new Map<string, BinaryCandidate>();
  for (const { collection, record } of records) {
    collectCandidates(record, collection, globalCandidates);
  }
  const candidatePaths = new Set([...globalCandidates.keys()].map((path) => {
    // A candidate path includes the concrete collection prefix; match its relative tail too.
    return path.replace(/^[^.]+\./, "");
  }));

  const patterns = options.stripFields ?? [];
  const shouldStrip = (path: string): boolean => {
    if (patterns.some((pattern) => matchesPattern(path, pattern))) return true;
    if (!options.detectBinaryLike) return false;
    const relative = path.replace(/^[^.]+\./, "");
    return candidatePaths.has(relative) || globalCandidates.has(path);
  };

  let relationalBytes = 0;
  let recomputedFullBytes = 0;
  let binaryBytesStripped = 0;
  let largestRowBytes = 0;

  for (const { collection, record } of records) {
    const full = Buffer.byteLength(stableStringify(record), "utf8");
    const stripped = stripFields(record, collection, shouldStrip);
    const kept = Buffer.byteLength(stableStringify(stripped), "utf8");
    recomputedFullBytes += full;
    relationalBytes += kept;
    binaryBytesStripped += Math.max(0, full - kept);
    if (kept > largestRowBytes) largestRowBytes = kept;
  }

  // FileSystemSnapshotStore joins records with "\n", so manifest bytes include
  // (count - 1) separators per batch. Count them so reconciliation is exact.
  const separatorBytes = manifest.collections.reduce(
    (total, collection) => total + collection.batches.reduce(
      (sum, batch) => sum + Math.max(0, batch.count - 1), 0),
    0
  );
  recomputedFullBytes += separatorBytes;
  relationalBytes += separatorBytes;

  const manifestBytes = manifest.collections.reduce(
    (total, collection) => total + collection.batches.reduce((sum, batch) => sum + batch.bytes, 0),
    0
  );

  const provenance: FieldProvenance[] = [
    { field: "snapshotId", status: "derived", source: "snapshot-manifest.json", detail: "Snapshot identifier from the manifest." },
    { field: "sourceEnvironment", status: "derived", source: "snapshot-manifest.json", detail: "sourceDatabase label only; no connection string." },
    { field: "collectedAt", status: "derived", source: "snapshot-manifest.json", detail: "Manifest watermark (UTC)." },
    { field: "relationalBytes", status: "derived", source: "declared snapshot batches", detail: "Serialised record bytes after configured binary fields are stripped." },
    { field: "largestRowBytes", status: "derived", source: "declared snapshot batches", detail: "Largest single record after configured binary fields are stripped." },
    ...NOT_DERIVABLE.map(([field, source, detail]) => ({ field: field as string, status: "not-derivable" as const, source, detail })),
  ];

  return {
    metrics: {
      snapshotId: manifest.snapshotId,
      sourceEnvironment: manifest.sourceDatabase,
      collectedAt: manifest.watermark,
      workersPaid: null,
      relationalBytes,
      indexBytes: null,
      projected12MonthTotalBytes: null,
      largestRowBytes: records.length ? largestRowBytes : null,
      binariesInD1Bytes: null,
      largestStatementBytes: null,
      maxBoundParameters: null,
      largestQueryResultBytes: null,
      p99QueryDurationMs: null,
      averageWriteDurationMs: null,
      peakWritesPerSecond: null,
      peakQueriesPerInvocation: null,
    },
    provenance,
    binaryCandidates: [...globalCandidates.values()].sort((a, b) => b.bytes - a.bytes),
    reconciliation: {
      manifestBytes,
      recomputedFullBytes,
      relationalBytes,
      binaryBytesStripped,
      recordCount: records.length,
      collectionCount: manifest.collections.length,
    },
  };
}

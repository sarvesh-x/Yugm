/**
 * Read-only screening of D1 capacity metrics against documented hard limits.
 *
 * This module never connects to MongoDB, D1, Cloudflare or any remote service.
 * The caller supplies aggregates from an approved export or monitoring source.
 * A passing result means only that no documented hard limit was exceeded; it is
 * NOT DCR-2 acceptance, because comfort, throughput headroom, query shape,
 * recovery and billing still require owner review.
 */
import { ValidationReportBuilder } from "./validate.js";
import type { ValidationReport } from "./types.js";

/** Cloudflare documents MB/GB/KB in decimal units; keep conversions explicit. */
const KB = 1_000;
const MB = 1_000_000;
const GB = 1_000_000_000;

export const D1_HARD_LIMITS = {
  paidDatabaseBytes: 10 * GB,
  freeDatabaseBytes: 500 * MB,
  rowBytes: 2 * MB,
  statementBytes: 100 * KB,
  boundParameters: 100,
  queryResultBytes: 50 * MB,
  queryDurationMs: 30_000,
  queriesPerInvocationFree: 50,
  queriesPerInvocationPaid: 1_000,
} as const;

export interface D1CapacityMetrics {
  snapshotId: string;
  sourceEnvironment: string;
  collectedAt: string;
  workersPaid: boolean;
  relationalBytes: number;
  indexBytes: number;
  projected12MonthTotalBytes: number;
  largestRowBytes: number;
  binariesInD1Bytes: number;
  largestStatementBytes: number;
  maxBoundParameters: number;
  largestQueryResultBytes: number;
  p99QueryDurationMs: number;
  averageWriteDurationMs: number;
  peakWritesPerSecond: number;
  peakQueriesPerInvocation: number;
}

export interface CapacityReviewItem {
  id: string;
  statement: string;
  measurement: string;
}

export interface D1CapacityReport extends ValidationReport {
  sourceEnvironment: string;
  workersPaid: boolean;
  currentTotalBytes: number;
  projectedTotalBytes: number;
  estimatedWriteQps: number | null;
  requiredWriteQps: number;
  throughputRatio: number | null;
  /** Alias for `passed` with a name that cannot be mistaken for DCR-2 acceptance. */
  hardGatesPassed: boolean;
  reviewItems: CapacityReviewItem[];
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a finite, non-negative number`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

export function parseD1CapacityMetrics(value: unknown): D1CapacityMetrics {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("metrics must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  return {
    snapshotId: readString(record, "snapshotId"),
    sourceEnvironment: readString(record, "sourceEnvironment"),
    collectedAt: readString(record, "collectedAt"),
    workersPaid: readBoolean(record, "workersPaid"),
    relationalBytes: readNumber(record, "relationalBytes"),
    indexBytes: readNumber(record, "indexBytes"),
    projected12MonthTotalBytes: readNumber(record, "projected12MonthTotalBytes"),
    largestRowBytes: readNumber(record, "largestRowBytes"),
    binariesInD1Bytes: readNumber(record, "binariesInD1Bytes"),
    largestStatementBytes: readNumber(record, "largestStatementBytes"),
    maxBoundParameters: readNumber(record, "maxBoundParameters"),
    largestQueryResultBytes: readNumber(record, "largestQueryResultBytes"),
    p99QueryDurationMs: readNumber(record, "p99QueryDurationMs"),
    averageWriteDurationMs: readNumber(record, "averageWriteDurationMs"),
    peakWritesPerSecond: readNumber(record, "peakWritesPerSecond"),
    peakQueriesPerInvocation: readNumber(record, "peakQueriesPerInvocation"),
  };
}

export function evaluateD1CapacityGates(metrics: D1CapacityMetrics): D1CapacityReport {
  const currentTotalBytes = metrics.relationalBytes + metrics.indexBytes;
  const builder = new ValidationReportBuilder();

  const projectionValid = metrics.projected12MonthTotalBytes >= currentTotalBytes;
  builder.assert(
    "capacity",
    "projection-not-below-current",
    projectionValid,
    projectionValid ? undefined : `projected ${metrics.projected12MonthTotalBytes} is below current ${currentTotalBytes}`
  );
  builder.assert(
    "capacity",
    "database-size-hard-limit",
    Math.max(currentTotalBytes, metrics.projected12MonthTotalBytes) <= D1_HARD_LIMITS.paidDatabaseBytes,
    `current ${currentTotalBytes}, projected ${metrics.projected12MonthTotalBytes}, limit ${D1_HARD_LIMITS.paidDatabaseBytes}`
  );
  builder.assert(
    "capacity",
    "workers-paid",
    metrics.workersPaid,
    "ADR-0001 requires Workers Paid before production traffic uses D1"
  );
  if (!metrics.workersPaid) {
    builder.assert(
      "capacity",
      "free-database-size",
      currentTotalBytes <= D1_HARD_LIMITS.freeDatabaseBytes,
      `current ${currentTotalBytes}, Free limit ${D1_HARD_LIMITS.freeDatabaseBytes}`
    );
  }
  builder.assert(
    "capacity",
    "row-size",
    metrics.largestRowBytes <= D1_HARD_LIMITS.rowBytes,
    `largest row ${metrics.largestRowBytes}, limit ${D1_HARD_LIMITS.rowBytes}`
  );
  builder.assert(
    "capacity",
    "binary-data-in-r2-only",
    metrics.binariesInD1Bytes === 0,
    `D1 must hold relational state only; found ${metrics.binariesInD1Bytes} binary bytes`
  );
  builder.assert(
    "capacity",
    "statement-size",
    metrics.largestStatementBytes <= D1_HARD_LIMITS.statementBytes,
    `largest statement ${metrics.largestStatementBytes}, limit ${D1_HARD_LIMITS.statementBytes}`
  );
  builder.assert(
    "capacity",
    "bound-parameters",
    metrics.maxBoundParameters <= D1_HARD_LIMITS.boundParameters,
    `max bound parameters ${metrics.maxBoundParameters}, limit ${D1_HARD_LIMITS.boundParameters}`
  );
  builder.assert(
    "capacity",
    "query-result-size",
    metrics.largestQueryResultBytes <= D1_HARD_LIMITS.queryResultBytes,
    `largest result ${metrics.largestQueryResultBytes}, limit ${D1_HARD_LIMITS.queryResultBytes}`
  );
  builder.assert(
    "capacity",
    "query-duration",
    metrics.p99QueryDurationMs <= D1_HARD_LIMITS.queryDurationMs,
    `p99 ${metrics.p99QueryDurationMs} ms, limit ${D1_HARD_LIMITS.queryDurationMs} ms`
  );
  const queriesPerInvocationLimit = metrics.workersPaid
    ? D1_HARD_LIMITS.queriesPerInvocationPaid
    : D1_HARD_LIMITS.queriesPerInvocationFree;
  builder.assert(
    "capacity",
    "queries-per-invocation",
    metrics.peakQueriesPerInvocation <= queriesPerInvocationLimit,
    `peak ${metrics.peakQueriesPerInvocation}, limit ${queriesPerInvocationLimit}`
  );

  const estimatedWriteQps = metrics.averageWriteDurationMs > 0
    ? 1_000 / metrics.averageWriteDurationMs
    : null;
  const throughputRatio = estimatedWriteQps !== null && metrics.peakWritesPerSecond > 0
    ? estimatedWriteQps / metrics.peakWritesPerSecond
    : null;
  const utilisation = metrics.projected12MonthTotalBytes / D1_HARD_LIMITS.paidDatabaseBytes;

  const reviewItems: CapacityReviewItem[] = [
    {
      id: "size-comfort",
      statement: "The 12-month projection must fit comfortably below 10 GB, not merely under the hard limit.",
      measurement: `projected ${metrics.projected12MonthTotalBytes} bytes = ${(utilisation * 100).toFixed(2)}% of the hard limit`,
    },
    {
      id: "write-throughput-headroom",
      statement: "Peak writes must fit single-database throughput with substantial headroom.",
      measurement: estimatedWriteQps === null
        ? "averageWriteDurationMs is 0; throughput cannot be estimated"
        : `estimated ${estimatedWriteQps.toFixed(2)} QPS vs peak ${metrics.peakWritesPerSecond} QPS (ratio ${throughputRatio === null ? "n/a" : throughputRatio.toFixed(2)})`,
    },
    {
      id: "indexed-query-shape",
      statement: "Top queries, indexes, rows scanned and slow-query evidence must show queries stay well below 30 s and 50 MB.",
      measurement: "hard limits screened only; query-shape evidence not evaluated",
    },
    {
      id: "growth-and-retention",
      statement: "30/90/180-day growth and retention policy must support the 12-month projection.",
      measurement: "projection supplied as an aggregate; growth evidence not evaluated",
    },
    {
      id: "recovery-and-billing",
      statement: "Exports plus Time Travel, a rehearsed restore, and rows read/written billing must be reviewed separately.",
      measurement: "not evaluated by this screener",
    },
  ];

  const report = builder.report(metrics.snapshotId);
  return {
    ...report,
    sourceEnvironment: metrics.sourceEnvironment,
    workersPaid: metrics.workersPaid,
    currentTotalBytes,
    projectedTotalBytes: metrics.projected12MonthTotalBytes,
    estimatedWriteQps,
    requiredWriteQps: metrics.peakWritesPerSecond,
    throughputRatio,
    hardGatesPassed: report.passed,
    reviewItems,
  };
}

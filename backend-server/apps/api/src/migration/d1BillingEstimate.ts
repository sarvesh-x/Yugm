/**
 * Read-only D1 billing estimate for DCR-2 evidence.
 *
 * Uses caller-supplied query observations and capacity metrics. It never
 * connects to MongoDB, D1, Cloudflare or any billing API. Values are screening
 * estimates, not invoices or acceptance decisions.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseD1CapacityMetrics, type D1CapacityMetrics } from "./d1CapacityGate.js";
import { readQueryProfileInput } from "./queryProfileAudit.js";

/** Paid inclusions from docs/infrastructure/cloudflare-platform-limits.md. */
export const D1_PAID_INCLUSIONS = {
  rowsReadPerMonth: 25_000_000_000,
  rowsWrittenPerMonth: 50_000_000,
  storageBytes: 5_000_000_000,
} as const;

const MINUTES_PER_MONTH = 60 * 24 * 30;

export interface BillingEstimateReport {
  source: string;
  observationCount: number;
  rowsReadPerMonth: number;
  rowsWrittenPerMonthUpperBound: number;
  currentStorageBytes: number;
  withinIncludedReads: boolean;
  withinIncludedWrites: boolean;
  withinIncludedStorage: boolean;
  estimatedReadOverage: number;
  estimatedWriteOverage: number;
  estimatedStorageOverageBytes: number;
  reviewItems: Array<{ id: string; statement: string }>;
  digest: string;
}

export function estimateD1Billing(
  observations: readonly { frequencyPerMinute: number; rowsScanned: number }[],
  metrics: D1CapacityMetrics,
  source: string
): BillingEstimateReport {
  const rowsReadPerMinute = observations.reduce(
    (sum, record) => sum + record.frequencyPerMinute * record.rowsScanned,
    0
  );
  const rowsReadPerMonth = rowsReadPerMinute * MINUTES_PER_MONTH;
  const rowsWrittenPerMonthUpperBound = metrics.peakWritesPerSecond * MINUTES_PER_MONTH;
  const currentStorageBytes = metrics.relationalBytes + metrics.indexBytes;

  const estimatedReadOverage = Math.max(0, rowsReadPerMonth - D1_PAID_INCLUSIONS.rowsReadPerMonth);
  const estimatedWriteOverage = Math.max(0, rowsWrittenPerMonthUpperBound - D1_PAID_INCLUSIONS.rowsWrittenPerMonth);
  const estimatedStorageOverageBytes = Math.max(0, currentStorageBytes - D1_PAID_INCLUSIONS.storageBytes);

  const hash = createHash("sha256");
  hash.update(`${source}|${metrics.snapshotId}|${observations.length}\n`);
  hash.update(`${rowsReadPerMonth}|${rowsWrittenPerMonthUpperBound}|${currentStorageBytes}\n`);
  for (const record of [...observations].sort((a, b) => a.frequencyPerMinute - b.frequencyPerMinute)) {
    hash.update(`${record.frequencyPerMinute}|${record.rowsScanned}\n`);
  }

  return {
    source,
    observationCount: observations.length,
    rowsReadPerMonth,
    rowsWrittenPerMonthUpperBound,
    currentStorageBytes,
    withinIncludedReads: estimatedReadOverage === 0,
    withinIncludedWrites: estimatedWriteOverage === 0,
    withinIncludedStorage: estimatedStorageOverageBytes === 0,
    estimatedReadOverage,
    estimatedWriteOverage,
    estimatedStorageOverageBytes,
    reviewItems: [
      {
        id: "peak-vs-average-writes",
        statement: "Rows written use peak write rate as an upper bound; confirm average writes and index amplification with monitoring.",
      },
      {
        id: "read-amplification",
        statement: "Rows scanned may undercount joins, index maintenance and admin queries; confirm against D1 billing after a staging replay.",
      },
      {
        id: "retention-storage",
        statement: "Storage estimate excludes Time Travel growth and backup snapshots; confirm retention and backup policy separately.",
      },
    ],
    digest: hash.digest("hex"),
  };
}

export async function readBillingInputs(
  queriesFile: string,
  metricsFile: string
): Promise<{ observations: Array<{ frequencyPerMinute: number; rowsScanned: number }>; metrics: D1CapacityMetrics; source: string }> {
  const queries = await readQueryProfileInput(queriesFile);
  const rawMetrics = JSON.parse(await readFile(path.resolve(metricsFile), "utf8")) as unknown;
  return {
    observations: queries.records,
    metrics: parseD1CapacityMetrics(rawMetrics),
    source: queries.source,
  };
}
